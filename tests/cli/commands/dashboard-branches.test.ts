/**
 * Branch coverage tests for src/cli/commands/dashboard.ts — uncovered branches:
 * - Line 40:8 — catch block in loadChangeState (parse error handling)
 * - Line 77:54 — hookInstalled ternary (true/false)
 * - Line 101:45 & 101:97 — goal status icon (completed vs in_progress vs other)
 * - Line 111:59 — roadmap status icon (completed vs in_progress vs other)
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

describe('dashboard command — uncovered branches', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

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
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Line 40:8 — catch block when loadChangeState throws ──

  it('should handle loadChangeState parse error gracefully', async () => {
    mockLoadChangeState.mockImplementation(() => {
      throw new Error('YAML parse error');
    });
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: null,
      coverage: { totalPages: 0, stalePages: 0, coverageRatio: 0 },
      goals: [],
      roadmap: [],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    // Should not throw — catch block at line 40 silently ignores parse errors
    await program.parseAsync(['dashboard'], { from: 'user' });

    // Should still output the dashboard (with empty phase/workflow)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MUMUSPEC DASHBOARD'));
  });

  // ── Line 77:54 — hookInstalled ternary ──

  it('should display hooks as not installed when hookInstalled is false', async () => {
    mockLoadChangeState.mockReturnValue({ phase: 'build', workflow: 'full' });
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: {
        name: 'test-change',
        phase: 'build',
        workflow: 'full',
        hookInstalled: false, // ← triggers "○ not installed" branch
        knowledgePages: 3,
        stalePages: 0,
        summary: 'No hooks',
      },
      coverage: { totalPages: 5, stalePages: 0, coverageRatio: 0.6 },
      goals: [],
      roadmap: [],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('○ not installed'));
  });

  it('should display hooks as installed when hookInstalled is true', async () => {
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: {
        name: 'test-change',
        phase: 'design',
        workflow: 'standard',
        hookInstalled: true, // ← triggers "✓ installed" branch
        knowledgePages: 5,
        stalePages: 1,
        summary: 'Hooks active',
      },
      coverage: { totalPages: 10, stalePages: 2, coverageRatio: 0.8 },
      goals: [],
      roadmap: [],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ installed'));
  });

  // ── Line 101 — goal status icons ──

  it('should show completed icon (✓) for completed goals', async () => {
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: null,
      coverage: { totalPages: 0, stalePages: 0, coverageRatio: 0 },
      goals: [
        { id: 'g1', title: 'Done goal', status: 'completed' },
      ],
      roadmap: [],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    // ✓ for completed
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ [g1] Done goal (completed)'));
  });

  it('should show in-progress icon (►) for in_progress goals', async () => {
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: null,
      coverage: { totalPages: 0, stalePages: 0, coverageRatio: 0 },
      goals: [
        { id: 'g2', title: 'Active goal', status: 'in_progress' },
      ],
      roadmap: [],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    // ► for in_progress
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('► [g2] Active goal (in_progress)'));
  });

  it('should show pending icon (○) for pending goals', async () => {
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: null,
      coverage: { totalPages: 0, stalePages: 0, coverageRatio: 0 },
      goals: [
        { id: 'g3', title: 'Pending goal', status: 'pending' },
      ],
      roadmap: [],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    // ○ for pending (not completed, not in_progress)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('○ [g3] Pending goal (pending)'));
  });

  // ── Line 111 — roadmap status icons ──

  it('should show completed icon (✓) for completed roadmap items', async () => {
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: null,
      coverage: { totalPages: 0, stalePages: 0, coverageRatio: 0 },
      goals: [],
      roadmap: [
        { id: 'r1', title: 'Shipped', milestone: 'v1.0', status: 'completed' },
      ],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ [r1] Shipped'));
  });

  it('should show in-progress icon (►) for in_progress roadmap items', async () => {
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: null,
      coverage: { totalPages: 0, stalePages: 0, coverageRatio: 0 },
      goals: [],
      roadmap: [
        { id: 'r2', title: 'In Progress Item', milestone: 'v2.0', status: 'in_progress' },
      ],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('► [r2] In Progress Item'));
  });

  it('should show pending icon (○) for pending roadmap items', async () => {
    mockGetDashboardData.mockReturnValue({
      project: 'test-proj',
      projectRoot: '/fake/root',
      activeChange: null,
      coverage: { totalPages: 0, stalePages: 0, coverageRatio: 0 },
      goals: [],
      roadmap: [
        { id: 'r3', title: 'Future Item', milestone: 'v3.0', status: 'planned' },
      ],
      alerts: [],
    });

    const { registerDashboardCommands } = await import('../../../src/cli/commands/dashboard.js');
    const program = new Command();
    registerDashboardCommands(program);

    await program.parseAsync(['dashboard'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('○ [r3] Future Item'));
  });
});
