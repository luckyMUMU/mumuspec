/**
 * Drift Score Evaluator — Auto-Evaluate Engine (R-0002)
 *
 * Uses `mumuspec drift --json` to measure spec↔code drift. Higher score = fewer
 * drift findings = more stable.
 *
 * E17 (evaluator-data-source-fix): 数据源从 `drift detect --format json` 改为
 * `drift --json`——drift 命令无 `--format`，且 `--json` 输出顶层数组 `DriftResult[]`
 * （原解析找 `report.totalViolations/totalChecks` 永远 NaN）。新语义：漂移条数按
 * DRIFT_SATURATION 有界归一化（1 条满分减 1/10，10 条归零）——不再虚构不存在的分母。
 */

import { spawnSync } from 'node:child_process';
import { parseJsonFrom } from '../utils.js';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

/**
 * Drift 条数饱和上限：达到该条数时 score 归零。
 * 有界归一化语义（同 constraint-density 的 cap 思维），替代不存在的 totalChecks 分母。
 */
export const DRIFT_SATURATION = 10;

export const driftScoreEvaluator: Evaluator = {
  name: 'drift-score',
  defaultWeight: 0.2, // D2 rebalance (was 0.25)

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      const result = spawnSync(
        'npx', ['mumuspec', 'drift', '--json'],
        // E17: win32 上 npx 是 npx.cmd，无 shell 无法 exec（constraint-density 同款修复）
        { cwd, encoding: 'utf-8', timeout: 30_000, shell: process.platform === 'win32' },
      );

      if (result.error) {
        return nullResult(`drift command failed to start: ${result.error.message}`);
      }

      const parsed = parseJsonFrom(result.stdout ?? '');
      if (parsed === null) {
        return nullResult('drift produced no JSON output');
      }

      // drift --json 顶层是数组（可能为空）。status 非 0 但 stdout 可解析时照常计算——
      // 有漂移恰是低分的来源。
      const drifts = Array.isArray(parsed) ? parsed : [];
      const violations = drifts.length;

      const driftScore = Math.max(0, Math.min(1, 1 - violations / DRIFT_SATURATION));

      return {
        name: 'drift-score',
        value: driftScore,
        // P1-3 (evaluator-weight-single-source): 单一权威源——引用 defaultWeight
        weight: driftScoreEvaluator.defaultWeight,
        details: `${violations} drift item(s) (score: ${Math.round((1 - driftScore) * 100)}% penalty; 0 = clean, ${DRIFT_SATURATION}+ = saturated)`,
        rawData: { violations, saturation: DRIFT_SATURATION },
      };
    } catch (err) {
      return nullResult(`drift detection failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: 'drift-score',
    value: 0,
    weight: 0,
    details: `${details} — metric skipped`,
  };
}