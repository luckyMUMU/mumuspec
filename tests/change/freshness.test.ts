/**
 * Tests for src/knowledge/freshness.ts — verifyKnowledge, listStalePages, supersedeKnowledge.
 *
 * Goal: increase src/knowledge/freshness.ts coverage beyond current ~86%.
 *
 * Uses real temporary directory with mock config and mocked dependencies
 * from knowledge/pages.ts and knowledge/index.ts. To get deterministic results
 * from verifyKnowledge (which internally calls new Date()), we use
 * vi.setSystemTime() to freeze the clock.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Fixed current time for deterministic freshness tests ────────────────
const NOW_ISO = '2026-08-22T10:00:00.000Z';
const NOW_TS = new Date(NOW_ISO).getTime();
const DAY = 1000 * 60 * 60 * 24;

function daysAgo(n: number): string {
  return new Date(NOW_TS - n * DAY).toISOString();
}

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('../../src/knowledge/pages.js', () => ({
  getKnowledgePage: vi.fn((_root: string, _config: unknown, id: string) => {
    const mockPages: Record<string, any> = {
      'decision-1': {
        path: '/tmp/knowledge/decisions/decision-1.md',
        frontmatter: {
          id: 'decision-1',
          title: 'Decision One',
          type: 'decision',
          status: 'confirmed',
          scope: 'core',
          created_at: daysAgo(200),
          verified_at: daysAgo(21),
        },
        content: 'Decision about core architecture',
      },
      'decision-2': {
        path: '/tmp/knowledge/decisions/decision-2.md',
        frontmatter: {
          id: 'decision-2',
          title: 'Decision Two',
          type: 'decision',
          status: 'confirmed',
          scope: 'api',
          created_at: daysAgo(600),
          verified_at: undefined,
        },
        content: 'Older decision — no verified_at',
      },
      'pattern-1': {
        path: '/tmp/knowledge/patterns/pattern-1.md',
        frontmatter: {
          id: 'pattern-1',
          title: 'Pattern One',
          type: 'pattern',
          status: 'confirmed',
          scope: 'cli',
          created_at: daysAgo(800),
          verified_at: daysAgo(780),
        },
        content: 'Very old pattern',
      },
    };
    return mockPages[id] || null;
  }),
  listKnowledgePages: vi.fn(() => [
    {
      path: '/tmp/knowledge/decisions/decision-1.md',
      frontmatter: {
        id: 'decision-1',
        title: 'Decision One',
        type: 'decision',
        status: 'confirmed',
        scope: 'core',
        created_at: daysAgo(200),
        verified_at: daysAgo(21),
      },
      content: 'recently verified',
    },
    {
      path: '/tmp/knowledge/decisions/decision-2.md',
      frontmatter: {
        id: 'decision-2',
        title: 'Decision Two',
        type: 'decision',
        status: 'confirmed',
        scope: 'api',
        created_at: daysAgo(600),
        verified_at: undefined,
      },
      content: 'uses created_at for verification',
    },
    {
      path: '/tmp/knowledge/patterns/pattern-1.md',
      frontmatter: {
        id: 'pattern-1',
        title: 'Pattern One',
        type: 'pattern',
        status: 'confirmed',
        scope: 'cli',
        created_at: daysAgo(800),
        verified_at: daysAgo(780),
      },
      content: 'very old — should be unverified',
    },
  ]),
}));

vi.mock('../../src/knowledge/index.js', () => ({
  updatePageIndex: vi.fn(() => {}),
}));

vi.mock('../../src/core/utils.js', () => ({
  writeText: vi.fn((_p: string, _c: string) => {}),
  createFrontmatter: vi.fn((data: Record<string, unknown>) => {
    const lines = Object.entries(data).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
    return `---\n${lines.join('\n')}\n---\n`;
  }),
  computeHash: vi.fn((s: string) => 'mock_hash_' + s.length),
  now: vi.fn(() => NOW_ISO),
  readText: vi.fn(() => 'content'),
  ensureDir: vi.fn(() => {}),
}));

// Import after mocks
import {
  verifyKnowledge,
  listStalePages,
  supersedeKnowledge,
} from '../../src/knowledge/freshness.js';

// ── Config fixtures ────────────────────────────────────────────────────

function makeConfig(overrides?: { warnDays?: number; errorDays?: number }) {
  return {
    knowledge: {
      freshness: {
        warn_after_days: overrides?.warnDays ?? 30,
        error_after_days: overrides?.errorDays ?? 90,
      },
      wiki: { dir: '.mumuspec/knowledge' },
      reverse_index: { file: '_reverse-index.yaml' },
    },
  } as any;
}

const TEST_ROOT = '/tmp/mumuspec-freshness-test';

// ── Tests ──────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.setSystemTime(NOW_ISO);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('verifyKnowledge', () => {
  it('returns fresh status for recently verified pages', () => {
    const config = makeConfig({ warnDays: 30, errorDays: 90 });
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'decision-1' });
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('decision-1');
    // decision-1: verified_at = 21 days ago, warn_after = 30, error_after = 90
    expect(results[0].status).toBe('fresh');
    expect(results[0].days_since_verify).toBe(21);
  });

  it('falls back to created_at when verified_at is undefined', () => {
    const config = makeConfig({ warnDays: 30, errorDays: 90 });
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'decision-2' });
    expect(results).toHaveLength(1);
    // decision-2: created_at = 600 days ago, no verified_at
    expect(results[0].status).toBe('unverified');
    expect(results[0].days_since_verify).toBe(600);
  });

  it('returns stale for pages past warn_after_days but under error_after_days', () => {
    // decision-1: verified_at = 21 days ago
    // warnDays = 10 means stale since 21 > 10
    const config = makeConfig({ warnDays: 10, errorDays: 30 });
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'decision-1' });
    expect(results[0].status).toBe('stale');
  });

  it('returns unverified for pages well past error_after_days', () => {
    const config = makeConfig({ warnDays: 30, errorDays: 90 });
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'pattern-1' });
    expect(results[0].status).toBe('unverified');
  });

  it('returns all pages when called with all=true', () => {
    const config = makeConfig({ warnDays: 30, errorDays: 90 });
    const results = verifyKnowledge(TEST_ROOT, config, { all: true });
    expect(results).toHaveLength(3);
    const freshResults = results.filter((r) => r.status === 'fresh');
    const unverifiedResults = results.filter((r) => r.status === 'unverified');
    expect(freshResults.length).toBe(1);
    expect(unverifiedResults.length).toBe(2);
  });

  it('returns all pages when called without id or all options', () => {
    const config = makeConfig();
    const results = verifyKnowledge(TEST_ROOT, config);
    expect(results).toHaveLength(3);
  });

  it('returns empty array when id matches no page', () => {
    const config = makeConfig();
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'nonexistent' });
    expect(results).toHaveLength(0);
  });
});

describe('listStalePages', () => {
  it('filters out fresh pages and includes stale/unverified', () => {
    const config = makeConfig({ warnDays: 30, errorDays: 90 });
    const stale = listStalePages(TEST_ROOT, config);
    const ids = stale.map((s) => s.id);
    expect(ids).not.toContain('decision-1'); // fresh
    expect(ids).toContain('decision-2'); // unverified
    expect(ids).toContain('pattern-1'); // unverified
  });

  it('includes title, days, and status fields', () => {
    const config = makeConfig({ warnDays: 30, errorDays: 90 });
    const stale = listStalePages(TEST_ROOT, config);
    for (const entry of stale) {
      expect(entry.title).toBeDefined();
      expect(entry.days).toBeGreaterThan(0);
      expect(entry.id).toBeTruthy();
      expect(['stale', 'unverified']).toContain(entry.status);
    }
  });

  it('uses title from page frontmatter', () => {
    const config = makeConfig({ warnDays: 30, errorDays: 90 });
    const stale = listStalePages(TEST_ROOT, config);
    const d2 = stale.find((s) => s.id === 'decision-2')!;
    expect(d2.title).toBe('Decision Two');
  });
});

describe('supersedeKnowledge', () => {
  it('throws when old page not found', () => {
    const config = makeConfig();
    expect(() => {
      supersedeKnowledge(TEST_ROOT, config, 'nonexistent-old', 'decision-1');
    }).toThrow('Knowledge page not found: nonexistent-old');
  });

  it('throws when new page not found', () => {
    const config = makeConfig();
    expect(() => {
      supersedeKnowledge(TEST_ROOT, config, 'decision-1', 'nonexistent-new');
    }).toThrow('Knowledge page not found: nonexistent-new');
  });

  it('successfully supersedes old page with new page (mocked file operations)', () => {
    const config = makeConfig();
    // Both 'decision-1' and 'decision-2' exist in our mock
    // writeText and createFrontmatter are mocked so no real I/O happens
    const fn = () => supersedeKnowledge(TEST_ROOT, config, 'decision-1', 'decision-2');
    expect(fn).not.toThrow();
  });
});

describe('verifyKnowledge — boundary conditions', () => {
  it('returns fresh at exactly warn threshold (days === warnDays)', () => {
    // decision-1: verified_at = 21 days ago
    // warnDays = 21 => fresh (21 > 21 is false)
    const config = makeConfig({ warnDays: 21, errorDays: 90 });
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'decision-1' });
    expect(results[0].status).toBe('fresh');
  });

  it('returns stale just above warn threshold', () => {
    // decision-1: 21 days. warnDays = 20 => 21 > 20 => stale
    const config = makeConfig({ warnDays: 20, errorDays: 90 });
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'decision-1' });
    expect(results[0].status).toBe('stale');
  });

  it('returns stale just below error threshold', () => {
    // pattern-1: 780 days. errorDays = 1000 => 780 < 1000 => stale (780 > 30)
    const config = makeConfig({ warnDays: 5, errorDays: 1000 });
    const results = verifyKnowledge(TEST_ROOT, config, { id: 'pattern-1' });
    expect(results[0].status).toBe('stale');
  });
});
