import { describe, it, expect, vi } from 'vitest';
import { useDashboardStore } from '@/store/useDashboardStore';

describe('useDashboardStore', () => {
  it('TC-L2-004: focusNode sets selectedNodeId', () => {
    const { focusNode } = useDashboardStore.getState();
    focusNode('node-change-1');
    expect(useDashboardStore.getState().selectedNodeId).toBe('node-change-1');
  });

  it('TC-L2-004: focusNode triggers onNodeFocus listener', () => {
    const spy = vi.fn();
    useDashboardStore.getState().setOnNodeFocus(spy);
    useDashboardStore.getState().focusNode('spec-root');
    expect(spy).toHaveBeenCalledWith('spec-root');
  });

  it('TC-L2-005: submitQA with keyword hit populates qaResults', () => {
    useDashboardStore.getState().submitQA('ponytail');
    const { qaResults } = useDashboardStore.getState();
    expect(qaResults.length).toBeGreaterThan(0);
    for (let i = 1; i < qaResults.length; i += 1) {
      expect(qaResults[i - 1].score).toBeGreaterThanOrEqual(qaResults[i].score);
    }
  });

  it('TC-L2-005: submitQA empty query → empty results', () => {
    useDashboardStore.getState().submitQA('');
    expect(useDashboardStore.getState().qaResults).toEqual([]);
  });

  it('TC-L2-005: submitQA random word → empty results', () => {
    useDashboardStore.getState().submitQA('xyz123不存在的词');
    expect(useDashboardStore.getState().qaResults).toEqual([]);
  });
});
