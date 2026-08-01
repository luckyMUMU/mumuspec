import { readYaml, writeYaml, getMumuSpecDir, existsSync } from './utils.js';
import type {
  ConstraintStrength,
  ConstraintDimension,
  ConstraintEntry,
  ConstraintConflict,
  ConstraintTreeNode,
  ConstraintTreeResolution,
  ConstraintsFile,
} from './types.js';

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
    /**
     * @deprecated 0.12.0 — use `workflow.tdd_enforced` (strength-aware) instead.
     * Kept for backwards compat with pre-0.12 configs; new code MUST read
     * `workflow.tdd_enforced` and `constraint_strength.overrides.workflow.tdd_enforced`.
     */
    default_tdd_mode: string;
    /**
     * @deprecated 0.12.0 — use `workflow.single_active_change` (strength-aware).
     * Source of truth is now `workflow.single_active_change`; this legacy
     * field is kept only so `deepMerge` doesn't drop it from old configs.
     */
    single_active_change: boolean;
    default_isolation: string;
    allow_isolation_downgrade: boolean;
    implementation_strategy: string;
    design_strategy: string;
    /**
     * @deprecated 0.12.0 — use `workflow.tdd_enforced` (strength-aware).
     * Duplicate of `default_tdd_mode`; both are legacy.
     */
    tdd_mode: string;
    /**
     * @deprecated 0.12.0 — use `constraint_strength.overrides.test_immutability`
     * (strength-aware). Also mirrored by `ci.test_immutability_check`.
     */
    test_immutability: boolean;
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

/**
 * Built-in exception list — always `block` regardless of strength level.
 * Users cannot disable these. See docs/design/constraint-strength.md §5.4.
 */
export const BUILTIN_CONSTRAINT_EXCEPTIONS: ReadonlyArray<string> = [
  'archive_terminal_state',
  'discard_user_confirmation',
  'commit_sha_immutability',
  'sensitive_info_scan',
  'shall_not_violation_in_ci',
  'bp_03_user_confirmation',
  'bp_04_design_confirmation',
  'bp_14_verify_failure',
  'bp_17_archive_confirmation',
] as const;

/**
 * Default mapping from constraint strength level to enforcement action.
 * - `high`   → `block`  (Pre-commit / Phase Guard 阻断)
 * - `medium` → `warn`   (输出 WARN，记录到 decisions.md，不阻断)
 * - `low`    → `info`   (输出 INFO，仅在 verify.md 汇总)
 */
export const STRENGTH_ACTION_MAP: Readonly<
  Record<ConstraintStrength, 'block' | 'warn' | 'info'>
> = {
  high: 'block',
  medium: 'warn',
  low: 'info',
} as const;

/**
 * Dimension → workflow rule mapping.
 * Used to resolve which strength dimension governs a given workflow rule
 * when `constraint_strength.overrides.workflow.<rule>` is `inherit`.
 *
 * Per docs/design/constraint-strength.md §6.1:
 *   - worktree_isolation    → RG (Requirement Goals)
 *   - single_active_change  → RG (Requirement Goals)
 *   - top_down_design       → TD (Technical Design)
 *   - tdd_enforced          → TD (Technical Design)
 */
export const WORKFLOW_RULE_DIMENSION: Readonly<
  Record<keyof WorkflowConfig, ConstraintDimension>
> = {
  worktree_isolation: 'requirement_goals',
  single_active_change: 'requirement_goals',
  top_down_design: 'technical_design',
  tdd_enforced: 'technical_design',
  max_active_changes: 'requirement_goals',
} as const;

/**
 * Strength-aware workflow relaxation matrix.
 * Defines the effective value of each workflow rule at each strength level
 * when no explicit override is set.
 *
 *  high   → all rules enforced (true / strict)
 *  medium → isolation & TDD enforced, single-active & top-down relaxed
 *  low    → all rules relaxed (false / off)
 */
export const WORKFLOW_STRENGTH_MATRIX: Readonly<
  Record<
    ConstraintStrength,
    {
      worktree_isolation: boolean;
      single_active_change: boolean;
      top_down_design: boolean;
      tdd_enforced: boolean;
    }
  >
> = {
  high: {
    worktree_isolation: true,
    single_active_change: true,
    top_down_design: true,
    tdd_enforced: true,
  },
  medium: {
    worktree_isolation: true,
    single_active_change: false,
    top_down_design: false,
    tdd_enforced: true,
  },
  low: {
    worktree_isolation: false,
    single_active_change: false,
    top_down_design: false,
    tdd_enforced: false,
  },
} as const;

