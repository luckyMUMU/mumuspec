/**
 * Test Pass Rate Evaluator — Auto-Evaluate Engine (R-0002)
 *
 * Collects test pass rate by running vitest with JSON reporter.
 * Returns the ratio of passed tests to total tests.
 */

import { spawnSync } from 'node:child_process';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

export const testPassRateEvaluator: Evaluator = {
  name: 'test-pass-rate',
  defaultWeight: 0.35,

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      // Run vitest with JSON output
      const result = spawnSync(
        'npx', ['vitest', 'run', '--reporter=json', '--no-color'],
        { cwd, encoding: 'utf-8', timeout: 60_000 }
      );

      if (result.error) {
        return nullResult('vitest execution failed');
      }

      const output = result.stdout ?? '';
      // Parse JSON from the last line (vitest JSON reporter outputs JSON)
      const lines = output.split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1] ?? '';
      const json = JSON.parse(lastLine);

      const numPassed = json.numPassedTests ?? 0;
      const numFailed = json.numFailedTests ?? 0;
      const numTotal = json.numTotalTests ?? (numPassed + numFailed);

      if (numTotal === 0) {
        return nullResult('no tests found');
      }

      const passRate = numPassed / numTotal;

      return {
        name: 'test-pass-rate',
        value: passRate,
        weight: 0.35,
        details: `${numPassed}/${numTotal} tests passed (${Math.round(passRate * 100)}%)`,
        rawData: { passed: numPassed, failed: numFailed, total: numTotal },
      };
    } catch {
      // vitest not available or parse error
      return nullResult('vitest unavailable');
    }
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: 'test-pass-rate',
    value: 0,
    weight: 0,
    details: `${details} — metric skipped`,
  };
}
