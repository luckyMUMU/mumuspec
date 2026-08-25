/**
 * Load mock graph + knowledge data.
 * ponytail: 直接返回常量（不加 React Suspense 抽象）。
 */

import { useMemo } from 'react';
import { mockGraphData } from '@/data/mock-graph';
import { mockKnowledge } from '@/data/mock-knowledge';
import type { KnowledgeItem } from '@/types/qa';

export interface MockData {
  nodes: typeof mockGraphData.nodes;
  edges: typeof mockGraphData.edges;
  knowledge: KnowledgeItem[];
}

export function useMockData(): MockData {
  return useMemo(
    () => ({
      nodes: mockGraphData.nodes,
      edges: mockGraphData.edges,
      knowledge: mockKnowledge,
    }),
    [],
  );
}
