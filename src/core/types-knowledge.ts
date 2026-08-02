/**
 * Knowledge types — knowledge pages, cognitive maps, page indices, and feedback.
 */

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

// ========== Feedback Types (0.12.1+) ==========

export type FeedbackType = 'bug' | 'feature-request' | 'improvement' | 'question' | 'design-review';
export type FeedbackSeverity = 'critical' | 'major' | 'minor' | 'info';
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
  direction: 'feedback-to-session' | 'session-to-feedback';
}

/** Aggregated feedback log for a change */
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
