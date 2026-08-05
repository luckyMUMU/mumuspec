/**
 * Tests for src/core/loop-engine.ts — Loop mode engine.
 *
 * Strategy: test pure functions (detectStagnation, getLoopRecommendation) directly,
 * and mock change/manager + utils for functions that persist state or invoke git.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock child_process (git worktree operations) ───

vi.mock('node:child_process', () => ({
  execSync: vi.fn((): string => 'mock-sha'),
}));

// ─── Mock change/manager ───

const mockChangeStates = new Map<string, any>();
let activeChangeName: string | null = null;

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
  resumeLoop,
  extendLoop,
  exitLoop,
  cleanupWorktrees,
  detectStagnation,
  getLoopRecommendation,
} from '../../src/core/loop-engine.js';
import type { LoopState, LoopAction, LoopEvaluation } from '../../src/core/types-loop.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

const PROJECT_ROOT = '/tmp/test-loop-engine';

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
// detectStagnation — pure function
// ════════════════════════════════════════════════════════════════════

describe('detectStagnation', () => {
  it('returns false when trend has fewer than 2 entries', () => {
    const loop = createLoopState({ progress_trend: [0.5] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('returns false when trend is empty', () => {
    const loop = createLoopState({ progress_trend: [] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('returns true when last 2 rounds have identical low progress', () => {
    const loop = createLoopState({ progress_trend: [0.3, 0.3] });
    expect(detectStagnation(loop)).toBe(true);
  });

  it('returns true when last 3 rounds have near-identical progress below threshold', () => {
    const loop = createLoopState({ progress_trend: [0.5, 0.51, 0.49] });
    expect(detectStagnation(loop)).toBe(true);
  });

  it('returns false when progress is improving', () => {
    const loop = createLoopState({ progress_trend: [0.3, 0.5, 0.7] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('returns false when stagnant but above convergence threshold', () => {
    const loop = createLoopState({ progress_trend: [0.9, 0.9] });
    expect(detectStagnation(loop)).toBe(false);
  });

  it('only checks the last N entries (not the full history)', () => {
    const loop = createLoopState({
      progress_trend: [0.1, 0.9, 0.5, 0.5],
    });
    // last 2 are 0.5, 0.5 → stagnant
    expect(detectStagnation(loop)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// getLoopRecommendation — pure function
// ════════════════════════════════════════════════════════════════════

describe('getLoopRecommendation', () => {
  it('returns converged message when phase is converged', () => {
    const loop = createLoopState({ phase: 'converged' });
    const rec = getLoopRecommendation(loop);
    expect(rec).toContain('converged');
    expect(rec).toContain('exit');
  });

  it('returns exhausted message when phase is exhausted', () => {
    const loop = createLoopState({ phase: 'exhausted', current_round: 3, max_rounds: 3 });
    const rec = getLoopRecommendation(loop);
    expect(rec).toContain('exhausted');
    expect(rec).toContain('extend');
  });

  it('returns blocked message when phase is blocked', () => {
    const loop = createLoopState({ phase: 'blocked' });
    const rec = getLoopRecommendation(loop);
    expect(rec).toContain('blocked');
    expect(rec).toContain('resume');
  });

  it('returns ready message for init phase', () => {
    const loop = createLoopState({ phase: 'init', current_round: 0 });
    const rec = getLoopRecommendation(loop);
    expect(rec).toContain('round 1');
  });

  it('returns ready message for plan phase', () => {
    const loop = createLoopState({ phase: 'plan', current_round: 1 });
    const rec = getLoopRecommendation(loop);
    expect(rec).toContain('round 2');
  });

  it('returns act message when phase is act', () => {
    const loop = createLoopState({ phase: 'act' });
    const rec = getLoopRecommendation(loop);
    expect(rec).toContain('executing');
  });

  it('returns empty string for evaluate phase (unspecified)', () => {
    const loop = createLoopState({ phase: 'evaluate' });
    const rec = getLoopRecommendation(loop);
    expect(rec).toBe('');
  });
});

// ════════════════════════════════════════════════════════════════════
// initLoop
// ════════════════════════════════════════════════════════════════════

describe('initLoop', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('throws if change does not exist', () => {
    expect(() => {
      initLoop(PROJECT_ROOT, {
        changeName: 'nonexistent',
        goal: 'test',
        convergence_criteria: ['test'],
      });
    }).toThrow('Change not found');
  });

  it('initializes loop state with defaults', () => {
    seedChange('my-change');

    const result = initLoop(PROJECT_ROOT, {
      changeName: 'my-change',
      goal: '实现功能',
      convergence_criteria: ['完成'],
    });

    expect(result.enabled).toBe(true);
    expect(result.phase).toBe('init');
    expect(result.max_rounds).toBe(3);
    expect(result.current_round).toBe(0);
    expect(result.goal).toBe('实现功能');
    expect(result.convergence_criteria).toEqual(['完成']);
    expect(result.auto_commit).toBe(true);
  });

  it('respects custom max_rounds', () => {
    seedChange('my-change');

    const result = initLoop(PROJECT_ROOT, {
      changeName: 'my-change',
      goal: 'test',
      convergence_criteria: ['test'],
      max_rounds: 5,
    });

    expect(result.max_rounds).toBe(5);
  });

  it('respects use_worktree=false', () => {
    seedChange('my-change');

    const result = initLoop(PROJECT_ROOT, {
      changeName: 'my-change',
      goal: 'test',
      convergence_criteria: ['test'],
      use_worktree: false,
    });

    expect(result.worktree_path).toBeUndefined();
    expect(result.original_branch).toBeUndefined();
  });

  it('respects auto_commit=false', () => {
    seedChange('my-change');

    const result = initLoop(PROJECT_ROOT, {
      changeName: 'my-change',
      goal: 'test',
      convergence_criteria: ['test'],
      auto_commit: false,
    });

    expect(result.auto_commit).toBe(false);
  });

  it('persists loop state into change state with build phase', () => {
    seedChange('my-change');

    initLoop(PROJECT_ROOT, {
      changeName: 'my-change',
      goal: 'test goal',
      convergence_criteria: ['c1'],
    });

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.phase).toBe('build');
    expect(savedState.loop_state).toBeDefined();
    expect(savedState.loop_state.goal).toBe('test goal');
  });
});

// ════════════════════════════════════════════════════════════════════
// startRound
// ════════════════════════════════════════════════════════════════════

describe('startRound', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('throws if loop not initialized', () => {
    seedChange('my-change', undefined);

    expect(() => {
      startRound(PROJECT_ROOT, 'my-change', 'my plan');
    }).toThrow('Loop not initialized');
  });

  it('increments round and sets phase to act', () => {
    seedChange('my-change', createLoopState());

    const round = startRound(PROJECT_ROOT, 'my-change', '实现模块 A');

    expect(round.round).toBe(1);
    expect(round.plan).toBe('实现模块 A');
    expect(round.actions).toEqual([]);
    expect(round.evaluation).toBeNull();
    expect(round.started_at).toBe('2025-01-15T10:30:00.000Z');

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.current_round).toBe(1);
    expect(savedState.loop_state.phase).toBe('act');
  });

  it('throws when loop is blocked', () => {
    seedChange('my-change', createLoopState({ phase: 'blocked' }));

    expect(() => {
      startRound(PROJECT_ROOT, 'my-change', 'plan');
    }).toThrow('blocked');
  });

  it('throws when max rounds reached', () => {
    seedChange('my-change', createLoopState({
      current_round: 3,
      max_rounds: 3,
    }));

    expect(() => {
      startRound(PROJECT_ROOT, 'my-change', 'plan');
    }).toThrow('exhausted');
  });

  it('starts sequential rounds correctly', () => {
    seedChange('my-change', createLoopState({ current_round: 1 }));

    const round = startRound(PROJECT_ROOT, 'my-change', 'second round');
    expect(round.round).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// recordAction
// ════════════════════════════════════════════════════════════════════

describe('recordAction', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('throws if loop not initialized', () => {
    seedChange('my-change', undefined);

    expect(() => {
      recordAction(PROJECT_ROOT, 'my-change', {
        type: 'file_edit',
        description: 'edit file',
        success: true,
      });
    }).toThrow('Loop not initialized');
  });

  it('throws if no active round', () => {
    seedChange('my-change', createLoopState({ phase: 'plan' }));

    expect(() => {
      recordAction(PROJECT_ROOT, 'my-change', {
        type: 'file_edit',
        description: 'edit',
        success: true,
      });
    }).toThrow('No active round');
  });

  it('records action and increments total_actions', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test plan',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('my-change', loopState);

    const action: LoopAction = {
      type: 'file_create',
      description: 'create utils.ts',
      target: 'src/utils.ts',
      success: true,
    };

    recordAction(PROJECT_ROOT, 'my-change', action);

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.rounds[0].actions.length).toBe(1);
    expect(savedState.loop_state.rounds[0].actions[0].description).toBe('create utils.ts');
    expect(savedState.loop_state.total_actions).toBe(1);
  });

  it('records multiple actions', () => {
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
    seedChange('my-change', loopState);

    recordAction(PROJECT_ROOT, 'my-change', {
      type: 'file_edit',
      description: 'edit 1',
      success: true,
    });
    recordAction(PROJECT_ROOT, 'my-change', {
      type: 'file_edit',
      description: 'edit 2',
      success: true,
    });

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.total_actions).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════════
// evaluateRound
// ════════════════════════════════════════════════════════════════════

describe('evaluateRound', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('throws if loop not initialized', () => {
    seedChange('my-change', undefined);

    expect(() => {
      evaluateRound(PROJECT_ROOT, 'my-change', {
        progress: 0.5,
        goal_achieved: false,
        issues: [],
        needs_user_input: false,
      });
    }).toThrow('Loop not initialized');
  });

  it('throws if no active round', () => {
    seedChange('my-change', createLoopState({ phase: 'plan' }));

    expect(() => {
      evaluateRound(PROJECT_ROOT, 'my-change', {
        progress: 0.5,
        goal_achieved: false,
        issues: [],
        needs_user_input: false,
      });
    }).toThrow('No active round');
  });

  it('sets phase to converged when goal achieved', () => {
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
    seedChange('my-change', loopState);

    const evaluation: LoopEvaluation = {
      progress: 1.0,
      goal_achieved: true,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'my-change', evaluation);

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.phase).toBe('converged');
    expect(savedState.loop_state.rounds[0].evaluation).toEqual(evaluation);
    expect(result.should_continue).toBe(false);
  });

  it('sets phase to blocked when user input needed', () => {
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
    seedChange('my-change', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.5,
      goal_achieved: false,
      issues: ['need user decision'],
      needs_user_input: true,
      block_reason: 'API design uncertain',
    };

    const result = evaluateRound(PROJECT_ROOT, 'my-change', evaluation);

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.phase).toBe('blocked');
    expect(result.should_continue).toBe(false);
  });

  it('sets phase to exhausted when max rounds reached without convergence', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 3,
      max_rounds: 3,
      rounds: [{
        round: 3,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'final',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('my-change', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.7,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'my-change', evaluation);

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.phase).toBe('exhausted');
    expect(result.should_continue).toBe(false);
  });

  it('sets phase to plan when more rounds available', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      max_rounds: 3,
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'round 1',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('my-change', loopState);

    const evaluation: LoopEvaluation = {
      progress: 0.5,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    };

    const result = evaluateRound(PROJECT_ROOT, 'my-change', evaluation);

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.phase).toBe('plan');
    expect(result.should_continue).toBe(true);
  });

  it('records progress trend', () => {
    const loopState = createLoopState({
      phase: 'act',
      current_round: 1,
      progress_trend: [0.2],
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: null,
      }],
    });
    seedChange('my-change', loopState);

    evaluateRound(PROJECT_ROOT, 'my-change', {
      progress: 0.6,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    });

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.progress_trend).toEqual([0.2, 0.6]);
  });

  it('sets completed_at on the round', () => {
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
    seedChange('my-change', loopState);

    evaluateRound(PROJECT_ROOT, 'my-change', {
      progress: 0.5,
      goal_achieved: false,
      issues: [],
      needs_user_input: false,
    });

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.rounds[0].completed_at).toBe('2025-01-15T10:30:00.000Z');
  });
});

// ════════════════════════════════════════════════════════════════════
// getLoopStatus
// ════════════════════════════════════════════════════════════════════

describe('getLoopStatus', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('returns null if loop not initialized', () => {
    seedChange('my-change', undefined);
    const status = getLoopStatus(PROJECT_ROOT, 'my-change');
    expect(status).toBeNull();
  });

  it('returns status summary with correct shape', () => {
    seedChange('my-change', createLoopState({
      current_round: 2,
      max_rounds: 3,
      goal: '实现功能X',
      total_actions: 5,
      progress_trend: [0.3, 0.6],
    }));

    const status = getLoopStatus(PROJECT_ROOT, 'my-change');
    expect(status).not.toBeNull();
    expect(status!.changeName).toBe('my-change');
    expect(status!.currentRound).toBe(2);
    expect(status!.maxRounds).toBe(3);
    expect(status!.goal).toBe('实现功能X');
    expect(status!.totalActions).toBe(5);
    expect(status!.progressTrend).toEqual([0.3, 0.6]);
    expect(status!.phase).toBe('init');
  });

  it('canContinue is true when in plan phase with rounds remaining', () => {
    seedChange('my-change', createLoopState({
      phase: 'plan',
      current_round: 1,
      max_rounds: 3,
    }));

    const status = getLoopStatus(PROJECT_ROOT, 'my-change');
    expect(status!.canContinue).toBe(true);
  });

  it('canContinue is false when converged', () => {
    seedChange('my-change', createLoopState({ phase: 'converged' }));
    const status = getLoopStatus(PROJECT_ROOT, 'my-change');
    expect(status!.canContinue).toBe(false);
  });

  it('canContinue is false when exhausted', () => {
    seedChange('my-change', createLoopState({ phase: 'exhausted' }));
    const status = getLoopStatus(PROJECT_ROOT, 'my-change');
    expect(status!.canContinue).toBe(false);
  });

  it('canContinue is false when blocked', () => {
    seedChange('my-change', createLoopState({
      phase: 'blocked',
      rounds: [{
        round: 1,
        started_at: '2025-01-15T10:00:00.000Z',
        plan: 'test',
        actions: [],
        evaluation: {
          progress: 0.3,
          goal_achieved: false,
          issues: [],
          needs_user_input: true,
          block_reason: '需要确认 API 格式',
        },
      }],
    }));

    const status = getLoopStatus(PROJECT_ROOT, 'my-change');
    expect(status!.canContinue).toBe(false);
    expect(status!.blockReason).toBe('需要确认 API 格式');
  });

  it('lastEvaluation is null when no rounds completed', () => {
    seedChange('my-change', createLoopState({ rounds: [] }));
    const status = getLoopStatus(PROJECT_ROOT, 'my-change');
    expect(status!.lastEvaluation).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════
// resumeLoop
// ════════════════════════════════════════════════════════════════════

describe('resumeLoop', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('throws if loop not initialized', () => {
    seedChange('my-change', undefined);
    expect(() => {
      resumeLoop(PROJECT_ROOT, 'my-change');
    }).toThrow('Loop not initialized');
  });

  it('throws if loop is not blocked', () => {
    seedChange('my-change', createLoopState({ phase: 'plan' }));
    expect(() => {
      resumeLoop(PROJECT_ROOT, 'my-change');
    }).toThrow("not blocked");
  });

  it('resumes blocked loop to plan phase', () => {
    seedChange('my-change', createLoopState({ phase: 'blocked' }));
    resumeLoop(PROJECT_ROOT, 'my-change');

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.phase).toBe('plan');
  });
});

// ════════════════════════════════════════════════════════════════════
// extendLoop
// ════════════════════════════════════════════════════════════════════

describe('extendLoop', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('throws if loop not initialized', () => {
    seedChange('my-change', undefined);
    expect(() => {
      extendLoop(PROJECT_ROOT, 'my-change', 2);
    }).toThrow('Loop not initialized');
  });

  it('extends max rounds', () => {
    seedChange('my-change', createLoopState({ max_rounds: 3 }));
    const result = extendLoop(PROJECT_ROOT, 'my-change', 2);
    expect(result.max_rounds).toBe(5);
  });

  it('revives exhausted loop when rounds are added', () => {
    seedChange('my-change', createLoopState({
      phase: 'exhausted',
      current_round: 3,
      max_rounds: 3,
    }));

    const result = extendLoop(PROJECT_ROOT, 'my-change', 2);
    expect(result.phase).toBe('plan');
    expect(result.max_rounds).toBe(5);
  });

  it('does not change phase if not exhausted', () => {
    seedChange('my-change', createLoopState({
      phase: 'plan',
      current_round: 1,
      max_rounds: 3,
    }));

    const result = extendLoop(PROJECT_ROOT, 'my-change', 1);
    expect(result.phase).toBe('plan');
  });
});

// ════════════════════════════════════════════════════════════════════
// exitLoop
// ════════════════════════════════════════════════════════════════════

describe('exitLoop', () => {
  beforeEach(() => {
    mockChangeStates.clear();
    activeChangeName = null;
  });

  it('throws if loop not initialized', () => {
    seedChange('my-change', undefined);
    expect(() => {
      exitLoop(PROJECT_ROOT, 'my-change', 'done');
    }).toThrow('Loop not initialized');
  });

  it('marks loop as converged', () => {
    seedChange('my-change', createLoopState({ phase: 'plan', current_round: 2 }));
    exitLoop(PROJECT_ROOT, 'my-change', 'completed');

    const savedState = mockChangeStates.get('my-change');
    expect(savedState.loop_state.phase).toBe('converged');
  });
});