// ════════════════════════════════════════════════════════════════════
// Tree-distributed constraint resolution (0.12.1+)
// See docs/design/constraint-strength.md §5.6 "树状层级与继承"
// ════════════════════════════════════════════════════════════════════

const VALID_STRENGTHS: ReadonlySet<ConstraintStrength> = new Set(['high', 'medium', 'low']);

export function isValidStrength(s: unknown): s is ConstraintStrength {
  return typeof s === 'string' && VALID_STRENGTHS.has(s as ConstraintStrength);
}

/**
 * Numeric rank for strength comparison. Higher = stricter.
 *
 * Used by:
 *  - `min_strength` tightening checks (child MUST be ≥ parent)
 *  - `shouldEnforce()` — `rank(current) >= rank(min_strength)`
 *  - Cross-dimension conflict resolution ("High strength > Low strength")
 *
 * Throws on undefined / invalid input — callers MUST validate strength
 * strings before persisting them to a `ConstraintsFile` or `ConstraintEntry`.
 * For tree-resolution code where partial failure is preferred, use
 * `safeStrengthRank()` instead.
 */
export function strengthRank(s: ConstraintStrength): number {
  if (!isValidStrength(s)) {
    throw new Error(
      `strengthRank: invalid strength "${String(s)}" — expected high|medium|low`,
    );
  }
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}

function safeStrengthRank(s: unknown, fallback: number = 1): { rank: number; valid: boolean } {
  if (!isValidStrength(s)) {
    return { rank: fallback, valid: false };
  }
  return { rank: strengthRank(s), valid: true };
}

/**
 * Normalize a directory scope string to canonical form.
 *  - `""` → `"."` (root)
 *  - `"./"` → `"."` (current dir prefix)
 *  - `"./src"` → `"src"` (strip leading "./")
 *  - `"/src"` → `"src"` (strip leading absolute slash)
 *  - `"src/"` → `"src"` (no trailing slash)
 *  - `"src\\api"` → `"src/api"` (Windows path separator)
 *  - `"."` → `"."` (already canonical)
 *
 * All internal tree resolution uses normalized scopes; loaders MUST call
 * this before constructing a `ConstraintsFile`.
 */
export function normalizeScope(scope: string | undefined): string {
  if (scope === undefined || scope === '' || scope === '.') return '.';

  let normalized = scope.replace(/\\/g, '/').replace(/\/+/g, '/');

  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return normalized === '' ? '.' : normalized;
}

/**
 * Inheritance & conflict policy for the tree-distributed constraint system.
 *
 * Mirrors Spec Layer §3 inheritance rules (sub-layer may tighten, not relax)
 * and extends them with bidirectional (forward / reverse) + two-dimension
 * (TD / RG) semantics. See constraint-strength.md §5.6.2.
 */
export const CONSTRAINT_TREE_POLICY = {
  /**
   * Child layers automatically inherit ALL parent constraints
   * (forward + reverse, both dimensions).
   *
   * When an intermediate layer file is missing, inheritance chains through
   * the nearest existing ancestor (跳层继承) — see `resolveConstraintTree`
   * step 2b.
   */
  inheritance: 'full' as const,

  /**
   * Child MAY tighten a parent constraint (raise `min_strength`),
   * but MUST NOT relax it. Relaxation attempts are silently ignored
   * and recorded as warnings on `ConstraintTreeResolution.warnings`.
   */
  tightening: 'allowed' as const,

  /**
   * SHALL NOT entries accumulate (union) across layers — a parent's
   * SHALL NOT remains in effect at the child unless explicitly tightened.
   * SHALL entries are likewise unioned; the agent must satisfy ALL.
   */
  shallAccumulation: 'union' as const,
  shallNotAccumulation: 'union' as const,

  /**
   * Conflict resolution when the SAME `id` is declared at multiple layers:
   *
   *   `highest_layer_wins` — smallest layer number wins (root = 0).
   *
   * Rationale: higher layers encode project-wide invariants; child layers
   * should not be able to silently override them. The losing entry is
   * preserved in `ConstraintConflict.losers` for audit.
   *
   * Note: legitimate tightening (child raises `min_strength` with same
   * `enforcement`) does NOT produce a `ConstraintConflict` — the child
   * entry replaces the parent's at the child scope, with `tightens` set.
   * `manual_review` is reserved for relaxation attempts that were ignored.
   */
  conflictResolution: 'highest_layer_wins' as const,

  /**
   * Cross-dimension tiebreaker when TD and RG constraints on the *same*
   * scope conflict (e.g. TD requires X, RG forbids X). Applied at
   * *evaluation time* (not at tree resolution), since the same TD SHALL
   * and RG SHALL NOT may coexist without conflict depending on content.
   * Order = first wins:
   *
   *   1. Any SHALL NOT (either dimension)        — prohibitions dominate
   *   2. RG SHALL NOT > TD SHALL NOT             — avoid doing the wrong thing
   *   3. RG SHALL > TD SHALL                     — scope correctness first
   *   4. Higher strength > lower strength        — within same direction
   */
  crossDimensionPriority: [
    'shall_not_over_shall',
    'rg_shall_not_over_td_shall_not',
    'rg_shall_over_td_shall',
    'high_strength_over_low',
  ] as const,
} as const;

