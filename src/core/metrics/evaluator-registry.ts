/**
 * Evaluator Registry — Auto-Evaluate Engine (R-0002)
 *
 * Manages registration and lookup of metric evaluators.
 * Provides a central place to enable/disable individual metrics.
 */

import type { Evaluator } from './types.js';

// ════════════════════════════════════════════════════════════════════
// Registry State
// ════════════════════════════════════════════════════════════════════

const registry = new Map<string, Evaluator>();
const disabledSet = new Set<string>();

// ════════════════════════════════════════════════════════════════════
// Registration API
// ════════════════════════════════════════════════════════════════════

/** Register an evaluator. Replaces existing evaluator with the same name. */
export function registerEvaluator(evaluator: Evaluator): void {
  registry.set(evaluator.name, evaluator);
}

/** Remove an evaluator from the registry. */
export function unregisterEvaluator(name: string): boolean {
  disabledSet.delete(name);
  return registry.delete(name);
}

/** Get an evaluator by name. Returns null if not found or disabled. */
export function getEvaluator(name: string): Evaluator | null {
  if (disabledSet.has(name)) return null;
  return registry.get(name) ?? null;
}

/** Get all registered (and not disabled) evaluators. */
export function getActiveEvaluators(): Evaluator[] {
  const result: Evaluator[] = [];
  for (const [name, evaluator] of registry) {
    if (!disabledSet.has(name)) {
      result.push(evaluator);
    }
  }
  return result;
}

/** Check if an evaluator is registered and active. */
export function hasEvaluator(name: string): boolean {
  return registry.has(name) && !disabledSet.has(name);
}

/** Disable an evaluator (it won't be used in composite calculations). */
export function disableEvaluator(name: string): void {
  if (registry.has(name)) {
    disabledSet.add(name);
  }
}

/** Enable a previously disabled evaluator. */
export function enableEvaluator(name: string): void {
  disabledSet.delete(name);
}

/** Get the count of active evaluators. */
export function getActiveEvaluatorCount(): number {
  let count = 0;
  for (const name of registry.keys()) {
    if (!disabledSet.has(name)) count++;
  }
  return count;
}

/** Clear the entire registry (used in tests). */
export function clearEvaluatorRegistry(): void {
  registry.clear();
  disabledSet.clear();
}
