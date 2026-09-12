/**
 * Spec Compliance Evaluator — Auto-Evaluate Engine (R-0002)
 *
 * Measures compliance rate of SHALL/SHALL NOT constraints in the spec.
 * Uses the guard validation command to check constraint adherence.
 */

import { spawnSync } from 'node:child_process';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

export const specComplianceEvaluator: Evaluator = {
  name: 'spec-compliance',
  defaultWeight: 0.2, // D2 rebalance (was 0.25)

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      // Run guard validate to check constraint compliance
      const result = spawnSync(
        'npx', ['mumuspec', 'guard', ctx.changeName, 'build', '--format', 'json'],
        { cwd, encoding: 'utf-8', timeout: 30_000 }
      );

      // 命令失败（崩溃/找不到 change/超时）时不得假设合规——返回 nullResult 让
      // autoEvaluate 跳过该指标，避免虚假满分推动错误的收敛判定
      if (result.error || result.status !== 0) {
        return nullResult(
          `guard command failed (status: ${result.error ? result.error.message : result.status})`
        );
      }

      const output = result.stdout ?? '';
      const lines = output.split('\n').filter(l => l.trim());
      const jsonLine = lines.find(l => l.startsWith('{'));

      if (!jsonLine) {
        // guard 退出码 0 但无 JSON 输出：无法度量合规率，保守跳过而非默认满分
        return nullResult('guard produced no JSON output — cannot determine compliance');
      }

      const report = JSON.parse(jsonLine);
      const passed = report.passed ?? report.numPassed ?? 0;
      const failed = report.failed ?? report.numFailed ?? 0;
      const total = report.total ?? (passed + failed);

      if (total === 0) {
        return nullResult('no constraints to check');
      }

      const complianceRate = passed / total;

      return {
        name: 'spec-compliance',
        value: complianceRate,
        // P1-3 (evaluator-weight-single-source): 单一权威源——引用 defaultWeight
        weight: specComplianceEvaluator.defaultWeight,
        details: `${passed}/${total} constraints passed (${Math.round(complianceRate * 100)}%)`,
        rawData: { passed, failed, total },
      };
    } catch {
      return nullResult('spec compliance check failed');
    }
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
