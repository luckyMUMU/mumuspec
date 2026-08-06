/**
 * Handler-level tests for dashboard command.
 *
 * Strategy: mock lower-level modules (core/utils, core/config, change/manager,
 * change/state, hooks/guard, knowledge/manager), register dashboard command on
 * a fresh Commander program, then invoke handlers via parseAsync() with
 * { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockGetActiveChange,
  mockLoadChangeState,
  mockGetChangeStatusSummary,
  mockGetHookStatus,
  mockGetDashboardData,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockGetChangeStatusSummary: vi.fn(),
  mockGetHookStatus: vi.fn(),
  mockGetDashboardData: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    getActiveChange: mockGetActiveChange,
    getChangeStatusSummary: mockGetChangeStatusSummary,
  };
});

vi.mock('../../../src/change/state.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/state.js')>();
  return {
    ...actual,
    loadChangeState: mockLoadChangeState,
  };
});

vi.mock('../../../src/hooks/guard.js', () => ({
  getHookStatus: mockGetHookStatus,
}));

vi.mock('../../../src/knowledge/manager.js', () => ({
  getDashboardData: mockGetDashboardData,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('dashboard command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const mockDashboard = {
    project: 'test-proj',
    projectRoot: '/fake/root',
    activeChange: {
      name: 'test-change',
      phase: 'design',
      workflow: 'standard',
      hookInstalled: true,
      knowledgePages: 5,
      stalePages: 1,
      summary: 'Test summary',
    },
    coverage: {
      totalPages: 10,
      stalePages: 2,
      coverageRatio: 0.8,
    },
    goals: [
      { id: 'goal-1', title: 'Ship MVP', status: 'in_progress' },
    ],
    roadmap: [
      { id: 'rm-1', title: 'Alpha release', milestone: 'v0.1', status: 'completed' },
    ],
    alerts: ['Stale knowledge pages detected'],
  };

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockLoadConfig.mockReset();
    mockGetActiveChange.mockReset();
    mockLoadChangeState.mockReset();
    mockGetChangeStatusSummary.mockReset();
    mockGetHookStatus.mockReset();
    mockGetDashboardData.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ ai: { rules_files: [] } });
    mockGetActiveChange.mockReturnValue('test-change');
    mockLoadChangeState.mockReturnValue({ phase: 'design', workflow: 'standard' });
    mockGetChangeStatusSummary.mockReturnValue('Test summary');
    mockGetHookStatus.mockReturnValue({ available: ['pre-commit', 'pre-push'], installed: ['pre-commit'] });
    mockGetDashboardData.mockReturnValue(mockDashboard);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Not in project ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard', '--workspace-path', '/nowhere'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Not in a MumuSpec project. Run `mumuspec init` first.',
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Text output with active change ──

  it('should display dashboard with active change info', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MUMUSPEC DASHBOARD'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-proj'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('test-change'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('design'));
  });

  // ── No active change ──

  it('should display "No active change" when none exists', async () => {
    mockGetActiveChange.mockReturnValue(undefined);
    mockGetDashboardData.mockReturnValue({
      ...mockDashboard,
      activeChange: null,
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('No active change.');
    expect(logSpy).toHaveBeenCalledWith('  Run `mumuspec new <name>` to create one.');
  });

  // ── JSON output ──

  it('should output JSON when --json flag is set', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard', '--json'], { from: 'user' });

    const calls = logSpy.mock.calls.flat();
    const jsonOutput = calls.find((c) => typeof c === 'string' && c.includes('"project"'));
    expect(jsonOutput).toBeDefined();
    const parsed = JSON.parse(jsonOutput!);
    expect(parsed.project).toBe('test-proj');
  });

  // ── Workspace path option ──

  it('should use workspace-path option for findProjectRoot', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard', '--workspace-path', '/custom/path'], { from: 'user' });

    expect(mockFindProjectRoot).toHaveBeenCalledWith('/custom/path');
  });

  // ── Knowledge coverage display ──

  it('should display knowledge coverage section', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Knowledge Coverage'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('10 total'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('80.0%'));
  });

  // ── Goals display ──

  it('should display project goals', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Project Goals'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Ship MVP'));
  });

  // ── Roadmap display ──

  it('should display roadmap items', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Roadmap'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Alpha release'));
  });

  // ── Alerts display ──

  it('should display alerts', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Alerts'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Stale knowledge pages'));
  });

  // ── Hooks display ──

  it('should display hooks status', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Hooks'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('pre-commit'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('pre-push'));
  });

  // ── workspace-path for hook status ──

  it('should pass workspace-path to getHookStatus', async () => {
    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard', '--workspace-path', '/my/workspace'], { from: 'user' });

    expect(mockGetHookStatus).toHaveBeenCalledWith('/my/workspace');
  });
});
