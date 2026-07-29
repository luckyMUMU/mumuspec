// Core type definitions for MumuSpec

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
 *
 * @deprecated 0.12.1 — use `ConstraintStrengthField` from `config.ts` for
 *   config-level shape and `ConstraintsFile.strength` for persistent file
 *   shape. This umbrella type is retained only for backwards compatibility
 *   with pre-0.12.1 code paths and will be removed in 0.13.0.
 *
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
 *
 * Tree-aware since 0.12.1: each entry carries `layer` and `scope` metadata
 * so the same struct can represent both a single-layer file and a resolved
 * cross-layer constraint set. See docs/design/constraint-strength.md §5.
 */
export interface ConstraintEntry {
  /** Unique ID, e.g. "TD-SHALL-001" or "RG-SHALL-NOT-002" */
  id: string;
  /** Human-readable constraint content */
  content: string;
  /** Minimum strength level for enforcement */
  min_strength: ConstraintStrength;
  /** Enforcement mechanism (e.g. "phase_guard: design_to_build") */
  enforcement: string;
  /** Category for grouping (e.g. "design_completeness") */
  category?: string;
  /** Whether the constraint is always enforced regardless of strength (exception list) */
  always_enforce?: boolean;
  /** Source spec.md files this constraint was derived from */
  source_specs?: string[];

  // ─── Tree-aware fields (0.12.1+) ───
  /**
   * Layer number where this constraint was *declared*. Root = 0.
   * Populated by the tree resolver; absent for entries read from a single
   * unresolved file.
   */
  layer?: number;
  /** Directory scope (relative to project root) where this entry lives, e.g. "." or "src/api" */
  scope?: string;
  /**
   * Whether this entry was *inherited* from an ancestor layer (true) or
   * *declared* at this layer (false / undefined). Inherited entries cannot
   * be edited at the child layer except to *tighten* them.
   */
  inherited?: boolean;
  /**
   * Tightened-from reference. When a child layer tightens a parent entry,
   * this points to the parent's `{ layer, scope, id }` triple. The
   * `min_strength` of a tightened entry MUST be ≥ the parent's.
   */
  tightens?: {
    layer: number;
    scope: string;
    id: string;
  };
}

/**
 * Loaded `.mumuspec/constraints.yaml` content (0.12.0+).
 *
 * **0.12.1+ — Tree-distributed shape**: each directory's `.mumuspec/`
 * MAY contain its own `constraints.yaml`. The root file is Level 0; child
 * files inherit and may tighten parent constraints. See
 * docs/design/constraint-strength.md §5.6.
 */
export interface ConstraintsFile {
  /** Schema version */
  version: string;
  last_updated: string;

  /**
   * Strength override for THIS layer. When absent, inherits from the
   * nearest ancestor that defines it; root ultimately falls back to
   * `config.yaml: constraint_strength.*`.
   */
  strength?: {
    technical_design?: ConstraintStrength;
    requirement_goals?: ConstraintStrength;
  };

  /** Layer metadata (0.12.1+). Absent on the root file is treated as level 0. */
  layer?: number;
  /** Directory scope this file governs, e.g. "." or "src/api" */
  scope?: string;

