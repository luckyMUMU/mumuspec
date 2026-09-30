/**
 * Drafting aspect coverage — single source of truth (core-consolidation L1, R-0014).
 *
 * Aspects are the drafting-coverage axes of a spec/design artifact (does the
 * artifact talk about security? about concurrency?). They are orthogonal to
 * `ConstraintDimension` (technical_design / requirement_goals), which only
 * selects where a constraint's strength is tuned — the two vocabularies must
 * never be merged.
 *
 * Pure functions, no I/O: callers (cognitive-map sync, phase guard, CLI, MCP)
 * supply parsed artifacts. Verdict is identity-based — row counts can always be
 * satisfied by repeating one dimension, which is exactly how the security blind
 * spot used to be skipped while reporting `converged: true`.
 */

export type AspectId =
  | 'function'
  | 'boundary'
  | 'data'
  | 'concurrency'
  | 'compat'
  | 'performance'
  | 'security-compliance'
  | 'observability';

/** Enumeration order is the presentation order for reports and diagrams. */
export const ASPECTS: readonly AspectId[] = [
  'function',
  'boundary',
  'data',
  'concurrency',
  'compat',
  'performance',
  'security-compliance',
  'observability',
];

export const SECURITY_ASPECT: AspectId = 'security-compliance';

/** Aspects that can never be skipped, whatever the row count. */
export const REQUIRED_ASPECTS: readonly AspectId[] = [SECURITY_ASPECT];

/** Distinct aspects needed for Q4 convergence (mirrors cognitive_framework.q4_min_dimensions). */
export const DEFAULT_MIN_DISTINCT_ASPECTS = 3;

/** Minimal shape consumed from cognitive-map.yaml entries. */
export interface AspectEntry {
  quadrant: string;
  category?: string;
  question?: string;
  answer?: string;
  status?: string;
}

export interface AspectCoverage {
  /** Q4 rows, kept for the existing state field. */
  rows: number;
  /** Recognised aspects in first-seen order. */
  distinct: AspectId[];
  /** Non-empty labels outside the enum — surfaced, never counted as coverage. */
  unknown: string[];
  missingRequired: AspectId[];
}

export interface ConvergenceOpts {
  minDistinct?: number;
}

function isAspect(value: string): value is AspectId {
  return (ASPECTS as readonly string[]).includes(value);
}

/** Classify Q4 rows by aspect identity. Rows without a category carry no identity. */
export function classifyAspects(entries: readonly AspectEntry[]): AspectCoverage {
  const distinct: AspectId[] = [];
  const unknown: string[] = [];
  let rows = 0;
  for (const entry of entries) {
    if (entry.quadrant !== 'Q4') continue;
    rows++;
    const category = entry.category?.trim();
    if (!category) continue;
    if (isAspect(category)) {
      if (!distinct.includes(category)) distinct.push(category);
    } else if (!unknown.includes(category)) {
      unknown.push(category);
    }
  }
  return {
    rows,
    distinct,
    unknown,
    missingRequired: REQUIRED_ASPECTS.filter((a) => !distinct.includes(a)),
  };
}

/** Required aspects absent from the coverage set. */
export function missingRequiredAspects(cov: AspectCoverage): AspectId[] {
  return cov.missingRequired;
}

/**
 * Q4 convergence: every required aspect present AND at least `minDistinct`
 * distinct aspects covered. Row count alone never converges.
 */
export function isAspectCoverageConverged(
  cov: AspectCoverage,
  opts?: ConvergenceOpts,
): boolean {
  const minDistinct = opts?.minDistinct ?? DEFAULT_MIN_DISTINCT_ASPECTS;
  return cov.missingRequired.length === 0 && cov.distinct.length >= minDistinct;
}
