/**
 * E17 (evaluator-data-source-fix) — 数据源契约测试。
 *
 * spec-compliance / drift-score 此前因 CLI 参数 + 输出契约不匹配而恒 nullResult(weight 0)，
 * 从未进 composite。本文件锁定新数据源的真实解析行为：
 * - 多行美化 JSON 解析（stdout 切片）
 * - check/drift status 非 0 但含 payload → 照常计算（低分不是跳过）
 * - coverage 缺失 / spawn 失败 → 诚实 nullResult
 * - drift 数组长度 capping 归一化
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { specComplianceEvaluator } from '../../../src/core/metrics/spec-compliance.js';
import { driftScoreEvaluator } from '../../../src/core/metrics/drift-score.js';
import { codeDeltaEvaluator } from '../../../src/core/metrics/code-delta.js';
import type { EvaluatorContext } from '../../../src/core/metrics/types.js';

const { spawnSyncMock } = vi.hoisted(() => ({
  spawnSyncMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

const ctx: EvaluatorContext = { projectRoot: '.', changeName: 'demo', roundHistory: [] };

function checkPayload(errors: Array<{ code: string }>, total: number, exitCode = 0): string {
  return JSON.stringify({
    compliance: { passed: errors.length === 0, errors, warnings: [], coverage: { total } },
    drift: { errors: [], warnings: [] },
    exitCode,
  }, null, 2);
}

describe('spec-compliance data source (check --json)', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('computes compliance from errors/total with a multi-line payload', async () => {
    spawnSyncMock.mockReturnValue({ stdout: checkPayload([{ code: 'E-X' }, { code: 'E-Y' }], 10), status: 0 });
    const r = await specComplianceEvaluator.evaluate(ctx);
    expect(r.weight).toBe(0.2);
    expect(r.value).toBeCloseTo(0.8);
  });

  it('reports low score (not skip) when check exits non-zero with a payload', async () => {
    spawnSyncMock.mockReturnValue({ stdout: checkPayload([{ code: 'E-A' }, { code: 'E-B' }, { code: 'E-C' }], 10, 1), status: 1 });
    const r = await specComplianceEvaluator.evaluate(ctx);
    expect(r.weight).toBe(0.2); // 成功解析 → 进 composite
    expect(r.value).toBeCloseTo(0.7);
  });

  it('returns nullResult when coverage is missing (no denominator)', async () => {
    spawnSyncMock.mockReturnValue({
      stdout: JSON.stringify({ compliance: { passed: true, errors: [], warnings: [] }, drift: { errors: [], warnings: [] }, exitCode: 0 }, null, 2),
      status: 0,
    });
    const r = await specComplianceEvaluator.evaluate(ctx);
    expect(r.weight).toBe(0); // 诚实跳过
    expect(r.details).toContain('coverage.total unavailable');
  });

  it('returns nullResult when spawn fails to start (E17 win32 shell semantic)', async () => {
    spawnSyncMock.mockReturnValue({ error: new Error('spawn npx ENOENT'), stdout: '', status: -1 });
    const r = await specComplianceEvaluator.evaluate(ctx);
    expect(r.weight).toBe(0);
    expect(r.details).toContain('failed to start');
  });
});

describe('drift-score data source (drift --json)', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('scores clean repo as 1.0 with empty array', async () => {
    spawnSyncMock.mockReturnValue({ stdout: '[]\n', status: 0 });
    const r = await driftScoreEvaluator.evaluate(ctx);
    expect(r.weight).toBe(0.2);
    expect(r.value).toBe(1.0);
  });

  it('penalizes per drift item up to DRIFT_SATURATION', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ type: `E-${i}`, severity: 'ERROR' as const, message: 'x' }));
    spawnSyncMock.mockReturnValue({ stdout: JSON.stringify(items, null, 2), status: 0 });
    const r = await driftScoreEvaluator.evaluate(ctx);
    expect(r.weight).toBe(0.2);
    expect(r.value).toBeCloseTo(0.5); // 1 - 5/10
  });

  it('saturates at zero when drift count reaches the cap', async () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ type: `E-${i}`, severity: 'ERROR' as const, message: 'x' }));
    spawnSyncMock.mockReturnValue({ stdout: JSON.stringify(items), status: 1 });
    const r = await driftScoreEvaluator.evaluate(ctx);
    expect(r.value).toBe(0);
    expect(r.weight).toBe(0.2); // 有数据 → 进 composite（0 分是真实低分，非跳过）
  });

  it('returns nullResult when spawn fails to start', async () => {
    spawnSyncMock.mockReturnValue({ error: new Error('spawn npx ENOENT'), stdout: '', status: -1 });
    const r = await driftScoreEvaluator.evaluate(ctx);
    expect(r.weight).toBe(0);
  });
});

describe('cross-evaluator: shell flag uses win32 (E17 layer 3)', () => {
  it('passes shell=true for child processes', async () => {
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ stdout: '[]', status: 0 });
    await driftScoreEvaluator.evaluate(ctx);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      'npx',
      ['mumuspec', 'drift', '--json'],
      expect.objectContaining({ shell: process.platform === 'win32' }),
    );
  });
});

describe('code-delta sanity after E17 (weight contract untouched)', () => {
  beforeEach(() => spawnSyncMock.mockReset());

  it('still returns defaultWeight in no-change branch', async () => {
    spawnSyncMock.mockReturnValue({ stdout: '', status: 0 });
    const r = await codeDeltaEvaluator.evaluate(ctx);
    expect(r.weight).toBe(codeDeltaEvaluator.defaultWeight);
  });
});