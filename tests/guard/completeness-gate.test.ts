/**
 * Tests for completeness gate hooks in src/guard/phase-guard.ts.
 * Locked test cases: TC-B2a..f (layer-1-cases.md).
 * Full-chain: runPhaseGuard → checkCompletenessGate → validateArtifact (real fs).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ChangeState } from '../../src/core/types.js';

vi.mock('../../src/change/manager.js', () => ({
  getChangeDir: vi.fn((root: string, name: string) => join(root, '.mumuspec', 'changes', name)),
  loadChangeState: vi.fn(),
  verifyTestCases: vi.fn(() => ({ valid: true, expectedHash: '', actualHash: '' })),
}));

import { runPhaseGuard } from '../../src/guard/phase-guard.js';
import { loadChangeState } from '../../src/change/manager.js';

const mockLoadState = vi.mocked(loadChangeState);

const CHANGE = 'gate-change';
const SIGNED_REF = '2026-09-01T14:27:28.783Z';

const DECISIONS = `# Decision Log: ${CHANGE}\n\n## [design] ${SIGNED_REF}\n\n签收条目。\n`;

function makeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: CHANGE,
    phase: 'design',
    workflow: 'full',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    affected_scopes: ['src'],
    build_layers: [{ layer: 0, scope: 'src', status: 'done' }],
    test_cases: {
      design_locked: true,
      suites_locked: true,
      suites_locked_layers: [0],
      suites_hash: { 0: 'x' },
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'incremental',
    tdd_mode: 'tdd',
    isolation: 'branch',
    single_active_change: true,
    user_confirmed: true,
    decisions_log: { counts: {}, content_hash: '' },
    rollback_history: [],
    ...overrides,
  } as ChangeState;
}

function resolvedOq(): string {
  return [
    'version: 1',
    `change: ${CHANGE}`,
    'items:',
    '  - id: OQ-1',
    '    question: q?',
    '    status: resolved',
    '    resolution:',
    `      decision_ref: "${SIGNED_REF}"`,
  ].join('\n');
}

let testRoot: string;

beforeEach(() => {
  testRoot = join(tmpdir(), `mumuspec-gate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(testRoot, '.mumuspec', 'changes', CHANGE), { recursive: true });
  writeFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, 'decisions.md'), DECISIONS);
  writeFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, 'design.md'), '# Design\n\n主体设计内容，超过十个字符。\n');
  mockLoadState.mockReset();
});

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

describe('TC-B2a: design→build，items 全 open 且无签收 → block', () => {
  it('open 项存在 → E-GUARD-008，诊断含 OQ id', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'open-questions.yaml'),
      [
        'version: 1',
        `change: ${CHANGE}`,
        'items:',
        '  - id: OQ-1',
        '    question: q1?',
        '    status: open',
        '  - id: OQ-2',
        '    question: q2?',
        '    status: open',
      ].join('\n')
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.passed).toBe(false);
    const gate = result.errors.find((e) => e.code === 'E-GUARD-008');
    expect(gate).toBeDefined();
    expect(gate!.message).toContain('2 个未消解 open 项');
    expect(gate!.detail).toContain('OQ-1');
    expect(gate!.detail).toContain('OQ-2');
  });
});

describe('TC-B2b: LLM advisory 字段声明"完备"不改变判定', () => {
  it('advisory completeness: complete + 全 open → 仍 block', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'open-questions.yaml'),
      [
        'version: 1',
        `change: ${CHANGE}`,
        'completeness: complete',
        'items:',
        '  - id: OQ-1',
        '    question: q?',
        '    status: open',
        '    llm_verdict: 设计完备无疑',
      ].join('\n')
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-GUARD-008')).toBe(true);
  });
});

describe('TC-B2c: items 消解 + decision_ref 命中 → pass', () => {
  it('全部消解且链完整 → 门禁不产生 error', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, 'open-questions.yaml'), resolvedOq());

    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.errors.filter((e) => e.code === 'E-GUARD-008' || e.code === 'E-CHANGE-020' || e.code === 'E-CHANGE-021')).toEqual([]);
    expect(result.passed).toBe(true);
  });
});

describe('TC-B2d: 工件缺失的两分支', () => {
  it('分支 1：工件不存在且未声明 → block', () => {
    mockLoadState.mockReturnValue(makeState());
    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.passed).toBe(false);
    const gate = result.errors.find((e) => e.code === 'E-GUARD-008');
    expect(gate).toBeDefined();
    expect(gate!.message).toContain('缺失');
  });

  it('分支 2a：design.md 声明 + decisions.md 有签收 → pass', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'design.md'),
      '# Design\n\n内容。\n\n<!-- no-open-questions -->\n'
    );
    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.errors.filter((e) => e.code === 'E-GUARD-008')).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('分支 2b：design.md 声明但无 decisions.md 签收条目 → block（双签不可省略）', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'design.md'),
      '# Design\n\n内容。\n\n<!-- no-open-questions -->\n'
    );
    writeFileSync(join(testRoot, '.mumuspec', 'changes', CHANGE, 'decisions.md'), '# Decision Log: 无条目\n');
    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.passed).toBe(false);
    const gate = result.errors.find((e) => e.code === 'E-GUARD-008');
    expect(gate).toBeDefined();
    expect(gate!.message).toContain('签收');
  });
});

describe('TC-B2e: build→verify 对 assumptions.yaml 同构生效', () => {
  const buildState = () =>
    makeState({ phase: 'build', workflow: 'full', verify_result: undefined, branch_status: undefined } as Partial<ChangeState>);

  it('assumptions 含 open 项 → block', () => {
    mockLoadState.mockReturnValue(buildState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'assumptions.yaml'),
      [
        'version: 1',
        `change: ${CHANGE}`,
        'items:',
        '  - id: AS-1',
        '    assumption: a?',
        '    status: open',
      ].join('\n')
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'verify');
    expect(result.passed).toBe(false);
    const gate = result.errors.find((e) => e.code === 'E-GUARD-008');
    expect(gate).toBeDefined();
    expect(gate!.message).toContain('未消解 open 项');
    expect(gate!.detail).toContain('AS-1');
  });

  it('assumptions 全消解且命中 → pass', () => {
    mockLoadState.mockReturnValue(buildState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'assumptions.yaml'),
      [
        'version: 1',
        `change: ${CHANGE}`,
        'items:',
        '  - id: AS-1',
        '    assumption: a?',
        '    status: resolved',
        '    resolution:',
        `      decision_ref: "${SIGNED_REF}"`,
      ].join('\n')
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'verify');
    expect(result.errors.filter((e) => e.code === 'E-GUARD-008' || e.code === 'E-CHANGE-020' || e.code === 'E-CHANGE-021')).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it('hotfix/tweak 工作流不启用 assumptions 门禁（只增不改，保留轻量语义）', () => {
    mockLoadState.mockReturnValue(buildState());
    const state = buildState();
    state.workflow = 'hotfix';
    mockLoadState.mockReturnValue(state);
    // 不写 assumptions.yaml
    const result = runPhaseGuard(testRoot, CHANGE, 'verify');
    expect(result.errors.filter((e) => e.code === 'E-GUARD-008')).toEqual([]);
  });
});

describe('TC-B2f: 非法工件 → 拒绝执行而非降级（fail-closed）', () => {
  it('schema 非法（缺 version）→ E-CHANGE-020，不产生放行 warning', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'open-questions.yaml'),
      `change: ${CHANGE}\nitems: []`
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-CHANGE-020')).toBe(true);
    // fail-closed：非法工件绝不降级为 warning 放行
    expect(result.warnings.some((w) => w.message.includes('open-questions'))).toBe(false);
  });

  it('resolution 链断裂 → E-CHANGE-021', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'open-questions.yaml'),
      [
        'version: 1',
        `change: ${CHANGE}`,
        'items:',
        '  - id: OQ-1',
        '    question: q?',
        '    status: resolved',
        '    resolution:',
        '      decision_ref: "2000-01-01T00:00:00Z"',
      ].join('\n')
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build');
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-CHANGE-021')).toBe(true);
  });

  it('strength 降级配置下门禁错误仍 block（always_enforce 红线）', () => {
    mockLoadState.mockReturnValue(makeState());
    writeFileSync(
      join(testRoot, '.mumuspec', 'changes', CHANGE, 'open-questions.yaml'),
      [
        'version: 1',
        `change: ${CHANGE}`,
        'items:',
        '  - id: OQ-1',
        '    question: q?',
        '    status: open',
      ].join('\n')
    );

    const result = runPhaseGuard(testRoot, CHANGE, 'build', {
      strength: {
        requirement_goals: 'low',
        technical_design: 'low',
        enforcement_strict: false,
      } as never,
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-GUARD-008')).toBe(true);
  });
});
