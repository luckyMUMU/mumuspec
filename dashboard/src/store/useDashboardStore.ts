/**
 * Zustand global store.
 * Q3-003: Chat/QA 通过 focusNode(id) 中介联动图谱，禁止直接 ref 调用。
 *
 * ponytail: 用 zustand create（L6 能一行 create? 不能 → 最小可工作）。
 */

import { create } from 'zustand';
import type {
  GraphNode,
  GraphEdge,
  ChangeEvent,
} from '@/types/graph';
import type { ChatMessage, Role } from '@/types/chat';
import type { QAResult } from '@/types/qa';
import { mockGraphData } from '@/data/mock-graph';
import { mockKnowledge } from '@/data/mock-knowledge';
import { rankResults } from '@/utils/scoring';

export type OnNodeFocusListener = (id: string) => void;

interface DashboardStore {
  // 图谱
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId: string | null;
  focusNode: (id: string) => void;
  setSelectedNode: (id: string | null) => void;
  onNodeFocus: OnNodeFocusListener | null;
  setOnNodeFocus: (fn: OnNodeFocusListener | null) => void;

  // Chat
  chatMessages: ChatMessage[];
  chatOpen: boolean;
  appendMessage: (m: ChatMessage) => void;
  toggleChat: () => void;

  // Onboard
  role: Role;
  onboardProgress: Record<string, number>;
  setRole: (r: Role) => void;
  advanceOnboard: (step: number) => void;

  // QA
  qaQuery: string;
  qaResults: QAResult[];
  submitQA: (q: string) => void;

  // Detail
  detailTimeline: ChangeEvent[];
}

const initialNodes = mockGraphData.nodes;
const initialEdges = mockGraphData.edges;
const knowledgeRef = mockKnowledge;

export const useDashboardStore = create<DashboardStore>((set, get) => ({
  nodes: initialNodes,
  edges: initialEdges,
  selectedNodeId: null,
  onNodeFocus: null,

  focusNode: (id) => {
    set({ selectedNodeId: id });
    get().onNodeFocus?.(id);
    const node = get().nodes.find((n) => n.id === id);
    set({ detailTimeline: node?.changeEvents ?? [] });
  },

  setSelectedNode: (id) => {
    set({ selectedNodeId: id });
    const node = get().nodes.find((n) => n.id === id);
    set({ detailTimeline: node?.changeEvents ?? [] });
  },

  setOnNodeFocus: (fn) => set({ onNodeFocus: fn }),

  chatMessages: [],
  chatOpen: true,
  appendMessage: (m) =>
    set((s) => ({ chatMessages: [...s.chatMessages, m] })),
  toggleChat: () => set((s) => ({ chatOpen: !s.chatOpen })),

  role: null,
  onboardProgress: {},
  setRole: (r) => set({ role: r }),
  advanceOnboard: (step) =>
    set((s) => ({
      onboardProgress: { ...s.onboardProgress, [s.role ?? '']: step },
    })),

  qaQuery: '',
  qaResults: [],
  submitQA: (q) => {
    if (!q.trim()) {
      set({ qaQuery: '', qaResults: [] });
      return;
    }
    const ranked = rankResults(q, knowledgeRef);
    set({ qaQuery: q, qaResults: ranked });
  },

  detailTimeline: [],
}));
