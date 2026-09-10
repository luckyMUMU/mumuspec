/**
 * Unit Tests — constraint-density evaluator (freedom-metrics)
 *
 * Covers ENF-1 of delta-spec freedom-metrics:
 * - SHALL 条目统计与归一化（DENSITY_CAP，纯函数直测）
 * - evaluator 经 mock spawn 取数：weight = 0（D1）、多 scope 聚合、nullResult 降级
 * - affected_scopes 缺失时退化为项目根 '.'
 *
 * 取数纪律与 spec-compliance 一致：spawn `mumuspec context --json`（core 层
 * 禁止依赖上层域，arch-boundaries 不变量），故 spawn 以 vi.mock 模拟。
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  constraintDensityEvaluator,
  extractConstraintCounts,
  normalizeDensity,
  DENSITY_CAP,
} from '../../../src/core/metrics/constraint-density.js';
import type { EvaluatorContext } from '../../../src/core/metrics/types.js';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

import { spawnSync } from 'node:child_process';
const mockSpawn = vi.mocked(spawnSync);

const dirs: string[] = [];

function makeRoot(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mumu-density-'));
  dirs.push(dir);
  return dir;
}

function makeCtx(projectRoot: string, changeName = 'den-test'): EvaluatorContext {
  return { projectRoot, changeName, roundHistory: [] };
}

function contextJson(shall: number, shallNot: number): string {
  const requirements = [
    {
      name: 'Core',
      shall: Array.from({ length: shall }, (_, i) => `do ${i}`),
      shallNot: Array.from({ length: shallNot }, (_, i) => `never ${i}`),
    },
  ];
  // Pretty-printed on purpose: the real `context --json` output is multi-line,
  // and a compact fixture is what let the single-line parsing bug go unnoticed.
  return JSON.stringify(
    { targetPath: '.', layers: [{ level: 0, tech: { requirements } }] },
    null,
    2
  );
}

function spawnOk(payload: string): ReturnType<typeof spawnSync> {
  return { status: 0, stdout: payload, stderr: '' } as unknown as ReturnType<typeof spawnSync>;
}

function writeState(root: string, changeName: string, yaml: string): void {
  mkdirSync(join(root, '.mumuspec', 'changes', changeName), { recursive: true });
  writeFileSync(join(root, '.mumuspec', 'changes', changeName, '.mumuspec.yaml'), yaml, 'utf8');
}

afterEach(() => {
  mockSpawn.mockReset();
  for (const d of dirs.splice(0)) {
    rmSync(d, { recursive: true, force: true });
  }
});

describe('pure helpers', () => {
  it('extractConstraintCounts sums SHALL/SHALL NOT across layers', () => {
    const counts = extractConstraintCounts(JSON.parse(contextJson(2, 1)));
    expect(counts).toEqual({ shall: 2, shallNot: 1 });
  });

  it('extractConstraintCounts tolerates missing layers/tech', () => {
    expect(extractConstraintCounts({})).toEqual({ shall: 0, shallNot: 0 });
    expect(extractConstraintCounts({ layers: [{}, { tech: {} }] })).toEqual({ shall: 0, shallNot: 0 });
  });

  it('normalizeDensity saturates at cap', () => {
    expect(normalizeDensity(3)).toBeCloseTo(3 / 150, 6);
    expect(normalizeDensity(10_000)).toBe(1);
    expect(DENSITY_CAP).toBe(150);
  });
});

describe('constraint-density evaluator', () => {
  it('counts via context command, normalizes with weight 0 (D1)', async () => {
    const root = makeRoot();
    writeState(root, 'den-test', 'name: den-test\naffected_scopes: []\n');
    mockSpawn.mockReturnValue(spawnOk(contextJson(2, 1)));

    const result = await constraintDensityEvaluator.evaluate(makeCtx(root));

    expect(mockSpawn.mock.calls[0]![1]).toEqual(['mumuspec', 'context', '.', '--json']);
    expect(result.name).toBe('constraint-density');
    expect(result.weight).toBe(0);
    expect(result.value).toBeCloseTo(3 / 150, 6);
    expect(result.rawData).toMatchObject({ shall: 2, shallNot: 1, total: 3, scopes: ['.'] });
  });

  it('aggregates across affected_scopes from state artifact', async () => {
    const root = makeRoot();
    writeState(root, 'den-test', 'name: den-test\naffected_scopes: ["sub", "deep/nested"]\n');
    mockSpawn.mockImplementation(((cmd: unknown, args: string[]) => {
      return args!.includes('sub')
        ? spawnOk(contextJson(2, 1))
        : spawnOk(contextJson(1, 0));
    }) as unknown as typeof spawnSync);

    const result = await constraintDensityEvaluator.evaluate(makeCtx(root));

    expect(mockSpawn).toHaveBeenCalledTimes(2);
    expect(result.rawData).toMatchObject({ shall: 3, shallNot: 1, total: 4, scopes: ['sub', 'deep/nested'] });
    expect(mockSpawn.mock.calls[1]![1]).toEqual(['mumuspec', 'context', 'deep/nested', '--json']);
  });

  it('returns nullResult when context command fails', async () => {
    const root = makeRoot();
    mockSpawn.mockReturnValue({ status: 1, stdout: '', stderr: 'boom' } as unknown as ReturnType<typeof spawnSync>);

    const result = await constraintDensityEvaluator.evaluate(makeCtx(root));

    expect(result.value).toBe(0);
    expect(result.weight).toBe(0);
    expect(result.details).toContain('failed');
  });

  it('returns nullResult when context emits no JSON', async () => {
    const root = makeRoot();
    mockSpawn.mockReturnValue(spawnOk('no json here'));

    const result = await constraintDensityEvaluator.evaluate(makeCtx(root));

    expect(result.value).toBe(0);
    expect(result.details).toContain('no JSON');
  });

  it('returns nullResult when spec chain has zero constraints', async () => {
    const root = makeRoot();
    mockSpawn.mockReturnValue(spawnOk(contextJson(0, 0)));

    const result = await constraintDensityEvaluator.evaluate(makeCtx(root));

    expect(result.value).toBe(0);
    expect(result.weight).toBe(0);
    expect(result.details).toContain('no SHALL/SHALL NOT');
  });
});
