/**
 * Handler-level tests for loop commands (init, round, action, evaluate, status, resume, extend, exit, merge, cleanup).
 *
 * Strategy: mock all loop-engine dependencies, register loop commands, then
 * invoke handlers to test branch logic including phase transitions, progress
 * bars, stagnation detection, and error paths.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadChangeState,
  mockGetActiveChange,
  mockInitLoop,
  mockStartRound,
  mockRecordAction,
  mockEvaluateRound,
  mockGetLoopStatus,
  mockResumeLoop,
  mockExtendLoop,
  mockExitLoop,
  mockMergeWorktreeBack,
  mockGetLoopRecommendation,
  mockDetectStagnation,
  mockCleanupWorktrees,
  mockRunLoopGrill,
  mockFormatGrillReport,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockInitLoop: vi.fn(),
  mockStartRound: vi.fn(),
  mockRecordAction: vi.fn(),
  mockEvaluateRound: vi.fn(),
  mockGetLoopStatus: vi.fn(),
  mockResumeLoop: vi.fn(),
  mockExtendLoop: vi.fn(),
  mockExitLoop: vi.fn(),
  mockMergeWorktreeBack: vi.fn(),
  mockGetLoopRecommendation: vi.fn(),
  mockDetectStagnation: vi.fn(),
  mockCleanupWorktrees: vi.fn(),
  mockRunLoopGrill: vi.fn(),
  mockFormatGrillReport: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    getActiveChange: mockGetActiveChange,
    loadChangeState: mockLoadChangeState,
  };
});

vi.mock('../../../src/core/loop-engine.js', () => ({
  initLoop: mockInitLoop,
  startRound: mockStartRound,
  recordAction: mockRecordAction,
  evaluateRound: mockEvaluateRound,
  getLoopStatus: mockGetLoopStatus,
  resumeLoop: mockResumeLoop,
  extendLoop: mockExtendLoop,
  exitLoop: mockExitLoop,
  mergeWorktreeBack: mockMergeWorktreeBack,
  getLoopRecommendation: mockGetLoopRecommendation,
  detectStagnation: mockDetectStagnation,
  cleanupWorktrees: mockCleanupWorktrees,
}));

vi.mock('../../../src/core/loop-grill.js', () => ({
  runLoopGrill: mockRunLoopGrill,
  formatGrillReport: mockFormatGrillReport,
}));

// Import after mocks
const { registerLoopCommands } = await import('../../../src/cli/commands/loop.js');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createProgram(): Command {
  const program = new Command();
  registerLoopCommands(program);
  return program;
}

const FAKE_ROOT = '/fake/project';

function validLoopState() {
  return {
    enabled: true,
    goal: 'Implement feature',
    max_rounds: 3,
    current_round: 1,
    phase: 'plan',
    auto_commit: true,
    convergence_criteria: ['All tests pass', 'No regressions'],
    worktree_path: '/tmp/worktree-loop',
  };
}

function validChangeState(loopState: ReturnType<typeof validLoopState>) {
  return {
    name: 'test-change',
    loop_state: loopState,
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('loop command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockRunLoopGrill.mockReturnValue({ passed: true, validatedContext: { goal: 'Implement feature', criteria: [], maxRounds: 3 } });
    mockFormatGrillReport.mockReturnValue('## Grill Report\nGoal is achievable.');
    mockGetLoopStatus.mockReturnValue({
      phase: 'plan',
      currentRound: 1,
      maxRounds: 3,
      goal: 'Implement feature',
      totalActions: 0,
      progressTrend: [],
      worktreePath: '/tmp/worktree-loop',
    });
    mockDetectStagnation.mockReturnValue(false);
    mockGetLoopRecommendation.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── init command ──────────────────────────────────────

  describe('init handler', () => {
    it('initializes loop mode successfully', async () => {
      const loopState = validLoopState();
      mockLoadChangeState.mockReturnValue({ name: 'test-change', loop_state: null });
      mockInitLoop.mockReturnValue(loopState);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'init', 'test-change', '--goal', 'Build X']);

      expect(mockInitLoop).toHaveBeenCalledWith(FAKE_ROOT, expect.objectContaining({
        changeName: 'test-change',
        goal: 'Build X',
        use_worktree: true,
        auto_commit: true,
      }));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Loop mode initialized'));
    });

    it('exits when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'init', 'bad-name', '--goal', 'X']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: bad-name');
    });

    it('exits when loop already initialized', async () => {
      mockLoadChangeState.mockReturnValue(validChangeState(validLoopState()));

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'init', 'test-change', '--goal', 'X']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Loop already initialized'));
    });

    it('exits when grill validation fails', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'test-change', loop_state: null });
      mockRunLoopGrill.mockReturnValue({ passed: false, validatedContext: { goal: '', criteria: [], maxRounds: 3 } });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'init', 'test-change', '--goal', '']))
        .rejects.toThrow('process.exit called with code 1');

      // Note: grill failure messages go to console.log, not console.error
      const logOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(logOutput).toContain('Grill validation failed');
    });

    it('can skip grill validation with --skip-grill', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'test-change', loop_state: null });
      mockInitLoop.mockReturnValue(validLoopState());

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'init', 'test-change', '--goal', 'X', '--skip-grill']);

      expect(mockRunLoopGrill).not.toHaveBeenCalled();
      expect(mockInitLoop).toHaveBeenCalled();
    });
  });

  // ── round command ─────────────────────────────────────

  describe('round handler', () => {
    it('starts a new round successfully', async () => {
      mockStartRound.mockReturnValue({ round: 1, plan: 'Fix bug', started_at: '2024-01-01T00:00:00Z' });
      mockGetActiveChange.mockReturnValue('test-change');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'round', 'Fix the bug']);

      expect(mockStartRound).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', 'Fix the bug');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Round 1 started'));
    });

    it('exits when no active change', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'round', 'Plan']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active change. Specify a change name.');
    });

    it('uses specified change name over active change', async () => {
      mockGetActiveChange.mockReturnValue('active-change');
      mockStartRound.mockReturnValue({ round: 2, plan: 'Plan', started_at: '2024-01-01' });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'round', 'Plan', 'explicit-change']);

      expect(mockStartRound).toHaveBeenCalledWith(FAKE_ROOT, 'explicit-change', 'Plan');
    });
  });

  // ── action command ────────────────────────────────────

  describe('action handler', () => {
    it('records action successfully', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockRecordAction.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'action', 'edited handler.ts']);

      expect(mockRecordAction).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', expect.objectContaining({
        type: 'file_edit',
        description: 'edited handler.ts',
        success: true,
      }));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Action recorded'));
    });

    it('records failed action with error', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockRecordAction.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'action', 'ran tests', '--failed', '--error', '2 tests failed']);

      expect(mockRecordAction).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', expect.objectContaining({
        description: 'ran tests',
        success: false,
        error: '2 tests failed',
      }));
    });

    it('exits when no active change and none specified', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'action', 'test']))
        .rejects.toThrow('process.exit called with code 1');
    });
  });

  // ── evaluate command ──────────────────────────────────

  describe('evaluate handler', () => {
    it('evaluates round with valid progress', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockEvaluateRound.mockReturnValue({ should_commit: true, should_continue: true });
      mockGetLoopStatus.mockReturnValue({
        phase: 'act',
        currentRound: 2,
        maxRounds: 3,
        goal: 'Build X',
        totalActions: 3,
        progressTrend: [0.4],
        worktreePath: null,
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '0.7']);

      expect(mockEvaluateRound).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', expect.objectContaining({
        progress: 0.7,
      }), expect.anything());
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Round 2 Evaluation'));
    });

    it('exits with invalid progress value', async () => {
      mockGetActiveChange.mockReturnValue('test-change');

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '1.5']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: --progress must be a number between 0.0 and 1.0');
    });

    it('exits with NaN progress value', async () => {
      mockGetActiveChange.mockReturnValue('test-change');

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', 'abc']))
        .rejects.toThrow('process.exit called with code 1');
    });
  });

  // ── status command ────────────────────────────────────

  describe('status handler', () => {
    it('shows loop status with progress info', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockLoadChangeState.mockReturnValue(validChangeState(validLoopState()));
      mockGetLoopStatus.mockReturnValue({
        phase: 'act',
        currentRound: 2,
        maxRounds: 3,
        goal: 'Implement new API endpoint with tests',
        totalActions: 5,
        progressTrend: [0.3, 0.6],
        worktreePath: '/tmp/wt',
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'status']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Round:     2 / 3'));
    });

    it('shows message when change not in loop mode', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockGetLoopStatus.mockReturnValue(null);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'status']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('is not in loop mode'));
    });

    it('exits when no active change', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'status']))
        .rejects.toThrow('process.exit called with code 1');
    });
  });

  // ── resume command ────────────────────────────────────

  describe('resume handler', () => {
    it('resumes blocked loop', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockResumeLoop.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'resume']);

      expect(mockResumeLoop).toHaveBeenCalledWith(FAKE_ROOT, 'test-change');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Loop resumed'));
    });
  });

  // ── extend command ────────────────────────────────────

  describe('extend handler', () => {
    it('extends rounds limit', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockExtendLoop.mockReturnValue({ ...validLoopState(), max_rounds: 5, current_round: 3 });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'extend', '2']);

      expect(mockExtendLoop).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', 2);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('max rounds is now 5'));
    });

    it('exits with invalid number', async () => {
      mockGetActiveChange.mockReturnValue('test-change');

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'loop', 'extend', '0']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: must be a positive number');
    });
  });

  // ── exit command ──────────────────────────────────────

  describe('exit handler', () => {
    it('exits loop mode successfully', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockExitLoop.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'exit']);

      expect(mockExitLoop).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', 'user requested exit');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Loop exited'));
    });

    it('accepts custom exit reason', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockExitLoop.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'exit', '--reason', 'goal achieved']);

      expect(mockExitLoop).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', 'goal achieved');
    });
  });

  // ── merge command ─────────────────────────────────────

  describe('merge handler', () => {
    it('merges worktree back', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockMergeWorktreeBack.mockReturnValue(true);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'merge']);

      expect(logSpy).toHaveBeenCalledWith('✓ Worktree merged back to original branch');
    });

    it('handles no worktree to merge', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockMergeWorktreeBack.mockReturnValue(false);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'merge']);

      expect(logSpy).toHaveBeenCalledWith('No worktree to merge or merge not needed.');
    });
  });

  // ── cleanup command ───────────────────────────────────

  describe('cleanup handler', () => {
    it('cleans up merged worktrees', async () => {
      mockCleanupWorktrees.mockReturnValue({ cleaned: ['/tmp/wt-1'], remaining: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'cleanup']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned 1 worktree(s)'));
    });

    it('runs in dry-run mode', async () => {
      mockCleanupWorktrees.mockReturnValue({ cleaned: [], remaining: [] });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'cleanup', '--dry-run']);

      // When both empty, should show "No loop worktrees found"
      expect(logSpy).toHaveBeenCalledWith('No loop worktrees found.');
    });
  });
});
