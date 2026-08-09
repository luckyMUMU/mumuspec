/**
 * Auto-Evaluate Orchestrator — Auto-Evaluate Engine (R-0002)
 *
 * Collects metrics from all registered evaluators, computes weighted
 * composite progress, and judges convergence based on stability window.
 */

import type {
  AutoEvaluateResult,
  ConvergenceConfig,
  EvaluatorContext,
  HybridConfig,
  MetricResult,
} from './types.js';
import {
  DEFAULT_CONVERGENCE_CONFIG,
  DEFAULT_HYBRID_CONFIG,
} from './types.js';
import {
  getActiveEvaluators,
  registerEvaluator,
  getActiveEvaluatorCount,
} from './evaluator-registry.js';

// Re-export for convenience
export { getActiveEvaluatorCount };
import { testPassRateEvaluator } from './test-pass-rate.js';
import { driftScoreEvaluator } from './drift-score.js';
import { specComplianceEvaluator } from './spec-compliance.js';
import { codeDeltaEvaluator } from './code-delta.js';

// ════════════════════════════════════════════════════════════════════
// History Tracker (for stability window check)
// ════════════════════════════════════════════════════════════════════

const historyMap = new Map<string, number[]>();

/** Get or create history for a change. */
function getHistory(changeName: string): number[] {
  if (!historyMap.has(changeName)) {
    historyMap.set(changeName, []);
  }
  return historyMap.get(changeName)!;
}

/** Record progress for stability analysis. */
function recordProgress(changeName: string, progress: number, windowSize: number): void {
  const history = getHistory(changeName);
  history.push(progress);
  // Keep only the last N+1 entries (need N+1 to check N consecutive)
  while (history.length > windowSize + 1) {
    history.shift();
  }
}

/** Check if the last N consecutive rounds all exceeded the threshold. */
function isStableConvergence(history: number[], threshold: number, windowSize: number): boolean {
  if (history.length < windowSize) return false;
  const recent = history.slice(-windowSize);
  return recent.every(v => v >= threshold);
}

/** Clear history for a change (used in tests and reset). */
export function clearHistory(changeName: string): void {
  historyMap.delete(changeName);
}

// ════════════════════════════════════════════════════════════════════
// Core Auto-Evaluate Logic
// ════════════════════════════════════════════════════════════════════

/**
 * Run auto-evaluation: collect metrics, compute progress, judge convergence.
 */
export async function autoEvaluate(
  ctx: EvaluatorContext,
  config: ConvergenceConfig = DEFAULT_CONVERGENCE_CONFIG,
): Promise<AutoEvaluateResult> {
  const evaluators = getActiveEvaluators();

  // 1. Collect metrics in parallel
  const results = await Promise.all(
    evaluators.map(e => e.evaluate(ctx).catch(() => null as MetricResult | null))
  );

  const metrics: MetricResult[] = results.filter((m): m is MetricResult => m !== null);

  // 2. Filter to active metrics (weight > 0) and renormalize weights
  const activeMetrics = metrics.filter(m => m.weight > 0);
  const totalWeight = activeMetrics.reduce((sum, m) => sum + m.weight, 0);

  if (totalWeight === 0 || activeMetrics.length === 0) {
    // All evaluators failed — signal to fallback to manual
    return {
      progress: 0,
      goalAchieved: false,
      metrics,
      recommendation: 'All auto-evaluators failed. Please use manual evaluation.',
      history: getHistory(ctx.changeName),
    };
  }

  // Normalize weights to sum=1
  for (const m of activeMetrics) {
    m.weight = m.weight / totalWeight;
  }

  // 3. Compute weighted progress
  const progress = activeMetrics.reduce((sum, m) => sum + m.value * m.weight, 0);

  // 4. Check convergence conditions
  const allAboveMin = activeMetrics.every(m => m.value >= config.minAcceptable);
  recordProgress(ctx.changeName, progress, config.stabilityWindow);
  const history = getHistory(ctx.changeName);
  const stableMet = isStableConvergence(history, config.threshold, config.stabilityWindow);

  const goalAchieved = progress >= config.threshold && allAboveMin && stableMet;

  // 5. Generate recommendation
  const recommendation = buildRecommendation(activeMetrics, progress, goalAchieved, config);

  return {
    progress,
    goalAchieved,
    metrics,
    recommendation,
    history,
  };
}

/**
 * Hybrid evaluation: combine auto metrics with manual input.
 */
export async function hybridEvaluate(
  ctx: EvaluatorContext,
  manualProgress: number,
  config: ConvergenceConfig = DEFAULT_CONVERGENCE_CONFIG,
  hybrid: HybridConfig = DEFAULT_HYBRID_CONFIG,
): Promise<AutoEvaluateResult> {
  const autoResult = await autoEvaluate(ctx, config);

  // If auto-evaluate failed completely, fall back to manual
  if (autoResult.metrics.length === 0 || autoResult.metrics.every(m => m.weight === 0)) {
    return {
      ...autoResult,
      progress: manualProgress,
      goalAchieved: manualProgress >= config.threshold,
      recommendation: 'Auto-evaluate unavailable, using manual progress.',
    };
  }

  // Weighted hybrid: auto * autoWeight + manual * manualWeight
  const hybridProgress = autoResult.progress * hybrid.autoWeight + manualProgress * hybrid.manualWeight;

  return {
    ...autoResult,
    progress: hybridProgress,
    goalAchieved: hybridProgress >= config.threshold,
    recommendation: autoResult.goalAchieved
      ? 'Hybrid convergence confirmed.'
      : `Hybrid progress: ${Math.round(hybridProgress * 100)}% (${Math.round(autoResult.progress * 100)}% auto + ${Math.round(manualProgress * 100)}% manual)`,
  };
}

// ════════════════════════════════════════════════════════════════════
// Recommendation Builder
// ════════════════════════════════════════════════════════════════════

function buildRecommendation(
  metrics: MetricResult[],
  progress: number,
  goalAchieved: boolean,
  config: ConvergenceConfig,
): string {
  if (goalAchieved) {
    return `Convergence confirmed! Progress: ${Math.round(progress * 100)}% >= ${Math.round(config.threshold * 100)}% for stability window.`;
  }

  // Find the weakest metric
  const sorted = [...metrics].sort((a, b) => a.value - b.value);
  const weakest = sorted[0];

  if (weakest && weakest.value < config.minAcceptable) {
    return `Focus on: ${weakest.name} (current: ${Math.round(weakest.value * 100)}%, needs >= ${Math.round(config.minAcceptable * 100)}%).`;
  }

  return `Progress: ${Math.round(progress * 100)}%. Continue working towards ${Math.round(config.threshold * 100)}% threshold.`;
}

// ════════════════════════════════════════════════════════════════════
// Registration Helper
// ════════════════════════════════════════════════════════════════════

/** Register built-in evaluators. */
export function registerBuiltInEvaluators(): void {
  registerEvaluator(testPassRateEvaluator);
  registerEvaluator(driftScoreEvaluator);
  registerEvaluator(specComplianceEvaluator);
  registerEvaluator(codeDeltaEvaluator);
}
