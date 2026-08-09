/**
 * Tests for src/change/branch.ts — branch lifecycle.
 *
 * Strategy: mock core/git.js + change state/listing to test branch naming,
 * per-branch single active, merge gate checks, and commit behavior.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const gitMocks = vi.hoisted(() => ({
  getCurrentBranch: vi.fn(),
  createBranch: vi.fn(),
  switchBranch: vi.fn(),
  isWorkingTreeClean: vi.fn(),
  getMainBranch: vi.fn(),
  mergeNoFF: vi.fn(),
  getMergeConflicts: vi.fn(),
  commitAll: vi.fn(),
  branchExists: vi.fn(),
  deleteBranch: vi.fn(),
  getHeadSha: vi.fn(),
}));

const stateMocks = vi.hoisted(() => ({
  loadChangeState: vi.fn(),
  saveChangeState: vi.fn(),
}));

const listingMocks = vi.hoisted(() => ({
  listActiveChanges: vi.fn(),
}));

const utilsMocks = vi.hoisted(() => ({
  now: vi.fn(() => '2026-08-08T10:00:00.000Z'),
  appendAuditLog: vi.fn(),
  getMumuSpecDir: vi.fn((r: string) => `${r}/.mumuspec`),
  validateChangeName: vi.fn(() => true),
  ensureDir: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
  rmSync: vi.fn(),
}));

vi.mock('../../src/core/git.js', () => gitMocks);
vi.mock('../../src/change/state.js', () => stateMocks);
vi.mock('../../src/change/listing.js', () => listingMocks);
vi.mock('../../src/core/utils.js', () => utilsMocks);
vi.mock('../../src/core/config.js', () => ({
  loadConfig: vi.fn(() => ({
    changes: { branch_prefix: 'mumuspec', default_isolation: 'branch' },
    workflow: { single_active_change: true },
  })),
}));
vi.mock('node:fs', () => fsMocks);

import {
  getChangeBranchName,
  ensureChangeBranch,
  rollbackChangeCreation,
  getActiveChangeOnBranch,
  commitChangeBranch,
  checkMergeGate,
  mergeArchivedChange,
} from '../../src/change/branch.js';
import type { ChangeState } from '../../src/core/types.js';

function makeState(partial: Partial<ChangeState>): ChangeState {
  return {
    name: 'demo',
    phase: 'open',
    workflow: 'full',
    created_at: '2026-08-08T00:00:00.000Z',
    updated_at: '2026-08-08T00:00:00.000Z',
    affected_scopes: ['.'],
    build_layers: [],
    test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 5,
    build_mode: 'executing-plans',
    tdd_mode: 'tdd',
    isolation: 'branch',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {} },
    rollback_history: [],
    ...partial,
  };
}

describe('branch.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getChangeBranchName', () => {
    it('uses prefix + change name', () => {
      expect(getChangeBranchName('/r', 'demo', { changes: { branch_prefix: 'mumuspec' } } as any)).toBe('mumuspec/demo');
    });

    it('falls back to mumuspec prefix when unset', () => {
      expect(getChangeBranchName('/r', 'demo', { changes: {} } as any)).toBe('mumuspec/demo');
    });
  });

  describe('ensureChangeBranch', () => {
    it('creates branch when missing', () => {
      gitMocks.branchExists.mockReturnValue(false);
      gitMocks.createBranch.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      ensureChangeBranch('/r', 'demo');
      expect(gitMocks.createBranch).toHaveBeenCalledWith('/r', 'mumuspec/demo');
      expect(gitMocks.switchBranch).not.toHaveBeenCalled();
    });

    it('switches when branch already exists', () => {
      gitMocks.branchExists.mockReturnValue(true);
      gitMocks.switchBranch.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      ensureChangeBranch('/r', 'demo');
      expect(gitMocks.switchBranch).toHaveBeenCalledWith('/r', 'mumuspec/demo');
      expect(gitMocks.createBranch).not.toHaveBeenCalled();
    });
  });

  describe('rollbackChangeCreation', () => {
    it('calls rmSync on change dir (no throw)', () => {
      fsMocks.rmSync.mockImplementation(() => undefined);
      rollbackChangeCreation('/r', 'demo');
      expect(fsMocks.rmSync).toHaveBeenCalled();
    });
  });

  describe('getActiveChangeOnBranch', () => {
    it('finds change whose branch matches', () => {
      listingMocks.listActiveChanges.mockReturnValue(['demo']);
      stateMocks.loadChangeState.mockReturnValue(makeState({ branch: 'mumuspec/demo', phase: 'build' }));
      expect(getActiveChangeOnBranch('/r', 'mumuspec/demo')).toBe('demo');
    });

    it('ignores archived/discarded changes', () => {
      listingMocks.listActiveChanges.mockReturnValue(['demo']);
      stateMocks.loadChangeState.mockReturnValue(makeState({ branch: 'mumuspec/demo', phase: 'archive-completed' }));
      expect(getActiveChangeOnBranch('/r', 'mumuspec/demo')).toBeUndefined();
    });

    it('legacy fallback: single active change without branch field', () => {
      listingMocks.listActiveChanges.mockReturnValue(['legacy']);
      stateMocks.loadChangeState.mockReturnValue(makeState({ branch: undefined, phase: 'open' }));
      expect(getActiveChangeOnBranch('/r', 'mumuspec/other')).toBe('legacy');
    });

    it('no fallback when multiple active changes lack branch', () => {
      listingMocks.listActiveChanges.mockReturnValue(['a', 'b']);
      stateMocks.loadChangeState.mockReturnValue(makeState({ branch: undefined, phase: 'open' }));
      expect(getActiveChangeOnBranch('/r', 'mumuspec/other')).toBeUndefined();
    });

    it('skips missing state', () => {
      listingMocks.listActiveChanges.mockReturnValue(['demo']);
      stateMocks.loadChangeState.mockReturnValue(undefined);
      expect(getActiveChangeOnBranch('/r', 'x')).toBeUndefined();
    });
  });

  describe('commitChangeBranch', () => {
    it('commits all, sets branch_status handled, saves state', () => {
      gitMocks.commitAll.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      const state = makeState({ phase: 'verify' });
      commitChangeBranch('/r', 'demo', state);
      expect(gitMocks.commitAll).toHaveBeenCalledWith('/r', expect.stringContaining('demo'));
      expect(state.branch_status).toBe('handled');
      expect(stateMocks.saveChangeState).toHaveBeenCalledWith('/r', 'demo', state);
    });

    it('no-op for terminal phases', () => {
      const state = makeState({ phase: 'discarded' });
      commitChangeBranch('/r', 'demo', state);
      expect(gitMocks.commitAll).not.toHaveBeenCalled();
    });
  });

  describe('checkMergeGate', () => {
    it('E-MERGE-001 when state missing', () => {
      stateMocks.loadChangeState.mockReturnValue(undefined);
      const r = checkMergeGate('/r', 'nope');
      expect(r.passed).toBe(false);
      expect(r.errors.some((e) => e.code === 'E-MERGE-001')).toBe(true);
    });

    it('passes when all gate checks satisfy', () => {
      stateMocks.loadChangeState.mockReturnValue(
        makeState({ phase: 'archive-completed', branch_status: 'handled', branch: 'mumuspec/demo', isolation: 'branch' }),
      );
      gitMocks.getCurrentBranch.mockReturnValue('master');
      gitMocks.isWorkingTreeClean.mockReturnValue(true);
      gitMocks.branchExists.mockReturnValue(true);
      gitMocks.getMainBranch.mockReturnValue('master');
      const r = checkMergeGate('/r', 'demo');
      expect(r.passed).toBe(true);
      expect(r.errors).toEqual([]);
    });

    it('E-MERGE-002 when not archived', () => {
      stateMocks.loadChangeState.mockReturnValue(makeState({ phase: 'verify', branch_status: 'handled', branch: 'mumuspec/demo' }));
      const r = checkMergeGate('/r', 'demo');
      expect(r.errors.some((e) => e.code === 'E-MERGE-002')).toBe(true);
    });

    it('E-MERGE-003 when branch_status pending', () => {
      stateMocks.loadChangeState.mockReturnValue(makeState({ phase: 'archive-completed', branch_status: 'pending', branch: 'mumuspec/demo' }));
      const r = checkMergeGate('/r', 'demo');
      expect(r.errors.some((e) => e.code === 'E-MERGE-003')).toBe(true);
    });

    it('E-MERGE-004 when isolation not branch', () => {
      stateMocks.loadChangeState.mockReturnValue(
        makeState({ phase: 'archive-completed', branch_status: 'handled', branch: undefined, isolation: 'worktree' }),
      );
      const r = checkMergeGate('/r', 'demo');
      expect(r.errors.some((e) => e.code === 'E-MERGE-004')).toBe(true);
    });

    it('E-MERGE-005 when on the change branch itself', () => {
      stateMocks.loadChangeState.mockReturnValue(makeState({ phase: 'archive-completed', branch_status: 'handled', branch: 'mumuspec/demo' }));
      gitMocks.getCurrentBranch.mockReturnValue('mumuspec/demo');
      const r = checkMergeGate('/r', 'demo');
      expect(r.errors.some((e) => e.code === 'E-MERGE-005')).toBe(true);
    });

    it('E-MERGE-006 when working tree dirty', () => {
      stateMocks.loadChangeState.mockReturnValue(makeState({ phase: 'archive-completed', branch_status: 'handled', branch: 'mumuspec/demo' }));
      gitMocks.getCurrentBranch.mockReturnValue('master');
      gitMocks.isWorkingTreeClean.mockReturnValue(false);
      const r = checkMergeGate('/r', 'demo');
      expect(r.errors.some((e) => e.code === 'E-MERGE-006')).toBe(true);
    });

    it('E-MERGE-007 when branch missing', () => {
      stateMocks.loadChangeState.mockReturnValue(makeState({ phase: 'archive-completed', branch_status: 'handled', branch: 'mumuspec/demo' }));
      gitMocks.getCurrentBranch.mockReturnValue('master');
      gitMocks.isWorkingTreeClean.mockReturnValue(true);
      gitMocks.branchExists.mockReturnValue(false);
      const r = checkMergeGate('/r', 'demo');
      expect(r.errors.some((e) => e.code === 'E-MERGE-007')).toBe(true);
    });

    it('E-MERGE-008 when no main branch', () => {
      stateMocks.loadChangeState.mockReturnValue(makeState({ phase: 'archive-completed', branch_status: 'handled', branch: 'mumuspec/demo' }));
      gitMocks.getCurrentBranch.mockReturnValue('master');
      gitMocks.isWorkingTreeClean.mockReturnValue(true);
      gitMocks.branchExists.mockReturnValue(true);
      gitMocks.getMainBranch.mockImplementation(() => {
        throw new Error('E-GIT-003');
      });
      const r = checkMergeGate('/r', 'demo');
      expect(r.errors.some((e) => e.code === 'E-MERGE-008')).toBe(true);
    });
  });

  describe('mergeArchivedChange', () => {
    beforeEach(() => {
      stateMocks.loadChangeState.mockReturnValue(
        makeState({ phase: 'archive-completed', branch_status: 'handled', branch: 'mumuspec/demo', isolation: 'branch' }),
      );
      gitMocks.getCurrentBranch.mockReturnValue('master');
      gitMocks.isWorkingTreeClean.mockReturnValue(true);
      gitMocks.branchExists.mockReturnValue(true);
      gitMocks.getMainBranch.mockReturnValue('master');
      gitMocks.mergeNoFF.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      gitMocks.getMergeConflicts.mockReturnValue([]);
      gitMocks.getHeadSha.mockReturnValue('abc123');
      gitMocks.deleteBranch.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    });

    it('switches to main, merges --no-ff, records git_merge, deletes branch', () => {
      const sha = mergeArchivedChange('/r', 'demo');
      expect(gitMocks.switchBranch).toHaveBeenCalledWith('/r', 'master');
      expect(gitMocks.mergeNoFF).toHaveBeenCalledWith('/r', 'mumuspec/demo', expect.stringContaining('demo'));
      expect(gitMocks.deleteBranch).toHaveBeenCalledWith('/r', 'mumuspec/demo');
      expect(sha).toBe('abc123');
      const saved = stateMocks.saveChangeState.mock.calls[0][2];
      expect(saved.git_merge).toEqual({ merged: true, commit_sha: 'abc123', strategy: 'no-ff' });
    });

    it('throws E-MERGE-009 when gate fails', () => {
      stateMocks.loadChangeState.mockReturnValue(makeState({ phase: 'verify', branch: 'mumuspec/demo' }));
      expect(() => mergeArchivedChange('/r', 'demo')).toThrowError(/E-MERGE-009/);
      expect(gitMocks.mergeNoFF).not.toHaveBeenCalled();
    });

    it('throws E-MERGE-010 on conflicts', () => {
      gitMocks.getMergeConflicts.mockReturnValue(['a.ts']);
      expect(() => mergeArchivedChange('/r', 'demo')).toThrowError(/E-MERGE-010/);
    });
  });
});
