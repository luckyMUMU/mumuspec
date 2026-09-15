/**
 * tests/core/metrics/fail-open-count.test.ts — L1 评估器单测（L1-C09~C16）。
 *
 * 依据：design.md §2.2.2 / §4 L1；DS-EVAL-003（SHALL weight=0、读 audit.log 计数分组；
 * SHALL NOT 改 composite）；C-1；D-eval-1（零非 success ≠ null）。
 * 隔离：tmp 目录真实文件读取（不 mock fs、不 spawn）。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  failOpenCountEvaluator,
  FAIL_OPEN_COUNT_NAME,
  FAIL_OPEN_CAP,
} from '../../../src/core/metrics/fail-open-count.js';
import type { EvaluatorContext, MetricResult } from '../../../src/core/metrics/types.js';

function ctx(projectRoot: string): EvaluatorContext {
  return { projectRoot, changeName: '', roundHistory: [] };
}

interface RawFailOpen {
  total: number;
  cap: number;
  byAction: Record<string, number>;
  entries: Array<{ action: string; ts?: string; error?: string }>;
}

function raw(r: MetricResult): RawFailOpen {
  return r.rawData as RawFailOpen;
}

describe('fail-open-count evaluator (L1-C09~C16)', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mumuspec-failopen-'));
    mkdirSync(join(root, '.mumuspec'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeLog(lines: string[]): void {
    writeFileSync(join(root, '.mumuspec', 'audit.log'), lines.join('\n') + '\n', 'utf8');
  }

  it('L1-C09 — 全 success → value=1, total=0', async () => {
    writeLog([
      JSON.stringify({ action: 'x', result: 'success', ts: '2026-09-15T00:00:00.000Z' }),
      JSON.stringify({ action: 'x', result: 'success', ts: '2026-09-15T00:00:01.000Z' }),
    ]);

    const r = await failOpenCountEvaluator.evaluate(ctx(root));
    expect(r.name).toBe('fail-open-count');
    expect(r.value).toBe(1);
    expect(r.weight).toBe(0);
    expect(raw(r).total).toBe(0);
    expect(raw(r).byAction).toEqual({});
    expect(raw(r).entries).toEqual([]);
  });

  it('L1-C10 — 混合 fail 按 action 分组 + entries 清单', async () => {
    writeLog([
      JSON.stringify({ action: 'a', result: 'success', ts: 't1' }),
      JSON.stringify({ action: 'a', result: 'success', ts: 't2' }),
      JSON.stringify({ action: 'a', result: 'fail', ts: 't3', error: 'boom-a1' }),
      JSON.stringify({ action: 'a', result: 'fail', ts: 't4', error: 'boom-a2' }),
      JSON.stringify({ action: 'b', result: 'bypassed', ts: 't5' }),
      JSON.stringify({ ts: 't6' }), // 缺 action（且缺 result → 非 success）
    ]);

    const r = await failOpenCountEvaluator.evaluate(ctx(root));
    expect(raw(r).total).toBe(4);
    expect(raw(r).byAction).toEqual({ a: 2, b: 1, '(unknown)': 1 });
    expect(raw(r).entries).toHaveLength(4);
    for (const e of raw(r).entries) {
      expect(e).toHaveProperty('action');
      expect(e).toHaveProperty('ts');
      expect(e).toHaveProperty('error');
    }
    expect(r.value).toBeCloseTo(1 - Math.min(1, 4 / 10));
    expect(r.weight).toBe(0);
  });

  it('L1-C11 — 坏 JSON 行跳过，不污染计数', async () => {
    writeLog([
      'not json',
      '{bad}',
      JSON.stringify({ action: 'a', result: 'fail', ts: 't1' }),
      '',
      '   ',
    ]);

    const r = await failOpenCountEvaluator.evaluate(ctx(root));
    expect(raw(r).total).toBe(1);
    expect(raw(r).byAction).toEqual({ a: 1 });
  });

  it('L1-C12 — audit.log 缺失 → nullResult（not found）', async () => {
    const r = await failOpenCountEvaluator.evaluate(ctx(root));
    expect(r.value).toBe(0);
    expect(r.weight).toBe(0);
    expect(r.details).toContain('not found');
    expect(raw(r)).toEqual({ total: 0, cap: FAIL_OPEN_CAP, byAction: {}, entries: [] });
  });

  it('L1-C13 — audit.log 空 → nullResult（empty）', async () => {
    writeLog([]); // 仅一个换行 → filter 后为空

    const r = await failOpenCountEvaluator.evaluate(ctx(root));
    expect(r.value).toBe(0);
    expect(r.weight).toBe(0);
    expect(r.details).toContain('empty');
  });

  it('L1-C14 — 零非 success 不是 null（对照空文件）', async () => {
    writeLog([
      JSON.stringify({ action: 'x', result: 'success', ts: 't1' }),
      JSON.stringify({ action: 'y', result: 'success', ts: 't2' }),
      JSON.stringify({ action: 'z', result: 'success', ts: 't3' }),
    ]);

    const r = await failOpenCountEvaluator.evaluate(ctx(root));
    expect(r.value).toBe(1); // 健康态，非 0、非 nullResult
    expect(r.details).toContain('0 non-success audit entr');
    expect(raw(r).total).toBe(0);
  });

  it('L1-C15 — defaultWeight===0 且 FAIL_OPEN_CAP===10', () => {
    expect(failOpenCountEvaluator.defaultWeight).toBe(0);
    expect(FAIL_OPEN_CAP).toBe(10);
    expect(FAIL_OPEN_COUNT_NAME).toBe('fail-open-count');
  });

  it('L1-C16 — value 有界（cap=10，15 条非 success → 0）', async () => {
    const lines: string[] = [];
    for (let i = 0; i < 15; i++) {
      lines.push(JSON.stringify({ action: 'a', result: 'fail', ts: `t${i}` }));
    }
    writeLog(lines);

    const r = await failOpenCountEvaluator.evaluate(ctx(root));
    expect(raw(r).total).toBe(15);
    expect(raw(r).cap).toBe(10);
    expect(r.value).toBe(0);
  });
});
