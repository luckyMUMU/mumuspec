/**
 * Extra tests for loop-experiment command — init, spawn, run subcommands.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();
const mockInitExperiment = vi.fn();
const mockSpawnArms = vi.fn();
const mockLoadExperimentState = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});

vi.mock('../../../src/core/experiment-engine.js', () => ({
  initExperiment: (...args: unknown[]) => mockInitExperiment(...args),
  spawnArms: (...args: unknown[]) => mockSpawnArms(...args),
  runArm: vi.fn(),
  compareArms: vi.fn(() => ({ totalArms: 0, successfulArms: 0, failedArms: 0, rankings: [], insights: [], recommendations: [] })),
  selectDirections: vi.fn(),
  adoptImprovements: vi.fn(),
  loadExperimentState: (...args: unknown[]) => mockLoadExperimentState(...args),
  getExperimentStatus: vi.fn(),
  listExperiments: vi.fn(() => []),
  cleanupExperiment: vi.fn(),
}));

describe('loop-experiment command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReset();
    mockInitExperiment.mockReset();
    mockSpawnArms.mockReset();
    mockLoadExperimentState.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('experiment init: should exit(1) when not in project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync([ 'experiment', 'init', 'exp1', '--goal', 'test goal'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('experiment init: should call initExperiment with options', async () => {
    mockInitExperiment.mockReturnValue({
      name: 'exp1',
      goal: 'test goal',
      directions: [{ id: 'd1', name: 'dir1', category: 'perf', description: 'desc', riskLevel: 'low' }],
      maxMetaRounds: 2,
      demoChangeName: 'add-priority-field',
      baseCommit: 'abc123',
      arms: [],
      status: 'initialized',
    });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync([ 'experiment', 'init', 'exp1', '--goal', 'test goal'], { from: 'user' });
    expect(mockInitExperiment).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Experiment Initialized'));
  });

  it('experiment spawn: should call spawnArms', async () => {
    mockSpawnArms.mockReturnValue([
      { id: 'arm1', worktreePath: '/tmp/wt1', branch: 'exp1-arm1' },
    ]);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync([ 'experiment', 'spawn', 'exp1'], { from: 'user' });
    expect(mockSpawnArms).toHaveBeenCalledWith('/fake/root', 'exp1');
  });

  it('experiment spawn: should exit(1) on error', async () => {
    mockSpawnArms.mockImplementation(() => { throw new Error('spawn failed'); });
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync([ 'experiment', 'spawn', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: spawn failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('experiment run: should handle experiment not found', async () => {
    mockLoadExperimentState.mockReturnValue(null);
    const { registerExperimentCommands } = await import('../../../src/cli/commands/loop-experiment.js');
    const loopCmd = new Command();
    registerExperimentCommands(loopCmd);
    await loopCmd.parseAsync([ 'experiment', 'run', 'exp1'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Experiment not found: exp1');
  });
});
