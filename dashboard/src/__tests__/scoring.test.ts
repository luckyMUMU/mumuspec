import { describe, it, expect } from 'vitest';
import { scoreQuery, rankResults } from '@/utils/scoring';
import type { KnowledgeItem } from '@/types/qa';

const items: KnowledgeItem[] = [
  { id: 'k1', title: 'Ponytail 编码约束', body: '7 级优先级阶梯', tags: ['ponytail', 'constraint'] },
  { id: 'k2', title: 'Spec Layer 基础', body: '树状规范 + SHALL', tags: ['spec', 'shall'] },
  { id: 'k3', title: 'Change 工作流', body: '五阶段流程', tags: ['change', 'workflow'] },
];

describe('utils/scoring', () => {
  it('TC-L3-001: keyword hit yields positive score', () => {
    const r = scoreQuery('ponytail', items[0]);
    expect(r).toBeGreaterThan(0);
  });

  it('TC-L3-001: empty query returns 0', () => {
    expect(scoreQuery('', items[0])).toBe(0);
  });

  it('TC-L3-001: no match returns 0', () => {
    expect(scoreQuery('不存在的词xyz123', items[0])).toBe(0);
  });

  it('TC-L3-002: rankResults sorts by score descending', () => {
    const ranked = rankResults('spec', items);
    expect(ranked.length).toBeGreaterThan(0);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
  });

  it('TC-L3-002: all miss → empty array', () => {
    expect(rankResults('nothingmatches', items)).toEqual([]);
  });
});
