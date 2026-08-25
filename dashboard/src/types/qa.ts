/**
 * QA domain types.
 */

export interface KnowledgeItem {
  id: string;
  title: string;
  body: string;
  tags: string[];
  relatedNodeId?: string;
}

export interface QAResult {
  item: KnowledgeItem;
  score: number;
}

export interface QARequest {
  query: string;
  timestamp: string; // ISO
}
