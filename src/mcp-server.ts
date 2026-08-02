#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { resolve, dirname } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { findProjectRoot } from './core/utils.js';
import { loadConfig } from './core/config.js';

// Spec
import { loadSpecContext, searchSpecs, getProhibitions } from './spec/loader.js';
import { validateAllSpecs } from './spec/validator.js';

// Change
import { loadChangeState, listActiveChanges, getActiveChange } from './change/manager.js';
import { getValidTransitions, getNextPhase } from './change/state-machine.js';

// Guard
import { checkCompliance, detectDrift } from './guard/checker.js';
import { runPhaseGuard } from './guard/phase-guard.js';

// Knowledge
import { getKnowledgePage, searchKnowledge, getKnowledgeContext, verifyKnowledge, analyzeImpact, generateOnboardingPath, analyzeCoverage, answerQuery } from './knowledge/manager.js';

/** Get the project root from env or cwd */
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
  // Spec Context
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

  // Guard
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

  // Change
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

  // Knowledge
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

  // Understand-A Style Knowledge Tools (0.13.0+)
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

  // Validate
  {
    name: 'validate_specs',
    description: 'Validate all spec file formats',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

/** Handle tool calls */
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  const root = getRoot();
  const config = loadConfig(root);

  switch (name) {
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

    case 'get_change_status': {
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
      const pages = searchKnowledge(root, config, {
        keyword: args.keyword as string,
        tag: args.tag as string,
        type: args.type as string,
      });
      return {
        pages: pages.map((p) => ({
          id: p.frontmatter.id,
          title: p.frontmatter.title,
          type: p.frontmatter.type,
          status: p.frontmatter.status,
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

// Understand-A Style Tool Handlers (0.13.0+)
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
  // Run impact analysis and extract deviations
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

case 'validate_specs': {
  const result = validateAllSpecs(root, config);
  return result;
}

default:
  return { error: `Unknown tool: ${name}` };
  }
}

/** Get version from package.json */
function getVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(__dirname, '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

/** Create and start MCP server */
async function main() {
  const server = new Server(
    {
      name: 'mumuspec',
      version: getVersion(),
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS,
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const result = await handleToolCall(name, args || {});
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Start server
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (stdout is used for MCP protocol)
  console.error('MumuSpec MCP Server started');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
