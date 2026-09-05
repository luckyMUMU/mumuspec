import type { ConstraintStrength } from './types.js';

/**
 * Workflow rule override value.
 * - `inherit` — evaluate against the active constraint_strength dimension
 * - `true` / `false` — explicit override, priority above strength level
 */
export type WorkflowOverride = 'inherit' | 'true' | 'false';

/**
 * System capability override value.
 * Generic shape for capabilities that can be `inherit` (follow strength)
 * or one of several explicit modes.
 */
export type CapabilityOverride =
  | 'inherit'
  | 'required'
  | 'optional'
  | 'conditional'
  | 'lightweight'
  | 'recommended'
  | 'strict'
  | 'design_only'
  | 'off';

/**
 * Constraint strength configuration field (0.12.0+).
 * Lives at the top level of `config.yaml` as `constraint_strength`.
 * See docs/design/constraint-strength.md for full design.
 *
 * NOTE: This is the config-level flat shape. The persistent
 * `.mumuspec/constraints.yaml` file uses a different (nested `strength:`)
 * shape — see `ConstraintsFile` in types.ts.
 */
export interface ConstraintStrengthField {
  /** HOW dimension — design & implementation rigor */
  technical_design: ConstraintStrength;
  /** WHAT dimension — requirement goal completeness */
  requirement_goals: ConstraintStrength;
  /** Read-only exception list — always block regardless of strength */
  exceptions: string[];
  /**
   * Verifier strict gate (P0, 2026-08-29; M2 default flip same day).
   * When true (default), a SHALL NOT with no verification channel emits
   * E-SPEC-015 as ERROR (red-line gate) and the verify stage requires
   * per-item evidence for manual constraints (E-VERIFY-003).
   * Opt out with `enforcement_strict: false` — unverifiable SHALL NOT then
   * surface as warnings only.
   *
   * ponytail: root-level gate only; per-layer tightening deferred until a
   * real project needs scoped strictness (YAGNI).
   */
  enforcement_strict?: boolean;
  /** Explicit overrides — priority above strength levels */
  overrides?: {
    workflow?: {
      worktree_isolation?: WorkflowOverride;
      single_active_change?: WorkflowOverride;
      top_down_design?: WorkflowOverride;
      tdd_enforced?: WorkflowOverride;
    };
    cognitive_framework?: CapabilityOverride;
    hyperplan?: CapabilityOverride;
    brainstorming?: CapabilityOverride;
    test_immutability?: CapabilityOverride;
    impact_analysis?: CapabilityOverride;
  };
}

/**
 * Four workflow rules (0.11.0+, made strength-aware in 0.12.0).
 * All default to `true`; users may explicitly close any rule.
 * Strength-aware evaluation: when `constraint_strength.overrides.workflow.*`
 * is `inherit` (or unset), the effective value is derived from the
 * corresponding dimension's strength level.
 */
export interface WorkflowConfig {
  worktree_isolation: boolean;
  single_active_change: boolean;
  top_down_design: boolean;
  tdd_enforced: boolean;
  /** Only effective when `single_active_change: false` */
  max_active_changes: number;
}

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
    /** Reverse index config (UA-style) */
    reverse_index: {
      file: string;
      auto_rebuild: string[];
      fallback: boolean;
    };
    /** Commit-time knowledge update (UA-style) */
    commit_update: {
      enabled: boolean;
      timeout_ms: number;
      async: boolean;
      llm_enhancement: boolean;
    };
    /** Commit message Knowledge-Impact parsing */
    commit_message: {
      parse_knowledge_impact: boolean;
    };
    /** Knowledge coverage analysis (UA-style) */
    coverage: {
      importance_formula: string;
      gap_threshold: number;
    };
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
    default_isolation: string;
    allow_isolation_downgrade: boolean;
    /** Branch prefix for branch-driven workflow (default "mumuspec") */
    branch_prefix: string;
    implementation_strategy: string;
    design_strategy: string;
    /**
     * Default tdd_mode for newly created changes (CHG-5, 0.20.0+).
     * Replaces the hardcoded 'tdd'. Old changes keep their original value (not migrated).
     * @default 'tdd'
     */
    default_tdd_mode: 'tdd' | 'non-tdd';
  };
  /**
   * Four workflow rules (0.11.0+). Strength-aware since 0.12.0.
   * Explicit `workflow.*` values take priority over `constraint_strength`.
   */
  workflow: WorkflowConfig;
  /**
   * Dynamic constraint strength (0.12.0+).
   * Two-dimension (technical_design + requirement_goals) × three-level
   * (high/medium/low) configuration. Controls enforcement strictness
   * and progressive workflow relaxation.
   */
  constraint_strength: ConstraintStrengthField;
  ci: {
    pre_commit_check: string;
    test_immutability_check: boolean;
    full_check_on_push: boolean;
    drift_detection_on_pr: boolean;
    /**
     * CHG-1: pre-commit 变更归属校验开关（默认 true）。
     * 为 true 时，非白名单分支上无活跃 change 的提交会按 constraint_strength
     * 输出警告（high=block，medium=warn，low=info）。
     */
    pre_commit_ownership_check: boolean;
    /** CI/常规分支白名单 — 这些分支上的提交不做归属校验（默认 main/master） */
    ownership_ci_branches: string[];
  };
  /**
   * CHG-2: 守卫绕过审计配置（0.20.0+）。
   * bypass_audit=true（默认）：guard --force / state transition --confirm /
   * state set 受保护字段 允许执行，但必须写 audit-log 并输出风险提示。
   * bypass_audit=false：上述绕过操作被拒绝（guard --force exit 1，state 拒绝 E-STATE-001）。
   */
  guard: {
    bypass_audit: boolean;
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

// ════════════════════════════════════════════════════════════════════
// Re-exports from submodules (backward-compatible barrel)
// ════════════════════════════════════════════════════════════════════

export {
  BUILTIN_CONSTRAINT_EXCEPTIONS,
  STRENGTH_ACTION_MAP,
  WORKFLOW_RULE_DIMENSION,
  WORKFLOW_STRENGTH_MATRIX,
  CONSTRAINT_TREE_POLICY,
  isValidStrength,
  strengthRank,
  safeStrengthRank,
  normalizeScope,
  isTightening,
  resolveConstraintTree,
} from './config-tree.js';

export {
  getDefaultConfig,
  loadConfig,
  saveConfig,
  isInitialized,
} from './config-io.js';
