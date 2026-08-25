/**
 * Effectiveness Scoring Engine (R-0005).
 *
 * Computes constraint effectiveness scores based on pass rate and false
 * positive rate.
 *
 * Algorithm: score = clamp(passRate × (1 - falsePositiveRate × penaltyWeight), 0, 1)
 *
 * ponytail: intentionally simple formula; can be replaced with Bayesian
 * adjustment once enough data is collected.
 */

import type {
  EffectivenessScore,
  EvolutionReport,
  ScoringConfig,
  CheckRecord,
} from './types.js';
import { DEFAULT_SCORING_CONFIG } from './types.js';

/**
 * Compute composite effectiveness score.
 *
 * @param passRate - [0, 1]
 * @param falsePositiveRate - [0, 1]
 * @param penaltyWeight - multiplier on falsePositiveRate (default 1.5)
 * @returns composite score clamped to [0, 1]
 */
export function computeScore(
  passRate: number,
  falsePositiveRate: number,
  penaltyWeight: number = DEFAULT_SCORING_CONFIG.penaltyWeight,
): number {
  const raw = passRate * (1 - falsePositiveRate * penaltyWeight);
  return Math.max(0, Math.min(1, raw));
}

/**
 * Compute per-constraint effectiveness scores from check records.
 *
 * Groups records by constraintId, calculates pass rate and false positive rate,
 * then computes the composite score for each.
 *
 * @param records - raw check records (most recent first)
 * @param config - scoring configuration
 * @param constraintIds - optional filter; if provided, only these ids are scored
 * @param excludeIds - constraint ids to exclude (e.g., Goal Preservation anchors)
 */
export function computeEffectivenessScores(
  records: CheckRecord[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  constraintIds?: string[],
  excludeIds: string[] = [],
): EffectivenessScore[] {
  // Group records by constraintId
  const grouped = new Map<string, CheckRecord[]>();

  for (const rec of records.slice(-config.windowSize)) {
    if (excludeIds.includes(rec.constraintId)) continue;
    if (constraintIds && !constraintIds.includes(rec.constraintId)) continue;

    const arr = grouped.get(rec.constraintId) ?? [];
    arr.push(rec);
    grouped.set(rec.constraintId, arr);
  }

  const now = new Date().toISOString();
  const scores: EffectivenessScore[] = [];

  for (const [id, recs] of grouped) {
    const sampleSize = recs.length;
    if (sampleSize === 0) continue;

    const passes = recs.filter((r) => r.passed).length;
    const failures = sampleSize - passes;
    const falsePositives = recs.filter((r) => !r.passed && r.falsePositive).length;

    const passRate = passes / sampleSize;
    const falsePositiveRate = failures > 0 ? falsePositives / failures : 0;

    scores.push({
      constraintId: id,
      passRate,
      falsePositiveRate,
      score: computeScore(passRate, falsePositiveRate, config.penaltyWeight),
      lastEvaluated: now,
      sampleSize,
      reliable: sampleSize >= config.minSampleSize,
    });
  }

  return scores;
}

/**
 * Generate a full evolution report from check records.
 */
export function generateReport(
  records: CheckRecord[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
  excludeIds: string[] = [],
): EvolutionReport {
  const scores = computeEffectivenessScores(records, config, undefined, excludeIds);

  // Low performing: score < threshold AND reliable
  const lowPerformingIds = scores
    .filter((s) => s.reliable && s.score < config.lowScoreThreshold)
    .map((s) => s.constraintId);

  // Build recommendations
  const recommendations: string[] = [];

  for (const id of lowPerformingIds) {
    const s = scores.find((x) => x.constraintId === id);
    if (!s) continue;

    if (s.falsePositiveRate > 0.5) {
      recommendations.push(
        `Constraint ${id} has high false positive rate (${(s.falsePositiveRate * 100).toFixed(0)}%). Consider relaxing its enforcement or narrowing scope.`,
      );
    } else if (s.passRate < 0.5) {
      recommendations.push(
        `Constraint ${id} has low pass rate (${(s.passRate * 100).toFixed(0)}%). Consider reviewing its necessity or providing better tooling.`,
      );
    } else {
      recommendations.push(
        `Constraint ${id} composite score ${(s.score).toFixed(2)} is below threshold. Review pass rate and false positive rate.`,
      );
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    scores,
    lowPerformingIds,
    recommendations,
    totalEvaluated: scores.length,
  };
}