/**
 * Check whether `child` is a valid tightening of `parent`.
 *
 * A valid tightening:
 *   - Same `id` (required — different id is just a new constraint)
 *   - `rank(child.min_strength) >= rank(parent.min_strength)`
 *   - Same `enforcement` mechanism (stricter mechanisms not yet supported;
 *     callers may extend this via a future partial-order hook)
 *   - `content` may be refined (e.g. narrower scope) but not generalized
 *
 * Returns `{ valid, reason }`. Used by `resolveConstraintTree()`.
 */
export function isTightening(
  parent: ConstraintEntry,
  child: ConstraintEntry,
): { valid: boolean; reason: string } {
  if (parent.id !== child.id) {
    return { valid: false, reason: 'id mismatch — not a tightening candidate' };
  }

  if (strengthRank(child.min_strength) < strengthRank(parent.min_strength)) {
    return {
      valid: false,
      reason: `child min_strength (${child.min_strength}) < parent (${parent.min_strength}) — relaxation disallowed`,
    };
  }

  // `enforcement` mechanism should remain the same or be stricter.
  // We do not define a strict partial order on enforcement strings here;
  // differing mechanisms fall back to "highest layer wins".
  if (parent.enforcement !== child.enforcement) {
    return {
      valid: false,
      reason: `enforcement differs (parent=${parent.enforcement}, child=${child.enforcement}) — falls back to highest_layer_wins`,
    };
  }

  return { valid: true, reason: 'tightening allowed' };
}

/**
 * Resolve a tree of `ConstraintsFile`s into a `ConstraintTreeResolution`.
 *
 * Algorithm:
 *   1. Index files by normalized scope; deduplicate (first wins, others WARN).
 *   2. Walk scopes in layer order (root → leaves). At each node:
 *      a. Locate nearest existing ancestor (跳层继承: if intermediate layer
 *         file is missing, chain through grandparent).
 *      b. Resolve effective `strength` by inheritance. If child explicitly
 *         sets `strength.<dim>` weaker than parent, IGNORE the override and
 *         WARN (per §5.6.4 rule 2).
 *      c. Inherit parent's effective forward/reverse × td/rg entries,
 *         marking them `inherited: true`.
 *      d. Merge local entries:
 *         - New id → append.
 *         - Existing id from parent:
 *           · If `isTightening(parent, local).valid` AND parent entry is
 *             `inherited` (i.e. truly from an ancestor) → replace (tightened),
 *             record `tightens: { parent.layer, parent.scope, parent.id }`.
 *           · If parent entry is NOT inherited (same-layer duplicate) →
 *             conflict, first declaration wins.
 *           · Else (invalid tightening) → conflict; parent wins, local
 *             goes to `losers[]`, `resolution: manual_review` for
 *             relaxation attempts.
 *         - SHALL NOT entries with new ids → append (accumulate).
 *   3. Collect conflicts and warnings.
 *
 * This is a pure function — no I/O. Callers pass in already-loaded
 * `ConstraintsFile`s; the function does not read from disk.
 */
