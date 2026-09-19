/**
 * freeze-gate 门禁测试（lightweight-freeze-gate）：
 * checkOpenToBuildHotfix 在 proposal 声明 blocking 用户决策且未逐项签收时报
 * E-GUARD-011；未声明 blocking 时守卫行为与现状一致（CHG-5 兼容）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';

const mockLoadChangeState = vi.fn();
const mockGetChangeDir = vi.fn();
const mockVerifyTestCases = vi.fn();
const mockExistsSync = vi.fn();
const mockReadText = vi.fn();

vi.mock('../../src/change/manager.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
  getChangeDir: (...args: unknown[]) => mockGetChangeDir(...args),
  verifyTestCases: (...args: unknown[]) => mockVerifyTestCases(...args),
}));

vi.mock('../../src/change/artifact-validator.js', () => ({
  validateArtifact: vi.fn(() => ({ exists: true, isValid: true, errors: [], openItemIds: [], items: [] })),
  extractDecisionRefs: vi.fn(() => []),
}));

vi.mock('../../src/guard/checker.js', () => ({
  applyStrengthToGuardResult: (result: unknown) => result,
}));

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs')>()),
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: vi.fn(() => ''),
  readdirSync: vi.fn(() => []),
}));

vi.mock('../../src/core/utils.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/core/utils.js')>()),
  readText: (...args: unknown[]) => mockReadText(...args),
  computeHash: vi.fn(() => 'hash'),
}));

vi.mock('yaml', () => ({ parse: () => ({}) }));

// proposal.ts 走真实纯函数（解析 + 签收判定），不做 mock —— 本测试验证守卫与解析的集成面。
import { runPhaseGuard } from '../../src/guard/phase-guard.js';

function makeLightweightState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: 'freeze-test',
    phase: 'open',
    workflow: 'tweak',
    created_at: '2026-09-18T00:00:00Z',
    updated_at: '2026-09-18T00:00:00Z',
    affected_scopes: ['.'],
    build_layers: [],
    test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 5,
    build_mode: 'executing-plans',
    tdd_mode: 'tdd',
    isolation: 'branch',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {} },
    rollback_history: [],
    scope: '.',
    ...overrides,
  };
}

const BLOCKING_PROPOSAL = `# Proposal: freeze-test

## Why
背景

## User Decisions
- [blocking] 确认新鉴权路由为唯一出口
- 实现技术选型可自行决定

## Workflow
tweak
`;

beforeEach(() => {
  mockGetChangeDir.mockReturnValue('/proj/.mumuspec/changes/freeze-test');
  mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: '', actualHash: '' });
  // default: existing paths all exist
  mockExistsSync.mockReturnValue(true);
  mockReadText.mockImplementation((p: string) => {
    if (p.endsWith('proposal.md')) return BLOCKING_PROPOSAL;
    if (p.endsWith('decisions.md')) return '# Decision Log: freeze-test\n\n';
    return '';
  });
});

describe('freeze-gate: checkOpenToBuildHotfix', () => {
  it('TC-L0-02: unsigned blocking decision → E-GUARD-011 with item listed', () => {
    mockLoadChangeState.mockReturnValue(makeLightweightState());
    const result = runPhaseGuard('/proj', 'freeze-test', 'build');
    const codes = result.errors.map((e) => e.code);
    expect(codes).toContain('E-GUARD-011');
    const err = result.errors.find((e) => e.code === 'E-GUARD-011');
    expect(err?.message).toContain('确认新鉴权路由为唯一出口');
  });

  it('TC-L0-03: blocking decision signed via decisions.md → no E-GUARD-011', () => {
    mockLoadChangeState.mockReturnValue(makeLightweightState());
    mockReadText.mockImplementation((p: string) => {
      if (p.endsWith('proposal.md')) return BLOCKING_PROPOSAL;
      if (p.endsWith('decisions.md'))
        return '# Decision Log\n\n## [open] 2026-09-18T00:00:00Z\n已签收：确认新鉴权路由为唯一出口\n';
      return '';
    });
    const result = runPhaseGuard('/proj', 'freeze-test', 'build');
    expect(result.errors.map((e) => e.code)).not.toContain('E-GUARD-011');
  });

  it('TC-L0-01: no User Decisions section → behavior identical to baseline (no E-GUARD-011)', () => {
    mockLoadChangeState.mockReturnValue(makeLightweightState());
    mockReadText.mockImplementation((p: string) => {
      if (p.endsWith('proposal.md'))
        return '# Proposal: freeze-test\n\n## Why\n背景\n\n## Workflow\ntweak\n';
      if (p.endsWith('decisions.md')) return '';
      return '';
    });
    const result = runPhaseGuard('/proj', 'freeze-test', 'build');
    expect(result.errors.map((e) => e.code)).not.toContain('E-GUARD-011');
  });

  it('TC-L0-04: non-blocking decisions only → no E-GUARD-011', () => {
    mockLoadChangeState.mockReturnValue(makeLightweightState());
    mockReadText.mockImplementation((p: string) => {
      if (p.endsWith('proposal.md'))
        return '# Proposal\n\n## User Decisions\n- 实现技术选型可自行决定\n\n## Workflow\ntweak\n';
      if (p.endsWith('decisions.md')) return '';
      return '';
    });
    const result = runPhaseGuard('/proj', 'freeze-test', 'build');
    expect(result.errors.map((e) => e.code)).not.toContain('E-GUARD-011');
  });

  it('TC-L0-07: skip_specs=true passes open→build without delta noise', () => {
    mockLoadChangeState.mockReturnValue(makeLightweightState({ skip_specs: true }));
    mockReadText.mockImplementation((p: string) => {
      if (p.endsWith('proposal.md')) return '# Proposal\n\n## Workflow\ntweak\n';
      if (p.endsWith('decisions.md')) return '';
      return '';
    });
    const result = runPhaseGuard('/proj', 'freeze-test', 'build');
    expect(result.errors.length).toBe(0);
  });
});