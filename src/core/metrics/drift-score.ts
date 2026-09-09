/**
 * Drift Score Evaluator — Auto-Evaluate Engine (R-0002)
 *
 * Uses AST Guard semantic constraint detection to measure drift.
 * Higher score = fewer constraint violations = less drift.
 * Depends on R-0003 (AST Guard).
 */

import { spawnSync } from 'node:child_process';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

export const driftScoreEvaluator: Evaluator = {
  name: 'drift-score',
  defaultWeight: 0.2, // D2 rebalance (was 0.25)

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      // Run guard check with drift detection
      const result = spawnSync(
        'npx', ['mumuspec', 'drift', 'detect', '--format', 'json'],
        { cwd, encoding: 'utf-8', timeout: 30_000 }
      );

      if (result.status !== 0 && !result.stdout) {
        return nullResult('drift detection unavailable');
      }

      // Parse drift report
      const output = result.stdout ?? '';
      const lines = output.split('\n').filter(l => l.trim());
      const jsonLine = lines.find(l => l.startsWith('{'));
      if (!jsonLine) {
        return nullResult('no drift report');
      }

      const report = JSON.parse(jsonLine);
      const totalViolations = report.totalViolations ?? report.violations ?? 0;
      const totalChecks = report.totalChecks ?? report.checks ?? 1;

      // Drift score = 1 - (violations / checks), clamped to [0, 1]
      const driftScore = Math.max(0, Math.min(1, 1 - (totalViolations / totalChecks)));

      return {
        name: 'drift-score',
        value: driftScore,
        weight: 0.25,
        details: `${totalViolations} violations in ${totalChecks} checks (drift: ${Math.round((1 - driftScore) * 100)}%)`,
        rawData: { violations: totalViolations, checks: totalChecks },
      };
    } catch {
      return nullResult('drift detection failed');
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
