/**
 * CHG-2 — 守卫绕过审计（AC-03/AC-04 及边界用例）。
 *
 * 覆盖：
 *   TC-2-1  guard 失败 + --force → audit.log 含 guard.force + stdout 风险提示
 *   TC-2-2  正常通过 → 无 guard.force 记录
 *   TC-2-3  bypass_audit 默认 true → state set 认知字段成功 + audit.log 含 state.set_unverified + value_hash
 *   TC-2-4  bypass_audit=false → guard --force 拒绝 exit 1；state set 受保护字段拒绝且 state 文件未变
 *   TC-2-5  state transition --confirm → audit.log 含 state.confirm_bypass
 *   TC-2-6  审计追加不覆盖（行数+1 旧行不变）
 *   TC-2-7  非受保护字段（build_mode）不审计
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

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

vi.mock('../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});

vi.mock('../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/config.js')>();
  return { ...actual, loadConfig: mockLoadConfig };
});

vi.mock('../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/change/manager.js')>();
  return {
    ...actual,
    loadChangeState: mockLoadChangeState,
    saveChangeState: mockSaveChangeState,
  };
});

vi.mock('../src/change/state-machine.js', () => ({
  executeTransition: mockExecuteTransition,
  executeRollback: vi.fn(() => ({ success: false, error: 'no rollback' })),
  getValidTransitions: vi.fn(() => []),
  getNextPhase: vi.fn(() => undefined),
  getWorkflowPhases: vi.fn(() => []),
  isTerminal: vi.fn(() => false),
  requiresUserConfirmation: mockRequiresUserConfirmation,
  activateProjectWorkflow: vi.fn(),
}));

vi.mock('../src/guard/phase-guard.js', () => ({
  runPhaseGuard: mockRunPhaseGuard,
}));

vi.mock('../src/change/branch.js', () => ({
  commitChangeBranch: vi.fn(),
}));

let root: string;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  root = join(tmpdir(), `mumuspec-guard-audit-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.mumuspec'), { recursive: true });

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

  mockFindProjectRoot.mockReturnValue(root);
  mockLoadConfig.mockReturnValue({
    constraint_strength: { technical_design: 'high', requirement_goals: 'high', exceptions: [], overrides: {} },
    changes: { default_tdd_mode: 'tdd' },
    guard: { bypass_audit: true },
  });
  mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });
  mockRequiresUserConfirmation.mockReturnValue({ required: false, bp: '', description: '' });
  mockExecuteTransition.mockReturnValue({ success: true, state: { phase: 'build' } });
  mockLoadChangeState.mockReturnValue({
    name: 'demo',
    phase: 'open',
    workflow: 'hotfix',
    tdd_mode: 'tdd',
    test_cases: { design_locked: false },
    build_layers: [{ layer: 0, scope: '.', status: 'pending' }],
    cognitive_framework: { q1_count: 0 },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function readAudit(): string {
  const auditPath = join(root, '.mumuspec', 'audit.log');
  if (!existsSync(auditPath)) return '';
  return readFileSync(auditPath, 'utf8');
}

describe('CHG-2 守卫绕过审计', () => {
  it('TC-2-1 guard 失败 + --force → audit.log 含 guard.force + stdout 风险提示', async () => {
    mockRunPhaseGuard.mockReturnValue({
      passed: false,
      errors: [{ code: 'E-GUARD-001', message: 'proposal.md 不存在' }],
      warnings: [],
    });

    const { registerGuardCommand } = await import('../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);
    await program.parseAsync(['guard', 'demo', 'design', '--force'], { from: 'user' }).catch(() => {});

    expect(readAudit()).toContain('"action":"guard.force"');
    expect(readAudit()).toContain('"change":"demo"');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('风险提示'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('guard.force'));
  });

  it('TC-2-2 边界：正常通过 → 无 guard.force 记录', async () => {
    mockRunPhaseGuard.mockReturnValue({ passed: true, errors: [], warnings: [] });

    const { registerGuardCommand } = await import('../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);
    await program.parseAsync(['guard', 'demo', 'design'], { from: 'user' }).catch(() => {});

    expect(readAudit()).not.toContain('guard.force');
  });

  it('TC-2-3 默认 bypass_audit=true → state set 认知字段成功 + audit.log 含 state.set_unverified + value_hash', async () => {
    const { registerStateCommands } = await import('../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['state', 'set', 'demo', 'cognitive_framework.q1_count', '3'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Set cognitive_framework.q1_count'));
    const audit = readAudit();
    expect(audit).toContain('"action":"state.set_unverified"');
    expect(audit).toContain('"field":"cognitive_framework.q1_count"');
    expect(audit).toContain('"value_hash"');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('风险提示'));
  });

  it('TC-2-4 bypass_audit=false → guard --force 拒绝 exit 1；state set 受保护字段拒绝且 state 文件未变', async () => {
    mockLoadConfig.mockReturnValue({
      constraint_strength: { technical_design: 'high', requirement_goals: 'high', exceptions: [], overrides: {} },
      changes: { default_tdd_mode: 'tdd' },
      guard: { bypass_audit: false },
    });
    mockRunPhaseGuard.mockReturnValue({
      passed: false,
      errors: [{ code: 'E-GUARD-001', message: 'proposal.md 不存在' }],
      warnings: [],
    });

    // guard --force 拒绝
    const { registerGuardCommand } = await import('../src/cli/commands/guard.js');
    const guardProgram = new Command();
    registerGuardCommand(guardProgram);
    await guardProgram.parseAsync(['guard', 'demo', 'design', '--force'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('E-STATE-001'));
    expect(exitSpy).toHaveBeenCalledWith(1);

    // state set 受保护字段拒绝 + 未写 state
    errorSpy.mockClear();
    exitSpy.mockClear();
    mockSaveChangeState.mockClear();
    const { registerStateCommands } = await import('../src/cli/commands/state.js');
    const stateProgram = new Command();
    registerStateCommands(stateProgram);
    await stateProgram.parseAsync(['state', 'set', 'demo', 'cognitive_framework.q1_count', '3'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('E-STATE-001'));
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockSaveChangeState).not.toHaveBeenCalled();
    expect(readAudit()).not.toContain('state.set_unverified');
  });

  it('TC-2-5 state transition --confirm → audit.log 含 state.confirm_bypass', async () => {
    mockRequiresUserConfirmation.mockReturnValue({ required: true, bp: 'BP-1', description: '阻塞点' });
    mockLoadChangeState.mockReturnValue({ name: 'demo', phase: 'open', workflow: 'full', tdd_mode: 'tdd' });
    mockExecuteTransition.mockReturnValue({ success: true, state: { name: 'demo', phase: 'design' } });

    const { registerStateCommands } = await import('../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['state', 'transition', 'demo', 'design', '--confirm'], { from: 'user' }).catch(() => {});

    const audit = readAudit();
    expect(audit).toContain('"action":"state.confirm_bypass"');
    expect(audit).toContain('"from":"open"');
    expect(audit).toContain('"to":"design"');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('state.confirm_bypass'));
  });

  it('TC-2-6 边界：审计追加不覆盖（行数+1 旧行不变）', async () => {
    const auditPath = join(root, '.mumuspec', 'audit.log');
    writeFileSync(auditPath, '{"ts":"2026-01-01T00:00:00.000Z","action":"init","result":"success"}\n', 'utf8');

    mockRunPhaseGuard.mockReturnValue({ passed: false, errors: [{ code: 'E-GUARD-001', message: 'x' }], warnings: [] });
    const { registerGuardCommand } = await import('../src/cli/commands/guard.js');
    const program = new Command();
    registerGuardCommand(program);
    await program.parseAsync(['guard', 'demo', 'design', '--force'], { from: 'user' }).catch(() => {});

    const lines = readAudit().split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
    expect(lines[0]).toBe('{"ts":"2026-01-01T00:00:00.000Z","action":"init","result":"success"}');
    expect(lines[1]).toContain('guard.force');
  });

  it('TC-2-7 边界：非受保护字段（build_mode）不审计', async () => {
    const { registerStateCommands } = await import('../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['state', 'set', 'demo', 'build_mode', 'executing-plans'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Set build_mode'));
    expect(readAudit()).not.toContain('state.set_unverified');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('风险提示'));
  });
});
