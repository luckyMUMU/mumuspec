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
import { constraintDensityEvaluator } from './constraint-density.js';
import { designBuildFirstPassEvaluator } from './design-build-first-pass.js';
import { verifiableRatioEvaluator } from './verifiable-ratio.js';
import { failOpenCountEvaluator } from './fail-open-count.js';

// ════════════════════════════════════════════════════════════════════
// History Tracker (for stability window check)
// ════════════════════════════════════════════════════════════════════
// P1-2 (loop-convergence-judgment): 稳定性窗口历史不再寄存在进程内内存 Map——
// `loop evaluate` 每次是新进程，模块级 Map 无重建路径导致窗口恒 false。
// 改为从持久化事实源派生：`EvaluatorContext.roundHistory`（loop.rounds[].evaluation.progress，
// 存于 .mumuspec.yaml，与 loop_state.progress_trend 同源），跨进程有效。

/** 从持久化轮次记录提取进度历史（不含当前轮——当前轮 progress 由调用方追加）。 */
function deriveHistory(ctx: EvaluatorContext): number[] {
  return ctx.roundHistory
    .map((r) => r.evaluation?.progress)
    .filter((p): p is number => typeof p === 'number');
}

/** Check if the last N consecutive rounds all exceeded the threshold. */
function isStableConvergence(history: number[], threshold: number, windowSize: number): boolean {
  if (history.length < windowSize) return false;
  const recent = history.slice(-windowSize);
  return recent.every(v => v >= threshold);
}

/**
 * Clear history for a change.
 * @deprecated P1-2 后稳定窗口历史来自持久化 roundHistory，进程内无历史可清——保留为
 * no-op 以兼容既有测试/reset 调用。
 */
export function clearHistory(_changeName: string): void {
  // no-op（P1-2）
}

// ════════════════════════════════════════════════════════════════════
// Core Auto-Evaluate Logic
// ════════════════════════════════════════════════════════════════════

/**
 * Collect metrics from all active evaluators — pure read-only.
 *
 * Read-only consumers (e.g. `mumuspec metrics`) must NOT trigger the
 * `recordProgress` write side effect embedded in `autoEvaluate`. Evaluator
 * failures are dropped rather than replaced by a fake value — same discipline
 * as `autoEvaluate`: never assume a passing score for a collection that failed.
 */
export async function collectMetrics(ctx: EvaluatorContext): Promise<MetricResult[]> {
  const results = await Promise.all(
    getActiveEvaluators().map(e => e.evaluate(ctx).catch(() => null as MetricResult | null))
  );
  return results.filter((m): m is MetricResult => m !== null);
}

/**
 * Run auto-evaluation: collect metrics, compute progress, judge convergence.
 */
export async function autoEvaluate(
  ctx: EvaluatorContext,
  config: ConvergenceConfig = DEFAULT_CONVERGENCE_CONFIG,
): Promise<AutoEvaluateResult> {
  // 1. Collect metrics in parallel (read-only; no state writes)
  const metrics = await collectMetrics(ctx);

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
      history: deriveHistory(ctx),
    };
  }

  // Normalize weights to sum=1
  for (const m of activeMetrics) {
    m.weight = m.weight / totalWeight;
  }

  // 3. Compute weighted progress
  const progress = activeMetrics.reduce((sum, m) => sum + m.value * m.weight, 0);

  // 4. Check convergence conditions（P1-2: 历史 = 持久化轮次 + 当前轮，不再依赖进程内 Map）
  const allAboveMin = activeMetrics.every(m => m.value >= config.minAcceptable);
  const history = [...deriveHistory(ctx), progress];
  const stableMet = isStableConvergence(history, config.threshold, config.stabilityWindow);

  const goalAchieved = progress >= config.threshold && allAboveMin && stableMet;

  // 5. Generate recommendation
  const recommendation = buildRecommendation(activeMetrics, progress, goalAchieved, config);

  // 6. Advisory constraint-strength suggestions (freedom-metrics, human signoff required)
  const suggestions = buildSuggestions(metrics);

  return {
    progress,
    goalAchieved,
    metrics,
    recommendation,
    suggestions,
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

  // P1-2.3: 与 autoEvaluate 统一判据——单看 hybridProgress 会让 hybrid 模式绕过稳定窗口
  // 与 allAboveMin（E14 第三层）。复用 autoResult 的持久化 history 与归一化 metrics。
  const active = autoResult.metrics.filter(m => m.weight > 0);
  const allAboveMin = active.every(m => m.value >= config.minAcceptable);
  const stableMet = isStableConvergence(autoResult.history, config.threshold, config.stabilityWindow);
  const goalAchieved = hybridProgress >= config.threshold && allAboveMin && stableMet;

  return {
    ...autoResult,
    progress: hybridProgress,
    goalAchieved,
    recommendation: goalAchieved
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
  registerEvaluator(designBuildFirstPassEvaluator);
  registerEvaluator(constraintDensityEvaluator);
  // eval-corpus / DS-EVAL-003：两个 weight=0 的观测评估器（不进 composite，权重和仍 1.0）
  registerEvaluator(verifiableRatioEvaluator);
  registerEvaluator(failOpenCountEvaluator);
}

// ════════════════════════════════════════════════════════════════════
// Advisory Feedback (freedom-metrics)
// ════════════════════════════════════════════════════════════════════

/** First-pass target from goal.md north-star ("一次通过率 ≥ 80%"). */
export const FIRST_PASS_TARGET = 0.8;
/** Tighten branch threshold for first-pass rate. */
export const FIRST_PASS_TIGHTEN = 0.9;
/** Density above which low pass-rate suggests relaxation review. */
export const DENSITY_RELAX_THRESHOLD = 0.7;
/** Density below which high pass-rate suggests tightening review. */
export const DENSITY_TIGHTEN_THRESHOLD = 0.3;

interface SuggestionMetric {
  value: number;
}

function findMetric(metrics: MetricResult[], name: string): SuggestionMetric | undefined {
  const m = metrics.find((x) => x.name === name);
  return m ? { value: m.value } : undefined;
}

/**
 * Build advisory constraint-strength suggestions from THIS round's metrics.
 * Pure function over the collected MetricResult list — no I/O, no config
 * mutation (red line: no strength change without human signoff).
 */
export function buildSuggestions(metrics: MetricResult[]): string[] {
  const suggestions: string[] = [];
  const firstPass = findMetric(metrics, 'design-build-first-pass');
  const density = findMetric(metrics, 'constraint-density');
  if (!firstPass || !density) return suggestions; // never reference stale values

  const fp = firstPass.value.toFixed(2);
  const den = density.value.toFixed(2);

  if (firstPass.value < FIRST_PASS_TARGET && density.value > DENSITY_RELAX_THRESHOLD) {
    suggestions.push(
      `一次通过率 ${fp} 低于目标 ${FIRST_PASS_TARGET.toFixed(2)} 且约束密度 ${den} 高于 ${DENSITY_RELAX_THRESHOLD.toFixed(2)} → 建议评估放宽约束强度（须人工签收后生效）`,
    );
  } else if (firstPass.value >= FIRST_PASS_TIGHTEN && density.value < DENSITY_TIGHTEN_THRESHOLD) {
    suggestions.push(
      `一次通过率 ${fp} 达标且约束密度 ${den} 低于 ${DENSITY_TIGHTEN_THRESHOLD.toFixed(2)} → 建议评估收紧约束强度（须人工签收后生效）`,
    );
  }
  return suggestions;
}
