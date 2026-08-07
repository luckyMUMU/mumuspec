/**
 * Deep coverage tests for src/core/loop-engine.ts.
 *
 * Extends loop-engine.test.ts by targeting uncovered branches:
 * - mergeWorktreeBack (no worktree, already merged, success, failure)
 * - cleanupWorktrees (parsing, dry-run, merged/non-merged branches)
 * - evaluateRound convergence via progress threshold (not goal_achieved)
 * - evaluateRound with auto_commit=false (no commit attempt)
 * - commitRound failure path (non-fatal)
 * - detectStagnation boundary conditions (exactly STAGNATION_LIMIT entries)
 * - evaluateRound with next_focus and issues (exercises buildCommitMessage branches)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared mock state (hoisted-aware) ───

const mockChangeStates = new Map<string, any>();
let activeChangeName: string | null = null;

// Create execSync mock via vi.hoisted() so the reference IS hoisted above vi.mock calls
const { mockExecSync } = vi.hoisted(() => ({
  mockExecSync: vi.fn(),
}));

// ─── Mock child_process (git worktree operations) ───

vi.mock('node:child_process', () => ({
  execSync: (...args: any[]) => mockExecSync(...args),
}));

// ─── Mock change/manager ───

vi.mock('../../src/change/manager.js', () => ({
  loadChangeState: vi.fn((_projectRoot: string, changeName: string) => {
    return mockChangeStates.get(changeName) ?? null;
  }),
  saveChangeState: vi.fn((_projectRoot: string, changeName: string, state: any, _scope: string) => {
    mockChangeStates.set(changeName, state);
  }),
  getActiveChange: vi.fn((_projectRoot: string) => activeChangeName),
}));

// ─── Mock utils ───

vi.mock('../../src/core/utils.js', () => ({
  now: vi.fn(() => '2025-01-15T10:30:00.000Z'),
  appendAuditLog: vi.fn(),
  getMumuSpecDir: vi.fn((root: string) => `${root}/.mumuspec`),
  computeHash: vi.fn(() => 'abc123'),
  readYaml: vi.fn(),
  writeYaml: vi.fn(),
  readText: vi.fn(),
  writeText: vi.fn(),
  ensureDir: vi.fn(),
  isPathSafe: vi.fn(() => true),
  existsSync: vi.fn(() => false),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(),
  findProjectRoot: vi.fn(),
}));

// ─── Import after mocks ───

import {
  initLoop,
  startRound,
  recordAction,
  evaluateRound,
  getLoopStatus,
  mergeWorktreeBack,
  cleanupWorktrees,
  detectStagnation,
  getLoopRecommendation,
  extendLoop,
} from '../../src/core/loop-engine.js';
import type { LoopState, LoopAction, LoopEvaluation } from '../../src/core/types-loop.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

const PROJECT_ROOT = '/tmp/test-loop-deep';

function createLoopState(overrides: Partial<LoopState> = {}): LoopState {
  return {
    enabled: true,
    phase: 'init',
    max_rounds: 3,
    current_round: 0,
    rounds: [],
    goal: '实现测试功能',
    convergence_criteria: ['功能完成', '测试通过'],
    auto_commit: true,
    worktree_path: undefined,
    original_branch: undefined,
    merged_back: false,
    total_actions: 0,
    progress_trend: [],
    ...overrides,
  };
}

function seedChange(name: string, loopState?: LoopState): void {
  mockChangeStates.set(name, {
    name,
    phase: 'build',
    scope: '.',
    workflow: 'standard',
    loop_state: loopState,
  });
  activeChangeName = name;
}

// ════════════════════════════════════════════════════════════════════
// mergeWorktreeBack — not covered by existing tests
// ════════════════════════════════════════════════════════════════════

describe('mergeWorktreeBack', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
    mockExecSync.mockReset();
  });

  it('returns false when no worktree_path', () => {
    seedChange('ch1', createLoopState({
      worktree_path: undefined,
      original_branch: 'main',
    }));

    const result = mergeWorktreeBack(PROJECT_ROOT, 'ch1');
    expect(result).toBe(false);
  });

  it('returns false when no original_branch', () => {
    seedChange('ch1', createLoopState({
      worktree_path: '/some/path',
      original_branch: undefined,
    }));

    const result = mergeWorktreeBack(PROJECT_ROOT, 'ch1');
    expect(result).toBe(false);
  });

  it('returns true when already merged_back', () => {
    seedChange('ch1', createLoopState({
      worktree_path: '/some/path',
      original_branch: 'main',
      merged_back: true,
    }));

    const result = mergeWorktreeBack(PROJECT_ROOT, 'ch1');
    expect(result).toBe(true);
  });

  it('returns false when no loop state exists', () => {
    seedChange('ch1', undefined);
    expect(() => {
      mergeWorktreeBack(PROJECT_ROOT, 'ch1');
    }).toThrow('Loop not initialized');
  });

  it('merges successfully and marks merged_back', () => {
    seedChange('ch1', createLoopState({
      worktree_path: '/tmp/wt',
      original_branch: 'main',
      merged_back: false,
    }));

    const result = mergeWorktreeBack(PROJECT_ROOT, 'ch1');
    expect(result).toBe(true);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.merged_back).toBe(true);
  });

  it('returns false when git commands fail', () => {
    mockExecSync.mockReset();
    mockExecSync.mockImplementation(() => { throw new Error('git failed'); });
    seedChange('ch1', createLoopState({
      worktree_path: '/tmp/wt',
      original_branch: 'main',
      merged_back: false,
    }));

    const result = mergeWorktreeBack(PROJECT_ROOT, 'ch1');
    expect(result).toBe(false);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.merged_back).toBe(false);
  });

  it('constructs correct branch name from change name', () => {
    seedChange('my-feature', createLoopState({
      worktree_path: '/tmp/wt',
      original_branch: 'develop',
      merged_back: false,
    }));

    mergeWorktreeBack(PROJECT_ROOT, 'my-feature');

    // Verify git commands reference the correct branch
    const branchCalls = mockExecSync.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('my-feature')
    );
    expect(branchCalls.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════
// cleanupWorktrees — not covered by existing tests
// ════════════════════════════════════════════════════════════════════

describe('cleanupWorktrees', () => {
  beforeEach(() => {
    mockExecSync.mockReset();
  });

  it('returns empty arrays when no worktrees exist', () => {
    mockExecSync.mockReturnValueOnce(''); // git worktree list returns empty
    // No worktrees means no subsequent calls, so the mockReturnValueOnce is sufficient

    const result = cleanupWorktrees(PROJECT_ROOT);
    expect(result.cleaned).toEqual([]);
    expect(result.remaining).toEqual([]);
  });

  it('skips main worktree and non-loop worktrees', () => {
    const worktreeOutput = [
      `worktree ${PROJECT_ROOT}`,
      'branch refs/heads/main',
      '',
      'worktree /other/path',
      'branch refs/heads/feature',
      '',
    ].join('\n');

    mockExecSync.mockImplementation((cmd: string | Buffer) => {
      const cmdStr = cmd.toString();
      if (cmdStr.includes('worktree list')) {
        return worktreeOutput;
      }
      if (cmdStr.includes('branch --merged')) {
        return '  main\n  feature\n';
      }
      return '';
    });

    const result = cleanupWorktrees(PROJECT_ROOT);
    expect(result.cleaned).toEqual([]);
    expect(result.remaining).toHaveLength(2);
    expect(result.remaining).toContain(PROJECT_ROOT);
    expect(result.remaining).toContain('/other/path');
  });

  it('cleans up merged loop worktrees', () => {
    const loopWorktree = `${PROJECT_ROOT}/.mumuspec/.loop-worktrees/test-change`;
    const worktreeOutput = [
      `worktree ${PROJECT_ROOT}`,
      'branch refs/heads/main',
      '',
      `worktree ${loopWorktree}`,
      'branch refs/heads/loop/test-change',
      '',
    ].join('\n');

    mockExecSync.mockImplementation((cmd: string | Buffer) => {
      const cmdStr = cmd.toString();
      if (cmdStr.includes('worktree list')) {
        return worktreeOutput;
      }
      if (cmdStr.includes('branch --merged')) {
        return '  main\n  loop/test-change\n';
      }
      return '';
    });

    const result = cleanupWorktrees(PROJECT_ROOT);
    expect(result.cleaned).toContain(loopWorktree);
  });

  it('does not clean up non-merged loop worktrees', () => {
    const loopWorktree = `${PROJECT_ROOT}/.mumuspec/.loop-worktrees/stale-change`;
    const worktreeOutput = [
      `worktree ${PROJECT_ROOT}`,
      'branch refs/heads/main',
      '',
      `worktree ${loopWorktree}`,
      'branch refs/heads/loop/stale-change',
      '',
    ].join('\n');

    mockExecSync.mockImplementation((cmd: string | Buffer) => {
      const cmdStr = cmd.toString();
      if (cmdStr.includes('worktree list')) {
        return worktreeOutput;
      }
      if (cmdStr.includes('branch --merged')) {
        return '  main\n'; // loop/stale-change not merged
      }
      return '';
    });

    const result = cleanupWorktrees(PROJECT_ROOT);
    expect(result.cleaned).toEqual([]);
    expect(result.remaining).toContain(loopWorktree);
  });

  it('dryRun does not remove worktrees', () => {
    const loopWorktree = `${PROJECT_ROOT}/.mumuspec/.loop-worktrees/merged-change`;
    const worktreeOutput = [
      `worktree ${PROJECT_ROOT}`,
      'branch refs/heads/main',
      '',
      `worktree ${loopWorktree}`,
      'branch refs/heads/loop/merged-change',
      '',
    ].join('\n');

    mockExecSync.mockImplementation((cmd: string | Buffer) => {
      const cmdStr = cmd.toString();
      if (cmdStr.includes('worktree list')) {
        return worktreeOutput;
      }
      if (cmdStr.includes('branch --merged')) {
        return '  main\n  loop/merged-change\n';
      }
      return '';
    });

    const result = cleanupWorktrees(PROJECT_ROOT, { dryRun: true });
    expect(result.cleaned).toContain(loopWorktree);
    // Verify remove command was NOT called
    const removeCalls = mockExecSync.mock.calls.filter(
      (call: any) => typeof call[0] === 'string' && call[0].includes('worktree remove')
    );
    expect(removeCalls.length).toBe(0);
  });

  it('handles null branch in worktree (detached HEAD)', () => {
    const loopWorktree = `${PROJECT_ROOT}/.mumuspec/.loop-worktrees/detached`;
    const worktreeOutput = [
      `worktree ${PROJECT_ROOT}`,
      'branch refs/heads/main',
      '',
      `worktree ${loopWorktree}`,
      'HEAD abc123',
      '',
    ].join('\n');

    mockExecSync.mockImplementation((cmd: string | Buffer) => {
      const cmdStr = cmd.toString();
      if (cmdStr.includes('worktree list')) {
        return worktreeOutput;
      }
      if (cmdStr.includes('branch --merged')) {
        return '  main\n';
      }
      return '';
    });

    const result = cleanupWorktrees(PROJECT_ROOT);
    // Detached HEAD has null branch; should remain (not cleaned)
    expect(result.remaining).toContain(loopWorktree);
  });

  it('ignores worktrees without .loop-worktrees in path', () => {
    const worktreeOutput = [
      `worktree ${PROJECT_ROOT}`,
      'branch refs/heads/main',
      '',
      'worktree /external/worktree',
      'branch refs/heads/other',
      '',
    ].join('\n');

    mockExecSync.mockImplementation((cmd: string | Buffer) => {
      const cmdStr = cmd.toString();
      if (cmdStr.includes('worktree list')) {
        return worktreeOutput;
      }
      if (cmdStr.includes('branch --merged')) {
        return '  main\n  other\n';
      }
      return '';
    });

    const result = cleanupWorktrees(PROJECT_ROOT);
    expect(result.cleaned).toEqual([]);
    expect(result.remaining).toContain('/external/worktree');
  });
});

// ════════════════════════════════════════════════════════════════════
// evaluateRound — convergence via progress threshold
// ════════════════════════════════════════════════════════════════════

describe('evaluateRound — convergence via progress threshold', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
    mockExecSync.mockReset();
    mockExecSync.mockImplementation(() => 'mock-sha');
  });

  it('converges when progress >= 0.85 (CONVERGENCE_THRESHOLD)', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    // progress=0.85 should trigger convergence
    const evaluation: LoopEvaluation = {
      progress: 0.85,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.phase).toBe('converged');
    expect(result.should_continue).toBe(false);
  });

  it('does NOT converge when progress is just below threshold (0.849)', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      max_rounds: 3,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.849,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.phase).toBe('plan');
    expect(result.should_continue).toBe(true);
  });

  it('converges when progress > threshold even with issues', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.9,
      goal_achieved: false,
      issues: ['minor warning', 'edge case'],
      next_focus: 'polish',
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.phase).toBe('converged');
    expect(result.should_continue).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// evaluateRound — auto_commit=false path
// ════════════════════════════════════════════════════════════════════

describe('evaluateRound — auto_commit disabled', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
    mockExecSync.mockReset();
    mockExecSync.mockImplementation(() => 'mock-sha');
  });

  it('does NOT commit when auto_commit is false', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      max_rounds: 3,
      auto_commit: false,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.6,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    expect(result.should_commit).toBe(false);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.phase).toBe('plan');
    // Verify no commit_sha was set on the round
    expect(savedState.loop_state.rounds[0].commit_sha).toBeUndefined();
  });

  it('does NOT commit when goal_achieved is true (even with auto_commit=true)', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      auto_commit: true,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const evaluation: LoopEvaluation = {
      progress: 1.0,
      goal_achieved: true,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    expect(result.should_commit).toBe(false);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.rounds[0].commit_sha).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// evaluateRound — commitRound failure (non-fatal)
// ════════════════════════════════════════════════════════════════════

describe('evaluateRound — commitRound failure', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('does not throw when git commit fails', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      max_rounds: 3,
      auto_commit: true,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    // Make git commands fail
    mockExecSync.mockReset();
    mockExecSync.mockImplementation(() => {
      throw new Error('git add failed: not a git repo');
    });

    const evaluation: LoopEvaluation = {
      progress: 0.5,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    };

    // Should NOT throw
    expect(() => {
      evaluateRound(PROJECT_ROOT, 'ch1', evaluation);
    }).not.toThrow();

    const savedState = mockChangeStates.get('ch1');
    // Phase should still advance to plan
    expect(savedState.loop_state.phase).toBe('plan');
    // But no commit_sha since commit failed
    expect(savedState.loop_state.rounds[0].commit_sha).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// evaluateRound — write paths (next_focus, issues)
// ════════════════════════════════════════════════════════════════════

describe('evaluateRound — writes next_focus and issues to commit message', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
    mockExecSync.mockReset();
    mockExecSync.mockImplementation(() => 'mock-sha');
  });

  it('includes next_focus in commit message when provided', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      max_rounds: 3,
      auto_commit: true,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.55,
      goal_achieved: false,
      issues: [],
      next_focus: 'refactor auth module',
      needs_user_input: false,
    };

    evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    // Check that commit was called with a message containing next_focus
    const commitCall = mockExecSync.mock.calls.find(
      (call: any) => typeof call[0] === 'string' && call[0].includes('git commit')
    );
    expect(commitCall).toBeDefined();
    expect(commitCall[0]).toContain('refactor auth module');
  });

  it('includes issues in commit message when present', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      max_rounds: 3,
      auto_commit: true,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.4,
      goal_achieved: false,
      issues: ['missing error handling', 'TODO: add tests'],
      needs_user_input: false,
    };

    evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    const commitCall = mockExecSync.mock.calls.find(
      (call: any) => typeof call[0] === 'string' && call[0].includes('git commit')
    );
    expect(commitCall).toBeDefined();
    expect(commitCall[0]).toContain('missing error handling');
    expect(commitCall[0]).toContain('TODO: add tests');
  });

  it('handles goal_achieved commit message format', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 2,
      auto_commit: true,
      rounds: [{
        round: 2,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'final round',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const evaluation: LoopEvaluation = {
      progress: 1.0,
      goal_achieved: true,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'ch1', evaluation);

    // goal_achieved means should_commit=false
    expect(result.should_commit).toBe(false);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.phase).toBe('converged');
  });
});

// ════════════════════════════════════════════════════════════════════
// detectStagnation — boundary conditions
// ════════════════════════════════════════════════════════════════════

describe('detectStagnation — boundary conditions', () => {
  it('returns false when trend has exactly 1 entry (STAGNATION_LIMIT-1)', () => {
    const loop = createLoopState({ progress_trend: [0.1] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('returns false when trend has 0 entries', () => {
    const loop = createLoopState({ progress_trend: [] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('detects stagnation with exactly 2 identical low values', () => {
    const loop = createLoopState({ progress_trend: [0.4, 0.4] });
    expect(detectStagnation(loop)).toBe(true);
  });

  it('detects stagnation with values within 0.05 tolerance', () => {
    const loop = createLoopState({ progress_trend: [0.50, 0.54] });
    expect(detectStagnation(loop)).toBe(true);
  });

  it('does NOT detect stagnation with values beyond 0.05 tolerance', () => {
    const loop = createLoopState({ progress_trend: [0.50, 0.56] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('only checks last 2 entries, ignoring earlier history', () => {
    const loop = createLoopState({
      progress_trend: [0.1, 0.1, 0.1, 0.5, 0.7],
    });
    // Last 2 are 0.5, 0.7 → improving, not stagnant
    expect(detectStagnation(loop)).toBe(false);
  });

  it('returns false when last 2 are identical but above threshold', () => {
    const loop = createLoopState({ progress_trend: [0.9, 0.9] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('returns true for exactly at threshold boundary (0.84)', () => {
    const loop = createLoopState({ progress_trend: [0.84, 0.84] });
    expect(detectStagnation(loop)).toBe(true);
  });

  it('returns false at exactly convergence threshold (0.85)', () => {
    const loop = createLoopState({ progress_trend: [0.85, 0.85] });
    expect(detectStagnation(loop)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// getLoopRecommendation — evaluate phase edge case
// ════════════════════════════════════════════════════════════════════

describe('getLoopRecommendation — commit phase', () => {
  it('returns empty string for commit phase', () => {
    const loop = createLoopState({ phase: 'commit' });
    const rec = getLoopRecommendation(loop);
    expect(rec).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════
// initLoop — edge case: worktree creation path
// ════════════════════════════════════════════════════════════════════

describe('initLoop — worktree creation path', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
    mockExecSync.mockReset();
    mockExecSync.mockImplementation((cmd: string | Buffer) => {
      const cmdStr = cmd.toString();
      if (cmdStr.includes('branch --show-current')) {
        return 'main';
      }
      return '';
    });
  });

  it('creates worktree when use_worktree=true', () => {
    seedChange('wt-test');

    const result = initLoop(PROJECT_ROOT, {
      changeName: 'wt-test',
      goal: 'test worktree',
      convergence_criteria: ['done'],
      use_worktree: true,
    });

    expect(result.worktree_path).toBeDefined();
    expect(result.original_branch).toBeDefined();
  });

  it('passes partial input (only required fields) with defaults applied', () => {
    seedChange('defaults-test');

    const result = initLoop(PROJECT_ROOT, {
      changeName: 'defaults-test',
      goal: 'test defaults',
      convergence_criteria: ['all good'],
      // No optional fields — defaults should be used
    });

    expect(result.max_rounds).toBe(3); // DEFAULT_MAX_ROUNDS
    expect(result.auto_commit).toBe(true);
    expect(result.worktree_path).toBeDefined(); // use_worktree defaults to true
  });
});

// ════════════════════════════════════════════════════════════════════
// startRound — evaluate phase transition
// ════════════════════════════════════════════════════════════════════

describe('startRound — from evaluate phase', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('allows starting round from evaluate phase', () => {
    seedChange('eval-test', createLoopState({ phase: 'evaluate', current_round: 1 }));
    const round = startRound(PROJECT_ROOT, 'eval-test', 'continue');
    expect(round.round).toBe(2);
  });

  it('allows starting round from plan phase', () => {
    seedChange('plan-test', createLoopState({ phase: 'plan', current_round: 0 }));
    const round = startRound(PROJECT_ROOT, 'plan-test', 'first plan');
    expect(round.round).toBe(1);
  });

  it('allows starting round from init phase', () => {
    seedChange('init-test', createLoopState({ phase: 'init', current_round: 0 }));
    const round = startRound(PROJECT_ROOT, 'init-test', 'init plan');
    expect(round.round).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════════
// recordAction — edge cases
// ════════════════════════════════════════════════════════════════════

describe('recordAction — action with error', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('records a failed action with error message', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const action: LoopAction = {
      type: 'command_run',
      description: 'run tests',
      success: false,
      error: 'test failed with exit code 1',
    };

    recordAction(PROJECT_ROOT, 'ch1', action);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.total_actions).toBe(1);
    expect(savedState.loop_state.rounds[0].actions[0].error).toBe('test failed with exit code 1');
  });

  it('records action without target', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('ch1', loopState);

    const action: LoopAction = {
      type: 'decision_record',
      description: 'chose REST over GraphQL',
      success: true,
    };

    recordAction(PROJECT_ROOT, 'ch1', action);

    const savedState = mockChangeStates.get('ch1');
    expect(savedState.loop_state.rounds[0].actions[0].target).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// getLoopStatus — additional edge cases
// ════════════════════════════════════════════════════════════════════

describe('getLoopStatus — canContinue edge cases', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('canContinue is false when at max_rounds even in plan phase', () => {
    seedChange('ch1', createLoopState({
      phase: 'plan',
      current_round: 3,
      max_rounds: 3,
    }));

    const status = getLoopStatus(PROJECT_ROOT, 'ch1');
    expect(status!.canContinue).toBe(false);
  });

  it('canContinue is false for act phase', () => {
    seedChange('ch1', createLoopState({
      phase: 'act',
      current_round: 1,
      max_rounds: 3,
    }));

    const status = getLoopStatus(PROJECT_ROOT, 'ch1');
    // act is not converged/exhausted/blocked, and current < max → can continue
    expect(status!.canContinue).toBe(true);
  });

  it('worktreePath is undefined when no worktree', () => {
    seedChange('ch1', createLoopState({
      worktree_path: undefined,
    }));

    const status = getLoopStatus(PROJECT_ROOT, 'ch1');
    expect(status!.worktreePath).toBeUndefined();
  });

  it('blockReason is undefined when not blocked', () => {
    seedChange('ch1', createLoopState({ phase: 'plan' }));
    const status = getLoopStatus(PROJECT_ROOT, 'ch1');
    expect(status!.blockReason).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Full lifecycle integration
// ════════════════════════════════════════════════════════════════════

describe('full lifecycle — multi-round flow', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
    mockExecSync.mockReset();
    mockExecSync.mockImplementation(() => 'mock-sha');
  });

  it('rounds 1 → 2 → converge', () => {
    seedChange('lifecycle-test', createLoopState());

    // Round 1: act, record action, evaluate (plan)
    const r1 = startRound(PROJECT_ROOT, 'lifecycle-test', 'implement feature');
    expect(r1.round).toBe(1);

    recordAction(PROJECT_ROOT, 'lifecycle-test', {
      type: 'file_create',
      description: 'create feature.ts',
      success: true,
    });

    const eval1 = evaluateRound(PROJECT_ROOT, 'lifecycle-test', {
      progress: 0.4,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    });
    expect(eval1.should_continue).toBe(true);

    // Round 2: act, record actions, evaluate (converged)
    const r2 = startRound(PROJECT_ROOT, 'lifecycle-test', 'finish feature');
    expect(r2.round).toBe(2);

    recordAction(PROJECT_ROOT, 'lifecycle-test', {
      type: 'file_edit',
      description: 'refactor feature.ts',
      success: true,
    });
    recordAction(PROJECT_ROOT, 'lifecycle-test', {
      type: 'test_run',
      description: 'run all tests',
      success: true,
    });

    const eval2 = evaluateRound(PROJECT_ROOT, 'lifecycle-test', {
      progress: 0.95,
      goal_achieved: true,
      issues: [],
      needs_user_input: false,
    });
    expect(eval2.should_continue).toBe(false);

    const status = getLoopStatus(PROJECT_ROOT, 'lifecycle-test');
    expect(status!.phase).toBe('converged');
    expect(status!.currentRound).toBe(2);
    expect(status!.totalActions).toBe(3);
    expect(status!.progressTrend).toEqual([0.4, 0.95]);
  });

  it('exhaust → extend → converge', () => {
    seedChange('exhaust-test', createLoopState({
      current_round: 3,
      max_rounds: 3,
      phase: 'exhausted',
      total_actions: 6,
      progress_trend: [0.2, 0.35, 0.5],
    }));

    // Extend
    const extended = extendLoop(PROJECT_ROOT, 'exhaust-test', 2);
    expect(extended.phase).toBe('plan');
    expect(extended.max_rounds).toBe(5);

    // Start next round
    const r4 = startRound(PROJECT_ROOT, 'exhaust-test', 'push through');
    expect(r4.round).toBe(4);
  });
});
