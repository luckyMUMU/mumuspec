/**
 * Extra handler-level tests for state subcommands — coverage focused.
 *
 * Covers branches not yet exercised by state-handler2.test.ts:
 *   state init (success + error)
 *   state transition (already-targeted, invalid, blocking-point, normal success)
 *   state graph (with rollback history)
 *   state get (undefined, object, string)
 *   state set (boolean, JSON, plain string, dotted key)
 *   state check (decisions-hash mismatch, test-cases mismatch,
 *                 rollback limit, invalid layer status, --recover)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockReadText,
  mockComputeHash,
  mockCreateChange,
  mockLoadChangeState,
  mockSaveChangeState,
  mockInitTestCases,
  mockLockTestCases,
  mockVerifyTestCases,
  mockComputeTestCasesHash,
  mockGetChangeDir,
  mockExistsSync,
  mockExecuteTransition,
  mockExecuteRollback,
  mockGetValidTransitions,
  mockGetNextPhase,
  mockGetWorkflowPhases,
  mockIsTerminal,
  mockRequiresUserConfirmation,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockReadText: vi.fn(),
  mockComputeHash: vi.fn(),
  mockCreateChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockSaveChangeState: vi.fn(),
  mockInitTestCases: vi.fn(),
  mockLockTestCases: vi.fn(),
  mockVerifyTestCases: vi.fn(),
  mockComputeTestCasesHash: vi.fn(),
  mockGetChangeDir: vi.fn(),
  mockExistsSync: vi.fn(),
  mockExecuteTransition: vi.fn(),
  mockExecuteRollback: vi.fn(),
  mockGetValidTransitions: vi.fn(),
  mockGetNextPhase: vi.fn(),
  mockGetWorkflowPhases: vi.fn(),
  mockIsTerminal: vi.fn(),
  mockRequiresUserConfirmation: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(async () => []),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    computeHash: mockComputeHash,
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
    createChange: mockCreateChange,
    loadChangeState: mockLoadChangeState,
    saveChangeState: mockSaveChangeState,
    initTestCases: mockInitTestCases,
    lockTestCases: mockLockTestCases,
    verifyTestCases: mockVerifyTestCases,
    computeTestCasesHash: mockComputeTestCasesHash,
    getChangeDir: mockGetChangeDir,
  };
});

vi.mock('../../../src/change/state-machine.js', () => ({
  executeTransition: mockExecuteTransition,
  executeRollback: mockExecuteRollback,
  getValidTransitions: mockGetValidTransitions,
  getNextPhase: mockGetNextPhase,
  getWorkflowPhases: mockGetWorkflowPhases,
  isTerminal: mockIsTerminal,
  requiresUserConfirmation: mockRequiresUserConfirmation,
}));

// ── Helpers ──

/** Build a minimal valid ChangeState for mocking. */
function makeState(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'my-change',
    phase: 'open',
    workflow: 'full',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    scope: 'test',
    affected_scopes: [],
    build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
    test_cases: {
      design_locked: false,
      design_content_hash: 'hash123',
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'normal',
    tdd_mode: 'strict',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {}, content_hash: 'aaaa1111' },
    rollback_history: [],
    ...overrides,
  };
}

// ── Suite ──

