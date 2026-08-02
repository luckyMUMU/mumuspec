/**
 * Analysis types — Understand-A style impact analysis, coverage, chat, onboarding, MCP/tooling.
 * 0.13.0+ Knowledge Layer enhancements.
 */

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
  path: string;
  change_type: 'added' | 'modified' | 'deleted';
  lines_changed: number;
}

/** A code node impacted by changes */
export interface ImpactNode {
  node_path: string;
  node_type: 'File' | 'Function' | 'Class' | 'Module';
  distance: number;
  dependents?: string[];
  impacted_specs?: SpecRef[];
  impacted_knowledge?: KnowledgeRef[];
}

/** Knowledge warning generated from impact analysis */
export interface KnowledgeWarning {
  knowledge_id: string;
  warning_type: 'SCOPE_OVERLAP' | 'RISK_AMPLIFY' | 'DECISION_DEVIATION';
  message: string;
  suggestion: string;
  severity: 'high' | 'medium' | 'low';
}

/** Recommendations from impact analysis */
export interface ImpactRecommendation {
  regression_scope: string[];
  review_focus: string[];
  knowledge_pages_to_review: string[];
}

/** Complete impact analysis result */
export interface ImpactAnalysis {
  generated_at: string;
  diff_range: string;
  changed_files: ChangedFile[];
  direct_impact: ImpactNode[];
  indirect_impact: ImpactNode[];
  knowledge_warnings: KnowledgeWarning[];
  recommendations: ImpactRecommendation;
}

/** A single step in a learning path */
export interface LearningStep {
  order: number;
  code_node: string;
  code_node_type: string;
  reason: string;
  knowledge_pages: string[];
  learning_objectives: string[];
  check_questions: string[];
}

/** Learning path for onboarding */
export interface LearningPath {
  scope: string;
  generated_at: string;
  generated_for: string;
  steps: LearningStep[];
  total_steps: number;
  estimated_minutes: number;
}

/** Coverage statistics by code node type */
export interface CoverageStatsByType {
  total: number;
  covered: number;
}

/** Knowledge coverage statistics */
export interface CoverageStats {
  total_code_nodes: number;
  covered_nodes: number;
  coverage_ratio: number;
  by_type: Record<string, CoverageStatsByType>;
}

/** Knowledge coverage gap */
export interface CoverageGap {
  node: string;
  node_type: string;
  importance: number;
  suggested_type: 'decision' | 'pattern' | 'rationale';
}

/** Knowledge overload (too many pages for one node) */
export interface KnowledgeOverload {
  node: string;
  pages_count: number;
}

/** Knowledge coverage analysis report */
export interface CoverageReport {
  scope: string;
  generated_at: string;
  coverage: CoverageStats;
  gaps: CoverageGap[];
  overloads: KnowledgeOverload[];
}

/** A reference to a knowledge page used in chat answers */
export interface ChatKnowledgeRef {
  id: string;
  title: string;
  type: 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson' | 'imported';
  relevance: number;
}

/** Result of a chat query against the knowledge base */
export interface ChatAnswer {
  query: string;
  generated_at: string;
  answer: string;
  references: ChatKnowledgeRef[];
  confidence: 'high' | 'medium' | 'low';
}

/** Project goal or milestone */
export interface ProjectGoal {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'in_progress' | 'completed';
  related_pages: string[];
}

/** Roadmap item for project planning */
export interface RoadmapItem {
  id: string;
  title: string;
  milestone: string;
  status: 'planned' | 'in_progress' | 'completed';
  related_changes: string[];
}

/** Enhanced dashboard data including roadmap and goals */
export interface DashboardData {
  project: string;
  projectRoot: string;
  activeChange: {
    name: string;
    phase: string;
    workflow: string;
    summary: string;
    hookInstalled: boolean;
    knowledgePages: number;
    stalePages: number;
  } | null;
  hooks: {
    available: string[];
    installed: string[];
  };
  coverage: {
    totalPages: number;
    stalePages: number;
    coverageRatio: number;
  };
  goals: ProjectGoal[];
  roadmap: RoadmapItem[];
  alerts: string[];
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
