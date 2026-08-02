/**
 * Adapter interface — reserved for post-MVP real data integration.
 * MVP: 完全封闭，所有数据来自 mock。
 */

import type { GraphData } from './graph';
import type { ChatMessage } from './chat';
import type { KnowledgeItem } from './qa';

export interface DashboardAdapter {
  fetchGraph(): Promise<GraphData>;
  fetchKnowledge(): Promise<KnowledgeItem[]>;
  submitChat(messages: ChatMessage[]): Promise<void>;
}

// ponytail: 当前不提供实现，避免未被请求的抽象层
