import { describe, it, expect } from 'vitest';
import { mockGraphData } from '@/data/mock-graph';

describe('mock-graph', () => {
  it('TC-L3-005: node count >= 12', () => {
    expect(mockGraphData.nodes.length).toBeGreaterThanOrEqual(12);
  });

  it('TC-L3-005: change node count >= 3', () => {
    const changeNodes = mockGraphData.nodes.filter((n) => n.kind === 'Change');
    expect(changeNodes.length).toBeGreaterThanOrEqual(3);
  });

  it('TC-L3-005: edge count >= 12', () => {
    expect(mockGraphData.edges.length).toBeGreaterThanOrEqual(12);
  });

  it('TC-L3-005: all edges reference valid node ids', () => {
    const ids = new Set(mockGraphData.nodes.map((n) => n.id));
    for (const e of mockGraphData.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });
});
