/**
 * Handler-level tests for graph verify command.
 *
 * Strategy: mock lower-level modules (core/utils, change/manager, change/state,
 * change/phase-graph, change/state-machine), register graph commands on a
 * fresh Commander program, then invoke handlers via parseAsync() with
 * { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockGetActiveChange,
  mockLoadChangeState,
  mockPHASE_ORDER,
  mockGetValidTransitionsWithContext,
  mockIsTerminal,
  mockFindTransitionPath,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockPHASE_ORDER: ['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed'],
  mockGetValidTransitionsWithContext: vi.fn(),
  mockIsTerminal: vi.fn(),
  mockFindTransitionPath: vi.fn(),
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
  };
});

vi.mock('../../../src/change/state.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/state.js')>();
  return {
    ...actual,
    loadChangeState: mockLoadChangeState,
  };
});

vi.mock('../../../src/change/phase-graph.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/phase-graph.js')>();
  return {
    ...actual,
    PHASE_ORDER: mockPHASE_ORDER,
  };
});

vi.mock('../../../src/change/state-machine.js', () => ({
  getValidTransitionsWithContext: mockGetValidTransitionsWithContext,
  isTerminal: mockIsTerminal,
  findTransitionPath: mockFindTransitionPath,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('graph command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const baseState = {
    name: 'test-change',
    phase: 'design',
    workflow: 'standard',
    rollback_count: 0,
    rollback_limit: 3,
    rebuild_count: 0,
    rebuild_limit: 5,
  };

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockGetActiveChange.mockReset();
    mockLoadChangeState.mockReset();
    mockGetValidTransitionsWithContext.mockReset();
    mockIsTerminal.mockReset();
    mockFindTransitionPath.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockGetActiveChange.mockReturnValue('test-change');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Not in project ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── No change specified or active ──

  it('should exit(1) when no change is specified and no active change', async () => {
    mockGetActiveChange.mockReturnValue(undefined);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: No active change. Specify --change or run inside a change directory.',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── State not found ──

  it('should exit(1) when state cannot be loaded', async () => {
    mockLoadChangeState.mockReturnValue(undefined);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify', '--change', 'bad-change'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Could not load state for change "bad-change".',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── All checks passed (non-terminal, valid) ──

  it('should print all checks passed for valid non-terminal state', async () => {
    mockLoadChangeState.mockReturnValue(baseState);
    mockIsTerminal.mockReturnValue(false);
    mockGetValidTransitionsWithContext.mockReturnValue(['build']);
    mockFindTransitionPath.mockReturnValue(['design', 'build', 'verify', 'archive-in-progress', 'archive-completed']);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify', '--change', 'test-change'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Graph Verify: test-change'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ All checks passed'));
    expect(exitSpy).not.toHaveBeenCalled();
  });

  // ── Invalid phase ──

  it('should fail check when phase is not in PHASE_ORDER', async () => {
    mockLoadChangeState.mockReturnValue({
      ...baseState,
      phase: 'invalid-phase',
    });
    mockIsTerminal.mockReturnValue(false);
    mockGetValidTransitionsWithContext.mockReturnValue([]);
    mockFindTransitionPath.mockReturnValue([]);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify', '--change', 'test-change'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('check(s) failed'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Terminal phase ──

  it('should pass terminal phase check when locked', async () => {
    mockLoadChangeState.mockReturnValue({
      ...baseState,
      phase: 'archive-completed',
    });
    mockIsTerminal.mockReturnValue(true);
    mockGetValidTransitionsWithContext.mockReturnValue([]);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify', '--change', 'test-change'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Terminal phase has no outgoing transitions'),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ All checks passed'));
  });

  // ── Rollback limit exceeded ──

  it('should fail check when rollback count exceeds limit', async () => {
    mockLoadChangeState.mockReturnValue({
      ...baseState,
      rollback_count: 5,
      rollback_limit: 3,
    });
    mockIsTerminal.mockReturnValue(false);
    mockGetValidTransitionsWithContext.mockReturnValue(['build']);
    mockFindTransitionPath.mockReturnValue(['design', 'build']);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify', '--change', 'test-change'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rollback limit respected'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('5/3'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Rebuild limit exceeded ──

  it('should fail check when rebuild count exceeds limit', async () => {
    mockLoadChangeState.mockReturnValue({
      ...baseState,
      rebuild_count: 10,
      rebuild_limit: 5,
    });
    mockIsTerminal.mockReturnValue(false);
    mockGetValidTransitionsWithContext.mockReturnValue(['build']);
    mockFindTransitionPath.mockReturnValue(['design', 'build']);

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify', '--change', 'test-change'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rebuild limit respected'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('10/5'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── No path to archive-completed ──

  it('should fail check when no path to archive-completed exists', async () => {
    mockLoadChangeState.mockReturnValue({
      ...baseState,
      phase: 'build',
    });
    mockIsTerminal.mockReturnValue(false);
    mockGetValidTransitionsWithContext.mockReturnValue(['verify']);
    mockFindTransitionPath.mockReturnValue([]); // unreachable

    const { registerGraphCommand } = await import('../../../src/cli/commands/graph.js');
    const program = new Command();
    registerGraphCommand(program);

    await program.parseAsync(['graph', 'verify', '--change', 'test-change'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Path to archive-completed exists'),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('unreachable'));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
