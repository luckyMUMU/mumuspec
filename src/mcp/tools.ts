/**
 * MCP tool registry — tool definitions + handlers.
 *
 * Extracted from mcp-server.ts (Phase 1): the server file keeps transport
 * concerns only; every tool handler is a thin adapter over domain functions,
 * shared with the CLI layer.
 */
import { findProjectRoot, isPathSafe } from '../core/utils.js';
import { loadConfig } from '../core/config.js';
import { resolve, isAbsolute } from 'node:path';
import { existsSync } from 'node:fs';

// Spec
import { loadSpecContext, searchSpecs, getProhibitions } from '../spec/loader.js';
import { validateAllSpecs } from '../spec/validator.js';

// Change
import { loadChangeState, listActiveChanges, getActiveChange } from '../change/manager.js';
import { getValidTransitions, getNextPhase, activateProjectWorkflow } from '../change/state-machine.js';

// Guard
import { checkCompliance, detectDrift } from '../guard/checker.js';
import { runPhaseGuard } from '../guard/phase-guard.js';

// Knowledge
import { getKnowledgePage, knowledgeSearch, getKnowledgeContext, verifyKnowledge, analyzeImpact, generateOnboardingPath, analyzeCoverage, answerQuery } from '../knowledge/manager.js';

// Code Graph
import { getCachedCodeGraph } from '../knowledge/graph-builder.js';
import { searchNodes, tracePath, getStructure, getGraphStats } from '../knowledge/code-graph.js';

// Contract Layer
import { loadAllContracts, findAllBoundaryDocuments } from '../contract/loader.js';
import { detectContractDrift, validateBoundaries } from '../contract/validator.js';
import { analyzeContractImpact, formatImpactReport } from '../contract/impact-analyzer.js';
import { persistContract, deprecateContract, removeContract, readAuditLog, scaffoldBoundary, writeBoundary } from '../contract/manager.js';
import { formatError } from '../core/errors.js';
import type { Contract, BoundaryDocument } from '../core/types-contract.js';

function getRoot(): string {
  const envRoot = process.env.MUMUSPEC_ROOT;
  if (envRoot && existsSync(envRoot)) {
    return resolve(envRoot);
  }
  const found = findProjectRoot();
  if (!found) {
    throw new Error('MumuSpec not initialized. Run `mumuspec init` first.');
  }
  return found;
}

