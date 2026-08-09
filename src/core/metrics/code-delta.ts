/**
 * Code Delta Evaluator — Auto-Evaluate Engine (R-0002)
 *
 * Measures code change convergence: high delta = still making many changes,
 * low delta = stabilizing. Returns 1 - normalized_delta as the score.
 */

import { spawnSync } from 'node:child_process';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

export const codeDeltaEvaluator: Evaluator = {
  name: 'code-delta',
  defaultWeight: 0.15,

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      // Get lines changed in the last round vs. total codebase
      const diffResult = spawnSync(
        'git', ['diff', '--stat', 'HEAD~1', 'HEAD'],
        { cwd, encoding: 'utf-8' }
      );

      const diffOutput = diffResult.stdout ?? '';
      if (!diffOutput.trim()) {
        return {
          name: 'code-delta',
          value: 1.0,
          weight: 0.15,
          details: 'No changes detected — code stable',
          rawData: { linesChanged: 0 },
        };
      }

      // Parse the summary line: "X files changed, Y insertions(+), Z deletions(-)"
      const summaryMatch = diffOutput.match(/(\d+)\s+insertion.*?(\d+)\s+deletion/);
      const insertions = summaryMatch ? parseInt(summaryMatch[1], 10) : 0;
      const deletions = summaryMatch ? parseInt(summaryMatch[2], 10) : 0;
      const linesChanged = insertions + deletions;

      // Get total lines in the codebase for normalization
      const wcResult = spawnSync(
        'git', ['ls-files', '|', 'xargs', 'wc', '-l'],
        { cwd, encoding: 'utf-8', shell: true }
      );
      const wcOutput = wcResult.stdout ?? '';
      const totalMatch = wcOutput.match(/(\d+)\s+total/);
      const totalLines = totalMatch ? parseInt(totalMatch[1], 10) : linesChanged * 10;

      // Convergence score: 1 - (changed / total), clamped to [0, 1]
      const ratio = totalLines > 0 ? linesChanged / totalLines : 0.1;
      const convergenceScore = Math.max(0, Math.min(1, 1 - ratio));

      return {
        name: 'code-delta',
        value: convergenceScore,
        weight: 0.15,
        details: `${linesChanged} lines changed (${Math.round(ratio * 100)}% of codebase)`,
        rawData: { linesChanged, insertions, deletions, totalLines },
      };
    } catch {
      return nullResult('code delta calculation failed');
    }
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: 'code-delta',
    value: 0,
    weight: 0,
    details: `${details} — metric skipped`,
  };
}