  /** Forward constraints (SHALL) — agent must do. Optional for partial YAML files. */
  forward?: {
    technical_design?: ConstraintEntry[];
    requirement_goals?: ConstraintEntry[];
  };
  /** Reverse constraints (SHALL NOT) — agent must not do. Optional for partial YAML files. */
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
 *
 * Built by `resolveConstraintTree()` from one or more `ConstraintsFile`s
 * scattered across the directory tree. Each node carries the *effective*
 * (inherited + tightened + locally-declared) constraints for its scope.
 */
export interface ConstraintTreeNode {
  /** Layer number; root = 0 */
  layer: number;
  /** Directory scope, e.g. "." or "src/api" */
  scope: string;
  /** Resolved effective strength (inherited or overridden at this layer) */
  strength: {
    technical_design: ConstraintStrength;
    requirement_goals: ConstraintStrength;
  };
  /** All effective forward constraints at this layer (inherited + local) */
  forward: {
    technical_design: ConstraintEntry[];
    requirement_goals: ConstraintEntry[];
  };
  /** All effective reverse constraints at this layer (inherited + local) */
  reverse: {
    technical_design: ConstraintEntry[];
    requirement_goals: ConstraintEntry[];
  };
  /** Child nodes, keyed by child scope */
  children: Map<string, ConstraintTreeNode>;
  /** Pointer to parent node (null for root) */
  parent: ConstraintTreeNode | null;
}

/**
 * Conflict record produced during tree resolution (0.12.1+).
 *
 * A conflict arises when the same constraint `id` is declared at multiple
 * layers with divergent `min_strength`, `enforcement`, or `content`, AND
 * the child entry is NOT a valid tightening of the parent.
 *
 * Resolution policy:
 *   - `highest_layer_wins` — parent entry retained, child logged as loser.
 *     Used for enforcement mechanism mismatches and same-layer duplicates.
 *   - `manual_review` — child attempted to relax `min_strength`; override
 *     ignored, parent retained. Flagged for human review since relaxation
 *     is never allowed.
 *
 * Note: legitimate tightening (child raises `min_strength` with same
 * `enforcement`) does NOT produce a `ConstraintConflict` — the child entry
 * replaces the parent's at the child scope, with `tightens` field set on
 * the entry itself. This is by design: tightening is legal, not a conflict.
 */
export interface ConstraintConflict {
  /** Constraint ID that collided */
  id: string;
  /** Dimension the constraint lives in */
  dimension: ConstraintDimension;
  /** Direction */
  direction: 'forward' | 'reverse';
  /** Winner entry (highest layer, i.e. smallest layer number) */
  winner: ConstraintEntry;
  /** One or more loser entries (lower layers) */
  losers: ConstraintEntry[];
  /** How the conflict was resolved */
  resolution: 'highest_layer_wins' | 'manual_review';
}

/**
 * Result of resolving a constraint tree (0.12.1+).
 */
export interface ConstraintTreeResolution {
  /** Root node of the resolved tree */
  root: ConstraintTreeNode;
  /** All conflicts detected during resolution (empty if none) */
  conflicts: ConstraintConflict[];
  /** Warnings (e.g. layer-2 attempted to relax a parent constraint; ignored) */
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

/** Spec file frontmatter */
export interface SpecFrontmatter {
  layer: number;
  scope: string;
  last_updated: string;
}

/** A single requirement block in spec.md */
export interface Requirement {
  name: string;
  shall: string[];
  shallNot: string[];
  should?: string[];
  enforcement: EnforcementRule[];
}

/** Enforcement rule for a constraint */
export interface EnforcementRule {
  id: string;
  description: string;
  check?: string;
  severity: Severity;
}

/** Parsed spec.md content */
export interface SpecFile {
  path: string;
  frontmatter: SpecFrontmatter;
  requirements: Requirement[];
  raw: string;
}

/** Parsed design.md content */
export interface DesignFile {
  path: string;
  scope: string;
  layer: number;
  content: string;
  decisions: DesignDecision[];
}

/** Architecture decision in design.md */
export interface DesignDecision {
  title: string;
  context: string;
  decision: string;
  consequences?: string;
}

/** Parsed prohibitions.md content */
export interface ProhibitionsFile {
  path: string;
  global: string[];
  moduleLevel: Map<string, string[]>;
}

/** Index.yaml content */
export interface SpecIndex {
  scope: string;
  layer: number;
  children: IndexChildEntry[];
}

export interface IndexChildEntry {
  name: string;
  path: string;
  summary: string;
  shallNotCount: number;
}

/** Loaded spec context for a directory (progressive disclosure) */
export interface SpecContext {
  targetPath: string;
  layers: SpecLayerContext[];
  prohibitions: string[];
  index?: SpecIndex;
}

/** A single layer in the progressive disclosure */
export interface SpecLayerContext {
  level: number;
  scope: string;
  path: string;
  spec?: SpecFile;
  design?: DesignFile;
}

/** Change workflow type */
export type Workflow = 'full' | 'hotfix' | 'tweak';

/** Change phase in the lifecycle */
export type ChangePhase =
  | 'open'
  | 'design'
  | 'build'
  | 'verify'
  | 'archive-in-progress'
  | 'archive-completed'
  | 'discarded';

/** Build layer status */
export type LayerStatus = 'pending' | 'in-progress' | 'done';

/** Build layer definition */
export interface BuildLayer {
  layer: number;
  scope: string;
  status: LayerStatus;
}

/** Test cases lock state */
export interface TestCasesState {
  design_locked: boolean;
  design_content_hash?: string;
  suites_locked: boolean;
  suites_locked_layers: number[];
  suites_hash: Record<number, string>;
}

/** Change state stored in .mumuspec.yaml */
export interface ChangeState {
  name: string;
  phase: ChangePhase;
  workflow: Workflow;
  created_at: string;
  updated_at: string;
  affected_scopes: string[];
  build_layers: BuildLayer[];
  test_cases: TestCasesState;
  rollback_count: number;
  rebuild_count: number;
  rollback_limit: number;
  rebuild_limit: number;
  build_mode: string;
  tdd_mode: string;
  isolation: string;
  single_active_change: boolean;
  user_confirmed: boolean;
  decisions_log: {
    counts: Record<string, number>;
    content_hash?: string;
  };
  rollback_history: RollbackHistoryEntry[];
  cognitive_framework?: {
    enabled: boolean;
    cognitive_map_ref?: string;
    q1_count: number;
    q2_pending: number;
    q3_pending: number;
    q4_scans_completed: number;
    converged: boolean;
    rounds_completed: number;
  };
  hyperplan_result?: {
    triggered: boolean;
    hard_constraints_merged: boolean;
    open_questions_resolved: boolean;
    degraded: boolean;
  };
  git_merge?: {
    merged: boolean;
    commit_sha?: string;
    strategy?: string;
  };
  knowledge_extraction?: {
    completed: boolean;
    pages_created_count: number;
    graph_bindings_verified: boolean;
    conflicts_resolved: boolean;
  };
  accepted_deviations?: string[];
  deviation_reviewer?: string;
  deviation_approved_at?: string;
}

export interface RollbackHistoryEntry {
  from: ChangePhase;
  to: ChangePhase;
  reason: string;
  timestamp: string;
  counted: boolean;
  event: string;
}

/** Phase guard check result */
export interface GuardResult {
  passed: boolean;
  errors: GuardError[];
  warnings: GuardWarning[];
}

export interface GuardError {
  code: string;
  message: string;
  detail?: string;
}

export interface GuardWarning {
  code: string;
  message: string;
  detail?: string;
}

/** Drift detection result */
export interface DriftResult {
  type: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
}

/** Knowledge page frontmatter */
export interface KnowledgePageFrontmatter {
  id: string;
  title: string;
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson';
  status: 'confirmed' | 'superseded' | 'deprecated' | 'proposed';
  scope: string;
  created_at: string;
  verified_at?: string;
  tags?: string[];
  graph_bindings?: string[];
  supersedes?: string;
  superseded_by?: string;
}

/** Knowledge page */
export interface KnowledgePage {
  path: string;
  frontmatter: KnowledgePageFrontmatter;
  content: string;
}

/** PageIndex entry */
export interface PageIndexEntry {
  id: string;
  title: string;
  type: string;
  status: string;
  scope: string;
  file: string;
  tags: string[];
  verified_at?: string;
}

/** PageIndex */
export interface PageIndex {
  pages: PageIndexEntry[];
}

/** Reverse index entry (code node -> knowledge pages) */
export interface ReverseIndexEntry {
  code_node: string;
  knowledge_pages: string[];
}

/** Cognitive map quadrant entry */
export interface CognitiveMapEntry {
  id: string;
  content: string;
  source?: string;
  status?: 'pending' | 'answered' | 'confirmed' | 'rejected';
  options?: string[];
  reasoning_chain?: string[];
  dimensions?: string[];
  fallback?: string;
}

/** Cognitive map (Q1-Q4) */
export interface CognitiveMap {
  change_name: string;
  rounds_completed: number;
  converged: boolean;
  q1_known_knowns: CognitiveMapEntry[];
  q2_known_unknowns: CognitiveMapEntry[];
  q3_unknown_knowns: CognitiveMapEntry[];
  q4_unknown_unknowns: CognitiveMapEntry[];
}

/** MCP tool definition */
export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Audit log entry */
export interface AuditLogEntry {
  ts: string;
  actor: string;
  action: string;
  result: 'success' | 'fail';
  error?: string;
  [key: string]: unknown;
}