/** Tool definitions */
const TOOLS = [
  // ═══════════════════════════════════════════════════════════════
  // Spec Context
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'get_spec_context',
    description: 'Get tree-distributed spec context for a directory (progressive disclosure)',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path relative to project root' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_specs',
    description: 'Search specifications by keyword, scope, or type',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        scope: { type: 'string' },
        type: { type: 'string', enum: ['shall', 'shall-not'] },
      },
    },
  },
  {
    name: 'get_prohibitions',
    description: 'Get SHALL NOT prohibitions for a scope (including inherited)',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
      },
      required: ['path'],
    },
  },
  {
    name: 'get_design_context',
    description: 'Get design document context for a directory',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path' },
      },
      required: ['path'],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Guard
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'check_compliance',
    description: 'Check code compliance against specs (SHALL/SHALL NOT/Ponytail)',
    inputSchema: {
      type: 'object',
      properties: {
        shall: { type: 'boolean' },
        shallNot: { type: 'boolean' },
        ponytail: { type: 'boolean' },
      },
    },
  },
  {
    name: 'detect_drift',
    description: 'Detect drift between specs and code',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'guard_check',
    description: 'Run phase guard check for a change',
    inputSchema: {
      type: 'object',
      properties: {
        change: { type: 'string' },
        phase: { type: 'string', enum: ['design', 'build', 'verify', 'archive-in-progress'] },
      },
      required: ['change', 'phase'],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Change
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'get_change_status',
    description: 'Get change status and state machine info',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Change name (omit for active change)' },
      },
    },
  },
  {
    name: 'list_changes',
    description: 'List all active changes',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Knowledge
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'get_knowledge_context',
    description: 'Get knowledge context for a code path (progressive loading)',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_knowledge',
    description: 'Search knowledge pages by keyword, tag, or type',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: { type: 'string' },
        tag: { type: 'string' },
        type: { type: 'string', enum: ['decision', 'pattern', 'risk', 'rationale', 'lesson'] },
      },
    },
  },
  {
    name: 'get_knowledge_page',
    description: 'Get a knowledge page by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'verify_knowledge',
    description: 'Verify knowledge page freshness',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        all: { type: 'boolean' },
      },
    },
  },

  // Understand-A Style Knowledge Tools
  {
    name: 'analyze_impact',
    description: 'Analyze change impact with knowledge correlation (UA-style)',
    inputSchema: {
      type: 'object',
      properties: {
        diff_range: { type: 'string', description: 'Git diff range (e.g., "HEAD~3..HEAD")' },
        scope: { type: 'string', description: 'Limit analysis to scope path' },
        include_knowledge_warnings: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'generate_onboarding_path',
    description: 'Generate a guided learning path for a codebase scope (UA-style)',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Code scope path' },
        role: { type: 'string', enum: ['junior', 'mid', 'senior', 'pm'], default: 'junior' },
      },
      required: ['scope'],
    },
  },
  {
    name: 'get_knowledge_coverage',
    description: 'Get knowledge coverage statistics for a scope (UA-style)',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Limit to scope path' },
      },
    },
  },
  {
    name: 'find_knowledge_gaps',
    description: 'Find important code nodes without knowledge coverage (UA-style)',
    inputSchema: {
      type: 'object',
      properties: {
        scope: { type: 'string', description: 'Limit to scope path' },
        min_importance: { type: 'number', default: 5 },
      },
    },
  },
  {
    name: 'detect_decision_deviation',
    description: 'Detect if code changes deviate from confirmed decisions (UA-style)',
    inputSchema: {
      type: 'object',
      properties: {
        changed_files: { type: 'array', items: { type: 'string' }, description: 'List of changed file paths' },
      },
      required: ['changed_files'],
    },
  },
  {
    name: 'query_knowledge',
    description: 'Ask questions about the project using the knowledge base (Chat)',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Question or keyword to search in knowledge base' },
      },
      required: ['query'],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Contract Layer (NEW — SDK v1.30 upgrade)
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'list_contracts',
    description: 'List all registered external contracts',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by category (api, database, sdk, cli, messaging, serialization, filesystem, config)' },
        status: { type: 'string', description: 'Filter by status (draft, active, deprecated, retired)' },
        direction: { type: 'string', enum: ['all', 'outbound', 'inbound'], description: 'Filter by direction' },
      },
    },
  },
  {
    name: 'get_contract',
    description: 'Get detailed contract information by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contract ID (e.g., "API-001")' },
      },
      required: ['id'],
    },
  },
  {
    name: 'detect_contract_drift',
    description: 'Run contract drift detection — validates contracts against actual code',
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'Limit drift check to specific contract ID (omit for all)' },
      },
    },
  },
  {
    name: 'list_boundaries',
    description: 'List all BOUNDARY.md documents in the project',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Limit to specific directory' },
      },
    },
  },
  {
    name: 'check_boundaries',
    description: 'Validate boundary documents against actual code implementation',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Limit to specific directory (omit for all)' },
      },
    },
  },
  {
    name: 'full_drift_report',
    description: 'Run comprehensive drift detection: spec drift + contract drift + boundary validation',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'analyze_contract_impact',
    description: 'Analyze the impact of a proposed contract change (upstream/downstream)',
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'Contract ID to analyze' },
        change_type: { type: 'string', enum: ['modify', 'remove', 'deprecate'], description: 'Type of proposed change' },
      },
      required: ['contract_id', 'change_type'],
    },
  },
  {
    name: 'get_contract_audit',
    description: 'Get contract audit log (history of contract changes)',
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'Filter by contract ID (omit for all)' },
        limit: { type: 'number', description: 'Max entries to return', default: 20 },
      },
    },
  },
  {
    name: 'scaffold_boundary',
    description: 'Auto-generate BOUNDARY.md from code analysis for a directory',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Directory path (absolute or relative to project root)' },
        dry_run: { type: 'boolean', description: 'Preview without writing', default: false },
      },
      required: ['dir'],
    },
  },
  {
    name: 'persist_contract',
    description: 'Create or update a contract in the registry (writes to contracts.yaml)',
    inputSchema: {
      type: 'object',
      properties: {
        contract: {
          type: 'object',
          description: 'Full contract object (id, name, category, criticality, status, version, owner, description, upstream, downstream, schema, examples)',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string', enum: ['api', 'database', 'messaging', 'serialization', 'sdk', 'cli', 'filesystem', 'config'] },
            criticality: { type: 'string', enum: ['critical', 'standard', 'low'] },
            status: { type: 'string', enum: ['draft', 'active', 'deprecated', 'retired'] },
            version: { type: 'string' },
          },
          required: ['id', 'name', 'category', 'criticality', 'status', 'version'],
        },
      },
      required: ['contract'],
    },
  },
  {
    name: 'deprecate_contract',
    description: 'Deprecate a contract with impact analysis',
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'Contract ID to deprecate' },
        migration_path: { type: 'string', description: 'Optional migration guidance for consumers' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'remove_contract',
    description: 'Remove a contract (blocked if upstream consumers exist)',
    inputSchema: {
      type: 'object',
      properties: {
        contract_id: { type: 'string', description: 'Contract ID to remove' },
      },
      required: ['contract_id'],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Code Graph (NEW — 0.20.0+)
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'code_graph_search',
    description: 'Search the code graph for symbols (functions, classes, files) by name',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Symbol name or file path to search for' },
        limit: { type: 'number', description: 'Max results (default 20)', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'code_graph_trace',
    description: 'Trace a call chain from a starting symbol (BFS traversal of CALLS edges)',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Starting symbol name' },
        file_path: { type: 'string', description: 'File path to disambiguate (optional)' },
        max_depth: { type: 'number', description: 'Max traversal depth (default 5)', default: 5 },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'code_graph_structure',
    description: 'Get directory-level structure summary from the code graph',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Directory path relative to project root' },
      },
      required: ['dir'],
    },
  },

  // ═══════════════════════════════════════════════════════════════
  // Validate
  // ═══════════════════════════════════════════════════════════════
  {
    name: 'validate_specs',
    description: 'Validate all spec file formats',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/**
 * Validate a path argument for MCP tools.
 * Returns an error string if validation fails, null if safe.
 */
function validateToolPath(root: string, path: string): string | null {
  if (!isPathSafe(path, root)) {
    return `Path traversal detected: "${path}" is outside project root. Refusing to process.`;
  }
  return null;
}

// Code graph cache moved to knowledge/graph-builder.ts (getCachedCodeGraph)

/** Handle tool calls */
export async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const root = getRoot();
  const config = loadConfig(root);

// Validate path arguments upfront for tools that accept filesystem paths
const PATH_TOOLS: Record<string, string> = {
  get_spec_context: 'path',
  get_prohibitions: 'path',
  get_design_context: 'path',
  get_knowledge_context: 'path',
  list_boundaries: 'dir',
  check_boundaries: 'dir',
  scaffold_boundary: 'dir',
  code_graph_structure: 'dir',
};
const pathArgName = PATH_TOOLS[name];
if (pathArgName) {
  const rawPath = args[pathArgName] as string;
  if (rawPath) {
    const error = validateToolPath(root, rawPath);
    if (error) return { error };
  }
}

// Validate scope arguments for knowledge tools (used for filtering, not file access)
const SCOPE_TOOLS: Record<string, string> = {
  generate_onboarding_path: 'scope',
  get_knowledge_coverage: 'scope',
  find_knowledge_gaps: 'scope',
};
const scopeArgName = SCOPE_TOOLS[name];
if (scopeArgName) {
  const rawScope = args[scopeArgName] as string;
  if (rawScope) {
    // Scope is used for string prefix matching, not file access, but still reject traversal patterns
    if (rawScope.includes('..') || isAbsolute(rawScope)) {
      return { error: `Invalid scope: "${rawScope}" contains illegal path patterns` };
    }
  }
}

  switch (name) {
    // ── Spec Context ──
    case 'get_spec_context': {
      const targetPath = resolve(root, args.path as string);
      const context = loadSpecContext(targetPath, root, config);
      return {
        targetPath,
        layers: context.layers.map((l) => ({
          level: l.level,
          scope: l.scope,
          spec: l.spec ? {
            requirements: l.spec.requirements.map((r) => ({
              name: r.name,
              shall: r.shall,
              shallNot: r.shallNot,
              enforcement: r.enforcement,
            })),
          } : undefined,
          hasDesign: !!l.design,
        })),
        prohibitions: context.prohibitions,
      };
    }

    case 'search_specs': {
      const results = searchSpecs(root, {
        keyword: args.keyword as string,
        scope: args.scope as string,
        type: args.type as 'shall' | 'shall-not',
      });
      return { results };
    }

    case 'get_prohibitions': {
      const targetPath = resolve(root, args.path as string);
      const prohibitions = getProhibitions(root, targetPath);
      return { prohibitions };
    }

    case 'get_design_context': {
      const targetPath = resolve(root, args.path as string);
      const context = loadSpecContext(targetPath, root, config);
      const designs = context.layers
        .filter((l) => l.design)
        .map((l) => ({
          level: l.level,
          scope: l.scope,
          content: l.design!.content.substring(0, 2000),
        }));
      return { designs };
    }

    // ── Guard ──
    case 'check_compliance': {
      const result = checkCompliance(root, {
        shall: args.shall as boolean,
        shallNot: args.shallNot as boolean,
        ponytail: args.ponytail as boolean,
      });
      return result;
    }

    case 'detect_drift': {
      const results = detectDrift(root);
      return { drifts: results };
    }

    case 'guard_check': {
      const result = runPhaseGuard(root, args.change as string, args.phase as string);
      return result;
    }

    // ── Change ──
    case 'get_change_status': {
      // CHG-7: 激活项目级 workflow 覆盖（每请求一次 IO，等价 CLI 每次调用语义；不做进程内热更新）
      activateProjectWorkflow(root);
      const changeName = (args.name as string) || getActiveChange(root);
      if (!changeName) {
        return { error: 'No active change' };
      }
      const state = loadChangeState(root, changeName);
      if (!state) {
        return { error: `Change not found: ${changeName}` };
      }
      const next = getNextPhase(state);
      const validTransitions = getValidTransitions(state.phase);
      return {
        name: state.name,
        phase: state.phase,
        workflow: state.workflow,
        buildLayers: state.build_layers,
        rollbackCount: state.rollback_count,
        rollbackLimit: state.rollback_limit,
        rebuildCount: state.rebuild_count,
        rebuildLimit: state.rebuild_limit,
        testCasesLocked: state.test_cases.design_locked,
        nextPhase: next,
        validTransitions,
      };
    }

    case 'list_changes': {
      const changes = listActiveChanges(root);
      const result = changes.map((name) => {
        const state = loadChangeState(root, name);
        return state ? { name, phase: state.phase, workflow: state.workflow } : { name };
      });
      return { changes: result };
    }

    // ── Knowledge ──
    case 'get_knowledge_context': {
      const targetPath = resolve(root, args.path as string);
      const pages = getKnowledgeContext(root, config, targetPath);
      return {
        pages: pages.map((p) => ({
          id: p.frontmatter.id,
          title: p.frontmatter.title,
          type: p.frontmatter.type,
          status: p.frontmatter.status,
          scope: p.frontmatter.scope,
          preview: p.content.substring(0, 500),
        })),
      };
    }

    case 'search_knowledge': {
      // Unified with CLI (`mumu knowledge search`): relevance-scored search
      // over the page index; filter-only queries return unscored results.
      const query = typeof args.keyword === 'string' ? args.keyword : '';
      const results = knowledgeSearch(root, config, query, {
        type: args.type ? [args.type as string] : undefined,
        tags: args.tag ? [args.tag as string] : undefined,
        limit: 20,
      });
      return {
        pages: results.map((r) => ({
          id: r.entry.id,
          title: r.entry.title,
          type: r.entry.type,
          status: r.entry.status,
          score: r.score,
        })),
      };
    }

    case 'get_knowledge_page': {
      const page = getKnowledgePage(root, config, args.id as string);
      if (!page) {
        return { error: `Knowledge page not found: ${args.id}` };
      }
      return {
        id: page.frontmatter.id,
        title: page.frontmatter.title,
        type: page.frontmatter.type,
        status: page.frontmatter.status,
        scope: page.frontmatter.scope,
        content: page.content,
        tags: page.frontmatter.tags,
        graphBindings: page.frontmatter.graph_bindings,
      };
    }

    case 'verify_knowledge': {
      const results = verifyKnowledge(root, config, {
        id: args.id as string,
        all: args.all as boolean,
      });
      return { results };
    }

    // Understand-A Style Tool Handlers
    case 'analyze_impact': {
      const result = analyzeImpact(root, config, {
        diffRange: args.diff_range as string,
        scope: args.scope as string,
        withKnowledge: args.include_knowledge_warnings as boolean,
      });
      return result;
    }

    case 'generate_onboarding_path': {
      const result = generateOnboardingPath(root, config, args.scope as string, args.role as 'junior' | 'mid' | 'senior' | 'pm');
      return result;
    }

    case 'get_knowledge_coverage': {
      const result = analyzeCoverage(root, config, args.scope as string);
      return result;
    }

    case 'find_knowledge_gaps': {
      const report = analyzeCoverage(root, config, args.scope as string);
      const minImp = (args.min_importance as number) ?? 5;
      return {
        gaps: report.gaps.filter((g) => g.importance >= minImp),
        total_gaps: report.gaps.length,
      };
    }

    case 'detect_decision_deviation': {
      const result = analyzeImpact(root, config, {
        withKnowledge: true,
        mockChangedFiles: (args.changed_files as string[]).map((path) => ({
          path,
          change_type: 'modified' as const,
          lines_changed: 0,
        })),
      });
      return {
        warnings: result.knowledge_warnings,
        direct_impact: result.direct_impact,
        recommendations: result.recommendations,
      };
    }

    case 'query_knowledge': {
      const result = answerQuery(root, config, args.query as string);
      return {
        query: result.query,
        answer: result.answer,
        confidence: result.confidence,
        references: result.references,
      };
    }

    // ═══════════════════════════════════════════════════════════════
    // Contract Layer Handlers (NEW)
    // ═══════════════════════════════════════════════════════════════
    case 'list_contracts': {
      const registry = loadAllContracts(root);
      let contracts = registry.contracts;
      const direction = args.direction as string;

      if (args.category) {
        contracts = contracts.filter((c) => c.category === args.category);
      }
      if (args.status) {
        contracts = contracts.filter((c) => c.status === args.status);
      }
      if (direction === 'outbound') {
        contracts = contracts.filter((c) => registry.outbound_ids.includes(c.id));
      } else if (direction === 'inbound') {
        contracts = contracts.filter((c) => registry.inbound_ids.includes(c.id));
      }

      return {
        contracts: contracts.map((c: Contract) => ({
          id: c.id,
          name: c.name,
          category: c.category,
          status: c.status,
          criticality: c.criticality,
          version: c.version,
          direction: registry.outbound_ids.includes(c.id) ? 'outbound' : 'inbound',
          upstream_count: c.upstream.length,
          downstream_count: c.downstream.length,
        })),
        total: contracts.length,
        registry_version: registry.version,
        last_updated: registry.last_updated,
      };
    }

    case 'get_contract': {
      const registry = loadAllContracts(root);
      const contract = registry.contracts.find((c) => c.id === args.id);

      if (!contract) {
        return {
          error: `Contract not found: ${args.id}`,
          available: registry.contracts.map((c) => c.id),
        };
      }

      return {
        ...contract,
        direction: registry.outbound_ids.includes(contract.id) ? 'outbound' : 'inbound',
      };
    }

    case 'detect_contract_drift': {
      const contractId = args.contract_id as string | undefined;

      if (contractId) {
        // Single contract drift check
        const registry = loadAllContracts(root);
        const contract = registry.contracts.find((c) => c.id === contractId);
        if (!contract) {
          return { error: `Contract not found: ${contractId}` };
        }
        const fullReport = detectContractDrift(root);
        return {
          ...fullReport,
          drifts: fullReport.drifts.filter((d: { contract_id: string }) => d.contract_id === contractId),
        };
      }

      // Full drift detection
      return detectContractDrift(root);
    }

    case 'list_boundaries': {
      const boundaries = findAllBoundaryDocuments(root);
      const dir = args.dir as string | undefined;

      const filtered = dir
        ? boundaries.filter((b: BoundaryDocument) => b.dir_path.startsWith(resolve(root, dir)))
        : boundaries;

      return {
        boundaries: filtered.map((b: BoundaryDocument) => ({
          dir_path: b.dir_path,
          file_path: b.file_path,
          exports_count: b.exports.length,
          dependencies_count: b.dependencies.length,
          data_contracts_count: b.data_contracts.length,
          change_log_entries: b.change_log.length,
          exports: b.exports.map((e) => ({ name: e.name, kind: e.kind })),
        })),
        total: filtered.length,
      };
    }

    case 'check_boundaries': {
      const results = validateBoundaries(root);
      const dir = args.dir as string | undefined;

      const filtered = dir
        ? results.filter((r) => r.dir_path.startsWith(resolve(root, dir)))
        : results;

      const totalErrors = filtered.reduce((sum, r) => sum + r.errors.length, 0);
      const totalWarnings = filtered.reduce((sum, r) => sum + r.warnings.length, 0);

      return {
        results: filtered,
        summary: {
          total_directories: filtered.length,
          with_boundary_doc: filtered.filter((r) => r.has_boundary_doc).length,
          missing_boundary_doc: filtered.filter((r) => !r.has_boundary_doc).length,
          total_errors: totalErrors,
          total_warnings: totalWarnings,
        },
      };
    }

    case 'full_drift_report': {
      const specDrift = detectDrift(root);
      const contractReport = detectContractDrift(root);
      const boundaryResults = validateBoundaries(root);

      const boundaryErrors = boundaryResults.reduce((sum, r) => sum + r.errors.length, 0);
      const boundaryWarnings = boundaryResults.reduce((sum, r) => sum + r.warnings.length, 0);

      return {
        timestamp: new Date().toISOString(),
        spec_drift: {
          count: specDrift.length,
          drifts: specDrift,
        },
        contract_drift: {
          count: contractReport.drift_count,
          critical: contractReport.has_critical_drifts,
          drifts: contractReport.drifts,
        },
        boundary_validation: {
          errors: boundaryErrors,
          warnings: boundaryWarnings,
          results: boundaryResults,
        },
        overall_status: (
          specDrift.length === 0 &&
          contractReport.drift_count === 0 &&
          boundaryErrors === 0
        ) ? 'clean' : 'issues_detected',
      };
    }

    // ── Contract Persistence ──
    case 'persist_contract': {
      const contract = args.contract as Contract;
      const result = persistContract(root, contract, { actor: 'mcp-tool' });
      return { persisted: true, id: contract.id, message: result.message };
    }

    case 'deprecate_contract': {
      const result = deprecateContract(root, args.contract_id as string, {
        migrationPath: args.migration_path as string | undefined,
        actor: 'mcp-tool',
      });
      return { deprecated: true, message: result.message, impact: result.impact };
    }

    case 'remove_contract': {
      const result = removeContract(root, args.contract_id as string, { actor: 'mcp-tool' });
      if (result.success) {
        return { removed: true, message: result.message, impact: result.impact };
      }
      return { error: result.message, impact: result.impact };
    }

    // ── Contract Impact Analysis ──
    case 'analyze_contract_impact': {
      const analysis = analyzeContractImpact(
        root,
        args.contract_id as string,
        args.change_type as 'modify' | 'remove' | 'deprecate',
      );
      return {
        analysis,
        report: formatImpactReport(analysis),
      };
    }

    // ── Contract Audit Log ──
    case 'get_contract_audit': {
      const contractId = args.contract_id as string | undefined;
      const limit = (args.limit as number) ?? 20;
      let entries = readAuditLog(root);
      if (contractId) {
        entries = entries.filter((e: { contract_id: string }) => e.contract_id === contractId);
      }
      entries = entries.slice(-limit);
      return { entries, total: entries.length };
    }

    // ── Boundary Scaffold ──
    case 'scaffold_boundary': {
      const dirPath = resolve(root, args.dir as string);
      const dryRun = (args.dry_run as boolean) ?? false;
      const content = scaffoldBoundary(dirPath);

      if (dryRun) {
        return { content, directory: dirPath };
      }

      const filePath = writeBoundary(dirPath, content);
      return { filePath, directory: dirPath };
    }

    // ── Code Graph ──
    case 'code_graph_search': {
      const graph = getCachedCodeGraph(root);
      const query = args.query as string;
      const limit = (args.limit as number) ?? 20;
      const results = searchNodes(graph, query, limit);
      return {
        results: results.map((r) => ({
          name: r.node.name,
          label: r.node.label,
          file: r.node.filePath,
          line: r.node.startLine,
          score: r.score,
        })),
        stats: getGraphStats(graph),
      };
    }

    case 'code_graph_trace': {
      const graph = getCachedCodeGraph(root);
      const symbolName = args.symbol as string;
      const filePath = args.file_path as string | undefined;
      const maxDepth = (args.max_depth as number) ?? 5;

      // Find the starting node
      const candidates = searchNodes(graph, symbolName, 10);
      if (candidates.length === 0) {
        return { error: `Symbol not found: ${symbolName}` };
      }

      // If file_path given, try to find exact match
      let startNode = candidates[0];
      if (filePath) {
        const exact = candidates.find((c) => c.node.filePath?.includes(filePath));
        if (exact) startNode = exact;
      }

      const path = tracePath(graph, startNode.node.id, maxDepth);
      return {
        start: { name: startNode.node.name, label: startNode.node.label, file: startNode.node.filePath },
        chain: path.map((n) => ({
          name: n.name,
          label: n.label,
          file: n.filePath,
          line: n.startLine,
        })),
        depth: path.length,
      };
    }

    case 'code_graph_structure': {
      const graph = getCachedCodeGraph(root);
      const dir = resolve(root, args.dir as string);
      const relDir = dir.replace(root, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
      const structure = getStructure(graph, relDir);
      return {
        dir: relDir,
        modules: structure.modules.map((m) => ({ name: m.name, path: m.filePath })),
        files: structure.files.map((f) => ({ name: f.name, path: f.filePath, language: f.language })),
        functions: structure.functions.map((f) => ({ name: f.name, file: f.filePath, line: f.startLine })),
        classes: structure.classes.map((c) => ({ name: c.name, file: c.filePath, line: c.startLine })),
        stats: getGraphStats(graph),
      };
    }

    case 'validate_specs': {
      const result = validateAllSpecs(root, config);
      return result;
    }

    default:
      return { error: formatError('E-GUARD-001', { tool: name }) };
  }
}


export { TOOLS as MCP_TOOLS };
