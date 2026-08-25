/**
 * Runtime Blocking Point Registry — LLM Freedom Enhancement (P1)
 *
 * Provides a runtime API for dynamically registering blocking points
 * beyond the static definitions in workflow.yaml.
 *
 * Use case: plugins or skills can register phase-specific blocking points
 * that are not known at CLI compile time (e.g., security-audit-check,
 * custom-compliance-gate).
 *
 * Storage: in-memory, process-scoped (not persisted to disk).
 */

import type { ChangePhase } from './types-workflow.js';

/** A blocking point that can be checked during phase transitions */
export interface BlockingPoint {
  /** Unique identifier (e.g., 'BP-99', 'security-audit') */
  id: string;
  /** Human-readable description */
  description: string;
  /** Which phase this BP gates */
  phase: ChangePhase;
  /** Whether this BP must be satisfied to proceed */
  required: boolean;
  /** Optional async resolver that attempts to fix the blocking point */
  resolver?: (ctx: BPPassContext) => Promise<BPSolution>;
}

/** Context passed to a BP resolver */
export interface BPPassContext {
  changeName: string;
  projectRoot: string;
  phase: ChangePhase;
  state: Record<string, unknown>;
}

/** Result of a BP resolution attempt */
export interface BPSolution {
  /** Whether the resolution succeeded */
  resolved: boolean;
  /** Human-readable message about what was done */
  message: string;
  /** Optional metadata for logging/auditing */
  metadata?: Record<string, string>;
}

// ─── In-memory registry ───

const registry = new Map<string, BlockingPoint>();

/**
 * Register a blocking point at runtime.
 *
 * If a BP with the same ID already exists, it is overwritten.
 */
export function registerBP(bp: BlockingPoint): void {
  registry.set(bp.id, { ...bp });
}

/**
 * Get the current runtime BP registry (read-only copy).
 */
export function getBPRegistry(): ReadonlyMap<string, BlockingPoint> {
  return new Map(registry);
}

/**
 * Look up a single blocking point by ID.
 */
export function getBP(id: string): BlockingPoint | undefined {
  return registry.get(id);
}

/**
 * Check if a blocking point with the given ID is registered.
 */
export function hasBP(id: string): boolean {
  return registry.has(id);
}

/**
 * Remove a single blocking point from the registry.
 */
export function unregisterBP(id: string): boolean {
  return registry.delete(id);
}

/**
 * Clear all runtime-registered blocking points.
 *
 * Intended for testing and CLI reset scenarios.
 */
export function clearBPRegistry(): void {
  registry.clear();
}

/**
 * Get all blocking points for a specific phase.
 */
export function getBPForPhase(phase: ChangePhase): BlockingPoint[] {
  return Array.from(registry.values()).filter((bp) => bp.phase === phase);
}

/**
 * Attempt to resolve a blocking point by running its resolver.
 *
 * Returns null if no resolver is attached.
 * Returns BPSolution with resolved=false if the resolver throws.
 */
export async function resolveBP(
  id: string,
  ctx: BPPassContext,
): Promise<BPSolution | null> {
  const bp = registry.get(id);
  if (!bp || !bp.resolver) {
    return null;
  }

  try {
    return await bp.resolver(ctx);
  } catch (err) {
    return {
      resolved: false,
      message: `Resolver for '${id}' threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