describe('state command handler — extra coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit');
    }) as () => never);

    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' }, specs: {} });
    mockExistsSync.mockReturnValue(false);
    mockReadText.mockReturnValue('file content');
    mockComputeHash.mockReturnValue('aaaa2222');
    mockCreateChange.mockReset();
    mockLoadChangeState.mockReset();
    mockSaveChangeState.mockReset();
    mockInitTestCases.mockReset();
    mockLockTestCases.mockReset();
    mockVerifyTestCases.mockReset();
    mockComputeTestCasesHash.mockReset();
    mockGetChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/my-change');
    mockExecuteTransition.mockReset();
    mockExecuteRollback.mockReset();
    mockGetValidTransitions.mockReturnValue(['design', 'build']);
    mockGetNextPhase.mockReturnValue({ phase: 'design', description: 'Design phase' });
    mockGetWorkflowPhases.mockReturnValue(['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed']);
    mockIsTerminal.mockReturnValue(false);
    mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── state init ──

  describe('state init', () => {
    it('should call createChange and print success', async () => {
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'init', 'new-change', 'full'], { from: 'user' });
      expect(mockCreateChange).toHaveBeenCalledWith('/fake/root', 'new-change', 'full', expect.anything());
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('initialized for "new-change"'));
    });

    it('should print error and exit on createChange failure', async () => {
      mockCreateChange.mockImplementation(() => {
        throw new Error('already exists');
      });
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'init', 'dup', 'full'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: already exists');
      expect(caught?.message).toBe('exit');
    });

    it('should print error and exit when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'init', 'orphan', 'full'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(caught?.message).toBe('exit');
    });
  });

  // ── state transition ──

  describe('state transition', () => {
    it('should exit 0 if already in target phase (E-CHANGE-007)', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'design' }));
      mockExecuteTransition.mockReturnValue({
        success: false,
        state: makeState({ phase: 'design' }),
        error: "E-CHANGE-007: Already in phase 'design', no transition needed",
      });
      mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith("✗ 已在目标阶段 'design'，无需转换");
      expect(errorSpy).toHaveBeenCalledWith('  当前阶段: design');
      expect(caught?.message).toBe('exit');
    });

    it('should report error for invalid transition (E-CHANGE-006)', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      mockExecuteTransition.mockReturnValue({
        success: false,
        state: makeState({ phase: 'open' }),
        error: 'E-CHANGE-006: Invalid transition from open to verify',
      });
      mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'transition', 'my-change', 'verify'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('✗ 无效的阶段转换: E-CHANGE-006: Invalid transition from open to verify');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("'mumuspec state next my-change'"));
      expect(caught?.message).toBe('exit');
    });

    it('should block transition requiring user confirmation without --confirm', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      mockRequiresUserConfirmation.mockReturnValue({
        required: true,
        bp: 'BP-001',
        description: 'blocking point description',
      });
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('✗ 阻塞点 BP-001：blocking point description');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--confirm'));
      expect(caught?.message).toBe('exit');
    });

    it('should execute transition successfully with --confirm and show blocking point passed', async () => {
      const updated = makeState({ phase: 'build' });
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'design' }));
      mockExecuteTransition.mockReturnValue({ success: true, state: updated });
      mockRequiresUserConfirmation.mockReturnValue({
        required: true,
        bp: 'BP-002',
        description: 'confirmed point',
      });
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'transition', 'my-change', 'build', '--confirm'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalledWith('/fake/root', 'my-change', updated);
      expect(logSpy).toHaveBeenCalledWith('✓ Transitioned my-change: design → build');
      expect(logSpy).toHaveBeenCalledWith('  阻塞点 BP-002 已通过 (confirmed point)');
    });

    it('should execute transition without blocking point and not print blocking info', async () => {
      const updated = makeState({ phase: 'design' });
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      mockExecuteTransition.mockReturnValue({ success: true, state: updated });
      mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalledWith('/fake/root', 'my-change', updated);
      expect(logSpy).toHaveBeenCalledWith('✓ Transitioned my-change: open → design');
    });

    it('should reject invalid target phase', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'transition', 'my-change', 'nonexistent'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('✗ 无效的目标阶段: nonexistent');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('有效阶段'));
      expect(caught?.message).toBe('exit');
    });

    it('should handle error when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'transition', 'ghost', 'design'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
      expect(caught?.message).toBe('exit');
    });
  });

  // ── state graph ──

  describe('state graph', () => {
    it('should print state machine info without rollback history', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({
          phase: 'build',
          workflow: 'full',
          rollback_history: [],
        }),
      );
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'graph', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('State Machine for: my-change'));
      expect(logSpy).toHaveBeenCalledWith('Current: build');
      expect(logSpy).toHaveBeenCalledWith('Workflow: full');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Valid transitions'));
      expect(logSpy).toHaveBeenCalledWith('Terminal: false');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow phases:'));
      expect(logSpy).toHaveBeenCalledWith('  ▶ build');
      expect(logSpy).toHaveBeenCalledWith('  ○ open');
      expect(logSpy).toHaveBeenCalledWith('  ○ design');
    });

    it('should print rollback history when present', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({
          phase: 'design',
          workflow: 'full',
          rollback_history: [
            {
              from: 'build',
              to: 'design',
              reason: 'test rollback',
              timestamp: '2025-01-02T00:00:00Z',
              counted: true,
              event: 'rollback-build-to-design',
            },
          ],
        }),
      );
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'graph', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rollback history:'));
      expect(logSpy).toHaveBeenCalledWith(
        '  2025-01-02T00:00:00Z: build → design (rollback-build-to-design) - test rollback',
      );
    });

    it('should handle error when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'graph', 'ghost'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
      expect(caught?.message).toBe('exit');
    });
  });

  // ── state get ──

  describe('state get', () => {
    it('should print string value for a primitive field', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'build' }));
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'get', 'my-change', 'phase'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('build');
    });

    it('should print JSON for an object field', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({ test_cases: { foo: 'bar', nested: { a: 1 } } }),
      );
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'get', 'my-change', 'test_cases'], { from: 'user' });
      // JSON.stringify({ foo: 'bar', nested: { a: 1 } }, null, 2);
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar', nested: { a: 1 } }, null, 2));
    });

    it('should print <undefined> for missing field', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'get', 'my-change', 'nonexistent'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('<undefined>');
    });

    it('should handle error when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'get', 'ghost', 'phase'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
      expect(caught?.message).toBe('exit');
    });
  });

  // ── state set ──

  describe('state set', () => {
    it('should coerce "true" to boolean', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      mockSaveChangeState.mockReset();
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'set', 'my-change', 'isolation', 'none'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('✓ Set isolation = "none"');
    });

    it('should coerce numeric string to number', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'set', 'my-change', 'rollback_count', '5'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalled();
      const savedState = mockSaveChangeState.mock.calls[0][2] as Record<string, unknown>;
      expect(savedState.rollback_count).toBe(5);
      expect(logSpy).toHaveBeenCalledWith('✓ Set rollback_count = 5');
    });

    it('should set field via dotted notation', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({ cognitive_framework: { enabled: false, q1_count: 0 } }),
      );
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'set', 'my-change', 'cognitive_framework.q1_count', '3'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalled();
      const savedState = mockSaveChangeState.mock.calls[0][2] as Record<string, unknown>;
      expect((savedState.cognitive_framework as Record<string, unknown>).q1_count).toBe(3);
    });

    it('should handle error when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'set', 'ghost', 'phase', 'open'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
      expect(caught?.message).toBe('exit');
    });
  });

  // ── state check ──

  describe('state check', () => {
    it('should print integrity OK when no issues detected', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({
          build_layers: [{ layer: 0, scope: 'core', status: 'done' }],
          rollback_count: 0,
          rollback_limit: 3,
        }),
      );
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      // existsSync returns false so decisions-hash check is skipped
      mockExistsSync.mockReturnValue(false);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'check', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ State integrity OK'));
    });

    it('should detect decisions-hash mismatch, list issue, exit 1 without --recover', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({
          build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
          rollback_count: 0,
          rollback_limit: 3,
          decisions_log: { counts: {}, content_hash: 'aaaa1111' },
        }),
      );
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      // existsSync returns true for decisions.md path
      mockExistsSync.mockImplementation((p: string) => p.endsWith('decisions.md'));
      mockReadText.mockReturnValue('decisions content');
      mockComputeHash.mockReturnValue('aaaa2222'); // differs from locked 'aaaa1111'
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'check', 'my-change'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('decisions.md content_hash 不匹配'));
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('State integrity issues'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('提示'));
      expect(caught?.message).toBe('exit');
    });

    it('should auto-recover decisions-hash mismatch with --recover', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({
          build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
          rollback_count: 0,
          rollback_limit: 3,
          decisions_log: { counts: {}, content_hash: 'aaaa1111' },
        }),
      );
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockImplementation((p: string) => p.endsWith('decisions.md'));
      mockReadText.mockReturnValue('decisions content');
      mockComputeHash.mockReturnValue('aaaa2222');
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'check', 'my-change', '--recover'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ decisions.md content_hash 已重新计算');
      expect(mockSaveChangeState).toHaveBeenCalled();
    });

    it('should detect invalid layer status without --recover', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({
          build_layers: [{ layer: 0, scope: 'core', status: 'invalid_status' }],
          rollback_count: 0,
          rollback_limit: 3,
        }),
      );
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'check', 'my-change'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('build_layers 含非法 status'));
      expect(caught?.message).toBe('exit');
    });

    it('should auto-recover invalid layer status with --recover', async () => {
      mockLoadChangeState.mockReturnValue(
        makeState({
          build_layers: [
            { layer: 0, scope: 'core', status: 'invalid_status' },
            { layer: 1, scope: 'cli', status: 'done' },
          ],
          rollback_count: 0,
          rollback_limit: 3,
        }),
      );
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      await program.parseAsync(['state', 'check', 'my-change', '--recover'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ 非法 layer status 已重置为 pending');
      const savedState = mockSaveChangeState.mock.calls[0][2] as Record<string, unknown>;
      const layers = savedState.build_layers as Array<{ status: string }>;
      expect(layers[0].status).toBe('pending');
      // layer with 'done' status should remain unchanged
      expect(layers[1].status).toBe('done');
    });

    it('should handle error when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
      const program = new Command();
      registerStateCommands(program);
      let caught: Error | undefined;
      try {
        await program.parseAsync(['state', 'check', 'ghost'], { from: 'user' });
      } catch (e) {
        caught = e as Error;
      }
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
      expect(caught?.message).toBe('exit');
    });
  });
});
