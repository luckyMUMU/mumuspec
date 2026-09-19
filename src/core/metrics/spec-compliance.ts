/**
 * Spec Compliance Evaluator — Auto-Evaluate Engine (R-0002)
 *
 * Measures compliance rate of SHALL/SHALL NOT constraints in the spec.
 * Uses the `mumuspec check --json` command to count runtime constraint failures
 * against the enforced constraint total.
 *
 * E17 (evaluator-data-source-fix): 数据源从 `guard <change> build --format json`
 * 改为 `check --json`——guard CLI 无 `--format` 且 `--json` 输出 `{passed: boolean}`
 * 无计数（布尔被当成 1 恒满分）；check 的 fullCheck `compliance.coverage.total` 是
 * 运行时约束总数、`compliance.errors` 是失败数，二者构成诚实的分母/分子。
 */

import { spawnSync } from 'node:child_process';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';
// DS-EVAL-003：单一权威源——与 drift-score / runner 复用同一抽取实现，禁止本地复刻。
import { parseJsonFrom } from '../utils.js';

interface CheckCompliancePayload {
  compliance?: {
    errors?: Array<{ code?: string }>;
    coverage?: { total?: number };
  };
  exitCode?: number;
}

export const specComplianceEvaluator: Evaluator = {
  name: 'spec-compliance',
  defaultWeight: 0.2, // D2 rebalance (was 0.25)

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    // In-process payload first (lightweight path, injected seam); the subprocess
    // channel remains the fallback. Core never imports the guard domain.
    let payload: CheckCompliancePayload | null = null;
    try {
      if (ctx.inProcess?.checkJsonPayload) {
        const built = ctx.inProcess.checkJsonPayload(cwd);
        payload = { compliance: built.compliance, exitCode: built.exitCode };
      }
    } catch {
      payload = null;
    }

    if (!payload) {
      try {
        const result = spawnSync(
          'npx', ['mumuspec', 'check', '--json'],
          // E17: win32 上 npx 是 npx.cmd，无 shell 无法 exec（constraint-density 同款修复）
          { cwd, encoding: 'utf-8', timeout: 30_000, shell: process.platform === 'win32' },
        );

        if (result.error) {
          return nullResult(`check command failed to start: ${result.error.message}`);
        }

        // check 报问题（status !== 0）时 stdout 仍含完整 payload——那恰恰是低分的来源，
        // 不得拒绝解析（拒绝会把"有违规"谎报成"跳过"）。
        const parsed = parseJsonFrom(result.stdout ?? '');
        if (parsed === null) {
          return nullResult('check produced no JSON output — cannot determine compliance');
        }
        payload = parsed as CheckCompliancePayload;
      } catch (err) {
        return nullResult(`spec compliance check failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const compliance = payload.compliance;
    const total = compliance?.coverage?.total ?? 0;
    const failed = compliance?.errors?.length ?? 0;

    if (total <= 0) {
      // fullCheck 的 coverage 缺失（非 full 路径）或 total=0：无分母即无通过率，诚实跳过
      return nullResult('check coverage.total unavailable — cannot determine compliance');
    }

    const complianceRate = Math.max(0, Math.min(1, 1 - failed / total));

    return {
      name: 'spec-compliance',
      value: complianceRate,
      // P1-3 (evaluator-weight-single-source): 单一权威源——引用 defaultWeight
      weight: specComplianceEvaluator.defaultWeight,
      details: `${total - failed}/${total} constraints passed (${Math.round(complianceRate * 100)}%)`,
      rawData: { failed, total, exitCode: payload.exitCode ?? null },
    };
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: 'spec-compliance',
    value: 0,
    weight: 0,
    details: `${details} — metric skipped`,
  };
}