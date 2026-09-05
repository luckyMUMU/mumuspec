/**
 * Knowledge types — knowledge pages, cognitive maps, page indices, feedback,
 * and bidirectional sync (export/import/tell/absorb).
 */

// ========== Schema v2: Semantic Pyramid ==========

/** Knowledge semantic level (L0=evidence → L3=summary) */
export type KnowledgeLevel = 'L0' | 'L1' | 'L2' | 'L3';

/** Knowledge type union (extended with 'scenario' for L2 aggregation) */
export type KnowledgeType = 'decision' | 'pattern' | 'risk' | 'rationale' | 'lesson' | 'imported' | 'scenario';

/** Knowledge page frontmatter (schema v2) */
export interface KnowledgePageFrontmatter {
  id: string;
  title: string;
  type: KnowledgeType;
  status: 'confirmed' | 'superseded' | 'deprecated' | 'proposed' | 'draft';
  scope: string;
  /** Semantic pyramid level */
  level?: KnowledgeLevel;
  /** L2 scenario aggregation key */
  scenario?: string;
  /** Source agent identifier (for imported knowledge) */
  source_agent?: string;
  created_at: string;
  updated_at?: string;
  verified_at?: string;
  tags?: string[];
  graph_bindings?: string[];
  related_pages?: string[];
  backward_refs?: string[];
  supersedes?: string;
  superseded_by?: string;
  source_change?: string;
  source_phase?: string;
  source_artifact?: string;
  cognitive_origin?: {
    quadrant?: string;
    reasoning_chain?: string[];
    confidence?: 'high' | 'medium' | 'low';
  };
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

// ========== Schema v2: Bidirectional Knowledge Sync ==========

/** Conflict resolution strategy for imports */
export type ConflictStrategy = 'skip' | 'overwrite' | 'new-version' | 'merge' | 'manual';

/** Export filter options */
export interface ExportOptions {
  scope?: string;
  type?: KnowledgeType[];
  tags?: string[];
  ids?: string[];
  level?: KnowledgeLevel[];
  since?: string; // ISO date — only entries updated since
}

/** Import options */
export interface ImportOptions {
  scope?: string;
  type?: KnowledgeType[];
  conflict: ConflictStrategy;
  dryRun: boolean;
}

/** Artifact produced by export — tailored for a specific agent */
export interface AgentArtifact {
  target: string;
  content: string;
  filePath: string;
  format: string;
  entryCount: number;
}

/** Sync capabilities declaration per agent target */
export interface SyncCapabilities {
  directExport: boolean;
  directImport: boolean;
  conversationFallback: boolean;
  supportedTypes: KnowledgeType[];
}

/** Bidirectional knowledge sync plugin interface */
export interface KnowledgeSyncPlugin {
  target: string;
  capabilities: SyncCapabilities;

  /** Export: convert MumuSpec knowledge entries to agent-readable artifact */
  formatForAgent(entries: KnowledgePage[], opts: ExportOptions): AgentArtifact;

  /** Import: parse agent source text into MumuSpec knowledge entries */
  parseFromAgent(source: string, opts: ImportOptions): KnowledgePage[];

  /** Generate conversation push prompt (for 'tell' command) */
  getExportPrompt?(entries: KnowledgePage[], opts: ExportOptions): string;

  /** Generate extract prompt (for 'absorb' command) */
  getExtractPrompt?(): string;

  /** Parse agent's conversation response back into entries */
  parseConversationResponse?(response: string): KnowledgePage[];

  /** Resolve conflict between existing and incoming entry */
  resolveConflict?(
    existing: KnowledgePage,
    incoming: KnowledgePage,
    strategy: ConflictStrategy,
  ): 'skip' | 'replace' | 'rename';
}

/** Conversation message for tell/absorb workflows */
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Import conflict record */
export interface ImportConflict {
  existing_id: string;
  incoming_title: string;
  similarity: number; // 0-1 title similarity
  strategy: ConflictStrategy;
  resolved: boolean;
  resolution?: 'skipped' | 'replaced' | 'renamed';
}

/** Knowledge usage metrics */
export interface KnowledgeMetrics {
  stats: {
    total_queries: number;
    cache_hits: number;
    exports: Record<string, number>;
    imports: Record<string, number>;
    by_type: Record<string, number>;
    unused_threshold_days: number;
  };
}

/** Search result with relevance score */
export interface KnowledgeSearchResult {
  entry: PageIndexEntry;
  score: number;
  matchedFields: string[];
  excerpt: string;
}

// ========== Code Graph Types (0.20.0+ — lightweight in-memory graph) ==========

/** Node labels in the code graph */
export type GraphNodeLabel = 'File' | 'Function' | 'Class' | 'Module' | 'Spec';

/** A node in the code graph */
export interface GraphNode {
  id: string;
  label: GraphNodeLabel;
  name: string;
  filePath?: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  hash?: string;
  scope?: string;
  specType?: 'SHALL' | 'SHALL_NOT';
}

/** Edge types in the code graph */
export type GraphEdgeType = 'DEFINES' | 'CALLS' | 'GOVERNED_BY' | 'CONTAINS';

/** A directed edge in the code graph */
export interface GraphEdge {
  from: string;
  to: string;
  type: GraphEdgeType;
}

/** The in-memory code graph */
export interface CodeGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  fileIndex: Map<string, string[]>;
  builtAt: string;
}

/** A symbol extracted from source code by a language provider */
export interface ExtractedSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface';
  startLine: number;
  endLine: number;
}

/** Search result from the code graph */
export interface GraphSearchResult {
  node: GraphNode;
  score: number;
}

/** Export/import operation result */
export interface SyncOperationResult {
  operation: 'export' | 'import' | 'tell' | 'absorb';
  target: string;
  entryCount: number;
  conflicts: ImportConflict[];
  artifact?: AgentArtifact;
  dryRun: boolean;
  timestamp: string;
}
