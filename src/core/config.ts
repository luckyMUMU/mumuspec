import { readYaml, writeYaml, getMumuSpecDir, existsSync } from './utils.js';

/** Full MumuSpec configuration */
export interface MumuSpecConfig {
  version: string;
  project: {
    name: string;
    language: string;
    framework?: string;
  };
  specs: {
    root: string;
    format: string;
    max_layer_depth: number;
    auto_index: boolean;
    require_design_doc: boolean;
  };
  knowledge: {
    enabled: boolean;
    code_graph: {
      enabled: boolean;
      storage: string;
      db_path: string;
      auto_index_on_commit: boolean;
      languages: string[];
    };
    wiki: {
      dir: string;
      auto_extract_on_archive: boolean;
      max_pages_per_scope: number;
    };
    progressive_disclosure: {
      max_pages_per_layer: number;
      load_stale_summary: boolean;
    };
    freshness: {
      check_on_load: boolean;
      warn_after_days: number;
      error_after_days: number;
    };
    drift_detection: boolean;
  };
  enforcement: {
    engine: string;
    eslint_config?: string;
    severity_levels: string[];
    fail_on: string;
  };
  changes: {
    default_workflow: string;
    require_brainstorming: boolean;
    auto_transition: boolean;
    default_rollback_limit: number;
    default_rebuild_limit: number;
    default_build_mode: string;
    default_tdd_mode: string;
    single_active_change: boolean;
    default_isolation: string;
    allow_isolation_downgrade: boolean;
    implementation_strategy: string;
    design_strategy: string;
    tdd_mode: string;
    test_immutability: boolean;
  };
  ci: {
    pre_commit_check: string;
    test_immutability_check: boolean;
    full_check_on_push: boolean;
    drift_detection_on_pr: boolean;
  };
  ai: {
    generate_rules: boolean;
    mcp_server: boolean;
    rules_files: string[];
  };
  skills: {
    enabled: boolean;
    discovery: string;
    ecosystems: Record<string, unknown>;
    dispatch: Record<string, unknown>;
    hyperplan?: Record<string, unknown>;
  };
  contracts: {
    enabled: boolean;
    external_dir: string;
    outbound_dir: string;
    schemas_dir: string;
    registry_file: string;
    auto_derive: boolean;
    drift_detection: boolean;
    compat_check_on_change: boolean;
    verify_on_build: boolean;
    verify_on_archive: boolean;
  };
  ponytail: {
    enabled: boolean;
    auto_inject_to_root: boolean;
    comment_marker: string;
    strict_no_new_deps: boolean;
  };
  cognitive_framework: {
    enabled: boolean;
    default_mode: string;
    max_rounds: number;
    q3_per_round: number;
    q2_per_round: number;
    q4_min_dimensions: number;
    hotfix_skip: boolean;
  };
  design_docs: {
    enabled: boolean;
    required: boolean;
    auto_sync_on_design_phase: boolean;
    drift_detection: boolean;
    inheritance: boolean;
  };
  docs: {
    enabled: boolean;
    output_dir: string;
    generation: Record<string, unknown>;
    types: Record<string, unknown>;
    templates: Record<string, unknown>;
    output: Record<string, unknown>;
    consistency_check: Record<string, unknown>;
  };
}

/** Default configuration */
export function getDefaultConfig(projectName: string = 'my-project'): MumuSpecConfig {
  return {
    version: '0.1.0',
    project: {
      name: projectName,
      language: 'typescript',
    },
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
      default_tdd_mode: 'tdd',
      single_active_change: true,
      default_isolation: 'worktree',
      allow_isolation_downgrade: true,
      implementation_strategy: 'bottom-up',
      design_strategy: 'top-down',
      tdd_mode: 'tdd',
      test_immutability: true,
    },
    ci: {
      pre_commit_check: 'shall-not',
      test_immutability_check: true,
      full_check_on_push: true,
      drift_detection_on_pr: true,
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

  // Merge with defaults to ensure all fields exist
  const defaults = getDefaultConfig(config.project?.name || 'my-project');
  return deepMerge(defaults, config);
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
