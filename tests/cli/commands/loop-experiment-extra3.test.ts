/**
 * Extra coverage tests for loop-experiment command — compare, select, adopt,
 * status, cleanup, info, default help, and error branches not yet covered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn(() => '/fake/root');
const mockInitExperiment = vi.fn();
const mockSpawnArms = vi.fn();
const mockRunArm = vi.fn();
const mockCompareArms = vi.fn();
const mockSelectDirections = vi.fn();
const mockAdoptImprovements = vi.fn();
const mockLoadExperimentState = vi.fn();
const mockGetExperimentStatus = vi.fn();
const mockListExperiments = vi.fn(() => []);
const mockCleanupExperiment = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: () => mockFindProjectRoot() };
});

vi.mock('../../../src/core/experiment-engine.js', () => ({
  initExperiment: (...args: unknown[]) => mockInitExperiment(...args),
  spawnArms: (...args: unknown[]) => mockSpawnArms(...args),
  runArm: (...args: unknown[]) => mockRunArm(...args),
  compareArms: (...args: unknown[]) => mockCompareArms(...args),
  selectDirections: (...args: unknown[]) => mockSelectDirections(...args),
  adoptImprovements: (...args: unknown[]) => mockAdoptImprovements(...args),
  loadExperimentState: (...args: unknown[]) => mockLoadExperimentState(...args),
  getExperimentStatus: (...args: unknown[]) => mockGetExperimentStatus(...args),
  listExperiments: (...args: unknown[]) => mockListExperiments(...args),
  cleanupExperiment: (...args: unknown[]) => mockCleanupExperiment(...args),
}));

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
  mockFindProjectRoot.mockReturnValue('/fake/root');
  mockInitExperiment.mockReset();
  mockSpawnArms.mockReset();
  mockRunArm.mockReset();
  mockRunArm.mockReturnValue(undefined);
  mockCompareArms.mockReset();
  mockSelectDirections.mockReset();
  mockAdoptImprovements.mockReset();
  mockLoadExperimentState.mockReset();
  mockGetExperimentStatus.mockReset();
  mockListExperiments.mockReset();
  mockListExperiments.mockReturnValue([]);
  mockCleanupExperiment.mockReset();
});

afterEach(() => { vi.restoreAllMocks(); });

// ════════════════════════════════════════════════════════════════════
// compare
// ════════════════════════════════════════════════════════════════════

describe('compare subcommand', () => {
  it('prints full comparison with rankings, insights, recommendations', async () => {
    mockCompareArms.mockReturnValue({
      totalArms: 3,
      successfulArms: 2,
      failedArms: 1,
      rankings: [
        { rank: 1, directionName: 'Add caching layer', directionId: 'd1', compositeScore: 8.5 },
        { rank: 2, directionName: 'Refactor loops', directionId: 'd2', compositeScore: 4.2 },
      ],
      insights: [
        { category: 'performance', description: 'Caching reduced latency' },
      ],
      recommendations: ['d1'],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'compare', 'exp1'], { from: 'user' });
    expect(mockCompareArms).toHaveBeenCalledWith('/fake/root', 'exp1');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Total arms:    3'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('8.5'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Add caching layer'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[performance] Caching reduced latency'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('d1'));
  });

  it('prints comparison with no rankings/insights/recommendations', async () => {
    mockCompareArms.mockReturnValue({
      totalArms: 0, successfulArms: 0, failedArms: 0,
      rankings: [], insights: [], recommendations: [],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'compare', 'exp-empty'], { from: 'user' });
    expect(mockCompareArms).toHaveBeenCalledWith('/fake/root', 'exp-empty');
  });

  it('exits 1 when compare throws', async () => {
    mockCompareArms.mockImplementation(() => { throw new Error('compare error'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'compare', 'exp-bad'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: compare error');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'compare', 'expX'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});

// ════════════════════════════════════════════════════════════════════
// select
// ════════════════════════════════════════════════════════════════════

describe('select subcommand', () => {
  it('selects multiple directions', async () => {
    mockSelectDirections.mockReturnValue({
      selectedDirections: ['d1', 'd3'],
      directions: [
        { id: 'd1', name: 'Direction One', description: '', category: 'perf', riskLevel: 'low', affectedFiles: [] },
        { id: 'd3', name: 'Direction Three', description: '', category: 'refactor', riskLevel: 'medium', affectedFiles: [] },
      ],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'select', 'exp1', 'd1', 'd3'], { from: 'user' });
    expect(mockSelectDirections).toHaveBeenCalledWith('/fake/root', 'exp1', ['d1', 'd3']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Direction One'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Direction Three'));
  });

  it('selects with empty selectedDirections', async () => {
    mockSelectDirections.mockReturnValue({
      selectedDirections: [],
      directions: [],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'select', 'exp1', 'none'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Selected 0 direction'));
  });

  it('selects with id not matching any direction name', async () => {
    mockSelectDirections.mockReturnValue({
      selectedDirections: ['orphan-id'],
      directions: [
        { id: 'other', name: 'Other Dir', description: '', category: 'x', riskLevel: 'low', affectedFiles: [] },
      ],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'select', 'exp1', 'orphan-id'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
  });

  it('handles unknown dirId', async () => {
    mockSelectDirections.mockReturnValue({
      selectedDirections: ['unknown-id'],
      directions: [],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'select', 'exp1', 'unknown-id'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
  });

  it('exits 1 when select throws', async () => {
    mockSelectDirections.mockImplementation(() => { throw new Error('select failed'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'select', 'exp1', 'd1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: select failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'select', 'exp1', 'd1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});

// ════════════════════════════════════════════════════════════════════
// adopt
// ════════════════════════════════════════════════════════════════════

describe('adopt subcommand', () => {
  it('adopts without dry-run and shows adopted + errors', async () => {
    mockAdoptImprovements.mockReturnValue({
      adopted: ['d1', 'd2'],
      errors: ['failed to merge d3'],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'adopt', 'exp1'], { from: 'user' });
    expect(mockAdoptImprovements).toHaveBeenCalledWith('/fake/root', 'exp1');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Adopted 2 improvement'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ d1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ d2'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to merge d3'));
  });

  it('adopts with no errors', async () => {
    mockAdoptImprovements.mockReturnValue({ adopted: ['d5'], errors: [] });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'adopt', 'exp-clean'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ d5'));
  });

  it('dry-run prints selected directions and files', async () => {
    mockLoadExperimentState.mockReturnValue({
      selectedDirections: ['d2'],
      directions: [
        { id: 'd2', name: 'Refactor module', description: '', category: 'refactor', riskLevel: 'low', affectedFiles: ['src/a.ts', 'src/b.ts'] },
      ],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'adopt', 'exp1', '--dry-run'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('DRY-RUN'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Refactor module'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('src/a.ts'));
  });

  it('dry-run with unknown direction id shows fallback name and none files', async () => {
    mockLoadExperimentState.mockReturnValue({
      selectedDirections: ['missing-id'],
      directions: [
        { id: 'real', name: 'Real Dir', description: '', category: 'x', riskLevel: 'low', affectedFiles: [] },
      ],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'adopt', 'exp1', '--dry-run'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Files: none'));
  });

  it('dry-run exits 1 when experiment not found', async () => {
    mockLoadExperimentState.mockReturnValue(null);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'adopt', 'missing', '--dry-run'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Experiment not found: missing');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when adopt throws', async () => {
    mockAdoptImprovements.mockImplementation(() => { throw new Error('merge conflict'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'adopt', 'exp-bad'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: merge conflict');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'adopt', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});

// ════════════════════════════════════════════════════════════════════
// status
// ════════════════════════════════════════════════════════════════════

describe('status subcommand', () => {
  it('shows detailed status for one experiment', async () => {
    mockGetExperimentStatus.mockReturnValue({
      name: 'exp1',
      phase: 'running',
      armsCompleted: 2,
      armsTotal: 5,
      armsFailed: 1,
      directionCount: 4,
      selectedCount: 2,
      mergedBack: true,
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'status', 'exp1'], { from: 'user' });
    expect(mockGetExperimentStatus).toHaveBeenCalledWith('/fake/root', 'exp1');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Phase:      running'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2/5 completed'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed:     1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Merged:     Yes'));
  });

  it('shows status without failed line when armsFailed is 0', async () => {
    mockGetExperimentStatus.mockReturnValue({
      name: 'clean-exp',
      phase: 'done',
      armsCompleted: 3,
      armsTotal: 3,
      armsFailed: 0,
      directionCount: 3,
      selectedCount: 1,
      mergedBack: false,
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'status', 'clean-exp'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Merged:     No'));
  });

  it('handles experiment not found gracefully (no exit)', async () => {
    mockGetExperimentStatus.mockReturnValue(null);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'status', 'ghost'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('lists all experiments when no name provided', async () => {
    mockListExperiments.mockReturnValue([
      { name: 'exp-a', phase: 'running', armsCompleted: 1, armsTotal: 3, directionCount: 3, selectedCount: 0, mergedBack: false },
      { name: 'exp-b', phase: 'done', armsCompleted: 5, armsTotal: 5, directionCount: 5, selectedCount: 2, mergedBack: true },
    ]);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'status'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 experiment'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('exp-a [running]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('exp-b [done]'));
  });

  it('prints "No experiments found" for empty list', async () => {
    mockListExperiments.mockReturnValue([]);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'status'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith('No experiments found.');
  });

  it('exits 1 when status command throws', async () => {
    mockGetExperimentStatus.mockImplementation(() => { throw new Error('status error'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'status', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: status error');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'status', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});

// ════════════════════════════════════════════════════════════════════
// cleanup
// ════════════════════════════════════════════════════════════════════

describe('cleanup subcommand', () => {
  it('cleans successfully', async () => {
    mockCleanupExperiment.mockReturnValue({
      cleaned: ['/fake/root/.wt/arm1', '/fake/root/.wt/arm2'],
      errors: [],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'cleanup', 'exp1'], { from: 'user' });
    expect(mockCleanupExperiment).toHaveBeenCalledWith('/fake/root', 'exp1', { dryRun: undefined });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Cleaned 2 worktree'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('.wt/arm1'));
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('dry-run cleans', async () => {
    mockCleanupExperiment.mockReturnValue({
      cleaned: ['/fake/root/.wt/arm1'],
      errors: [],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'cleanup', 'exp1', '--dry-run'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('DRY-RUN'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Would clean'));
  });

  it('prints "No worktrees to clean up" when empty', async () => {
    mockCleanupExperiment.mockReturnValue({ cleaned: [], errors: [] });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'cleanup', 'exp1'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith('No worktrees to clean up.');
  });

  it('shows errors on partial cleanup failure', async () => {
    mockCleanupExperiment.mockReturnValue({
      cleaned: ['/fake/root/.wt/arm1'],
      errors: ['Could not remove arm2: busy'],
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'cleanup', 'exp1'], { from: 'user' });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Could not remove arm2'));
  });

  it('exits 1 when cleanup throws', async () => {
    mockCleanupExperiment.mockImplementation(() => { throw new Error('cleanup error'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'cleanup', 'exp-bad'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: cleanup error');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'cleanup', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});

// ════════════════════════════════════════════════════════════════════
// run
// ════════════════════════════════════════════════════════════════════

describe('run subcommand', () => {
  it('handles empty arms with exit(1)', async () => {
    mockLoadExperimentState.mockReturnValue({ arms: [] });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'run', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: No arms spawned. Run "mumuspec loop experiment spawn" first.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('runs multiple arms, some fail', async () => {
    mockLoadExperimentState.mockReturnValue({
      arms: [
        { id: 'arm1', worktreePath: '/tmp/wt1', branch: 'b1' },
        { id: 'arm2', worktreePath: '/tmp/wt2', branch: 'b2' },
        { id: 'arm3', worktreePath: '/tmp/wt3', branch: 'b3' },
      ],
    });
    mockRunArm.mockReturnValueOnce(undefined)
      .mockImplementationOnce(() => { throw new Error('timeout'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'run', 'exp1'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Running arm1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Running arm2'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Completed'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Failed: timeout'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2 succeeded, 1 failed'));
  });

  it('runs non-error throw from runArm (string)', async () => {
    mockLoadExperimentState.mockReturnValue({
      arms: [{ id: 'arm', worktreePath: '/tmp/wt', branch: 'b' }],
    });
    mockRunArm.mockImplementation(() => { throw 'string error'; });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'run', 'exp1'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('string error'));
  });

  it('runs non-error throw from runArm (number)', async () => {
    mockLoadExperimentState.mockReturnValue({
      arms: [{ id: 'a', worktreePath: '/t', branch: 'b' }],
    });
    mockRunArm.mockImplementation(() => { throw 42; });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'run', 'exp1'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('42'));
  });

  it('exits 1 when run outer catch fires', async () => {
    mockLoadExperimentState.mockImplementation(() => { throw new Error('state corrupt'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'run', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: state corrupt');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits 1 when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'run', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});

// ════════════════════════════════════════════════════════════════════
// info
// ════════════════════════════════════════════════════════════════════

describe('info subcommand', () => {
  it('prints help overview', async () => {
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'info'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Parallel Evolution Loop'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('plan'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('compare'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('mumuspec loop experiment spawn'));
  });
});

// ════════════════════════════════════════════════════════════════════
// default action (no subcommand)
// ════════════════════════════════════════════════════════════════════

describe('experiment default action', () => {
  it('prints usage when no subcommand given', async () => {
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Parallel evolution loop'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Usage'));
  });
});

// ════════════════════════════════════════════════════════════════════
// init — additional branches not in extra.test.ts
// ════════════════════════════════════════════════════════════════════

describe('init subcommand extras', () => {
  it('init handles error during execution', async () => {
    mockInitExperiment.mockImplementation(() => { throw new Error('init failed'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'init', 'exp1', '--goal', 'do something'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: init failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('init uses NaN fallback for direction count', async () => {
    mockInitExperiment.mockReturnValue({
      name: 'exp', goal: 'g', directions: [], maxMetaRounds: 3,
      demoChangeName: 'x', baseCommit: '', arms: [], status: 'initialized',
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(
      ['experiment', 'init', 'exp', '--goal', 'g', '--directions', 'not-a-number', '--meta-rounds', 'abc'],
      { from: 'user' },
    );
    expect(mockInitExperiment).toHaveBeenCalledWith(
      '/fake/root',
      expect.objectContaining({
        config: expect.objectContaining({ directionCount: 5, maxMetaRounds: 2 }),
      }),
    );
  });

  it('init uses focus categories when provided', async () => {
    mockInitExperiment.mockReturnValue({
      name: 'exp', goal: 'g', directions: [], maxMetaRounds: 1,
      demoChangeName: 'x', baseCommit: '', arms: [], status: 'initialized',
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(
      ['experiment', 'init', 'exp', '--goal', 'g', '--focus', 'perf', 'security'],
      { from: 'user' },
    );
    expect(mockInitExperiment).toHaveBeenCalledWith(
      '/fake/root',
      expect.objectContaining({
        config: expect.objectContaining({ focusCategories: ['perf', 'security'] }),
      }),
    );
  });

  it('init prints direction descriptions truncated at 60 chars', async () => {
    const longDesc = 'a'.repeat(80);
    mockInitExperiment.mockReturnValue({
      name: 'exp', goal: 'test', maxMetaRounds: 1,
      demoChangeName: 'ch', baseCommit: 'deadbeef1234',
      directions: [
        { id: 'd1', name: 'longdir', category: 'refactor', description: longDesc, riskLevel: 'high' },
      ],
      arms: [], status: 'initialized',
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'init', 'exp', '--goal', 'test'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(longDesc.substring(0, 60) + '...'));
  });

  it('init with demo-project and demo-change options', async () => {
    mockInitExperiment.mockReturnValue({
      name: 'exp', goal: 'g', directions: [], maxMetaRounds: 1,
      demoChangeName: 'custom-change', baseCommit: '', arms: [], status: 'initialized',
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(
      ['experiment', 'init', 'exp', '--goal', 'g', '--demo-change', 'custom-change', '--demo-project', 'rel/path'],
      { from: 'user' },
    );
    expect(mockInitExperiment).toHaveBeenCalledWith(
      '/fake/root',
      expect.objectContaining({
        config: expect.objectContaining({
          demoChangeName: 'custom-change',
        }),
      }),
    );
    // Verify demoProjectPath is a resolved absolute path ending with the relative input
    const call = mockInitExperiment.mock.calls[0];
    expect(call[1].config.demoProjectPath).toMatch(/rel[\\/]path$/);
  });
});

// ════════════════════════════════════════════════════════════════════
// spawn — additional branches not in extra.test.ts
// ════════════════════════════════════════════════════════════════════

describe('spawn subcommand extras', () => {
  it('spawn exits 1 when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'spawn', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('spawn handles multiple arms', async () => {
    mockSpawnArms.mockReturnValue([
      { id: 'a1', worktreePath: '/t/1', branch: 'b1' },
      { id: 'a2', worktreePath: '/t/2', branch: 'b2' },
      { id: 'a3', worktreePath: '/t/3', branch: 'b3' },
    ]);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync(['experiment', 'spawn', 'multi'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Spawned 3 worktree'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('a3'));
  });
});
