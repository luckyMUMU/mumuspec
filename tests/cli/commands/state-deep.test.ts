/**
 * Deep-coverage tests for src/cli/commands/state.ts.
 *
 *覆盖率目标: ≥ 95% line / branch / statement。
 *
 * 分支覆盖重点:
 *   state init              – ok / createChange 抛错 / root 为空
 *   state transition        – rollback build→design, verify→design, verify→build (成功/失败);
 *                             非法阶段; 阻塞点未确认; 正常转换含/不含阻塞点;
 *     E-CHANGE-007 / E-CHANGE-006 / 通用失败; change 不存在; root 为空
 *   state next              – 下一阶段 / 终端状态
 *   state graph             – 有/无 rollback_history
 *   state get               – 字符串 / 对象 / undefined
 *   state set               – 布尔 / 整数 / 浮点 / 点号嵌套 / JSON 解析 / JSON 解析失败 / 缺 change
 *   state check             – 完整 OK; decisions-hash 不匹配 (--recover / 无);
 *                             test-cases 不匹配 (recover / 无);
 *                             rollback/rebuild 超限 (recover / 无);
 *                             非法 layer status (recover / 无)
 *   state scale             – 小规模(light) / 大规模(full, 多 tasks + 多 delta-specs)
 *   test-cases init         – ok / root 为空
 *   test-cases lock         – ok (Hash)
 *   test-cases hash         – 与 locked 相等 / 与 locked 不等 / 无 locked(未锁定) / root 为空
 *   test-cases verify       – 成功 / 失败 / root 为空
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

/* ── vi.hoisted mock factories ── */
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockComputeHash,
  mockReadText,
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
  mockComputeHash: vi.fn(),
  mockReadText: vi.fn(),
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

/* ── vi.mock registrations ── */

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
    // CHG-2: 审计写入在此 handler 测试中为 no-op（避免依赖 node:fs 真实写盘）
    appendAuditLog: vi.fn(),
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
  activateProjectWorkflow: vi.fn(),
}));

/* ── Helpers ── */

interface BuildLayer {
  layer: number;
  scope: string;
  status: string;
}

interface RollbackHistoryEntry {
  timestamp: string;
  from: string;
  to: string;
  event: string;
  reason: string;
  counted?: boolean;
}

interface FakeState {
  name?: string;
  phase?: string;
  workflow?: string;
  created_at?: string;
  updated_at?: string;
  scope?: string;
  affected_scopes?: string[];
  build_layers?: BuildLayer[];
  test_cases?: Record<string, unknown>;
  rollback_count?: number;
  rebuild_count?: number;
  rollback_limit?: number;
  rebuild_limit?: number;
  build_mode?: string;
  tdd_mode?: string;
  isolation?: string;
  single_active_change?: boolean;
  user_confirmed?: boolean;
  decisions_log?: Record<string, unknown>;
  rollback_history?: RollbackHistoryEntry[];
  [key: string]: unknown;
}

