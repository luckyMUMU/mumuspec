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
  grill_me_result?: {
    completed: boolean;
    rounds: number;
    max_rounds: number;
    deferred_count: number;
    consensus_reached: boolean;
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
  verify_result?: 'pending' | 'pass' | 'pass-with-deviations' | 'fail';
  branch_status?: 'pending' | 'handled';
  verification_report?: string;
  verify_mode?: 'light' | 'full';
  /** Clarification loop result (0.13.0+) */
  clarify_result?: {
    completed: boolean;
    questions_asked: number;
    questions_answered: number;
  };
  /** AI self-review result (0.13.0+) */
  review_result?: {
    completed: boolean;
    critical_count: number;
    major_count: number;
    minor_count: number;
  };
  /** Feedback log — feedback IDs linked to this change + session links (0.12.1+) */
  feedback_log?: {
    entries: Array<{
      feedback_id: string;
      linked_at: string;
      acknowledged: boolean;
    }>;
    session_links: Array<{
      feedback_id: string;
      session_id: string;
      linked_at: string;
    }>;
  };
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
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson' | 'imported';
  status: 'confirmed' | 'superseded' | 'deprecated' | 'proposed';
  scope: string;
  created_at: string;
  verified_at?: string;
  tags?: string[];
  graph_bindings?: string[];
  related_pages?: string[];
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

/** Knowledge organization scan result */
export interface KnowledgeOrganizeResult {
  issues: KnowledgeIssue[];
  stats: {
    total_files: number;
    total_index_entries: number;
    duplicate_ids: number;
    missing_from_index: number;
    orphaned_index_entries: number;
    missing_required_fields: number;
    type_mismatches: number;
  };
  fixed: number;
}

/** Knowledge issue found by organize scan */
export interface KnowledgeIssue {
  severity: 'error' | 'warning' | 'info';
  type: 'duplicate_id' | 'missing_from_index' | 'orphaned_index' | 'missing_field' | 'type_mismatch' | 'missing_file';
  page_id?: string;
  file?: string;
  message: string;
  auto_fixable: boolean;
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

// ========== Feedback Types (0.12.1+) ==========

/** User feedback type */
export type FeedbackType = 'bug' | 'feature-request' | 'improvement' | 'question' | 'design-review';

/** Feedback severity */
export type FeedbackSeverity = 'critical' | 'major' | 'minor' | 'info';

/** Feedback status */
export type FeedbackStatus = 'open' | 'acknowledged' | 'in-progress' | 'resolved' | 'declined';

/** User feedback entry (stored in .mumuspec/feedback/user/) */
export interface UserFeedback {
  id: string;
  date: string;
  submitter: string;
  type: FeedbackType;
  severity: FeedbackSeverity;
  title: string;
  changeName?: string;
  sessionId?: string;
  designRef?: string;
  filePath: string;
  body: string;
  expected?: string;
  actual?: string;
  impact?: string;
  suggestion?: string;
  status: FeedbackStatus;
}

/** Compact feedback reference in index */
export interface FeedbackEntry {
  id: string;
  date: string;
  title: string;
  type: string;
  severity: string;
  submitter: string;
  changeName?: string;
  sessionId?: string;
  file: string;
  status: string;
}

/** Bi-directional link between feedback and session summary */
export interface FeedbackSessionLink {
  feedback_id: string;
  session_id: string;
  linked_at: string;
  /** Direction: 'feedback-to-session' (用户反馈引用 session) or 'session-to-feedback' (session 引用用户反馈) */
  direction: 'feedback-to-session' | 'session-to-feedback';
}

/** Aggregated feedback log for a change (stored in change/feedback/feedback-log.yaml) */
export interface FeedbackLog {
  entries: Array<{
    feedback_id: string;
    linked_at: string;
    acknowledged: boolean;
    acknowledged_at?: string;
  }>;
  session_links: FeedbackSessionLink[];
  last_updated: string;
}

// ========== Understand-A Style Types (0.13.0+) ==========
// Inspired by Understand-Anything (Lum1104/UA) — Knowledge Layer enhancement

/** Reference to a spec entry */
export interface SpecRef {
  id: string;
  title: string;
}

/** Reference to a knowledge page */
export interface KnowledgeRef {
  id: string;
  title: string;
}

/** Changed file in a diff */
export interface ChangedFile {
  /** File path relative to project root */
  path: string;
  /** Type of change */
  change_type: 'added' | 'modified' | 'deleted';
  /** Approximate lines changed */
  lines_changed: number;
}

/** A code node impacted by changes */
export interface ImpactNode {
  /** Code node path (e.g., "src/api/routes.ts" or "src/api/routes.ts:processPayment") */
  node_path: string;
  /** Type of code node */
  node_type: 'File' | 'Function' | 'Class' | 'Module';
  /** Distance from changed file: 1 = direct, 2+ = indirect */
  distance: number;
  /** Direct dependents (for BFS expansion) */
  dependents?: string[];
  /** Impacted spec entries */
  impacted_specs?: SpecRef[];
  /** Impacted knowledge pages */
  impacted_knowledge?: KnowledgeRef[];
}

/** Knowledge warning generated from impact analysis */
export interface KnowledgeWarning {
  /** Knowledge page ID */
  knowledge_id: string;
  /** Type of warning */
  warning_type: 'SCOPE_OVERLAP' | 'RISK_AMPLIFY' | 'DECISION_DEVIATION';
  /** Human-readable warning message */
  message: string;
  /** Suggested action */
  suggestion: string;
  /** Severity level */
  severity: 'high' | 'medium' | 'low';
}

/** Recommendations from impact analysis */
export interface ImpactRecommendation {
  /** Suggested regression test scope (code paths) */
  regression_scope: string[];
  /** Focus areas for code review */
  review_focus: string[];
  /** Knowledge pages to review */
  knowledge_pages_to_review: string[];
}

/** Complete impact analysis result */
export interface ImpactAnalysis {
  /** ISO timestamp of analysis generation */
  generated_at: string;
  /** Git diff range used for analysis */
  diff_range: string;
  /** List of changed files */
  changed_files: ChangedFile[];
  /** Directly impacted code nodes (distance 1) */
  direct_impact: ImpactNode[];
  /** Indirectly impacted code nodes (distance 2+) */
  indirect_impact: ImpactNode[];
  /** Warnings related to knowledge pages */
  knowledge_warnings: KnowledgeWarning[];
  /** Recommendations for review and testing */
  recommendations: ImpactRecommendation;
}

/** A single step in a learning path */
export interface LearningStep {
  /** Step order (1-based) */
  order: number;
  /** Code node path */
  code_node: string;
  /** Type of code node */
  code_node_type: string;
  /** Why this order (pedagogical reason) */
  reason: string;
  /** Associated knowledge page IDs */
  knowledge_pages: string[];
  /** What to understand at this step */
  learning_objectives: string[];
  /** Self-check questions */
  check_questions: string[];
}

/** Learning path for onboarding */
export interface LearningPath {
  /** Scope of the learning path (code path) */
  scope: string;
  /** ISO timestamp of generation */
  generated_at: string;
  /** Target role */
  generated_for: string;
  /** Ordered learning steps */
  steps: LearningStep[];
  /** Total number of steps */
  total_steps: number;
  /** Estimated completion time in minutes */
  estimated_minutes: number;
}

/** Coverage statistics by code node type */
export interface CoverageStatsByType {
  total: number;
  covered: number;
}

/** Knowledge coverage statistics */
export interface CoverageStats {
  /** Total code nodes in scope */
  total_code_nodes: number;
  /** Nodes with knowledge coverage */
  covered_nodes: number;
  /** Coverage ratio (0.0-1.0) */
  coverage_ratio: number;
  /** Coverage by node type */
  by_type: Record<string, CoverageStatsByType>;
}

/** Knowledge coverage gap */
export interface CoverageGap {
  /** Code node path */
  node: string;
  /** Type of code node */
  node_type: string;
  /** Importance score (higher = more important to document) */
  importance: number;
  /** Suggested knowledge type */
  suggested_type: 'decision' | 'pattern' | 'rationale';
}

/** Knowledge overload (too many pages for one node) */
export interface KnowledgeOverload {
  /** Code node path */
  node: string;
  /** Number of knowledge pages */
  pages_count: number;
}

/** Knowledge coverage analysis report */
export interface CoverageReport {
  /** Scope of analysis */
  scope: string;
  /** ISO timestamp of generation */
  generated_at: string;
  /** Coverage statistics */
  coverage: CoverageStats;
  /** Coverage gaps sorted by importance desc */
  gaps: CoverageGap[];
  /** Overloaded nodes */
  overloads: KnowledgeOverload[];
}

// ========== Chat & Dashboard Types (Understand-A Style) ==========

/** A reference to a knowledge page used in chat answers */
export interface ChatKnowledgeRef {
  /** Knowledge page ID */
  id: string;
  /** Page title */
  title: string;
  /** Page type */
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson' | 'imported';
  /** Relevance score (0-1) */
  relevance: number;
}

/** Result of a chat query against the knowledge base */
export interface ChatAnswer {
  /** Original query */
  query: string;
  /** ISO timestamp of answer generation */
  generated_at: string;
  /** Text answer synthesized from knowledge base */
  answer: string;
  /** Knowledge pages referenced */
  references: ChatKnowledgeRef[];
  /** Confidence level */
  confidence: 'high' | 'medium' | 'low';
}

/** Project goal or milestone */
export interface ProjectGoal {
  /** Goal identifier */
  id: string;
  /** Goal title */
  title: string;
  /** Goal description */
  description: string;
  /** Status */
  status: 'planned' | 'in_progress' | 'completed';
  /** Related knowledge page IDs */
  related_pages: string[];
}

/** Roadmap item for project planning */
export interface RoadmapItem {
  /** Item identifier */
  id: string;
  /** Item title */
  title: string;
  /** Quarter or milestone */
  milestone: string;
  /** Status */
  status: 'planned' | 'in_progress' | 'completed';
  /** Related specs or changes */
  related_changes: string[];
}

/** Enhanced dashboard data including roadmap and goals */
export interface DashboardData {
  /** Project name */
  project: string;
  /** Project root path */
  projectRoot: string;
  /** Active change info */
  activeChange: {
    name: string;
    phase: string;
    workflow: string;
    summary: string;
    hookInstalled: boolean;
    knowledgePages: number;
    stalePages: number;
  } | null;
  /** Hook installation status */
  hooks: {
    available: string[];
    installed: string[];
  };
  /** Knowledge coverage summary */
  coverage: {
    totalPages: number;
    stalePages: number;
    coverageRatio: number;
  };
  /** Project goals */
  goals: ProjectGoal[];
  /** Roadmap items */
  roadmap: RoadmapItem[];
  /** Stale alerts requiring attention */
  alerts: string[];
}

// ========== Environment Detection Types (0.13.0+) ==========

/** Tool ecosystem identifiers */
export type ToolEcosystem = 'java' | 'node' | 'python' | 'go' | 'rust' | 'build' | 'container';

/** Tool status */
export type ToolStatus = 'ok' | 'warn' | 'missing';

/** Detected tool information */
export interface DetectedTool {
  /** Tool name (e.g., "jdk", "maven", "node") */
  name: string;
  /** Ecosystem this tool belongs to */
  ecosystem: ToolEcosystem;
  /** Detected version string */
  version: string;
  /** Filesystem path to the tool executable */
  location: string;
  /** Relevant environment variables */
  envVars: Record<string, string>;
  /** Detection status */
  status: ToolStatus;
}

/** OS information */
export interface OSInfo {
  /** OS type */
  type: 'windows' | 'linux' | 'macos';
  /** CPU architecture */
  arch: 'x64' | 'arm64' | 'x86';
  /** OS version string */
  version: string;
  /** Relevant environment variables (filtered) */
  envVars: Record<string, string>;
}

/** Complete environment detection result */
export interface EnvironmentDetection {
  /** ISO timestamp of detection */
  timestamp: string;
  /** Operating system info */
  os: OSInfo;
  /** List of detected tools */
  tools: DetectedTool[];
  /** List of required but missing tools */
  missing: string[];
  /** Warnings (e.g., version too old) */
  warnings: string[];
}

/** Environment specification entry */
export interface EnvironmentSpecEntry {
  /** Tool name */
  tool: string;
  /** Requirement description */
  requirement: string;
  /** Minimum version required */
  minVersion?: string;
  /** Required environment variables */
  requiredEnvVars?: string[];
  /** Last detected tool info */
  detected?: DetectedTool;
  /** ISO timestamp of last check */
  lastChecked?: string;
}

/** A section in the env-spec.md file */
export interface EnvSpecSection {
  /** Category name (e.g., "Java Development Kit") */
  category: string;
  /** SHALL constraints */
  shall: string[];
  /** SHALL NOT constraints */
  shallNot: string[];
  /** Auto-detected tools */
  detected: DetectedTool[];
  /** Manual notes */
  notes?: string;
}

/** env-spec.md file structure */
export interface EnvSpecFile {
  /** Frontmatter layer */
  layer: 0;
  /** Scope is always ".env" */
  scope: '.env';
  /** Type identifier */
  type: 'environment';
  /** Last update timestamp */
  lastUpdated: string;
  /** Environment specification sections */
  environments: EnvSpecSection[];
}

/** Tool detector configuration */
export interface ToolDetectorConfig {
  /** Command to query version */
  command: string;
  /** Regex to extract version from output */
  versionRegex: RegExp;
  /** Environment variables to capture */
  envVars?: string[];
  /** Command to query location */
  locationCmd?: string;
}

