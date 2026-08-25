/**
 * CHG-5 — tdd_mode 配置化（AC-09/AC-10 及边界用例）。
 *
 * 覆盖：
 *   TC-5-1  default_tdd_mode: non-tdd → createChange 后 state.tdd_mode==='non-tdd'，
 *           guard open→build（hotfix）/ design→build（full）通过
 *   TC-5-2  未配置（默认 tdd）→ state.tdd_mode==='tdd' 且 guard 通过（向后兼容）
 *   TC-5-3  旧变更 tdd_mode 原值不变不迁移；与配置不符 → WARN 不阻断
 *   TC-5-4  runPhaseGuard 未传 expectedTddMode → 默认 'tdd'
 *   TC-5-5  hotfix/tweak + non-tdd → 取配置值
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createChange } from '../src/change/lifecycle.js';
import { loadChangeState, saveChangeState, getChangeDir, computeTestCasesHash } from '../src/change/manager.js';
import { runPhaseGuard } from '../src/guard/phase-guard.js';
import { writeText } from '../src/core/utils.js';

vi.mock('../src/core/spec-scaffolder.js', () => ({
  scaffoldChangeSpecs: vi.fn(() => {}),
}));

vi.mock('../src/feedback/manager.js', () => ({
  ensureFeedbackStructure: vi.fn(() => {}),
  getChangeFeedbackDir: vi.fn((root: string, name: string) => join(root, '.mumuspec', 'changes', name, 'feedback')),
}));

let root: string;

beforeEach(() => {
  root = join(tmpdir(), `mumuspec-tdd-config-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function makeConfig(tddMode?: 'tdd' | 'non-tdd') {
  return {
    changes: {
      default_rollback_limit: 3,
      default_rebuild_limit: 5,
      default_build_mode: 'executing-plans',
      default_isolation: 'worktree',
      allow_isolation_downgrade: true,
      branch_prefix: 'mumuspec',
      implementation_strategy: 'bottom-up',
      design_strategy: 'top-down',
      ...(tddMode ? { default_tdd_mode: tddMode } : {}),
    },
    workflow: { single_active_change: true },
    cognitive_framework: { enabled: false },
  };
}

/** 解锁 test-cases（design_locked + content_hash）使 build 守卫可通过 */
function lockTestCasesFor(name: string): void {
  const state = loadChangeState(root, name);
  if (!state) throw new Error(`change not found: ${name}`);
  state.test_cases.design_locked = true;
  state.test_cases.design_content_hash = computeTestCasesHash(root, name);
  saveChangeState(root, name, state);
}

/** 为 full workflow 补齐 design.md（design→build 需要） */
function writeDesign(name: string): void {
  writeText(join(getChangeDir(root, name), 'design.md'), '# Design\n\n## Overview\nSimple design\n');
}

describe('CHG-5 tdd_mode 配置化', () => {
  it('TC-5-1 default_tdd_mode: non-tdd → state.tdd_mode=non-tdd，hotfix open→build 通过', () => {
    const state = createChange(root, 'hotfix-nontdd', 'hotfix', makeConfig('non-tdd') as never, ['.']);
    expect(state.tdd_mode).toBe('non-tdd');

    const loaded = loadChangeState(root, 'hotfix-nontdd');
    expect(loaded?.tdd_mode).toBe('non-tdd');

    lockTestCasesFor('hotfix-nontdd');
    const guard = runPhaseGuard(root, 'hotfix-nontdd', 'build', { expectedTddMode: 'non-tdd' });
    expect(guard.passed).toBe(true);
    expect(guard.errors.some((e) => e.message.includes('tdd_mode'))).toBe(false);
  });

  it('TC-5-1b default_tdd_mode: non-tdd → full workflow design→build 通过', () => {
    const state = createChange(root, 'full-nontdd', 'full', makeConfig('non-tdd') as never, ['.']);
    expect(state.tdd_mode).toBe('non-tdd');

    writeDesign('full-nontdd');
    lockTestCasesFor('full-nontdd');
    const st = loadChangeState(root, 'full-nontdd')!;
    st.build_layers = [{ layer: 0, scope: '.', status: 'pending' }];
    saveChangeState(root, 'full-nontdd', st);

    const guard = runPhaseGuard(root, 'full-nontdd', 'build', { expectedTddMode: 'non-tdd' });
    expect(guard.passed).toBe(true);
    expect(guard.errors.some((e) => e.message.includes('tdd_mode'))).toBe(false);
  });

  it('TC-5-2 未配置 → state.tdd_mode=tdd 且 guard 通过（向后兼容 0.19.1）', () => {
    const state = createChange(root, 'default-tdd', 'hotfix', makeConfig() as never, ['.']);
    expect(state.tdd_mode).toBe('tdd');

    lockTestCasesFor('default-tdd');
    const guard = runPhaseGuard(root, 'default-tdd', 'build', { expectedTddMode: 'tdd' });
    expect(guard.passed).toBe(true);
    expect(guard.warnings.some((w) => w.code === 'W-GUARD-001')).toBe(false);
  });

  it('TC-5-3 旧变更 tdd_mode 原值不变不迁移；与配置不符 → WARN 不阻断', () => {
    const state = createChange(root, 'legacy', 'hotfix', makeConfig('non-tdd') as never, ['.']);
    expect(state.tdd_mode).toBe('non-tdd');

    lockTestCasesFor('legacy');
    // 未传 expectedTddMode → 默认 'tdd'，旧变更（non-tdd）与配置不符 → WARN 不阻断
    const guard = runPhaseGuard(root, 'legacy', 'build');
    expect(guard.passed).toBe(true);
    expect(guard.errors.some((e) => e.message.includes('tdd_mode'))).toBe(false);
    expect(guard.warnings.some((w) => w.code === 'W-GUARD-001')).toBe(true);

    // 原值不变
    expect(loadChangeState(root, 'legacy')?.tdd_mode).toBe('non-tdd');
  });

  it('TC-5-4 runPhaseGuard 未传 expectedTddMode → 默认 tdd', () => {
    createChange(root, 'plain', 'hotfix', makeConfig('tdd') as never, ['.']);
    lockTestCasesFor('plain');

    const guard = runPhaseGuard(root, 'plain', 'build');
    expect(guard.passed).toBe(true);
    expect(guard.warnings.some((w) => w.code === 'W-GUARD-001')).toBe(false);
  });

  it('TC-5-5 tweak + non-tdd → 取配置值', () => {
    const state = createChange(root, 'tweak-nontdd', 'tweak', makeConfig('non-tdd') as never, ['.']);
    expect(state.tdd_mode).toBe('non-tdd');

    lockTestCasesFor('tweak-nontdd');
    const guard = runPhaseGuard(root, 'tweak-nontdd', 'build', { expectedTddMode: 'non-tdd' });
    expect(guard.passed).toBe(true);
  });

  it('边界：tdd_mode 非法枚举 → error 不通过', () => {
    createChange(root, 'bad', 'hotfix', makeConfig('tdd') as never, ['.']);
    lockTestCasesFor('bad');
    const st = loadChangeState(root, 'bad')!;
    st.tdd_mode = 'banana' as never;
    saveChangeState(root, 'bad', st);

    const guard = runPhaseGuard(root, 'bad', 'build', { expectedTddMode: 'tdd' });
    expect(guard.passed).toBe(false);
    expect(guard.errors.some((e) => e.message.includes('tdd_mode 非法'))).toBe(true);
  });
});
