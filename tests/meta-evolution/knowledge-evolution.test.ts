/**
 * Tests for Knowledge Layer Meta-Evolution (R0) — TC-META-07.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeFreshness,
  analyzeAllFreshness,
  refreshPageIndex,
} from '../../src/meta-evolution/knowledge-evolution.js';

describe('analyzeFreshness', () => {
  // TC-META-07
  it('promotes frequently referenced pages', () => {
    const action = analyzeFreshness({
      pageId: 'kb-ts-config',
      currentFreshness: 'aging',
      lastReferenced: '2026-08-09T10:00:00Z',
      referenceCount: 8,
    });

    expect(action).not.toBeNull();
    expect(action?.action).toBe('promote_freshness');
    expect(action?.newValue).toBe('active');
  });

  it('demotes stale unused pages', () => {
    const action = analyzeFreshness({
      pageId: 'kb-legacy-api',
      currentFreshness: 'active',
      lastReferenced: '2026-01-01T00:00:00Z',
      referenceCount: 0,
    });

    expect(action).not.toBeNull();
    expect(action?.action).toBe('demote_freshness');
  });

  it('returns null when no change needed', () => {
    const action = analyzeFreshness({
      pageId: 'kb-ok',
      currentFreshness: 'active',
      lastReferenced: '2026-08-08T10:00:00Z',
      referenceCount: 3,
    });

    expect(action).toBeNull();
  });

  it('does not promote already active pages', () => {
    const action = analyzeFreshness({
      pageId: 'kb-already-active',
      currentFreshness: 'active',
      referenceCount: 10,
    });

    expect(action).toBeNull();
  });
});

describe('analyzeAllFreshness', () => {
  it('filters out no-op pages', () => {
    const actions = analyzeAllFreshness([
      { pageId: 'p1', currentFreshness: 'active', referenceCount: 10 },
      { pageId: 'p2', currentFreshness: 'aging', referenceCount: 8 },
      { pageId: 'p3', currentFreshness: 'aging', lastReferenced: '2026-08-09T10:00:00Z', referenceCount: 2 },
    ]);

    expect(actions).toHaveLength(1);
    expect(actions[0].pageId).toBe('p2');
  });
});

describe('refreshPageIndex', () => {
  it('creates a refresh action', () => {
    const action = refreshPageIndex('kb-drifted');
    expect(action.action).toBe('refresh_page_index');
    expect(action.pageId).toBe('kb-drifted');
  });
});
