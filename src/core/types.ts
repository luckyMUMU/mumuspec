// Core type definitions for MumuSpec

/** Spec constraint type */
export type ConstraintType = 'shall' | 'shall-not' | 'should' | 'may';

/** Severity level */
export type Severity = 'ERROR' | 'WARN' | 'INFO';

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
