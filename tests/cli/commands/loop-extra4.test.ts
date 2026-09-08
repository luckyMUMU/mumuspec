/**
 * Supplementary coverage for loop commands: info, grill, cleanup-remaining,
 * evaluate-phase branches, and error paths.
 *
 * Augments loop-handler.test.ts — does NOT replace or overlap cases.
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

vi.mock('../../../src/change/loop-engine.js', () => ({
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

vi.mock('../../../src/cli/commands/loop-experiment.js', () => ({
  registerExperimentCommands: vi.fn(),
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

describe('loop extra coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockRunLoopGrill.mockReturnValue({
      passed: true,
      validatedContext: { goal: 'test goal', criteria: [], maxRounds: 3 },
    });
    mockFormatGrillReport.mockReturnValue('## Grill Report\nAll good.');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── info command ──────────────────────────────────────

  describe('info command', () => {
    it('prints loop mode help overview', async () => {
      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'info']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Loop Mode');
      expect(output).toContain('Plan → Act → Evaluate');
      expect(output).toContain('mumuspec loop init');
      expect(output).toContain('mumuspec loop round');
      expect(output).toContain('mumuspec loop action');
      expect(output).toContain('mumuspec loop evaluate');
      expect(output).toContain('mumuspec loop exit');
      expect(output).toContain('mumuspec loop merge');
      expect(output).toContain('mumuspec loop grill');
      expect(output).toContain('mumuspec loop status');
      expect(output).toContain('mumuspec loop resume');
      expect(output).toContain('mumuspec loop extend');
    });
  });

  // ── grill command ─────────────────────────────────────

  describe('grill command', () => {
    it('passes and prints grill report', async () => {
      mockRunLoopGrill.mockReturnValue({
        passed: true,
        validatedContext: { goal: 'Ship feature', criteria: ['tests pass'], maxRounds: 5 },
      });
      mockFormatGrillReport.mockReturnValue('## Grill Report\nFeasible!');

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'loop', 'grill',
        '--goal', 'Ship feature',
        '--criteria', 'tests pass',
        '--rounds', '5',
      ]);

      expect(mockRunLoopGrill).toHaveBeenCalledWith({
        goal: 'Ship feature',
        criteria: ['tests pass'],
        maxRounds: 5,
      });
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Feasible!');
    });

    it('fails and exits with code 1 when grill does not pass', async () => {
      mockRunLoopGrill.mockReturnValue({
        passed: false,
        validatedContext: { goal: '', criteria: [], maxRounds: 3 },
      });
      mockFormatGrillReport.mockReturnValue('## Grill Report\nToo vague.');

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'grill', '--goal', '']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── cleanup with remaining worktrees ──────────────────

  describe('cleanup with remaining worktrees', () => {
    it('shows remaining when some worktrees are still active', async () => {
      mockCleanupWorktrees.mockReturnValue({
        cleaned: [`${FAKE_ROOT}/.worktrees/old-wt`],
        remaining: [`${FAKE_ROOT}/.worktrees/active-wt`],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'cleanup']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Cleaned 1 worktree(s)');
      expect(output).toContain('.worktrees/old-wt');
      expect(output).toContain('1 active worktree(s) remaining');
    });

    it('dry-run shows would-clean message', async () => {
      mockCleanupWorktrees.mockReturnValue({
        cleaned: [`${FAKE_ROOT}/.worktrees/wt-1`],
        remaining: [],
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'cleanup', '--dry-run']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('[DRY-RUN] Would clean');
      expect(output).toContain('1 worktree(s)');
    });

    it('cleanup error path prints error message', async () => {
      mockCleanupWorktrees.mockImplementation(() => {
        throw new Error('git worktree lock failed');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'cleanup']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: git worktree lock failed');
    });
  });

  // ── evaluate: phase-specific branches ─────────────────

  describe('evaluate phase branches', () => {
    beforeEach(() => {
      mockGetActiveChange.mockReturnValue('test-change');
    });

    it('handles converged phase with success and exit tip', async () => {
      mockEvaluateRound.mockReturnValue({ should_commit: false, should_continue: false });
      mockGetLoopStatus.mockReturnValue({
        phase: 'converged',
        currentRound: 3,
        maxRounds: 3,
        goal: 'All done',
        totalActions: 10,
        progressTrend: [0.3, 0.7, 1.0],
        worktreePath: null,
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '1.0', '--goal-achieved']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Round 3 Evaluation');
      expect(output).toContain('Goal achieved!');
      expect(output).toContain('loop exit');
    });

    it('handles exhausted phase with extend/exit/status tips', async () => {
      mockEvaluateRound.mockReturnValue({ should_commit: false, should_continue: false });
      mockGetLoopStatus.mockReturnValue({
        phase: 'exhausted',
        currentRound: 3,
        maxRounds: 3,
        goal: 'Stuck after max rounds',
        totalActions: 8,
        progressTrend: [0.2, 0.3, 0.3],
        worktreePath: null,
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '0.3']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Round limit reached');
      expect(output).toContain('loop extend <n>');
      expect(output).toContain('loop exit');
      expect(output).toContain('loop status');
    });

    it('handles blocked phase with fail and resume tip', async () => {
      mockEvaluateRound.mockReturnValue({ should_commit: false, should_continue: false });
      mockGetLoopStatus.mockReturnValue({
        phase: 'blocked',
        currentRound: 2,
        maxRounds: 3,
        goal: 'Requires external API',
        totalActions: 4,
        progressTrend: [0.1, 0.1],
        worktreePath: '/tmp/wt',
        blockReason: 'API key missing',
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'loop', 'evaluate',
        '--progress', '0.1', '--block-reason', 'API key missing',
      ]);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Blocked: API key missing');
      expect(output).toContain('mumuspec loop resume');
    });

    it('handles should_continue phase with next round tip', async () => {
      mockEvaluateRound.mockReturnValue({ should_commit: true, should_continue: true });
      mockGetLoopStatus.mockReturnValue({
        phase: 'plan',
        currentRound: 1,
        maxRounds: 3,
        goal: 'In progress',
        totalActions: 2,
        progressTrend: [0.5],
        worktreePath: null,
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '0.5']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Ready for round 2');
    });

    it('displays issues from lastEvaluation', async () => {
      mockEvaluateRound.mockReturnValue({ should_commit: false, should_continue: false });
      mockGetLoopStatus.mockReturnValue({
        phase: 'act',
        currentRound: 2,
        maxRounds: 3,
        goal: 'Debugging',
        totalActions: 5,
        progressTrend: [0.3, 0.4],
        worktreePath: null,
        lastEvaluation: {
          issues: ['Test coverage dropped', 'Performance regression detected'],
        },
      } as any);

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'loop', 'evaluate',
        '--progress', '0.4',
        '--issue', 'Test coverage dropped',
        '--issue', 'Performance regression detected',
      ]);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Test coverage dropped');
      expect(output).toContain('Performance regression detected');
    });

    it('exits when getLoopStatus returns null after evaluateRound', async () => {
      mockEvaluateRound.mockReturnValue({ should_commit: false, should_continue: false });
      mockGetLoopStatus.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '0.5']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Could not get loop status');
    });

    it('exits when evaluateRound throws', async () => {
      mockEvaluateRound.mockImplementation(() => {
        throw new Error('No active round to evaluate');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '0.5']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active round to evaluate');
    });

    it('accepts --needs-user flag', async () => {
      mockEvaluateRound.mockReturnValue({ should_commit: false, should_continue: false });
      mockGetLoopStatus.mockReturnValue({
        phase: 'blocked',
        currentRound: 1,
        maxRounds: 3,
        goal: 'Needs input',
        totalActions: 0,
        progressTrend: [0.0],
        worktreePath: null,
        blockReason: 'Awaiting user clarification',
      });

      const program = createProgram();
      await program.parseAsync([
        'node', 'mumuspec', 'loop', 'evaluate',
        '--progress', '0.0', '--needs-user', '--next-focus', 'Clarify requirements',
      ]);

      expect(mockEvaluateRound).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', expect.objectContaining({
        needs_user_input: true,
        next_focus: 'Clarify requirements',
      }), expect.anything());
    });
  });

  // ── status: root-null and unreachable paths ───────────

  describe('status root-null path', () => {
    it('exits when findProjectRoot returns null in status', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'status']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── resume: root-null + no-active-change ──────────────

  describe('resume unreachable paths', () => {
    it('exits when findProjectRoot returns null in resume', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'resume']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('exits when no active change in resume', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'resume']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active change. Specify a change name.');
    });
  });

  // ── status: stagnation + recommendation ──────────────

  describe('status branches', () => {
    beforeEach(() => {
      mockGetActiveChange.mockReturnValue('test-change');
    });

    it('shows stagnation warning and recommendation', async () => {
      mockGetLoopStatus.mockReturnValue({
        phase: 'act',
        currentRound: 3,
        maxRounds: 5,
        goal: 'Implement complex refactor across multiple modules',
        totalActions: 12,
        progressTrend: [0.1, 0.1, 0.1],
        worktreePath: null,
        lastEvaluation: {
          next_focus: 'Try breaking into smaller changes',
        },
      });
      mockDetectStagnation.mockReturnValue(true);
      mockGetLoopRecommendation.mockReturnValue('Consider switching strategy');
      mockLoadChangeState.mockReturnValue({
        name: 'test-change',
        loop_state: {
          enabled: true,
          goal: 'test',
          max_rounds: 5,
          current_round: 3,
          phase: 'plan',
          auto_commit: true,
          convergence_criteria: [],
          worktree_path: null,
          round_history: [],
          progress_trend: [0.1, 0.1, 0.1],
        },
      });

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'loop', 'status']);

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('Stagnation detected');
      expect(output).toContain('Try breaking into smaller changes'); // next_focus tip
      expect(output).toContain('Consider switching strategy'); // recommendation
    });
  });

  // ── init error path ───────────────────────────────────

  describe('init error path', () => {
    it('catches initLoop error and exits', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'test-change', loop_state: null });
      mockInitLoop.mockImplementation(() => {
        throw new Error('Failed to create worktree');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'init', 'test-change', '--goal', 'X']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Failed to create worktree');
    });

    it('exits when findProjectRoot returns null in init', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'init', 'test-change', '--goal', 'X']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── round error path ──────────────────────────────────

  describe('round error path', () => {
    it('catches startRound error and exits', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockStartRound.mockImplementation(() => {
        throw new Error('Loop not initialized');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'round', 'Plan']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Loop not initialized');
    });

    it('exits when findProjectRoot returns null in round', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'round', 'Plan']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── action error path ─────────────────────────────────

  describe('action error path', () => {
    it('catches recordAction error and exits', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockRecordAction.mockImplementation(() => {
        throw new Error('No active round');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'action', 'test']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active round');
    });

    it('exits when findProjectRoot returns null in action', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'action', 'test']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── evaluate: root-null + no-active-change ────────────

  describe('evaluate unreachable paths', () => {
    it('exits when findProjectRoot returns null in evaluate', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '0.5']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('exits when no active change in evaluate', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'evaluate', '--progress', '0.5']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active change. Specify a change name.');
    });
  });

  // ── resume error path ─────────────────────────────────

  describe('resume error path', () => {
    it('catches resumeLoop error and exits', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockResumeLoop.mockImplementation(() => {
        throw new Error('Cannot resume: loop is not blocked');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'resume']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Cannot resume: loop is not blocked');
    });
  });

  // ── extend error path ─────────────────────────────────

  describe('extend error path', () => {
    it('catches extendLoop error and exits', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockExtendLoop.mockImplementation(() => {
        throw new Error('Cannot extend: already at max');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'extend', '1']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Cannot extend: already at max');
    });

    it('exits when findProjectRoot returns null in extend', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'extend', '1']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('exits when no active change in extend', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'extend', '1']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active change. Specify a change name.');
    });
  });

  // ── exit error path ───────────────────────────────────

  describe('exit error path', () => {
    it('catches exitLoop error and exits', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockExitLoop.mockImplementation(() => {
        throw new Error('Cannot exit: loop not active');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'exit']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Cannot exit: loop not active');
    });

    it('exits when findProjectRoot returns null in exit', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'exit']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('exits when no active change in exit', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'exit']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active change. Specify a change name.');
    });
  });

  // ── merge error path ──────────────────────────────────

  describe('merge error path', () => {
    it('catches mergeWorktreeBack error and exits', async () => {
      mockGetActiveChange.mockReturnValue('test-change');
      mockMergeWorktreeBack.mockImplementation(() => {
        throw new Error('Merge conflict detected');
      });

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'merge']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Merge conflict detected');
    });

    it('exits when findProjectRoot returns null in merge', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'merge']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('exits when no active change in merge', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'merge']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: No active change. Specify a change name.');
    });
  });

  // ── cleanup: findProjectRoot-null path ────────────────

  describe('cleanup project-root path', () => {
    it('exits when findProjectRoot returns null in cleanup', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(
        program.parseAsync(['node', 'mumuspec', 'loop', 'cleanup']),
      ).rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });
});
