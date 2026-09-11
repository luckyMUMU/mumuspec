/**
 * Tests for branch commit failure handling — 提交失败必须中断，
 * 不得静默置位 branch_status 并记成功审计。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';

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
  saveChangeStateInDir: vi.fn(),
}));

const listingMocks = vi.hoisted(() => ({
  listActiveChanges: vi.fn(),
}));

const utilsMocks = vi.hoisted(() => ({
  now: vi.fn(() => '2026-09-12T10:00:00.000Z'),
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
vi.mock('node:fs', () => fsMocks);

import { commitChangeBranch } from '../../src/change/branch.js';
import { MumuSpecError } from '../../src/core/errors.js';

const PROJECT_ROOT = '/tmp/branch-commit';
const CHANGE_NAME = 'commit-check';

function makeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: CHANGE_NAME,
    phase: 'verify',
    workflow: 'full',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    affected_scopes: ['.'],
    build_layers: [],
    test_cases: {
      design_locked: true,
      suites_locked: true,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'incremental',
    tdd_mode: 'tdd',
    isolation: 'branch',
    branch: `mumuspec/${CHANGE_NAME}`,
    branch_status: 'pending',
    single_active_change: true,
    user_confirmed: true,
    decisions_log: { counts: {}, content_hash: 'hash' },
    rollback_history: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('L0-3 分支提交失败不标记已处理', () => {
  it('提交返回非 0 时抛错且不置位 branch_status', () => {
    gitMocks.commitAll.mockReturnValue({ status: 1, stdout: '', stderr: 'pre-commit hook failed' });
    const state = makeState();

    expect(() => commitChangeBranch(PROJECT_ROOT, CHANGE_NAME, state)).toThrow(MumuSpecError);
    expect(state.branch_status).toBe('pending');
    expect(stateMocks.saveChangeState).not.toHaveBeenCalled();
  });

  it('提交失败记录失败审计', () => {
    gitMocks.commitAll.mockReturnValue({ status: 128, stdout: '', stderr: 'nothing to commit' });

    expect(() => commitChangeBranch(PROJECT_ROOT, CHANGE_NAME, makeState())).toThrow();
    const auditCalls = utilsMocks.appendAuditLog.mock.calls.map((c) => c[1]);
    const failure = auditCalls.find((a: Record<string, unknown>) => a.action === 'change.branch_commit');
    expect(failure).toBeTruthy();
    expect(failure.result).toBe('failed');
  });

  it('提交成功时置位 branch_status 并保存', () => {
    gitMocks.commitAll.mockReturnValue({ status: 0, stdout: '[main abc] msg', stderr: '' });
    const state = makeState();

    commitChangeBranch(PROJECT_ROOT, CHANGE_NAME, state);

    expect(state.branch_status).toBe('handled');
    expect(stateMocks.saveChangeState).toHaveBeenCalled();
  });

  it('已归档/已丢弃的变更跳过提交', () => {
    const state = makeState({ phase: 'archive-completed' });

    commitChangeBranch(PROJECT_ROOT, CHANGE_NAME, state);

    expect(gitMocks.commitAll).not.toHaveBeenCalled();
  });
});
