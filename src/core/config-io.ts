/**
 * Config I/O — getDefaultConfig, loadConfig, saveConfig, isInitialized, deepMerge.
 */
import { readYaml, writeYaml, getMumuSpecDir, existsSync } from './utils.js';
import type { MumuSpecConfig } from './config.js';
import { BUILTIN_CONSTRAINT_EXCEPTIONS } from './config-tree.js';

/** Default configuration */
export function getDefaultConfig(projectName: string = 'my-project'): MumuSpecConfig {
  return {
    version: '0.1.0',
    project: { name: projectName, language: 'typescript' },
    specs: {
      root: '.mumuspec',
      format: 'yaml+markdown',
      max_layer_depth: 5,
      auto_index: true,
      require_design_doc: true,
    },
    knowledge: {
      enabled: true,
      code_graph: {
        enabled: true,
        storage: 'sqlite',
        db_path: '.mumuspec/graph/index.db',
        auto_index_on_commit: true,
        languages: ['typescript', 'javascript'],
      },
      wiki: {
        dir: '.mumuspec/knowledge',
        auto_extract_on_archive: true,
        max_pages_per_scope: 20,
      },
      progressive_disclosure: {
        max_pages_per_layer: 5,
        load_stale_summary: true,
      },
      freshness: {
        check_on_load: true,
        warn_after_days: 90,
        error_after_days: 180,
      },
      drift_detection: true,
      reverse_index: {
        file: '_reverse-index.yaml',
        auto_rebuild: ['pre-commit', 'post-merge', 'post-checkout'],
        fallback: true,
      },
      commit_update: {
        enabled: true,
        timeout_ms: 500,
        async: true,
        llm_enhancement: false,
      },
      commit_message: { parse_knowledge_impact: true },
      coverage: {
        importance_formula: 'ref_count * node_count',
        gap_threshold: 5,
      },
    },
    enforcement: {
      engine: 'builtin',
      severity_levels: ['error', 'warn', 'info'],
      fail_on: 'error',
    },
    changes: {
      default_workflow: 'full',
      require_brainstorming: true,
      auto_transition: true,
      default_rollback_limit: 3,
      default_rebuild_limit: 5,
      default_build_mode: 'executing-plans',
      default_isolation: 'branch',
      allow_isolation_downgrade: true,
      branch_prefix: 'mumuspec',
      implementation_strategy: 'bottom-up',
      design_strategy: 'top-down',
      default_tdd_mode: 'tdd',
    },
    workflow: {
      worktree_isolation: true,
      single_active_change: true,
      top_down_design: true,
      tdd_enforced: true,
      max_active_changes: 3,
    },
    constraint_strength: {
      technical_design: 'high',
      requirement_goals: 'high',
      exceptions: [...BUILTIN_CONSTRAINT_EXCEPTIONS],
      overrides: {
        workflow: {
          worktree_isolation: 'inherit',
          single_active_change: 'inherit',
          top_down_design: 'inherit',
          tdd_enforced: 'inherit',
        },
        cognitive_framework: 'inherit',
        hyperplan: 'inherit',
        brainstorming: 'inherit',
        test_immutability: 'inherit',
        impact_analysis: 'inherit',
      },
    },
    ci: {
      pre_commit_check: 'shall-not',
      test_immutability_check: true,
      full_check_on_push: true,
      drift_detection_on_pr: true,
      pre_commit_ownership_check: true,
      ownership_ci_branches: ['main', 'master'],
    },
    guard: {
      bypass_audit: true,
    },
    ai: {
      generate_rules: true,
      mcp_server: true,
      rules_files: ['CLAUDE.md', '.cursorrules', 'AGENTS.md'],
    },
    skills: {
      enabled: true,
      discovery: 'auto',
      ecosystems: {},
      dispatch: {
        required_skill_missing: 'block',
        shall_violation: 'block',
        shall_not_violation: 'block',
        skill_timeout: '300s',
        parallel_dispatch: false,
      },
    },
    contracts: {
      enabled: true,
      external_dir: 'contracts/external',
      outbound_dir: 'contracts/outbound',
      schemas_dir: 'contracts/schemas',
      registry_file: 'contracts/_registry.yaml',
      auto_derive: true,
      drift_detection: true,
      compat_check_on_change: true,
      verify_on_build: true,
      verify_on_archive: true,
    },
    ponytail: {
      enabled: true,
      auto_inject_to_root: true,
      comment_marker: 'ponytail:',
      strict_no_new_deps: true,
    },
    cognitive_framework: {
      enabled: true,
      default_mode: 'full',
      max_rounds: 5,
      q3_per_round: 3,
      q2_per_round: 5,
      q4_min_dimensions: 3,
      hotfix_skip: true,
    },
    design_docs: {
      enabled: true,
      required: true,
      auto_sync_on_design_phase: true,
      drift_detection: true,
      inheritance: true,
    },
    docs: {
      enabled: true,
      output_dir: 'docs',
      generation: {
        auto_on_build: true,
        auto_on_archive: true,
        stale_detection: true,
        context_aggregation_depth: -1,
      },
      types: {},
      templates: {
        custom_dir: '.mumuspec/templates',
        fallback_to_builtin: true,
      },
      output: {
        default_format: 'markdown',
        formats: ['markdown'],
      },
      consistency_check: {
        enabled: true,
        on_pr: true,
        auto_regen_on_drift: true,
        block_on_manual_edit: true,
      },
    },
  };
}

/** Load config from project root */
export function loadConfig(projectRoot: string): MumuSpecConfig {
  const mumuDir = getMumuSpecDir(projectRoot);
  const configPath = joinPaths(mumuDir, 'config.yaml');
  const config = readYaml<MumuSpecConfig>(configPath);

  if (!config) {
    return getDefaultConfig(projectRoot);
  }

  const defaults = getDefaultConfig(config.project?.name || 'my-project');
  const merged = deepMerge(defaults, config);

  merged.constraint_strength.exceptions = Array.from(
    new Set([...BUILTIN_CONSTRAINT_EXCEPTIONS, ...(merged.constraint_strength?.exceptions ?? [])]),
  );

  return merged;
}

/** Save config to project root */
export function saveConfig(projectRoot: string, config: MumuSpecConfig): void {
  const mumuDir = getMumuSpecDir(projectRoot);
  const configPath = joinPaths(mumuDir, 'config.yaml');
  writeYaml(configPath, config);
}

/** Check if MumuSpec is initialized in a project */
export function isInitialized(projectRoot: string): boolean {
  return existsSync(joinPaths(getMumuSpecDir(projectRoot), 'config.yaml'));
}

/** Deep merge two objects */
function deepMerge<T>(target: T, source: Partial<T>): T {
  if (typeof target !== 'object' || target === null) return source as T;
  if (typeof source !== 'object' || source === null) return source as T;

  const result = { ...target } as Record<string, unknown>;
  for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}

/** Simple join that avoids importing path again */
function joinPaths(...paths: string[]): string {
  return paths.join('/').replace(/\/+/g, '/');
}
