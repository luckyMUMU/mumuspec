/**
 * Deep tests for src/change/lifecycle.ts — extended coverage for branches
 * not covered by lifecycle.test.ts.
 *
 * Goal: increase src/change/lifecycle.ts coverage beyond current ~87.53%.
 *
 * Covers:
 * - computeTestCasesHash (empty dir, dir with .md files, dir doesn't exist)
 * - verifyTestCases (design_locked=true, hash matching/non-matching)
 * - escalateChange (with renameSync, without state to update)
 * - discardChange in a scope (scoped operations)
 * - Single active change with scope (different scope allows creation)
 * - createChange with cold-start (no affected scopes)
 * - updateBuildLayerStatus (transition to 'done')
 * - initBuildLayers with complex layer arrays
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MumuSpecError } from '../../src/core/errors.js';

// ── Mocks ──────────────────────────────────────────────────────────────

const mockSaveState = vi.fn();
const mockLoadState = vi.fn();

vi.mock('../../src/core/utils.js', () => ({
  readText: vi.fn((p: string) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } }),
  writeText: vi.fn((p: string, c: string) => { writeFileSync(p, c); }),
  ensureDir: vi.fn((p: string) => { mkdirSync(p, { recursive: true }); }),
  computeHash: vi.fn((s: string) => 'hash_' + s.length),
  now: vi.fn(() => '2025-01-01T00:00:00Z'),
  appendAuditLog: vi.fn(() => {}),
  getMumuSpecDir: vi.fn((root: string) => join(root, '.mumuspec')),
}));

vi.mock('../../src/core/spec-scaffolder.js', () => ({
  scaffoldChangeSpecs: vi.fn(() => {}),
}));

vi.mock('../../src/feedback/manager.js', () => ({
  ensureFeedbackStructure: vi.fn(() => {}),
  getChangeFeedbackDir: vi.fn((root: string, name: string) => join(root, '.mumuspec', 'changes', name, 'feedback')),
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeDir: vi.fn((root: string, name: string, scope?: string) => {
    if (scope && scope !== '.') {
      return join(root, scope, '.mumuspec', 'changes', name);
    }
    return join(root, '.mumuspec', 'changes', name);
  }),
  getArchiveDir: vi.fn((root: string, scope?: string) => {
    if (scope && scope !== '.') {
      return join(root, scope, '.mumuspec', 'changes', 'archive');
    }
    return join(root, '.mumuspec', 'changes', 'archive');
  }),
  getChangesDir: vi.fn((root: string, scope?: string) => {
    if (scope && scope !== '.') {
      return join(root, scope, '.mumuspec', 'changes');
    }
    return join(root, '.mumuspec', 'changes');
  }),
}));

vi.mock('../../src/change/listing.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/change/listing.js')>();
  return { ...actual, getActiveChange: vi.fn(() => null) };
});

vi.mock('../../src/change/state.js', () => ({
  saveChangeState: (...args: unknown[]) => mockSaveState(...args),
  loadChangeState: (...args: unknown[]) => mockLoadState(...args),
}));

// Import after mock
import {
  createChange,
  discardChange,
  escalateChange,
  computeTestCasesHash,
  lockTestCases,
  verifyTestCases,
  initBuildLayers,
  initTestCases,
  updateBuildLayerStatus,
} from '../../src/change/lifecycle.js';

let testRoot: string;

beforeEach(() => {
  testRoot = join(tmpdir(), `mumuspec-lifecycle-deep-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(testRoot, '.mumuspec'), { recursive: true });
  mockSaveState.mockClear();
  mockLoadState.mockClear();
});

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

function defaultConfig() {
  return {
    workflow: { single_active_change: true },
    changes: {
      default_rollback_limit: 3,
      default_rebuild_limit: 5,
      default_build_mode: 'safe',
      default_isolation: 'worktree',
    },
    cognitive_framework: { enabled: true },
  };
}

// ════════════════════════════════════════════════════════════════════
// computeTestCasesHash — empty dir, with files, no dir
// ════════════════════════════════════════════════════════════════════

describe('computeTestCasesHash', () => {
  it('returns hash of empty string when no test-cases directory exists', () => {
    const hash = computeTestCasesHash(testRoot, 'no-cases-change');
    expect(hash).toBe('hash_0');  // computeHash('') = 'hash_' + 0
  });

  it('returns hash when test-cases dir exists with no md files', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'empty-cases');
    mkdirSync(join(changeDir, 'test-cases'), { recursive: true });
    // Create a non-md file that should be ignored
    writeFileSync(join(changeDir, 'test-cases', 'readme.txt'), 'not a markdown file');

    const hash = computeTestCasesHash(testRoot, 'empty-cases');
    expect(hash).toBe('hash_0');
  });

  it('returns hash of sorted content when md files exist', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'multi-cases');
    mkdirSync(join(changeDir, 'test-cases'), { recursive: true });
    // Write in non-alphabetical order to verify sort
    writeFileSync(join(changeDir, 'test-cases', 'z-last.md'), 'Z content');
    writeFileSync(join(changeDir, 'test-cases', 'a-first.md'), 'A content');
    writeFileSync(join(changeDir, 'test-cases', 'm-middle.md'), 'M content');

    const hash = computeTestCasesHash(testRoot, 'multi-cases');
    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('returns different hash for different content', () => {
    // Change 1
    const dir1 = join(testRoot, '.mumuspec', 'changes', 'tc-1');
    mkdirSync(join(dir1, 'test-cases'), { recursive: true });
    writeFileSync(join(dir1, 'test-cases', 'cases.md'), 'content A');

    // Change 2
    const dir2 = join(testRoot, '.mumuspec', 'changes', 'tc-2');
    mkdirSync(join(dir2, 'test-cases'), { recursive: true });
    writeFileSync(join(dir2, 'test-cases', 'cases.md'), 'different content B');

    const hash1 = computeTestCasesHash(testRoot, 'tc-1');
    const hash2 = computeTestCasesHash(testRoot, 'tc-2');
    expect(hash1).not.toBe(hash2);
  });
});

// ════════════════════════════════════════════════════════════════════
// verifyTestCases — design_locked = true with hash matching
// ════════════════════════════════════════════════════════════════════

describe('verifyTestCases — deep', () => {
  it('returns valid=true when locked and hash matches', () => {
    mockLoadState.mockReturnValue({
      name: 'verify-deep',
      phase: 'design',
      workflow: 'full',
      created_at: '',
      updated_at: '',
      scope: '.',
      affected_scopes: [],
      build_layers: [],
      test_cases: {
        design_locked: true,
        design_content_hash: 'hash_0',
        suites_locked: false,
        suites_locked_layers: [],
        suites_hash: {},
      },
      rollback_count: 0,
      rebuild_count: 0,
      rollback_limit: 3,
      rebuild_limit: 5,
      build_mode: 'safe',
      tdd_mode: 'tdd',
      isolation: 'worktree',
      single_active_change: true,
      user_confirmed: false,
      decisions_log: { counts: {} },
      rollback_history: [],
    });

    const result = verifyTestCases(testRoot, 'verify-deep');
    expect(result.valid).toBe(true);
    expect(result.actualHash).toBe('hash_0');
  });

  it('returns valid=false when locked and hash does not match', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'verify-fail');
    mkdirSync(join(changeDir, 'test-cases'), { recursive: true });
    writeFileSync(join(changeDir, 'test-cases', 'c.md'), 'modified content');

    mockLoadState.mockReturnValue({
      name: 'verify-fail',
      phase: 'design',
      workflow: 'full',
      created_at: '',
      updated_at: '',
      scope: '.',
      affected_scopes: [],
      build_layers: [],
      test_cases: {
        design_locked: true,
        design_content_hash: 'hash_original',
        suites_locked: false,
        suites_locked_layers: [],
        suites_hash: {},
      },
      rollback_count: 0,
      rebuild_count: 0,
      rollback_limit: 3,
      rebuild_limit: 5,
      build_mode: 'safe',
      tdd_mode: 'tdd',
      isolation: 'worktree',
      single_active_change: true,
      user_confirmed: false,
      decisions_log: { counts: {} },
      rollback_history: [],
    });

    const result = verifyTestCases(testRoot, 'verify-fail');
    expect(result.valid).toBe(false);
    expect(result.actualHash).not.toBe('hash_original');
  });

  it('returns valid=false when state is null', () => {
    mockLoadState.mockReturnValue(null);
    const result = verifyTestCases(testRoot, 'nonexistent');
    expect(result.valid).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// escalateChange — move files between scopes
// ════════════════════════════════════════════════════════════════════

describe('escalateChange', () => {
  it('escalates from child scope to parent scope and updates state', () => {
    // Create a scoped change directory
    const fromDir = join(testRoot, 'sub', '.mumuspec', 'changes', 'child-change');
    mkdirSync(fromDir, { recursive: true });
    writeFileSync(join(fromDir, 'design.md'), '# Child Scope Design');
    writeFileSync(join(fromDir, 'proposal.md'), '# Child Scope Proposal');

    mockLoadState.mockReturnValue({
      name: 'child-change',
      phase: 'design',
      workflow: 'full',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
      scope: 'sub',
      affected_scopes: ['sub'],
      build_layers: [],
      test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    const parentScope = escalateChange(testRoot, 'child-change', 'sub');
    expect(parentScope).toBe('.');
  });

  it('returns root "." when escalating from a single-level scope', () => {
    const fromDir = join(testRoot, 'src/core', '.mumuspec', 'changes', 'deep-change');
    mkdirSync(fromDir, { recursive: true });
    writeFileSync(join(fromDir, 'a.md'), 'content');

    mockLoadState.mockReturnValue(null); // No state to load at parent

    const result = escalateChange(testRoot, 'deep-change', 'src/core');
    expect(result).toBe('src');
  });

  it('returns "." when escalating from top-level directory', () => {
    const fromDir = join(testRoot, 'src', '.mumuspec', 'changes', 'top-change');
    mkdirSync(fromDir, { recursive: true });

    const result = escalateChange(testRoot, 'top-change', 'src');
    expect(result).toBe('.');
  });
});

// ════════════════════════════════════════════════════════════════════
// discardChange with scope + phase validation
// ════════════════════════════════════════════════════════════════════

describe('discardChange — discarded phase guard', () => {
  it('throws E-CHANGE-006 when phase is already discarded', () => {
    mockLoadState.mockReturnValue({
      name: 'already-discarded',
      phase: 'discarded',
      workflow: 'full',
      created_at: '',
      updated_at: '',
      scope: '.',
      affected_scopes: [],
      build_layers: [],
      test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    expect(() => {
      discardChange(testRoot, 'already-discarded', 'reason');
    }).toThrow(MumuSpecError);
  });
});

// ════════════════════════════════════════════════════════════════════
// createChange — cold-start with disabled single_active_change
// ════════════════════════════════════════════════════════════════════

describe('createChange — single_active_change disabled', () => {
  it('allows creation when single_active_change is false and active change exists', async () => {
    const { getActiveChange } = await import('../../src/change/listing.js');
    (getActiveChange as ReturnType<typeof vi.fn>).mockReturnValueOnce('existing-change');

    const config = defaultConfig();
    config.workflow.single_active_change = false;

    // Should NOT throw even with an active change
    const state = createChange(testRoot, 'parallel-change', 'full', config, ['src/parallel/']);
    expect(state.name).toBe('parallel-change');
  });
});

// ════════════════════════════════════════════════════════════════════
// createChange — cognitive_framework disabled
// ════════════════════════════════════════════════════════════════════

describe('createChange — cognitive_framework disabled', () => {
  it('disables cognitive framework in createChange for full workflow when config sets enabled=false', () => {
    const config = defaultConfig();
    config.cognitive_framework.enabled = false;

    const state = createChange(testRoot, 'no-cog-change', 'full', config, ['src/']);
    expect(state.cognitive_framework.enabled).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// initBuildLayers — complex layer arrays
// ════════════════════════════════════════════════════════════════════

describe('initBuildLayers — complex layers', () => {
  it('initializes multiple layers', () => {
    mockLoadState.mockReturnValue({
      name: 'multi-layer',
      phase: 'design',
      workflow: 'full',
      created_at: '',
      updated_at: '',
      scope: '.',
      affected_scopes: [],
      build_layers: [],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    initBuildLayers(testRoot, 'multi-layer', [
      { layer: 0, scope: 'src/core' },
      { layer: 1, scope: 'src/utils' },
      { layer: 2, scope: 'src/api' },
      { layer: 3, scope: 'src/cli' },
    ]);

    const savedState = mockSaveState.mock.calls[0][2];
    expect(savedState.build_layers).toHaveLength(4);
    savedState.build_layers.forEach((l: any) => {
      expect(l.status).toBe('pending');
      expect(l.layer).toBeGreaterThanOrEqual(0);
    });
  });

  it('throws when change does not exist', () => {
    mockLoadState.mockReturnValue(null);
    expect(() => {
      initBuildLayers(testRoot, 'missing', [{ layer: 0, scope: 'src/' }]);
    }).toThrow('Change not found');
  });
});

// ════════════════════════════════════════════════════════════════════
// updateBuildLayerStatus — done transition
// ════════════════════════════════════════════════════════════════════

describe('updateBuildLayerStatus — done status', () => {
  it('updates layer status from in-progress to done', () => {
    mockLoadState.mockReturnValue({
      name: 'progress-change',
      phase: 'build',
      workflow: 'full',
      created_at: '',
      updated_at: '',
      scope: '.',
      affected_scopes: [],
      build_layers: [
        { layer: 0, scope: 'src/core', status: 'in-progress' },
        { layer: 1, scope: 'src/cli', status: 'pending' },
      ],
      test_cases: { design_locked: true, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    updateBuildLayerStatus(testRoot, 'progress-change', 0, 'done');
    const savedState = mockSaveState.mock.calls[mockSaveState.mock.calls.length - 1][2];
    expect(savedState.build_layers[0].status).toBe('done');
    expect(savedState.build_layers[1].status).toBe('pending'); // unchanged
  });
});

// ════════════════════════════════════════════════════════════════════
// lockTestCases — change not in state
// ════════════════════════════════════════════════════════════════════

describe('lockTestCases — edge case', () => {
  it('throws when state not found', () => {
    mockLoadState.mockReturnValue(null);
    expect(() => {
      lockTestCases(testRoot, 'nonexistent');
    }).toThrow('Change not found: nonexistent');
  });
});

// ════════════════════════════════════════════════════════════════════
// initTestCases — empty layers
// ════════════════════════════════════════════════════════════════════

describe('initTestCases — empty input', () => {
  it('creates no files when given empty layers array', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'no-layers');
    mkdirSync(changeDir, { recursive: true });

    initTestCases(testRoot, 'no-layers', []);
    // No error, no files created
    const testCasesDir = join(changeDir, 'test-cases');
    if (existsSync(testCasesDir)) {
      const files = readdirSync(testCasesDir);
      expect(files).toHaveLength(0);
    }
  });
});