function makeState(overrides: FakeState = {}): FakeState {
  return {
    name: 'my-change',
    phase: 'open',
    workflow: 'full',
    ...overrides,
    created_at: '2025-01-01 00:00:00',
    updated_at: '2025-01-01 00:00:00',
    scope: 'test',
    affected_scopes: [],
    build_layers: overrides.build_layers ?? [{ layer: 0, scope: 'core', status: 'pending' }],
    test_cases: overrides.test_cases ?? {
      design_locked: false,
      design_content_hash: 'hash123',
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: overrides.rollback_count ?? 0,
    rebuild_count: overrides.rebuild_count ?? 0,
    rollback_limit: overrides.rollback_limit ?? 3,
    rebuild_limit: overrides.rebuild_limit ?? 3,
    build_mode: 'normal',
    tdd_mode: 'strict',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: overrides.decisions_log ?? { counts: {}, content_hash: 'abc123' },
    rollback_history: overrides.rollback_history ?? [],
  };
}

async function freshProgram(): Promise<Command> {
  const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
  const program = new Command();
  registerStateCommands(program);
  return program;
}

/* ════════════════════════════════════════════════════════════════════ */
/* Test suite                                                          */
/* ════════════════════════════════════════════════════════════════════ */

describe('state command handler — deep coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as (code?: number) => never);

    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' }, specs: {} });
    mockExistsSync.mockReturnValue(false);
    mockReadText.mockReturnValue('');
    mockComputeHash.mockReturnValue('def456');
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

  /* ════ state init ════ */

  describe('state init', () => {
    it('should print success when createChange succeeds', async () => {
      mockCreateChange.mockReturnValue(undefined);
      const program = await freshProgram();
      await program.parseAsync(['state', 'init', 'new-change', 'full'], { from: 'user' });
      expect(mockCreateChange).toHaveBeenCalledWith('/fake/root', 'new-change', 'full', expect.anything());
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('initialized for "new-change"'));
    });

    it('should error + exit(1) when createChange throws', async () => {
      mockCreateChange.mockImplementation(() => { throw new Error('already exists'); });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'init', 'dup', 'full'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: already exists');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'init', 'orphan', 'hotfix'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  /* ════ state transition ════ */

  describe('state transition', () => {
    it('should rollback build→design and log Rollback count', async () => {
      const rolledBack = makeState({ phase: 'design', rollback_count: 1, rollback_limit: 3 });
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'build' }));
      mockExecuteRollback.mockReturnValue({ success: true, state: rolledBack });
      const program = await freshProgram();
      await program.parseAsync(['state', 'transition', 'my-change', 'design', '--reason', 'fix bug'], { from: 'user' });
      expect(mockExecuteRollback).toHaveBeenCalledWith(expect.anything(), 'build_to_design', 'fix bug');
      expect(logSpy).toHaveBeenCalledWith('✓ Rolled back my-change: build → design');
      expect(logSpy).toHaveBeenCalledWith('  Rollback count: 1/3');
    });

    it('should rollback verify→design', async () => {
      const rolledBack = makeState({ phase: 'design', rollback_count: 2, rollback_limit: 3 });
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'verify' }));
      mockExecuteRollback.mockReturnValue({ success: true, state: rolledBack });
      const program = await freshProgram();
      await program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' });
      expect(mockExecuteRollback).toHaveBeenCalledWith(expect.anything(), 'verify_to_design', 'No reason');
      expect(logSpy).toHaveBeenCalledWith('✓ Rolled back my-change: verify → design');
    });

    it('should rollback verify→build and log Rebuild count', async () => {
      const rolledBack = makeState({ phase: 'build', rebuild_count: 1, rebuild_limit: 2 });
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'verify' }));
      mockExecuteRollback.mockReturnValue({ success: true, state: rolledBack });
      const program = await freshProgram();
      await program.parseAsync(['state', 'transition', 'my-change', 'build'], { from: 'user' });
      expect(mockExecuteRollback).toHaveBeenCalledWith(expect.anything(), 'verify_to_build', 'No reason');
      expect(logSpy).toHaveBeenCalledWith('✓ Rolled back my-change: verify → build');
      expect(logSpy).toHaveBeenCalledWith('  Rebuild count: 1/2');
    });

    it('should error + exit(1) when rollback fails', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'build' }));
      mockExecuteRollback.mockReturnValue({ success: false, error: 'rollback limit hit' });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('✗ Rollback failed: rollback limit hit');
    });

    it('should error + exit(1) when verify→build rollback fails (lines 97-99)', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'verify' }));
      mockExecuteRollback.mockReturnValue({ success: false, error: 'rebuild limit hit' });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'build'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('✗ Rollback failed: rebuild limit hit');
    });

    it('should reject invalid target phase', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'bogus'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('✗ 无效的目标阶段: bogus');
    });

    it('should block transition when confirmation required without --confirm', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      mockRequiresUserConfirmation.mockReturnValue({ required: true, bp: 'BP-001', description: 'design gate' });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' }),
      ).rejects.toThrow('exit:2');
      expect(errorSpy).toHaveBeenCalledWith('✗ 阻塞点 BP-001：design gate');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('--confirm'));
    });

    it('should pass --confirm and log blocking point passed', async () => {
      const updated = makeState({ phase: 'build' });
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'design' }));
      mockExecuteTransition.mockReturnValue({ success: true, state: updated });
      mockRequiresUserConfirmation.mockReturnValue({ required: true, bp: 'BP-002', description: 'build gate' });
      const program = await freshProgram();
      await program.parseAsync(['state', 'transition', 'my-change', 'build', '--confirm'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalledWith('/fake/root', 'my-change', updated);
      expect(logSpy).toHaveBeenCalledWith('✓ Transitioned my-change: design → build');
      expect(logSpy).toHaveBeenCalledWith('  阻塞点 BP-002 已通过 (build gate)');
    });

    it('should succeed without blocking point info when none present', async () => {
      const updated = makeState({ phase: 'design' });
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      mockExecuteTransition.mockReturnValue({ success: true, state: updated });
      mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
      const program = await freshProgram();
      await program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('✓ Transitioned my-change: open → design');
    });

    it('should handle E-CHANGE-007 (exit 0 already in phase)', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'design' }));
      mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
      mockExecuteTransition.mockReturnValue({
        success: false,
        state: makeState({ phase: 'design' }),
        error: "E-CHANGE-007: Already in phase 'design'",
      });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' }),
      ).rejects.toThrow('exit:0');
      expect(errorSpy).toHaveBeenCalledWith("✗ 已在目标阶段 'design'，无需转换");
    });

    it('should handle E-CHANGE-006 (invalid transition)', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
      mockExecuteTransition.mockReturnValue({
        success: false,
        state: makeState({ phase: 'open' }),
        error: 'E-CHANGE-006: Invalid transition from open to archive',
      });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'archive-completed'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('✗ 无效的阶段转换: E-CHANGE-006: Invalid transition from open to archive');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("mumuspec state next my-change"));
    });

    it('should handle generic transition error', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open' }));
      mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
      mockExecuteTransition.mockReturnValue({
        success: false,
        state: makeState({ phase: 'open' }),
        error: 'E-CHANGE-009: Some other error',
      });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('✗ Transition failed: E-CHANGE-009: Some other error');
    });

    it('should error + exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'ghost', 'design'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'transition', 'my-change', 'design'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  /* ════ state next ════ */

  describe('state next', () => {
    it('should print next phase', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      mockGetNextPhase.mockReturnValue({ phase: 'design', description: 'Design it' });
      const program = await freshProgram();
      await program.parseAsync(['state', 'next', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('Next: design — Design it');
    });

    it('should print terminal state message when no next phase', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      mockGetNextPhase.mockReturnValue(null);
      const program = await freshProgram();
      await program.parseAsync(['state', 'next', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('No next phase (terminal state).');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'next', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('should error + exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'next', 'ghost'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
    });
  });

  /* ════ state graph ════ */

  describe('state graph', () => {
    it('should print state machine info without rollback history', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'open', workflow: 'full', rollback_history: [] }));
      mockGetValidTransitions.mockReturnValue(['design']);
      mockIsTerminal.mockReturnValue(false);
      mockGetWorkflowPhases.mockReturnValue(['open', 'design']);
      const program = await freshProgram();
      await program.parseAsync(['state', 'graph', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('State Machine for: my-change'));
      expect(logSpy).toHaveBeenCalledWith('Current: open');
      expect(logSpy).toHaveBeenCalledWith('Workflow: full');
      expect(logSpy).toHaveBeenCalledWith('\nValid transitions: design');
      expect(logSpy).toHaveBeenCalledWith('Terminal: false');
      expect(logSpy).toHaveBeenCalledWith('  ▶ open');
      expect(logSpy).toHaveBeenCalledWith('  ○ design');
    });

    it('should print state with rollback history', async () => {
      mockLoadChangeState.mockReturnValue(makeState({
        phase: 'design',
        rollback_history: [{
          timestamp: '2025-06-01T12:00:00Z',
          from: 'build',
          to: 'design',
          event: 'rollback-b2d',
          reason: 'test failed',
          counted: true,
        }],
      }));
      mockGetWorkflowPhases.mockReturnValue(['open', 'design', 'build']);
      const program = await freshProgram();
      await program.parseAsync(['state', 'graph', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  2025-06-01T12:00:00Z: build → design (rollback-b2d) - test failed');
      expect(logSpy).toHaveBeenCalledWith('\nRollback history:');
      expect(logSpy).toHaveBeenCalledWith('\nWorkflow phases:');
    });

    it('should print ✓ icon for archive-completed', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'build' }));
      mockGetWorkflowPhases.mockReturnValue(['open', 'design', 'build', 'archive-completed']);
      const program = await freshProgram();
      await program.parseAsync(['state', 'graph', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ archive-completed');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'graph', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('should error + exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'graph', 'ghost'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
    });
  });

  /* ════ state get ════ */

  describe('state get', () => {
    it('should print string value for primitive field', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ phase: 'build' }));
      const program = await freshProgram();
      await program.parseAsync(['state', 'get', 'my-change', 'phase'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('build');
    });

    it('should print JSON for object field', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ test_cases: { foo: 'bar', n: 1 } }));
      const program = await freshProgram();
      await program.parseAsync(['state', 'get', 'my-change', 'test_cases'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ foo: 'bar', n: 1 }, null, 2));
    });

    it('should print <undefined> for nonexistent field', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      const program = await freshProgram();
      await program.parseAsync(['state', 'get', 'my-change', 'no_such_field'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('<undefined>');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'get', 'my-change', 'phase'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('should error + exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'get', 'ghost', 'phase'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
    });
  });

  /* ════ state set ════ */

  describe('state set', () => {
    it('should coerce "false" to boolean', async () => {
      const state = makeState();
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'single_active_change', 'false'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalled();
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.single_active_change).toBe(false);
      expect(logSpy).toHaveBeenCalledWith('✓ Set single_active_change = false');
    });

    it('should coerce "true" to boolean', async () => {
      const state = makeState();
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'user_confirmed', 'true'], { from: 'user' });
      expect(mockSaveChangeState).toHaveBeenCalled();
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.user_confirmed).toBe(true);
      expect(logSpy).toHaveBeenCalledWith('✓ Set user_confirmed = true');
    });

    it('should coerce integer string to number', async () => {
      const state = makeState();
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'rollback_count', '5'], { from: 'user' });
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.rollback_count).toBe(5);
      expect(logSpy).toHaveBeenCalledWith('✓ Set rollback_count = 5');
    });

    it('should coerce float string to number', async () => {
      const state = makeState();
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'cognitive_score', '3.14'], { from: 'user' });
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.cognitive_score).toBe(3.14);
      expect(logSpy).toHaveBeenCalledWith('✓ Set cognitive_score = 3.14');
    });

    it('should set value via dot notation', async () => {
      const state = makeState({ cognitive_framework: { enabled: false } } as FakeState);
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'cognitive_framework.q1_count', '7'], { from: 'user' });
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect((saved.cognitive_framework as Record<string, unknown>).q1_count).toBe(7);
      expect(logSpy).toHaveBeenCalledWith('✓ Set cognitive_framework.q1_count = 7');
    });

    it('should create empty {} for missing parent in dot notation (lines 281-282)', async () => {
      // state does NOT have 'metrics' key - exercising the branch that creates {}
      const state = makeState();
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'metrics.accuracy', '0.95'], { from: 'user' });
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect((saved.metrics as Record<string, unknown>).accuracy).toBe(0.95);
      expect(logSpy).toHaveBeenCalledWith('✓ Set metrics.accuracy = 0.95');
    });

    it('should parse value as JSON when --json flag set', async () => {
      const state = makeState();
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'build_layers', '[{"layer":1}]', '--json'], { from: 'user' });
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.build_layers).toEqual([{ layer: 1 }]);
      expect(logSpy).toHaveBeenCalledWith('✓ Set build_layers = [{"layer":1}]');
    });

    it('should warn and store as string when JSON parsing fails', async () => {
      const state = makeState();
      mockLoadChangeState.mockReturnValue(state);
      const program = await freshProgram();
      await program.parseAsync(['state', 'set', 'my-change', 'testfield', '{invalid json', '--json'], { from: 'user' });
      expect(warnSpy).toHaveBeenCalledWith('  (value is not valid JSON, storing as string)');
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.testfield).toBe('{invalid json');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'set', 'my-change', 'phase', 'open'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('should error + exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'set', 'ghost', 'phase', 'open'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
    });
  });

  /* ════ state check ════ */

  describe('state check', () => {
    it('should print integrity OK when no issues', async () => {
      mockLoadChangeState.mockReturnValue(makeState({
        build_layers: [{ layer: 0, scope: 'core', status: 'done' }],
        rollback_count: 0,
        rollback_limit: 3,
        rebuild_count: 0,
        rebuild_limit: 3,
      }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await program.parseAsync(['state', 'check', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ State integrity OK'));
    });

    it('should detect decisions.md mismatch without --recover and exit(1)', async () => {
      mockLoadChangeState.mockReturnValue(makeState({
        decisions_log: { counts: {}, content_hash: 'locked_hash' },
        build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
      }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockImplementation((p: string) => p.endsWith('decisions.md'));
      mockReadText.mockReturnValue('old decisions');
      mockComputeHash.mockReturnValue('new_hash');
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'check', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('decisions.md content_hash 不匹配'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('提示'));
    });

    it('should not flag decisions-hash issue when no content_hash locked (readText falsy → empty)', async () => {
      // Locked content_hash is undefined → branch at line 318 is skipped;
      // readText returns falsy (line 317 uses || '')
      mockLoadChangeState.mockReturnValue(makeState({
        decisions_log: { counts: {}, content_hash: undefined },
        build_layers: [{ layer: 0, scope: 'core', status: 'done' }],
      }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockImplementation((p: string) => p.endsWith('decisions.md'));
      mockReadText.mockReturnValue('');  // falsy → becomes ''
      const program = await freshProgram();
      await program.parseAsync(['state', 'check', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ State integrity OK'));
    });

    it('should auto-recover decisions.md mismatch with --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState({
        decisions_log: { counts: {}, content_hash: 'locked_hash' },
      }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockImplementation((p: string) => p.endsWith('decisions.md'));
      mockReadText.mockReturnValue('old decisions');
      mockComputeHash.mockReturnValue('new_hash');
      const program = await freshProgram();
      await program.parseAsync(['state', 'check', 'my-change', '--recover'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ decisions.md content_hash 已重新计算');
      expect(mockSaveChangeState).toHaveBeenCalled();
    });

    it('should detect test-cases mismatch without --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      mockVerifyTestCases.mockReturnValue({ valid: false, expectedHash: 'expected', actualHash: 'actual' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'check', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('test-cases hash 不匹配'));
    });

    it('should auto-recover test-cases mismatch with --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState());
      mockVerifyTestCases.mockReturnValue({ valid: false, expectedHash: 'expected', actualHash: 'actual' });
      mockLockTestCases.mockReturnValue('new_locked_hash');
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await program.parseAsync(['state', 'check', 'my-change', '--recover'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ test-cases 已重新锁定 (hash: new_locked_hash)');
      expect(mockSaveChangeState).toHaveBeenCalled();
    });

    it('should detect rollback_count over limit without --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ rollback_count: 5, rollback_limit: 3 }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'check', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('rollback_count 5 超过上限 3'));
    });

    it('should auto-recover rollback_count over limit with --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ rollback_count: 5, rollback_limit: 3 }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await program.parseAsync(['state', 'check', 'my-change', '--recover'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ rollback_count 已重置为 3');
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.rollback_count).toBe(3);
    });

    it('should detect rebuild_count over limit without --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ rebuild_count: 4, rebuild_limit: 2 }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'check', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('rebuild_count 4 超过上限 2'));
    });

    it('should auto-recover rebuild_count over limit with --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ rebuild_count: 4, rebuild_limit: 2 }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await program.parseAsync(['state', 'check', 'my-change', '--recover'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ rebuild_count 已重置为 2');
    });

    it('should detect invalid layer status without --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState({
        build_layers: [
          { layer: 0, scope: 'core', status: 'done' },
          { layer: 1, scope: 'cli', status: 'bogus' },
        ],
      }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'check', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('build_layers 含非法 status: 1=bogus'));
    });

    it('should auto-recover invalid layer status with --recover', async () => {
      mockLoadChangeState.mockReturnValue(makeState({
        build_layers: [
          { layer: 0, scope: 'core', status: 'bogus' },
          { layer: 1, scope: 'cli', status: 'done' },
        ],
      }));
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await program.parseAsync(['state', 'check', 'my-change', '--recover'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  ✓ 非法 layer status 已重置为 pending');
      const saved = mockSaveChangeState.mock.calls[0][2] as FakeState;
      expect(saved.build_layers![0].status).toBe('pending');
      expect(saved.build_layers![1].status).toBe('done');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'check', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('should error + exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'check', 'ghost'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
    });
  });

  /* ════ state scale ════ */

  describe('state scale', () => {
    it('should recommend light mode for small changes', async () => {
      mockLoadChangeState.mockReturnValue(makeState({ build_layers: [{ layer: 0, scope: 'core', status: 'pending' }] }));
      mockExistsSync.mockReturnValue(false);
      const program = await freshProgram();
      await program.parseAsync(['state', 'scale', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  Verify mode:     light');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('verify_mode light'));
    });

    it('should fallback to empty string when tasks.md exists but readText falsy (lines 417-418)', async () => {
      // tasks.md exists but readText returns '' → fallback ''
      mockLoadChangeState.mockReturnValue(makeState({
        build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
      }));
      mockExistsSync.mockImplementation((p: string) => p.endsWith('tasks.md'));
      mockReadText.mockReturnValue('');  // falsy → '' fallback
      const program = await freshProgram();
      await program.parseAsync(['state', 'scale', 'taskless-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  Tasks:           0');
      expect(logSpy).toHaveBeenCalledWith('  Verify mode:     light');
    });

    it('should recommend full mode when task count exceeds threshold', async () => {
      mockGetChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/scale-big');
      const manyTasks = '- [ ] task1\n- [ ] task2\n- [ ] task3\n- [ ] task4\n';
      mockLoadChangeState.mockReturnValue(makeState({
        build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
      }));
      mockReadText.mockReturnValue(manyTasks);
      mockExistsSync.mockImplementation((p: string) => p.endsWith('tasks.md'));
      const program = await freshProgram();
      await program.parseAsync(['state', 'scale', 'big-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  Tasks:           4');
      expect(logSpy).toHaveBeenCalledWith('  Verify mode:     full');
    });

    it('should recommend full mode when delta-specs dir has .md files (readdir success)', async () => {
      // make readdir return markdown files to exercise lines 426-429
      const { readdir } = await import('node:fs/promises');
      (readdir as ReturnType<typeof vi.fn>).mockResolvedValueOnce(['spec1.md', 'spec2.md', 'spec3.md']);

      mockGetChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/delta-change');
      mockLoadChangeState.mockReturnValue(makeState({
        build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
      }));
      mockExistsSync.mockImplementation((p: string) => p.endsWith('delta-specs'));
      const program = await freshProgram();
      await program.parseAsync(['state', 'scale', 'delta-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  Delta specs:     3');
      expect(logSpy).toHaveBeenCalledWith('  Verify mode:     full');
    });

    it('should silently ignore readdir errors and report 0 delta-specs', async () => {
      const { readdir } = await import('node:fs/promises');
      (readdir as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ENOENT'));

      mockGetChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/err-change');
      mockLoadChangeState.mockReturnValue(makeState({
        build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
      }));
      mockExistsSync.mockImplementation((p: string) => p.endsWith('delta-specs'));
      const program = await freshProgram();
      await program.parseAsync(['state', 'scale', 'err-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('  Delta specs:     0');
      expect(logSpy).toHaveBeenCalledWith('  Verify mode:     light');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'scale', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('should error + exit(1) when change not found', async () => {
      mockLoadChangeState.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['state', 'scale', 'ghost'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: ghost');
    });
  });

  /* ════ test-cases init ════ */

  describe('test-cases init', () => {
    it('should call initTestCases with parsed layers', async () => {
      mockInitTestCases.mockReturnValue(undefined);
      const program = await freshProgram();
      await program.parseAsync(['test-cases', 'init', 'my-change', '--layers', '0,1,2'], { from: 'user' });
      expect(mockInitTestCases).toHaveBeenCalledWith('/fake/root', 'my-change', [0, 1, 2]);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Test cases initialized for my-change'));
    });

    it('should use default layers "0" when --layers not provided', async () => {
      mockInitTestCases.mockReturnValue(undefined);
      const program = await freshProgram();
      await program.parseAsync(['test-cases', 'init', 'another-change'], { from: 'user' });
      expect(mockInitTestCases).toHaveBeenCalledWith('/fake/root', 'another-change', [0]);
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['test-cases', 'init', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  /* ════ test-cases lock ════ */

  describe('test-cases lock', () => {
    it('should print locked hash', async () => {
      mockLockTestCases.mockReturnValue('myhash789');
      const program = await freshProgram();
      await program.parseAsync(['test-cases', 'lock', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('✓ Test cases locked for my-change');
      expect(logSpy).toHaveBeenCalledWith('  Hash: myhash789');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['test-cases', 'lock', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  /* ════ test-cases hash ════ */

  describe('test-cases hash', () => {
    it('should print hash + matches when equal to locked', async () => {
      mockComputeTestCasesHash.mockReturnValue('match_hash');
      mockLoadChangeState.mockReturnValue(makeState({
        test_cases: { design_locked: true, design_content_hash: 'match_hash' },
      }));
      const program = await freshProgram();
      await program.parseAsync(['test-cases', 'hash', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('match_hash');
      expect(logSpy).toHaveBeenCalledWith('  ✓ matches locked hash');
    });

    it('should warn + exit(1) when hash differs from locked', async () => {
      mockComputeTestCasesHash.mockReturnValue('different_hash');
      mockLoadChangeState.mockReturnValue(makeState({
        test_cases: { design_locked: true, design_content_hash: 'stored_hash' },
      }));
      const program = await freshProgram();
      await expect(
        program.parseAsync(['test-cases', 'hash', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(logSpy).toHaveBeenCalledWith('different_hash');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('stored_hash'));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('内容已漂移'));
    });

    it('should print (test-cases 未锁定) when no locked hash', async () => {
      mockComputeTestCasesHash.mockReturnValue('fresh_hash');
      mockLoadChangeState.mockReturnValue(makeState({
        test_cases: { design_locked: false, design_content_hash: undefined },
      }));
      const program = await freshProgram();
      await program.parseAsync(['test-cases', 'hash', 'unlocked-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('fresh_hash');
      expect(logSpy).toHaveBeenCalledWith('  (test-cases 未锁定)');
    });

    it('should print (test-cases 未locked) when loadChangeState returns null-ish', async () => {
      mockComputeTestCasesHash.mockReturnValue('fresh_hash');
      const program = await freshProgram();
      await program.parseAsync(['test-cases', 'hash', 'fresh-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('fresh_hash');
      expect(logSpy).toHaveBeenCalledWith('  (test-cases 未锁定)');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['test-cases', 'hash', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  /* ════ test-cases verify ════ */

  describe('test-cases verify', () => {
    it('should print success when verification passes', async () => {
      mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h', actualHash: 'h' });
      const program = await freshProgram();
      await program.parseAsync(['test-cases', 'verify', 'my-change'], { from: 'user' });
      expect(logSpy).toHaveBeenCalledWith('✓ Test cases verified for my-change');
    });

    it('should error + exit(1) when verification fails', async () => {
      mockVerifyTestCases.mockReturnValue({ valid: false, expectedHash: 'expected', actualHash: 'actual' });
      const program = await freshProgram();
      await expect(
        program.parseAsync(['test-cases', 'verify', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('✗ Test cases verification failed for my-change');
      expect(errorSpy).toHaveBeenCalledWith('  Expected: expected');
      expect(errorSpy).toHaveBeenCalledWith('  Actual:   actual');
    });

    it('should error + exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(null);
      const program = await freshProgram();
      await expect(
        program.parseAsync(['test-cases', 'verify', 'my-change'], { from: 'user' }),
      ).rejects.toThrow('exit:1');
      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });
});
