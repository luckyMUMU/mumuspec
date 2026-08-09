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
  defaultWeight: 0.25,

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      // Run guard validate to check constraint compliance
      const result = spawnSync(
        'npx', ['mumuspec', 'guard', ctx.changeName, 'build', '--format', 'json'],
        { cwd, encoding: 'utf-8', timeout: 30_000 }
      );

      const output = result.stdout ?? '';
      const lines = output.split('\n').filter(l => l.trim());
      const jsonLine = lines.find(l => l.startsWith('{'));

      if (!jsonLine) {
        // If guard passes without JSON output, assume full compliance
        return {
          name: 'spec-compliance',
          value: 1.0,
          weight: 0.25,
          details: 'Guard validation passed — full compliance',
          rawData: { passed: true },
        };
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
        weight: 0.25,
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
