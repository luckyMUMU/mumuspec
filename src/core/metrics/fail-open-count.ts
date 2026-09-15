/**
 * Fail-Open Count Evaluator — B4 fail-open 计数（eval-corpus / DS-EVAL-003）。
 *
 * Data source: `.mumuspec/audit.log`（JSONL）。计数口径：`result !== 'success'`
 * 的条目（字符串比较，兼容 'fail' / 'bypassed' / 缺字段）＝ 一次 fail-open 入账。
 *
 * Semantics:
 * - weight = 0（C-1）：观测信号，不参与 loop composite 加权。
 * - value = 1 - min(1, total / FAIL_OPEN_CAP)：越高越健康（有界归一化，同
 *   constraint-density cap 思维）。方向仅为可读性选择（weight=0 不影响 composite）。
 * - D-eval-1：**零非 success 不是 null**（0 fail-open 是健康态，value=1）；
 *   只有「无数据源」——audit.log 不存在或完全为空——才 nullResult。
 *
 * 范围边界（D-eval-1）：M1 只交付 DS-EVAL-003 明文要求的「计数 + 按 action 分组清单」；
 * 与 design.md 固化静默点位清单的比对依赖 M2 的 check.warn 入账事件，不在 M1。
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMumuSpecDir } from '../utils.js';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

export const FAIL_OPEN_COUNT_NAME = 'fail-open-count';

/** 有界归一化上限：非 success 条目数达到该值即 value 归零。 */
export const FAIL_OPEN_CAP = 10;

interface FailOpenEntry {
  action: string;
  ts?: string;
  error?: string;
}

export const failOpenCountEvaluator: Evaluator = {
  name: FAIL_OPEN_COUNT_NAME,
  defaultWeight: 0, // C-1：weight=0，不进 composite

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const logPath = join(getMumuSpecDir(ctx.projectRoot), 'audit.log');
    if (!existsSync(logPath)) {
      return nullResult('audit.log not found');
    }

    const content = readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());
    if (lines.length === 0) {
      return nullResult('audit.log is empty');
    }

    const byAction: Record<string, number> = {};
    const entries: FailOpenEntry[] = [];
    let total = 0;

    for (const line of lines) {
      let entry: { action?: unknown; result?: unknown; ts?: unknown; error?: unknown };
      try {
        entry = JSON.parse(line) as typeof entry;
      } catch {
        continue; // 坏行跳过，不污染计数
      }

      if (entry.result === 'success') continue; // 成功条目不入账

      total += 1;
      const action = typeof entry.action === 'string' ? entry.action : '(unknown)';
      byAction[action] = (byAction[action] ?? 0) + 1;
      entries.push({ action, ts: entry.ts as string, error: entry.error as string });
    }

    const value = 1 - Math.min(1, total / FAIL_OPEN_CAP);

    return {
      name: FAIL_OPEN_COUNT_NAME,
      value,
      weight: 0,
      details: `${total} non-success audit entr${total === 1 ? 'y' : 'ies'} across ${Object.keys(byAction).length} action(s)`,
      rawData: { total, cap: FAIL_OPEN_CAP, byAction, entries },
    };
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: FAIL_OPEN_COUNT_NAME,
    value: 0,
    weight: 0,
    details: `${details} — metric skipped`,
    rawData: { total: 0, cap: FAIL_OPEN_CAP, byAction: {}, entries: [] },
  };
}
