/**
 * P1-3 (evaluator-weight-single-source) — 权重副本防回归。
 *
 * E15 教训：`freedom-suggestions.test.ts` 的 W1 只断言 `defaultWeight` 求和为 1，
 * 查不出「成功返回的 `weight` 字面量 ≠ defaultWeight」——D2 重平衡从未生效且无人察觉。
 * 本文件锁定**返回 weight 与 defaultWeight 逐项一致**，且成功路径的 weight 必须引用
 * 自身常量（单一权威源），防止再次漂移。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { testPassRateEvaluator } from '../../../src/core/metrics/test-pass-rate.js';
import { driftScoreEvaluator } from '../../../src/core/metrics/drift-score.js';
import { specComplianceEvaluator } from '../../../src/core/metrics/spec-compliance.js';
import { codeDeltaEvaluator } from '../../../src/core/metrics/code-delta.js';
import { designBuildFirstPassEvaluator } from '../../../src/core/metrics/design-build-first-pass.js';
import type { EvaluatorContext } from '../../../src/core/metrics/types.js';

const { spawnSyncMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

function ctx(projectRoot: string): EvaluatorContext {
  return {
    projectRoot,
    changeName: 'demo-change',
    previousRound: 0,
    roundHistory: [],
  };
}

describe('success-path returned weight === defaultWeight (P1-3 single source)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mumuspec-weight-'));
    spawnSyncMock.mockReset();
  });

  afterEach(async () => {
    rmSync(root, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('test-pass-rate returns its defaultWeight (0.3, not the stale 0.35)', async () => {
    spawnSyncMock.mockReturnValue({
      stdout: '{"numPassedTests":8,"numFailedTests":2,"numTotalTests":10}',
      status: 0,
    });

    const result = await testPassRateEvaluator.evaluate(ctx(root));
    expect(result.weight).toBe(testPassRateEvaluator.defaultWeight);
    expect(result.weight).toBe(0.3);
    expect(result.value).toBeCloseTo(0.8);
  });

  it('drift-score returns its defaultWeight (0.2, not the stale 0.25)', async () => {
    spawnSyncMock.mockReturnValue({ stdout: '{"totalViolations":1,"totalChecks":10}', status: 0 });

    const result = await driftScoreEvaluator.evaluate(ctx(root));
    expect(result.weight).toBe(driftScoreEvaluator.defaultWeight);
    expect(result.weight).toBe(0.2);
    expect(result.value).toBeCloseTo(0.9);
  });

  it('spec-compliance returns its defaultWeight (0.2, not the stale 0.25)', async () => {
    spawnSyncMock.mockReturnValue({ stdout: '{"passed":9,"failed":1,"total":10}', status: 0 });

    const result = await specComplianceEvaluator.evaluate(ctx(root));
    expect(result.weight).toBe(specComplianceEvaluator.defaultWeight);
    expect(result.weight).toBe(0.2);
    expect(result.value).toBeCloseTo(0.9);
  });

  it('code-delta no-change branch returns its defaultWeight (0.1, not the stale 0.15)', async () => {
    // git diff --stat 输出为空 → "No changes detected" 分支
    spawnSyncMock.mockReturnValue({ stdout: '', status: 0 });

    const result = await codeDeltaEvaluator.evaluate(ctx(root));
    expect(result.weight).toBe(codeDeltaEvaluator.defaultWeight);
    expect(result.weight).toBe(0.1);
    expect(result.value).toBe(1.0);
  });

  it('code-delta changed branch returns its defaultWeight (0.1)', async () => {
    writeFileSync(join(root, 'a.ts'), 'x\ny\nz\n');
    spawnSyncMock
      .mockReturnValueOnce({ stdout: '1 file changed, 5 insertions(+), 2 deletions(-)\n', status: 0 }) // git diff --stat
      .mockReturnValueOnce({ stdout: 'a.ts\n', status: 0 }); // git ls-files

    const result = await codeDeltaEvaluator.evaluate(ctx(root));
    expect(result.weight).toBe(codeDeltaEvaluator.defaultWeight);
    expect(result.weight).toBe(0.1);
  });

  it('invariant: active defaultWeight sum equals 1 across all 5 active evaluators', () => {
    const evaluators = [
      testPassRateEvaluator,
      driftScoreEvaluator,
      specComplianceEvaluator,
      codeDeltaEvaluator,
      designBuildFirstPassEvaluator,
    ];
    expect(evaluators.reduce((s, e) => s + e.defaultWeight, 0)).toBeCloseTo(1, 9);
  });
});