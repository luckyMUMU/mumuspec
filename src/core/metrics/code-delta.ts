/**
 * Code Delta Evaluator — Auto-Evaluate Engine (R-0002)
 *
 * Measures code change convergence: high delta = still making many changes,
 * low delta = stabilizing. Returns 1 - normalized_delta as the score.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

export const codeDeltaEvaluator: Evaluator = {
  name: 'code-delta',
  defaultWeight: 0.1, // D2 rebalance (was 0.15)

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;

    try {
      // Get lines changed in the last round vs. total codebase
      const diffResult = spawnSync(
        'git', ['diff', '--stat', 'HEAD~1', 'HEAD'],
        { cwd, encoding: 'utf-8' }
      );

      // git 失败（非仓库/首个提交无 HEAD~1/超时）时不得把空输出当作"代码稳定"
      if (diffResult.error || diffResult.status !== 0) {
        return nullResult(
          `git diff failed (status: ${diffResult.error ? diffResult.error.message : diffResult.status})`
        );
      }

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
      // 纯 JS 统计：替代 shell 管道（xargs 在 Windows 不存在，且 shell:true 有注入面）
      const totalLines = countTrackedLines(cwd);

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

/** 统计 git tracked 文件的总行数（跨平台、无 shell 依赖） */
function countTrackedLines(cwd: string): number {
  const lsResult = spawnSync('git', ['ls-files'], { cwd, encoding: 'utf-8' });
  if (lsResult.error || lsResult.status !== 0) return 0;

  const files = (lsResult.stdout ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  let total = 0;
  for (const file of files) {
    try {
      const content = readFileSync(resolve(cwd, file), 'utf-8');
      total += content.length === 0 ? 0 : content.split('\n').length;
    } catch {
      // 二进制或不可读文件跳过，不影响统计
    }
  }
  return total;
}

function nullResult(details: string): MetricResult {
  return {
    name: 'code-delta',
    value: 0,
    weight: 0,
    details: `${details} — metric skipped`,
  };
}
