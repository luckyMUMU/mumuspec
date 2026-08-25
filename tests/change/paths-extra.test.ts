/**
 * Supplementary tests for src/change/paths.ts — path generation utilities.
 *
 * Covers branches not in paths.test.ts:
 * - getChangesDir with explicit scope ("." and undefined)
 * - getArchiveDir with scope
 * - getArchivedChangeDir (exists/no-match/with-yaml/catch-block)
 * - getChangeDir with scope
 * - getChangeStatePath
 * - scopeToPath
 * - re-exported relative and sep
 *
 * node:fs is mocked selectively; node:path is kept real to avoid breaking
 * getMumuSpecDir which also imports from node:path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';

// ── Hoisted mocks for node:fs ──
const {
  mockExistsSync,
  mockReaddirSync,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
  };
});

// Import after mocks
const {
  getChangesDir,
  getArchiveDir,
  getArchivedChangeDir,
  getChangeDir,
  getChangeStatePath,
  scopeToPath,
  relative,
  sep,
} = await import('../../src/change/paths.js');

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

const FAKE_ROOT = 'D:\\project';

describe('paths.ts — getChangesDir with scope', () => {
  it('returns .mumuspec/changes when scope is "."', () => {
    const result = getChangesDir(FAKE_ROOT, '.');
    expect(result).toContain('.mumuspec');
    expect(result).toContain('changes');
    // Should NOT contain a scope subdirectory
    expect(result).toBe(join(FAKE_ROOT, '.mumuspec', 'changes'));
  });

  it('returns .mumuspec/changes when scope is undefined', () => {
    const result = getChangesDir(FAKE_ROOT, undefined);
    expect(result).toContain('.mumuspec');
    expect(result).toContain('changes');
  });

  it('returns scoped changes dir path when scope is provided', () => {
    const result = getChangesDir(FAKE_ROOT, 'packages/core');
    expect(result).toContain('packages');
    expect(result).toContain('core');
    expect(result).toContain('.mumuspec');
    expect(result).toContain('changes');
  });

  it('treats "." same as no scope (no extra directory)', () => {
    const resultWithDot = getChangesDir(FAKE_ROOT, '.');
    const resultUndefined = getChangesDir(FAKE_ROOT, undefined);
    expect(resultWithDot).toBe(resultUndefined);
  });
});

describe('paths.ts — getArchiveDir', () => {
  it('includes "archive" in the path', () => {
    const result = getArchiveDir(FAKE_ROOT);
    expect(result).toContain('archive');
  });

  it('returns scoped archive dir when scope is provided', () => {
    const result = getArchiveDir(FAKE_ROOT, 'sub/project');
    expect(result).toContain('archive');
    expect(result).toContain('sub');
    expect(result).toContain('project');
  });
});

describe('paths.ts — getArchivedChangeDir', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns undefined when archive dir does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = getArchivedChangeDir(FAKE_ROOT, 'my-change');
    expect(result).toBeUndefined();
  });

  it('returns undefined when no entries match the change name', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['2025-01-01-other-change', '2025-01-02-another']);

    const result = getArchivedChangeDir(FAKE_ROOT, 'my-change');
    expect(result).toBeUndefined();
  });

  it('returns path when entry exactly matches change name and yaml exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['my-change', 'other-change']);

    const result = getArchivedChangeDir(FAKE_ROOT, 'my-change');
    expect(result).toBeDefined();
    expect(result).toContain('my-change');
  });

  it('matches entry ending with -<changeName> and yaml exists', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['2025-03-15-feature-x']);

    const result = getArchivedChangeDir(FAKE_ROOT, 'feature-x');
    expect(result).toBeDefined();
    expect(result).toContain('2025-03-15-feature-x');
  });

  it('returns undefined when matching entry has no .mumuspec.yaml', () => {
    // existsSync: true for archiveDir, false for yaml check
    mockExistsSync.mockImplementation((filepath: string) => {
      return !filepath.includes('.mumuspec.yaml');
    });
    mockReaddirSync.mockReturnValue(['2025-01-01-no-yaml']);

    const result = getArchivedChangeDir(FAKE_ROOT, 'no-yaml');
    expect(result).toBeUndefined();
  });

  it('returns undefined when readdirSync throws (catch block)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const result = getArchivedChangeDir(FAKE_ROOT, 'any-change');
    expect(result).toBeUndefined();
  });
});

describe('paths.ts — getChangeDir', () => {
  it('constructs change dir without scope', () => {
    const result = getChangeDir(FAKE_ROOT, 'my-feature');
    expect(result).toContain('my-feature');
    expect(result).toContain('changes');
  });

  it('constructs change dir with scope', () => {
    const result = getChangeDir(FAKE_ROOT, 'scoped-feature', 'packages/lib');
    expect(result).toContain('scoped-feature');
    expect(result).toContain('packages');
    expect(result).toContain('lib');
  });
});

describe('paths.ts — getChangeStatePath', () => {
  it('returns .mumuspec.yaml path for a change', () => {
    const result = getChangeStatePath(FAKE_ROOT, 'my-change');
    expect(result).toContain('my-change');
    expect(result).toContain('.mumuspec.yaml');
  });

  it('includes scope in state path', () => {
    const result = getChangeStatePath(FAKE_ROOT, 'scoped-change', 'sub/pkg');
    expect(result).toContain('scoped-change');
    expect(result).toContain('.mumuspec.yaml');
  });
});

describe('paths.ts — scopeToPath', () => {
  it('returns projectRoot when scope is "."', () => {
    const result = scopeToPath(FAKE_ROOT, '.');
    expect(result).toBe(FAKE_ROOT);
  });

  it('joins projectRoot with scope using path.join', () => {
    const result = scopeToPath(FAKE_ROOT, 'packages/core');
    expect(result).toBe(join(FAKE_ROOT, 'packages/core'));
  });
});

describe('paths.ts — re-exports', () => {
  it('exports sep', () => {
    expect(sep).toBeDefined();
  });

  it('exports relative function', () => {
    expect(typeof relative).toBe('function');
  });
});
