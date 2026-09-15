/**
 * Verifiable Ratio Evaluator — A1 可验证率（eval-corpus / DS-EVAL-003）。
 *
 * Data source: `mumuspec validate --json` 顶层 `coverage`（字段契约见
 * `EnforcementCoverage`）——**只读消费**，不改 validate 的输出 schema（C-3）。
 *
 * Semantics:
 * - weight = 0（C-1）：可验证率是**观测信号**，不参与 loop composite 加权。
 * - value = clamp(coverage.strong_ratio, 0, 1)：已强锚定约束占比，越高越可验证。
 * - nullResult（诚实跳过，weight=0 / value=0，附 '— metric skipped'）用于：
 *   spawn 失败 / 无 JSON / 缺 coverage / coverage.total<=0（无分母，Q4-002）。
 *
 * R-5：严格取 `validate --json` 顶层 coverage，而非 `check --json` 的运行时 coverage。
 */

import { spawnSync } from 'node:child_process';
import { parseJsonFrom } from '../utils.js';
import type { EnforcementCoverage } from '../types-workflow.js';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

export const VERIFIABLE_RATIO_NAME = 'verifiable-ratio';

export const verifiableRatioEvaluator: Evaluator = {
  name: VERIFIABLE_RATIO_NAME,
  defaultWeight: 0, // C-1：weight=0，不进 composite

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      const result = spawnSync(
        'npx',
        ['mumuspec', 'validate', '--json'],
        // ponytail: win32 上 npx 是 npx.cmd，无 shell 无法 exec（drift-score 同款修复）
        { cwd, encoding: 'utf-8', timeout: 30_000, shell: process.platform === 'win32' },
      );

      if (result.error) {
        return nullResult(`validate failed to start: ${result.error.message}`);
      }

      const parsed = parseJsonFrom(result.stdout ?? '');
      if (parsed === null) {
        return nullResult('validate produced no JSON output');
      }

      const cov = (parsed as { coverage?: Partial<EnforcementCoverage> }).coverage;
      if (!cov || typeof cov.total !== 'number' || cov.total <= 0) {
        // Q4-002：无分母即跳过（同 spec-compliance 的诚实语义）
        return nullResult('validate coverage.total unavailable');
      }

      const value = Math.max(0, Math.min(1, cov.strong_ratio ?? 0));

      return {
        name: VERIFIABLE_RATIO_NAME,
        value,
        weight: 0,
        details:
          `strong ${cov.enforced_strong}/${cov.total} (strong_ratio ${value.toFixed(3)}); ` +
          `weak ${cov.enforced_weak} manual ${cov.manual} unverifiable ${cov.unverifiable}`,
        rawData: {
          total: cov.total,
          enforced_strong: cov.enforced_strong,
          enforced_weak: cov.enforced_weak,
          manual: cov.manual,
          unverifiable: cov.unverifiable,
          declared_ratio: cov.declared_ratio ?? 0,
          strong_ratio: cov.strong_ratio ?? 0,
        },
      };
    } catch (err) {
      return nullResult(
        `verifiable-ratio failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: VERIFIABLE_RATIO_NAME,
    value: 0,
    weight: 0,
    details: `${details} — metric skipped`,
  };
}
