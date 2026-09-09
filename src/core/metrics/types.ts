/**
 * Metrics Types — Auto-Evaluate Engine (R-0002)
 *
 * Defines the Evaluator interface and result types for objective
 * metric-driven Loop convergence judgment.
 */

import type { LoopRound } from '../types-loop.js';

// ════════════════════════════════════════════════════════════════════
// Core Interfaces
// ════════════════════════════════════════════════════════════════════

/** Context passed to each Evaluator for metric collection. */
export interface EvaluatorContext {
  /** Project root directory */
  projectRoot: string;
  /** Active change name */
  changeName: string;
  /** Worktree path (if loop uses worktree isolation) */
  worktreePath?: string;
  /** Previous round number (0 if first round) */
  previousRound?: number;
  /** Full round history for trend analysis */
  roundHistory: LoopRound[];
}

/** Result from a single metric collector. */
export interface MetricResult {
  /** Unique metric identifier */
  name: string;
  /** Normalized value [0, 1] */
  value: number;
  /** Weight in composite score (normalized to sum=1 across active metrics) */
  weight: number;
  /** Human-readable detail message */
  details: string;
  /** Raw data for HTML reporting */
  rawData?: unknown;
}

/** Evaluator interface — each metric implements this contract. */
export interface Evaluator {
  /** Unique metric name */
  readonly name: string;
  /** Default weight when all metrics are available */
  readonly defaultWeight: number;
  /** Collect metric from the current loop state */
  evaluate(ctx: EvaluatorContext): Promise<MetricResult>;
}

// ════════════════════════════════════════════════════════════════════
// Auto-Evaluate Results
// ════════════════════════════════════════════════════════════════════

/** Convergence configuration for auto-evaluate mode. */
export interface ConvergenceConfig {
  /** Progress threshold to consider "done" (default: 0.85) */
  threshold: number;
  /** Number of consecutive rounds above threshold to confirm convergence (default: 3) */
  stabilityWindow: number;
  /** Minimum acceptable value for any single metric (default: 0.5) */
  minAcceptable: number;
}

/** Result of auto-evaluate computation. */
export interface AutoEvaluateResult {
  /** Composite progress score [0, 1] */
  progress: number;
  /** Whether convergence is confirmed */
  goalAchieved: boolean;
  /** Per-metric breakdown */
  metrics: MetricResult[];
  /** Recommendation for next round */
  recommendation: string;
  /** Advisory constraint-strength suggestions (freedom-metrics; human signoff required to act) */
  suggestions?: string[];
  /** History of recent composite scores (for stability check) */
  history: number[];
}

/** Loop evaluation mode. */
export type EvaluateMode = 'manual' | 'auto' | 'hybrid';

/** Hybrid evaluation configuration. */
export interface HybridConfig {
  /** Weight for auto-evaluated metrics (0.0-1.0), default 0.7 */
  autoWeight: number;
  /** Manual progress override weight (0.0-1.0), default 0.3 */
  manualWeight: number;
}

/** Metric snapshot from one evaluation round (persisted in LoopState). */
export interface MetricsSnapshot {
  round: number;
  timestamp: string;
  progress: number;
  goalAchieved: boolean;
  metrics: Array<{ name: string; value: number; details: string }>;
}

// ════════════════════════════════════════════════════════════════════
// Default Configurations
// ════════════════════════════════════════════════════════════════════

export const DEFAULT_CONVERGENCE_CONFIG: ConvergenceConfig = {
  threshold: 0.85,
  stabilityWindow: 3,
  minAcceptable: 0.5,
};

export const DEFAULT_HYBRID_CONFIG: HybridConfig = {
  autoWeight: 0.7,
  manualWeight: 0.3,
};

// W1 (CHG 2026-09-09-review-followup-hardening): DEFAULT_EVALUATOR_WEIGHTS removed.
// The single source of truth for evaluator weights is each evaluator's
// `defaultWeight` property (consumed via MetricResult.weight in auto-evaluate).
// Invariant (enforced by tests/core/metrics/freedom-suggestions.test.ts):
// built-in active (defaultWeight > 0) weights sum to 1; constraint-density = 0.
