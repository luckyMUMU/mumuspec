import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMockData } from '@/hooks/useMockData';

describe('useMockData', () => {
  it('TC-L2-001: returns three arrays', () => {
    const { result } = renderHook(() => useMockData());
    expect(result.current.nodes.length).toBeGreaterThanOrEqual(12);
    expect(result.current.edges.length).toBeGreaterThanOrEqual(12);
    expect(result.current.knowledge.length).toBeGreaterThanOrEqual(6);
  });
});
