/**
 * Tests for src/change/lifecycle.ts — createChange, discardChange, validateScope,
 * escalateChange, saveSnapshot, initTestCases, lockTestCases, verifyTestCases,
 * initBuildLayers, updateBuildLayerStatus
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MumuSpecError } from '../../src/core/errors.js';

// Mock dependencies  
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
}));

vi.mock('../../src/change/listing.js', () => ({
  getActiveChange: vi.fn(() => null),
}));

// Import after mock
import {
  createChange,
  discardChange,
  validateScope,
  escalateChange,
  saveSnapshot,
  initTestCases,
  lockTestCases,
  verifyTestCases,
  initBuildLayers,
  updateBuildLayerStatus,
} from '../../src/change/lifecycle.js';

const mockSaveState = vi.fn();
const mockLoadState = vi.fn();

vi.mock('../../src/change/state.js', () => ({
  saveChangeState: (...args: unknown[]) => mockSaveState(...args),
  loadChangeState: (...args: unknown[]) => mockLoadState(...args),
}));

let testRoot: string;

beforeEach(() => {
  testRoot = join(tmpdir(), `mumuspec-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

// ========== validateScope ==========

describe('validateScope', () => {
  it('accepts scopes within subtree', () => {
    const result = validateScope(testRoot, 'src/core', ['src/core/utils.ts', 'src/core/config.ts']);
    expect(result.valid).toBe(true);
    expect(result.overflowPaths).toEqual([]);
  });

  it('rejects scopes outside the given scope', () => {
    const result = validateScope(testRoot, 'src/core', ['src/cli/index.ts']);
    expect(result.valid).toBe(false);
    expect(result.overflowPaths).toContain('src/cli/index.ts');
  });

  it('treats "." as root (always valid)', () => {
    const result = validateScope(testRoot, '.', ['src/core/utils.ts']);
    expect(result.valid).toBe(true);
  });

  it('accepts "." as a matching scope', () => {
    const result = validateScope(testRoot, 'src', ['.']);
    expect(result.valid).toBe(true);
  });

  it('accepts empty string scope as matching', () => {
    const result = validateScope(testRoot, 'src', ['']);
    expect(result.valid).toBe(true);
  });

  it('accepts exact scope match', () => {
    const result = validateScope(testRoot, 'src/core', ['src/core']);
    expect(result.valid).toBe(true);
  });
});

// ========== createChange ==========

describe('createChange', () => {
  it('creates a change with correct initial state', () => {
    const state = createChange(testRoot, 'test-change', 'full', defaultConfig(), ['src/core/utils.ts']);
    expect(state.name).toBe('test-change');
    expect(state.phase).toBe('open');
    expect(state.workflow).toBe('full');
    expect(state.scope).toBe('.');
    expect(state.affected_scopes).toEqual(['src/core/utils.ts']);
    expect(state.rollback_limit).toBe(3);
    expect(state.rebuild_limit).toBe(5);
  });

  it('creates proposal.md and directories', () => {
    createChange(testRoot, 'test-change', 'full', defaultConfig(), ['src/core/']);
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'test-change');
    expect(existsSync(join(changeDir, 'proposal.md'))).toBe(true);
    expect(existsSync(join(changeDir, 'delta-specs'))).toBe(true);
    expect(existsSync(join(changeDir, 'constraints'))).toBe(true);
    expect(existsSync(join(changeDir, 'test-cases'))).toBe(true);
    expect(existsSync(join(changeDir, 'code-graph'))).toBe(true);
    expect(existsSync(join(changeDir, 'decisions.md'))).toBe(true);
    expect(existsSync(join(changeDir, 'snapshots'))).toBe(true);
  });

  it('single_active_change blocks new create when active exists', async () => {
    const { getActiveChange } = await import('../../src/change/listing.js');
    (getActiveChange as ReturnType<typeof vi.fn>).mockReturnValueOnce('other-change');

    expect(() => {
      createChange(testRoot, 'new-change', 'full', defaultConfig());
    }).toThrow(MumuSpecError);
  });

  it('hotfix workflow creates single build layer at layer 0', () => {
    const state = createChange(testRoot, 'hotfix-test', 'hotfix', defaultConfig(), ['src/bug.ts']);
    expect(state.build_layers).toHaveLength(1);
    expect(state.build_layers[0].layer).toBe(0);
    expect(state.build_layers[0].scope).toBe('src/bug.ts');
    expect(state.build_layers[0].status).toBe('pending');
  });

  it('tweak workflow creates single build layer', () => {
    const state = createChange(testRoot, 'tweak-test', 'tweak', defaultConfig(), ['src/refactor.ts']);
    expect(state.build_layers).toHaveLength(1);
    expect(state.build_layers[0].layer).toBe(0);
  });

  it('loop workflow skips to build phase', () => {
    const state = createChange(testRoot, 'loop-test', 'loop', defaultConfig(), []);
    expect(state.phase).toBe('build');
    expect(state.build_layers).toHaveLength(1);
  });

  it('throws E-CHANGE-008 when scope overflows', () => {
    const config = defaultConfig();
    expect(() => {
      createChange(testRoot, 'bad-scope', 'full', config, ['src/other/file.ts'], 'src/core');
    }).toThrow(MumuSpecError);
  });

  it('saves state via saveChangeState', () => {
    createChange(testRoot, 'save-test', 'full', defaultConfig());
    expect(mockSaveState).toHaveBeenCalled();
  });
});

// ========== discardChange ==========

describe('discardChange', () => {
  function createAndSetupDiscard(): void {
    createChange(testRoot, 'discard-me', 'full', defaultConfig());
    mockLoadState.mockImplementation((_root: string, name: string) => {
      return {
        name,
        phase: 'design',
        workflow: 'full',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        scope: '.',
        affected_scopes: [],
        build_layers: [],
        test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
        rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
        build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
        single_active_change: true, user_confirmed: false,
        decisions_log: { counts: {} }, rollback_history: [],
        cognitive_framework: { enabled: false, q1_count: 0, q2_pending: 0, q3_pending: 0, q4_scans_completed: 0, converged: false, rounds_completed: 0 },
        hyperplan_result: { triggered: false, hard_constraints_merged: true, open_questions_resolved: true, degraded: false },
        feedback_log: { entries: [], session_links: [] },
      };
    });
  }

  it('discards change and sets phase to discarded', () => {
    createAndSetupDiscard();
    discardChange(testRoot, 'discard-me', 'no longer needed');
    expect(mockSaveState).toHaveBeenCalled();
    const savedState = mockSaveState.mock.calls[mockSaveState.mock.calls.length - 1][2];
    expect(savedState.phase).toBe('discarded');
  });

  it('throws for non-existent change', () => {
    mockLoadState.mockReturnValue(null);
    expect(() => {
      discardChange(testRoot, 'nonexistent', 'reason');
    }).toThrow('Change not found');
  });

  it('throws E-CHANGE-006 when phase is archive-completed', () => {
    mockLoadState.mockReturnValue({
      name: 'archived', phase: 'archive-completed', workflow: 'full',
      created_at: '', updated_at: '', scope: '.', affected_scopes: [],
      build_layers: [], test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });
    expect(() => {
      discardChange(testRoot, 'archived', 'reason');
    }).toThrow(MumuSpecError);
  });
});

// ========== saveSnapshot ==========

describe('saveSnapshot', () => {
  it('creates snapshot directory and copies artifacts', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'snap-change');
    mkdirSync(changeDir, { recursive: true });
    writeFileSync(join(changeDir, 'design.md'), '# Design');
    writeFileSync(join(changeDir, 'tasks.md'), '# Tasks');

    const snapDir = saveSnapshot(testRoot, 'snap-change', 'v1');
    expect(existsSync(snapDir)).toBe(true);
    expect(existsSync(join(snapDir, 'design.md'))).toBe(true);
    expect(existsSync(join(snapDir, 'tasks.md'))).toBe(true);
  });

  it('ignores missing artifact files', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'sparse-change');
    mkdirSync(changeDir, { recursive: true });

    const snapDir = saveSnapshot(testRoot, 'sparse-change', 'v1');
    expect(existsSync(snapDir)).toBe(true);
  });
});

// ========== initTestCases ==========

describe('initTestCases', () => {
  it('creates test case markdown files for each layer', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'tc-change');
    mkdirSync(changeDir, { recursive: true });

    initTestCases(testRoot, 'tc-change', [0, 1, 2]);
    expect(existsSync(join(changeDir, 'test-cases', 'layer-0-cases.md'))).toBe(true);
    expect(existsSync(join(changeDir, 'test-cases', 'layer-1-cases.md'))).toBe(true);
    expect(existsSync(join(changeDir, 'test-cases', 'layer-2-cases.md'))).toBe(true);
  });
});

// ========== lockTestCases & verifyTestCases ==========

describe('lockTestCases and verifyTestCases', () => {
  it('locks test cases and stores hash', () => {
    const changeDir = join(testRoot, '.mumuspec', 'changes', 'lock-tc');
    mkdirSync(join(changeDir, 'test-cases'), { recursive: true });
    writeFileSync(join(changeDir, 'test-cases', 'layer-0-cases.md'), '# Layer 0\nTest me');

    mockLoadState.mockReturnValue({
      name: 'lock-tc', phase: 'design', workflow: 'full',
      created_at: '', updated_at: '', scope: '.', affected_scopes: [],
      build_layers: [], test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    const hash = lockTestCases(testRoot, 'lock-tc');
    expect(hash).toBeDefined();
    expect(mockSaveState).toHaveBeenCalled();
    const savedState = mockSaveState.mock.calls[mockSaveState.mock.calls.length - 1][2];
    expect(savedState.test_cases.design_locked).toBe(true);
    expect(savedState.test_cases.design_content_hash).toBe(hash);
  });

  it('verifyTestCases returns valid=true when not locked', () => {
    mockLoadState.mockReturnValue({
      name: 'verify-tc', phase: 'design', workflow: 'full',
      created_at: '', updated_at: '', scope: '.', affected_scopes: [],
      test_cases: { design_locked: false },
    });
    const result = verifyTestCases(testRoot, 'verify-tc');
    expect(result.valid).toBe(true);
  });

  it('verifyTestCases returns valid=false for state without change', () => {
    mockLoadState.mockReturnValue(null);
    const result = verifyTestCases(testRoot, 'missing');
    expect(result.valid).toBe(false);
  });
});

// ========== initBuildLayers ==========

describe('initBuildLayers', () => {
  it('initializes build layers from config', () => {
    mockLoadState.mockReturnValue({
      name: 'layers-tc', phase: 'design', workflow: 'full',
      created_at: '', updated_at: '', scope: '.', affected_scopes: [],
      build_layers: [], test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    initBuildLayers(testRoot, 'layers-tc', [
      { layer: 0, scope: 'src/core' },
      { layer: 1, scope: 'src/cli' },
    ]);
    expect(mockSaveState).toHaveBeenCalled();
    const savedState = mockSaveState.mock.calls[mockSaveState.mock.calls.length - 1][2];
    expect(savedState.build_layers).toHaveLength(2);
    expect(savedState.build_layers[0].status).toBe('pending');
    expect(savedState.build_layers[1].status).toBe('pending');
  });
});

// ========== updateBuildLayerStatus ==========

describe('updateBuildLayerStatus', () => {
  it('updates layer status', () => {
    mockLoadState.mockReturnValue({
      name: 'status-tc', phase: 'build', workflow: 'full',
      created_at: '', updated_at: '', scope: '.', affected_scopes: [],
      build_layers: [{ layer: 0, scope: 'src/core', status: 'pending' }],
      test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    updateBuildLayerStatus(testRoot, 'status-tc', 0, 'in-progress');
    const savedState = mockSaveState.mock.calls[mockSaveState.mock.calls.length - 1][2];
    expect(savedState.build_layers[0].status).toBe('in-progress');
  });

  it('throws for non-existent layer', () => {
    mockLoadState.mockReturnValue({
      name: 'layer-missing', phase: 'build', workflow: 'full',
      created_at: '', updated_at: '', scope: '.', affected_scopes: [],
      build_layers: [],
      test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0, rebuild_count: 0, rollback_limit: 3, rebuild_limit: 5,
      build_mode: 'safe', tdd_mode: 'tdd', isolation: 'worktree',
      single_active_change: true, user_confirmed: false,
      decisions_log: { counts: {} }, rollback_history: [],
    });

    expect(() => {
      updateBuildLayerStatus(testRoot, 'layer-missing', 99, 'done');
    }).toThrow('Layer 99 not found');
  });
});
