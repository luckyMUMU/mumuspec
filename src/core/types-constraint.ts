/**
 * Constraint types — constraint_strength, tree resolution, and constraint evaluation.
 * 0.12.0+ strength system, 0.12.1+ tree-distributed constraints.
 */

/** Spec constraint type */
export type ConstraintType = 'shall' | 'shall-not' | 'should' | 'may';

/** Severity level */
export type Severity = 'ERROR' | 'WARN' | 'INFO';

/**
 * Constraint strength level (0.12.0+).
 * Controls how strictly a constraint is enforced.
 * - `high` — block (Pre-commit / Phase Guard 阻断)
 * - `medium` — warn (输出 WARN，记录到 decisions.md，不阻断)
 * - `low` — info (输出 INFO，仅在 verify.md 汇总)
 */
export type ConstraintStrength = 'high' | 'medium' | 'low';

/**
 * Constraint dimension (0.12.0+).
 * Two independent axes for constraint strength configuration.
 * - `technical_design` (TD) — HOW the agent designs & builds
 * - `requirement_goals` (RG) — WHAT the agent must deliver
 */
export type ConstraintDimension = 'technical_design' | 'requirement_goals';

/**
 * Constraint strength configuration (0.12.0+).
 * @deprecated 0.12.1 — use `ConstraintStrengthField` from `config.ts` for
 *   config-level shape and `ConstraintsFile.strength` for persistent file
 *   shape. This umbrella type is retained only for backwards compatibility
 *   with pre-0.12.1 code paths and will be removed in 0.13.0.
 * See docs/design/constraint-strength.md for full design.
 */
export interface ConstraintStrengthConfig {
  strength: {
    technical_design: ConstraintStrength;
    requirement_goals: ConstraintStrength;
  };
  exceptions: string[];
  overrides?: {
    workflow?: {
      worktree_isolation?: 'inherit' | 'true' | 'false';
      single_active_change?: 'inherit' | 'true' | 'false';
      top_down_design?: 'inherit' | 'true' | 'false';
      tdd_enforced?: 'inherit' | 'true' | 'false';
    };
    cognitive_framework?: 'inherit' | 'required' | 'optional' | 'conditional' | 'lightweight' | 'recommended' | 'strict' | 'design_only' | 'off';
    hyperplan?: 'inherit' | 'required' | 'optional' | 'conditional' | 'lightweight' | 'recommended' | 'strict' | 'design_only' | 'off';
    brainstorming?: 'inherit' | 'required' | 'optional' | 'conditional' | 'lightweight' | 'recommended' | 'strict' | 'design_only' | 'off';
    test_immutability?: 'inherit' | 'required' | 'optional' | 'conditional' | 'lightweight' | 'recommended' | 'strict' | 'design_only' | 'off';
    impact_analysis?: 'inherit' | 'required' | 'optional' | 'conditional' | 'lightweight' | 'recommended' | 'strict' | 'design_only' | 'off';
  };
}

/**
 * A single constraint entry in `.mumuspec/constraints.yaml` (0.12.0+).
 * Persistent, code-independent, bidirectional (SHALL / SHALL NOT).
 * Tree-aware since 0.12.1: each entry carries `layer` and `scope` metadata.
 * See docs/design/constraint-strength.md §5.
 */
export interface ConstraintEntry {
  id: string;
  content: string;
  min_strength: ConstraintStrength;
  enforcement: string;
  category?: string;
  always_enforce?: boolean;
  source_specs?: string[];
  layer?: number;
  scope?: string;
  inherited?: boolean;
  tightens?: { layer: number; scope: string; id: string };
}

/**
 * Loaded `.mumuspec/constraints.yaml` content (0.12.0+).
 * 0.12.1+ — Tree-distributed shape: each directory's `.mumuspec/`
 * MAY contain its own `constraints.yaml`. The root file is Level 0; child
 * files inherit and may tighten parent constraints.
 */
export interface ConstraintsFile {
  version: string;
  last_updated: string;
  strength?: {
    technical_design?: ConstraintStrength;
    requirement_goals?: ConstraintStrength;
  };
  layer?: number;
  scope?: string;
  forward?: {
    technical_design?: ConstraintEntry[];
    requirement_goals?: ConstraintEntry[];
  };
  reverse?: {
    technical_design?: ConstraintEntry[];
    requirement_goals?: ConstraintEntry[];
  };
  metadata?: {
    generated_by?: string;
    source_specs?: string[];
    custom_constraints_count?: number;
  };
}

/**
 * A node in the resolved constraint tree (0.12.1+).
 * Built by `resolveConstraintTree()` from one or more `ConstraintsFile`s.
 */
export interface ConstraintTreeNode {
  layer: number;
  scope: string;
  strength: { technical_design: ConstraintStrength; requirement_goals: ConstraintStrength };
  forward: { technical_design: ConstraintEntry[]; requirement_goals: ConstraintEntry[] };
  reverse: { technical_design: ConstraintEntry[]; requirement_goals: ConstraintEntry[] };
  children: Map<string, ConstraintTreeNode>;
  parent: ConstraintTreeNode | null;
}

/**
 * Conflict record produced during tree resolution (0.12.1+).
 */
export interface ConstraintConflict {
  id: string;
  dimension: ConstraintDimension;
  direction: 'forward' | 'reverse';
  winner: ConstraintEntry;
  losers: ConstraintEntry[];
  resolution: 'highest_layer_wins' | 'manual_review';
}

/**
 * Result of resolving a constraint tree (0.12.1+).
 */
export interface ConstraintTreeResolution {
  root: ConstraintTreeNode;
  conflicts: ConstraintConflict[];
  warnings: string[];
}

/**
 * Result of evaluating a constraint check against current strength.
 */
export interface ConstraintEvalResult {
  action: 'block' | 'warn' | 'info';
  reason: string;
  check_id: string;
  dimension: ConstraintDimension;
}