export function resolveConstraintTree(
  files: ConstraintsFile[],
  rootStrength: {
    technical_design: ConstraintStrength;
    requirement_goals: ConstraintStrength;
  },
): ConstraintTreeResolution {
  const conflicts: ConstraintConflict[] = [];
  const warnings: string[] = [];

  if (files.length === 0) {
    // Empty tree — return a bare root.
    const bareRoot: ConstraintTreeNode = {
      layer: 0,
      scope: '.',
      strength: { ...rootStrength },
      forward: { technical_design: [], requirement_goals: [] },
      reverse: { technical_design: [], requirement_goals: [] },
      children: new Map(),
      parent: null,
    };
    return { root: bareRoot, conflicts, warnings };
  }

  // 1. Index files by normalized scope; first wins on duplicate.
  const byScope = new Map<string, ConstraintsFile>();
  for (const f of files) {
    const scope = normalizeScope(f.scope);
    if (byScope.has(scope)) {
      warnings.push(`duplicate constraints.yaml at scope "${scope}" — first wins`);
      continue;
    }
    byScope.set(scope, { ...f, scope });
  }

  // Derive layer numbers from path depth. Root "." = 0.
  const layerOf = (scope: string): number => {
    if (scope === '.') return 0;
    return scope.split('/').filter(Boolean).length;
  };

  // 2. Sort scopes by layer (root first), then alphabetically for stability.
  const scopes = Array.from(byScope.keys()).sort(
    (a, b) => layerOf(a) - layerOf(b) || a.localeCompare(b),
  );

  /**
   * Find the nearest existing ancestor scope for `scope`.
   * Implements 跳层继承: if intermediate layer file is missing, chain
   * through grandparent. Returns `null` for root.
   *
   * Example: for scope "src/api/controllers" with files at "." and
   * "src/api/controllers" (but NOT "src" or "src/api"), returns ".".
   */
  const nearestAncestorScope = (scope: string): string | null => {
    if (scope === '.') return null;
    const parts = scope.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = i === 0 ? '.' : parts.slice(0, i).join('/');
      if (byScope.has(candidate)) return candidate;
    }
    return null;
  };

  // 3. Walk in layer order, building nodes.
  const nodes = new Map<string, ConstraintTreeNode>();

  for (const scope of scopes) {
    const file = byScope.get(scope)!;
    const derivedLayer = layerOf(scope);

    if (file.layer !== undefined && file.layer !== derivedLayer) {
      warnings.push(
        `scope="${scope}": declared layer=${file.layer} does not match path depth=${derivedLayer} — using derived layer`,
      );
    }
    const layer = derivedLayer;

    const parentScope = nearestAncestorScope(scope);
    const parent = parentScope ? nodes.get(parentScope) ?? null : null;

    if (parentScope && !parent) {
      warnings.push(
        `scope="${scope}": ancestor scope "${parentScope}" not yet resolved — skipping inheritance`,
      );
    }

    // 3a. Resolve effective strength by inheritance with tightening check.
    // Per §5.6.4 rule 2: child strength MUST be ≥ parent strength; weaker
    // overrides are IGNORED with a WARN.
    const resolveStrengthDim = (
      dim: 'technical_design' | 'requirement_goals',
    ): ConstraintStrength => {
      const parentVal = parent?.strength[dim] ?? rootStrength[dim];
      const childVal = file.strength?.[dim];
      if (childVal === undefined) return parentVal;

      if (!isValidStrength(childVal)) {
        warnings.push(
          `scope="${scope}" strength.${dim}="${String(childVal)}" is invalid (expected high|medium|low) — using parent=${parentVal}`,
        );
        return parentVal;
      }

      const parentRank = strengthRank(parentVal);
      const childRank = strengthRank(childVal);
      if (childRank < parentRank) {
        warnings.push(
          `scope="${scope}" strength.${dim}=${childVal} < parent=${parentVal} — override ignored (relaxation disallowed)`,
        );
        return parentVal;
      }
      return childVal;
    };

    const strength = {
      technical_design: resolveStrengthDim('technical_design'),
      requirement_goals: resolveStrengthDim('requirement_goals'),
    };

    // 3b. Start with inherited entries from parent.
    const forwardTd: ConstraintEntry[] = [];
    const forwardRg: ConstraintEntry[] = [];
    const reverseTd: ConstraintEntry[] = [];
    const reverseRg: ConstraintEntry[] = [];

    if (parent) {
      for (const e of parent.forward.technical_design) {
        forwardTd.push({ ...e, inherited: true });
      }
      for (const e of parent.forward.requirement_goals) {
        forwardRg.push({ ...e, inherited: true });
      }
      for (const e of parent.reverse.technical_design) {
        reverseTd.push({ ...e, inherited: true });
      }
      for (const e of parent.reverse.requirement_goals) {
        reverseRg.push({ ...e, inherited: true });
      }
    }

    // 3c. Merge local entries.
    const merge = (
      bucket: ConstraintEntry[],
      local: ConstraintEntry[],
      direction: 'forward' | 'reverse',
      dim: ConstraintDimension,
    ) => {
      for (const entry of local) {
        if (!isValidStrength(entry.min_strength)) {
          warnings.push(
            `scope="${scope}" id="${entry.id}": invalid min_strength="${String(entry.min_strength)}" — skipping entry`,
          );
          continue;
        }

        const stamped: ConstraintEntry = {
          ...entry,
          layer,
          scope,
          inherited: false,
        };
        const existingIdx = bucket.findIndex((e) => e.id === entry.id);
        if (existingIdx === -1) {
          bucket.push(stamped);
        } else {
          const existing = bucket[existingIdx];

          if (existing.inherited === false) {
            conflicts.push({
              id: entry.id,
              dimension: dim,
              direction,
              winner: existing,
              losers: [stamped],
              resolution: 'highest_layer_wins',
            });
            warnings.push(
              `scope="${scope}" id="${entry.id}": duplicate declaration in same layer — first entry retained`,
            );
            continue;
          }

          const { valid, reason } = isTightening(existing, stamped);
          if (valid) {
            const tightensRef = {
              layer: existing.layer ?? 0,
              scope: existing.scope ?? '.',
              id: existing.id,
            };
            bucket[existingIdx] = { ...stamped, tightens: tightensRef };
          } else {
            const isRelaxation = reason.includes('relaxation');
            conflicts.push({
              id: entry.id,
              dimension: dim,
              direction,
              winner: existing,
              losers: [stamped],
              resolution: isRelaxation ? 'manual_review' : 'highest_layer_wins',
            });
            warnings.push(
              `scope="${scope}" id="${entry.id}": ${reason} — parent entry retained`,
            );
          }
        }
      }
    };

    merge(forwardTd, file.forward?.technical_design ?? [], 'forward', 'technical_design');
    merge(forwardRg, file.forward?.requirement_goals ?? [], 'forward', 'requirement_goals');
    merge(reverseTd, file.reverse?.technical_design ?? [], 'reverse', 'technical_design');
    merge(reverseRg, file.reverse?.requirement_goals ?? [], 'reverse', 'requirement_goals');

    const node: ConstraintTreeNode = {
      layer,
      scope,
      strength,
      forward: {
        technical_design: forwardTd,
        requirement_goals: forwardRg,
      },
      reverse: {
        technical_design: reverseTd,
        requirement_goals: reverseRg,
      },
      children: new Map(),
      parent,
    };

    if (parent) {
      parent.children.set(scope, node);
    }
    nodes.set(scope, node);
  }

  // 4. Locate root. Prefer scope "."; fall back to the shallowest node.
  const rootScope = scopes.includes('.') ? '.' : scopes[0];
  const rootNode = nodes.get(rootScope);
  if (!rootNode) {
    // Defensive: should be unreachable given files.length > 0 check above.
    throw new Error('resolveConstraintTree: failed to locate root node');
  }
  return { root: rootNode, conflicts, warnings };
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
      commit_message: {
        parse_knowledge_impact: true,
      },
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
      // legacy — see @deprecated notes on the field definitions above.
      // Source of truth for runtime behavior is `workflow.*` and
      // `constraint_strength.overrides.*`, NOT these `changes.*` fields.
      default_tdd_mode: 'tdd',
      single_active_change: true,
      default_isolation: 'worktree',
      allow_isolation_downgrade: true,
      implementation_strategy: 'bottom-up',
      design_strategy: 'top-down',
      tdd_mode: 'tdd',
      test_immutability: true,
    },
    // 0.11.0+: four workflow rules, all default to true (strength-aware since 0.12.0).
    // These are the explicit `workflow.*` overrides; when users do not set them,
    // effective values are resolved from `constraint_strength` via
    // WORKFLOW_STRENGTH_MATRIX and WORKFLOW_RULE_DIMENSION.
    workflow: {
      worktree_isolation: true,
      single_active_change: true,
      top_down_design: true,
      tdd_enforced: true,
      max_active_changes: 3,
    },
    // 0.12.0+: dynamic constraint strength. Defaults to high/high — the safest
    // posture for new projects. Mature teams may lower one or both dimensions
    // to progressively relax workflow restrictions. See
    // docs/design/constraint-strength.md §6 for the relaxation matrix.
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
