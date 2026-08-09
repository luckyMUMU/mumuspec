/**
 * Metrics Module — Auto-Evaluate Engine (R-0002)
 *
 * Barrel export for the metrics subsystem.
 */

export * from './types.js';
export * from './evaluator-registry.js';
export * from './auto-evaluate.js';
export { testPassRateEvaluator } from './test-pass-rate.js';
export { driftScoreEvaluator } from './drift-score.js';
export { specComplianceEvaluator } from './spec-compliance.js';
export { codeDeltaEvaluator } from './code-delta.js';
export { generateHtmlReport } from './html-reporter.js';
