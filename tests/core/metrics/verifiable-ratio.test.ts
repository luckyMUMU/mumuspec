/**
 * tests/core/metrics/verifiable-ratio.test.ts — L1 评估器单测（L1-C01~C08、C17~C18）。
 *
 * 依据：design.md §2.2.1 / §2.2.3 / §4 L1；DS-EVAL-003（SHALL weight=0、取 strong_ratio、
 * rawData 四分类计数；SHALL NOT 改 composite 权重和/阈值/窗口）；C-1、C-3、R-5、Q4-002。
 * 隔离：mock `node:child_process`（不真跑 CLI，对齐 constraint-density.test.ts）。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  verifiableRatioEvaluator,
  VERIFIABLE_RATIO_NAME,
} from '../../../src/core/metrics/verifiable-ratio.js';
import { failOpenCountEvaluator } from '../../../src/core/metrics/fail-open-count.js';
import {
  registerEvaluator,
  getEvaluator,
  getActiveEvaluators,
  clearEvaluatorRegistry,
} from '../../../src/core/metrics/evaluator-registry.js';
import {
  registerBuiltInEvaluators,
  autoEvaluate,
} from '../../../src/core/metrics/auto-evaluate.js';
import { DEFAULT_CONVERGENCE_CONFIG } from '../../../src/core/metrics/types.js';
import type { EvaluatorContext, Evaluator, MetricResult } from '../../../src/core/metrics/types.js';

const { spawnSyncMock } = vi.hoisted(() => ({ spawnSyncMock: vi.fn() }));

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

function ctx(over: Partial<EvaluatorContext> = {}): EvaluatorContext {
  return { projectRoot: '/tmp/proj', changeName: '', roundHistory: [], ...over };
}

function covPayload(coverage: Record<string, unknown>): string {
  return JSON.stringify({ coverage });
}

function raw(r: MetricResult): Record<string, number> {
  return r.rawData as Record<string, number>;
}

// ════════════════════════════════════════════════════════════════════
// A. verifiable-ratio（L1-C01~C08）
// ════════════════════════════════════════════════════════════════════

describe('verifiable-ratio evaluator (L1-C01~C08)', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('L1-C01 — 全 strong → value=1，rawData 含四分类计数', async () => {
    spawnSyncMock.mockReturnValue({
      stdout: covPayload({
        total: 10, enforced_strong: 10, enforced_weak: 0, manual: 0, unverifiable: 0,
        strong_ratio: 1, declared_ratio: 1,
      }),
      status: 0,
    });

    const r = await verifiableRatioEvaluator.evaluate(ctx());
    expect(r.name).toBe('verifiable-ratio');
    expect(r.value).toBe(1);
    expect(r.weight).toBe(0);
    expect(raw(r)).toMatchObject({
      total: 10, enforced_strong: 10, enforced_weak: 0, manual: 0, unverifiable: 0,
    });
  });

  it('L1-C02 — 部分 strong → value=strong_ratio，四分类逐一匹配', async () => {
    spawnSyncMock.mockReturnValue({
      stdout: covPayload({
        total: 8, enforced_strong: 4, enforced_weak: 2, manual: 1, unverifiable: 1,
        strong_ratio: 0.5, declared_ratio: 0.875,
      }),
      status: 0,
    });

    const r = await verifiableRatioEvaluator.evaluate(ctx());
    expect(r.value).toBeCloseTo(0.5);
    expect(r.weight).toBe(0);
    expect(raw(r).total).toBe(8);
    expect(raw(r).enforced_strong).toBe(4);
    expect(raw(r).enforced_weak).toBe(2);
    expect(raw(r).manual).toBe(1);
    expect(raw(r).unverifiable).toBe(1);
  });

  it('L1-C03 — total<=0 / 缺 coverage → nullResult（unavailable）', async () => {
    spawnSyncMock.mockReturnValueOnce({
      stdout: covPayload({ total: 0, enforced_strong: 0, enforced_weak: 0, manual: 0, unverifiable: 0, strong_ratio: 0 }),
      status: 0,
    });
    spawnSyncMock.mockReturnValueOnce({ stdout: JSON.stringify({ passed: true }), status: 0 });

    for (let i = 0; i < 2; i++) {
      const r = await verifiableRatioEvaluator.evaluate(ctx());
      expect(r.value).toBe(0);
      expect(r.weight).toBe(0);
      expect(r.details).toContain('unavailable');
    }
  });

  it('L1-C04 — spawn 失败 → nullResult（failed to start）', async () => {
    spawnSyncMock.mockReturnValue({ error: new Error('ENOENT'), stdout: '', status: -1 });

    const r = await verifiableRatioEvaluator.evaluate(ctx());
    expect(r.value).toBe(0);
    expect(r.weight).toBe(0);
    expect(r.details).toContain('failed to start');
  });

  it('L1-C05 — 无 JSON 输出 → nullResult（no JSON）', async () => {
    spawnSyncMock.mockReturnValue({ stdout: 'no json here', stderr: '', status: 0 });

    const r = await verifiableRatioEvaluator.evaluate(ctx());
    expect(r.value).toBe(0);
    expect(r.weight).toBe(0);
    expect(r.details).toContain('no JSON');
  });

  it('L1-C06 — value 钳制 [0,1]', async () => {
    spawnSyncMock.mockReturnValueOnce({
      stdout: covPayload({ total: 10, enforced_strong: 14, enforced_weak: 0, manual: 0, unverifiable: 0, strong_ratio: 1.4 }),
      status: 0,
    });
    const high = await verifiableRatioEvaluator.evaluate(ctx());
    expect(high.value).toBe(1);

    spawnSyncMock.mockReturnValueOnce({
      stdout: covPayload({ total: 10, enforced_strong: 0, enforced_weak: 0, manual: 0, unverifiable: 0, strong_ratio: -0.2 }),
      status: 0,
    });
    const low = await verifiableRatioEvaluator.evaluate(ctx());
    expect(low.value).toBe(0);
  });

  it('L1-C07 — argv/cwd 正确（严格 validate --json，非 check）', async () => {
    spawnSyncMock.mockReturnValue({
      stdout: covPayload({ total: 5, enforced_strong: 3, enforced_weak: 1, manual: 1, unverifiable: 0, strong_ratio: 0.6 }),
      status: 0,
    });
    const c = ctx({ projectRoot: '/tmp/proj' });

    await verifiableRatioEvaluator.evaluate(c);

    expect(spawnSyncMock).toHaveBeenCalledTimes(1);
    const [cmd, args, options] = spawnSyncMock.mock.calls[0] as [string, string[], Record<string, unknown>];
    expect(cmd).toBe('npx');
    expect(args).toEqual(['mumuspec', 'validate', '--json']);
    expect(args).not.toContain('check');
    expect(options.cwd).toBe(c.worktreePath || c.projectRoot);
    expect(options.encoding).toBe('utf-8');
    expect(options.timeout).toBe(30000);
    expect(options.shell).toBe(process.platform === 'win32');
  });

  it('L1-C08 — defaultWeight===0', () => {
    expect(verifiableRatioEvaluator.defaultWeight).toBe(0);
    expect(VERIFIABLE_RATIO_NAME).toBe('verifiable-ratio');
  });
});

// ════════════════════════════════════════════════════════════════════
// C. 注册与权重不变式（L1-C17~C18）
// ════════════════════════════════════════════════════════════════════

function mockEvaluator(name: string, value: number, weight: number): Evaluator {
  return {
    name,
    defaultWeight: weight,
    async evaluate(): Promise<MetricResult> {
      return { name, value, weight, details: 'mock' };
    },
  };
}

describe('built-in registration & weight invariant (L1-C17~C18)', () => {
  let root: string;

  beforeEach(() => {
    clearEvaluatorRegistry();
    spawnSyncMock.mockReset();
    root = mkdtempSync(join(tmpdir(), 'mumuspec-l1-reg-'));
  });

  afterEach(() => {
    clearEvaluatorRegistry();
    rmSync(root, { recursive: true, force: true });
  });

  it('L1-C17 — 注册三重断言（名字存在 / weight=0 / 活跃权重和≈1.0）', () => {
    registerBuiltInEvaluators();

    expect(getEvaluator('verifiable-ratio')).not.toBeNull();
    expect(getEvaluator('fail-open-count')).not.toBeNull();
    expect(getEvaluator('verifiable-ratio')!.defaultWeight).toBe(0);
    expect(getEvaluator('fail-open-count')!.defaultWeight).toBe(0);

    // 既有 6 评估器未被移除
    for (const name of ['test-pass-rate', 'drift-score', 'spec-compliance', 'code-delta', 'design-build-first-pass', 'constraint-density']) {
      expect(getEvaluator(name)).not.toBeNull();
    }

    const active = getActiveEvaluators().filter((e) => e.defaultWeight > 0);
    expect(active.reduce((s, e) => s + e.defaultWeight, 0)).toBeCloseTo(1.0, 10);
  });

  it('L1-C18 — 注册后 loop composite 不受影响（weight=0 贡献 0）', async () => {
    const base: Array<[string, number, number]> = [
      ['test-pass-rate', 0.9, 0.3],
      ['drift-score', 0.9, 0.2],
      ['spec-compliance', 0.9, 0.2],
      ['design-build-first-pass', 0.9, 0.2],
      ['code-delta', 0.9, 0.1],
    ];
    for (const [name, value, weight] of base) {
      registerEvaluator(mockEvaluator(name, value, weight));
    }
    spawnSyncMock.mockReturnValue({
      stdout: covPayload({ total: 5, enforced_strong: 3, enforced_weak: 1, manual: 1, unverifiable: 0, strong_ratio: 0.6 }),
      status: 0,
    });
    const c: EvaluatorContext = { projectRoot: root, changeName: '', roundHistory: [] };

    const withoutNew = await autoEvaluate(c);

    registerEvaluator(verifiableRatioEvaluator);
    registerEvaluator(failOpenCountEvaluator);
    const withNew = await autoEvaluate(c);

    // 两个 weight=0 评估器对加权 progress 贡献 0
    expect(withNew.progress).toBe(withoutNew.progress);
    // 阈值与稳定窗口常量不变（DS-EVAL-003 SHALL NOT）
    expect(DEFAULT_CONVERGENCE_CONFIG.threshold).toBe(0.85);
    expect(DEFAULT_CONVERGENCE_CONFIG.stabilityWindow).toBe(3);
  });
});
