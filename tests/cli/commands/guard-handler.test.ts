/**
 * Handler-level tests for guard command.
 *
 * Strategy: mock lower-level modules (core/utils, core/config, change/manager,
 * change/state-machine, guard/phase-guard), register the guard command on a
 * fresh Commander program, then invoke its action handler via parseAsync() with
 * { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockLoadChangeState,
  mockSaveChangeState,
  mockExecuteTransition,
  mockRequiresUserConfirmation,
  mockRunPhaseGuard,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockSaveChangeState: vi.fn(),
  mockExecuteTransition: vi.fn(),
  mockRequiresUserConfirmation: vi.fn(),
  mockRunPhaseGuard: vi.fn(),
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
    loadChangeState: mockLoadChangeState,
    saveChangeState: mockSaveChangeState,
  };
});

vi.mock('../../../src/change/state-machine.js', () => ({
  executeTransition: mockExecuteTransition,
  requiresUserConfirmation: mockRequiresUserConfirmation,
}));

vi.mock('../../../src/guard/phase-guard.js', () => ({
  runPhaseGuard: mockRunPhaseGuard,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('guard command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockLoadConfig.mockReset();
    mockLoadChangeState.mockReset();
    mockSaveChangeState.mockReset();
    mockExecuteTransition.mockReset();
    mockRequiresUserConfirmation.mockReset();
    mockRunPhaseGuard.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ constraint_strength: { technical_design: 'standard' } });
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Not in project ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── JSON output ──

  it('should print JSON when --json option is set', async () => {
    const guardResult = {
      passed: true,
      errors: [],
      warnings: [{ code: 'W-001', message: 'Minor issue' }],
    };
    mockRunPhaseGuard.mockReturnValue(guardResult);

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design', '--json'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('"passed": true'),
    );
    // Should return early after JSON output
    expect(mockLoadChangeState).not.toHaveBeenCalled();
  });

  // ── Guard passed ──

  it('should print success message when guard passes without apply', async () => {
    mockRunPhaseGuard.mockReturnValue({
      passed: true,
      errors: [],
      warnings: [],
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('✓ Phase guard passed: my-change → design');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  // ── Guard failed ──

  it('should print errors when guard fails without apply', async () => {
    mockRunPhaseGuard.mockReturnValue({
      passed: false,
      errors: [
        { code: 'E-GUARD-001', message: 'Change not found' },
        { code: 'E-GUARD-003', message: 'Missing design doc', detail: 'design.md' },
      ],
      warnings: [],
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('✗ Phase guard failed: my-change → design');
    expect(errorSpy).toHaveBeenCalledWith('  [E-GUARD-001] Change not found');
    expect(errorSpy).toHaveBeenCalledWith('  [E-GUARD-003] Missing design doc');
    expect(errorSpy).toHaveBeenCalledWith('    design.md');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Guard warnings ──

  it('should print warnings when present', async () => {
    mockRunPhaseGuard.mockReturnValue({
      passed: true,
      errors: [],
      warnings: [{ code: 'W-CLAUDE-002', message: 'Minor issue' }],
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design'], { from: 'user' });

    expect(warnSpy).toHaveBeenCalledWith('  ⚠ [W-CLAUDE-002] Minor issue');
  });

  // ── Apply transition: success ──

  it('should apply transition when guard passed and --apply is set', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'open' });
    mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
    mockExecuteTransition.mockReturnValue({
      success: true,
      state: { name: 'my-change', phase: 'design' },
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design', '--apply'], { from: 'user' });

    expect(mockExecuteTransition).toHaveBeenCalled();
    expect(mockSaveChangeState).toHaveBeenCalledWith('/fake/root', 'my-change', expect.objectContaining({ phase: 'design' }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('阶段转换已应用'));
  });

  // ── Apply transition: state not found ──

  it('should exit(1) when state cannot be loaded during apply', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue(undefined);

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design', '--apply'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: my-change');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Apply transition: blocking point requires confirm ──

  it('should exit(2) when blocking point requires confirmation but not given', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'build' });
    mockRequiresUserConfirmation.mockReturnValue({
      required: true,
      bp: 'BP-3',
      description: 'Verify to Archive needs confirmation',
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'archive-in-progress', '--apply'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('阻塞点 BP-3'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('必须显式确认'),
    );
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  // ── Apply transition: blocking point with confirm ──

  it('should proceed through blocking point when --confirm is given', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'build' });
    mockRequiresUserConfirmation.mockReturnValue({
      required: true,
      bp: 'BP-3',
      description: 'Blocking verification',
    });
    mockExecuteTransition.mockReturnValue({
      success: true,
      state: { name: 'my-change', phase: 'verify' },
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(
      ['guard', 'my-change', 'verify', '--apply', '--confirm'],
      { from: 'user' },
    );

    expect(mockExecuteTransition).toHaveBeenCalledWith(
      expect.anything(),
      'verify',
      { userConfirmed: true },
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('阻塞点 BP-3 已通过'),
    );
  });

  // ── Apply transition: invalid phase ──

  it('should exit(1) when phase is not in valid list', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'open' });
    mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'invalid-phase', '--apply'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('无效的目标阶段: invalid-phase'),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Apply transition: E-CHANGE-007 (already in target phase) ──

  it('should print info message when already in target phase', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'verify' });
    mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
    mockExecuteTransition.mockReturnValue({
      success: false,
      error: "E-CHANGE-007: Already in phase 'verify', no transition needed",
      state: { name: 'my-change', phase: 'verify' },
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'verify', '--apply'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("已在目标阶段 'verify'，无需转换"),
    );
  });

  // ── Apply transition: E-CHANGE-006 (terminal state) ──

  it('should exit(1) and print hint for invalid transition from terminal state', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'archive-completed' });
    mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
    mockExecuteTransition.mockReturnValue({
      success: false,
      error: 'E-CHANGE-006: archive-completed is terminal',
      state: { name: 'my-change', phase: 'archive-completed' },
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'verify', '--apply'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('无效的阶段转换'),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("可运行 'mumuspec state next"),
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Apply transition: generic failure ──

  it('should exit(1) for generic transition failures', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
    mockLoadChangeState.mockReturnValue({ name: 'my-change', phase: 'open' });
    mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
    mockExecuteTransition.mockReturnValue({
      success: false,
      error: 'Some other error',
      state: { name: 'my-change', phase: 'open' },
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design', '--apply'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('✗ 转换失败: Some other error');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Not exit when guard passed without apply ──

  it('should NOT call exit when guard passes even with warnings', async () => {
    mockRunPhaseGuard.mockReturnValue({
      passed: true,
      errors: [],
      warnings: [{ code: 'W-001', message: 'Just a warning' }],
    });

    const { registerGuardCommand } = await import('../../../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);

    await program.parseAsync(['guard', 'my-change', 'design'], { from: 'user' }).catch(() => {});

    // exit should NOT be called when passed
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
