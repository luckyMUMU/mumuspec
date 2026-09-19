/**
 * ConstraintEvaluator — runtime strength evaluation (0.12.1+).
 *
 * Implements the evaluation algorithm defined in
 * docs/design/constraint-strength.md §9 "求值流程".
 *
 * Given a `ConstraintCheck` (a single guard / phase-guard check item with
 * `min_strength` and optional `always_enforce`) and a `ConstraintStrengthField`
 * (the project's effective strength configuration), produces an
 * `ConstraintEvalResult` with `{ action: 'block' | 'warn' | 'info', reason }`.
 *
 * Evaluation order (per §9.1):
 *   1. Exception list / always_enforce → always block
 *   2. Explicit override (non-`inherit`) → use override value
 *   3. Action by current strength (high=block, medium=warn, low=info);
 *      `min_strength` only affects the reason text, NOT the action.
 *
 * This is a pure function — no I/O. Callers (Guard Layer, CLI, MCP) pass in
 * already-loaded config and check descriptors.
 */

import type {
  ConstraintStrength,
  ConstraintDimension,
  ConstraintEvalResult,
} from './types.js';
import type { ConstraintStrengthField, WorkflowOverride, CapabilityOverride } from './config.js';
import {
  STRENGTH_ACTION_MAP,
  strengthRank,
  BUILTIN_CONSTRAINT_EXCEPTIONS,
} from './config.js';
import type { Severity } from './types-constraint.js';
import { ERROR_CODES } from './errors.js';

/**
 * Deterministically suggest a constraint strength from its metadata
 * (severity-dominant, class-dominant fallback). Pure function — the suggestion
 * is advisory only; it is never written to config (constraint_strength changes
 * still require human sign-off).
 */
export function suggestStrengthFor(input: {
  severity?: Severity;
}): ConstraintStrength {
  if (input.severity) {
    switch (input.severity) {
      case 'ERROR': return 'high';
      case 'WARN': return 'medium';
      case 'INFO': return 'low';
    }
  }
  return 'low';
}

/** One strength deviation observation: suggested (severity-derived) exceeds actual. */
export interface StrengthDeviation {
  code: string;
  severity: Severity;
  dimension: ConstraintDimension;
  suggested: ConstraintStrength;
  actual: ConstraintStrength;
}

/**
 * Sweep the ERROR_CODES registry and report deviations where the
 * severity-derived suggestion ranks above the configured dimension strength.
 * Deterministic and code-derived; advisory only (no writes, no sign-off bypass).
 */
export function collectStrengthDeviations(
  config: ConstraintStrengthField,
): StrengthDeviation[] {
  const deviations: StrengthDeviation[] = [];
  if (!config) return deviations;
  for (const [code, def] of Object.entries(ERROR_CODES)) {
    if (!def.severity || !def.dimension) continue;
    const dimension = def.dimension as ConstraintDimension;
    if (!(dimension in config)) continue;
    const suggested = suggestStrengthFor({ severity: def.severity });
    const actual = config[dimension];
    if (strengthRank(suggested) > strengthRank(actual)) {
      deviations.push({ code, severity: def.severity, dimension, suggested, actual });
    }
  }
  return deviations;
}

/**
 * A single guard / phase-guard check item, annotated with strength metadata.
 *
 * Mirrors the design's `ConstraintCheck` interface (§9.2). Built by Guard
 * Layer code from `phase-guards.md` tables or from `ConstraintEntry` records
 * loaded out of `constraints.yaml`.
 */
export interface ConstraintCheck {
  /** Unique check id, e.g. "open_to_design:proposal_md_exists" or "TD-SHALL-001" */
  id: string;
  /** Which dimension this check belongs to (TD / RG) */
  dimension: ConstraintDimension;
  /** Minimum strength at which this check is enforced */
  min_strength: ConstraintStrength;
  /**
   * If true, this check is always enforced regardless of strength level
   * (exception list). Same as appearing in `BUILTIN_CONSTRAINT_EXCEPTIONS`.
   */
  always_enforce?: boolean;
  /**
   * Optional capability key for explicit overrides. When set, the evaluator
   * looks up `config.overrides[capabilityKey]`; if non-`inherit`, that value
   * takes priority over the dimension's strength level.
   *
   * Example: `'cognitive_framework'` → reads `config.overrides.cognitive_framework`.
   *
   * Note: this excludes `workflow` (which is a nested object, not a
   * `CapabilityOverride`); workflow rule overrides go through `workflowRule`.
   */
  capabilityOverride?: 'cognitive_framework' | 'hyperplan' | 'brainstorming' | 'test_immutability' | 'impact_analysis';
  /**
   * Optional workflow rule key for explicit overrides. When set, the evaluator
   * looks up `config.overrides.workflow[workflowRule]`; if non-`inherit`, that
   * value takes priority.
   *
   * Example: `'worktree_isolation'` → reads `config.overrides.workflow.worktree_isolation`.
   */
  workflowRule?: 'worktree_isolation' | 'single_active_change' | 'top_down_design' | 'tdd_enforced';
}

/**
 * Evaluate a single `ConstraintCheck` against the project's strength config.
 *
 * Returns `{ action, reason, check_id, dimension }`. The `action` field
 * tells the caller what to do:
 *   - `'block'` — Pre-commit / Phase Guard should abort
 *   - `'warn'`  — output WARN, record to decisions.md, do NOT abort
 *   - `'info'`  — output INFO, only aggregate in verify.md
 *
 * @see docs/design/constraint-strength.md §9.2
 */
export function evaluateConstraint(
  check: ConstraintCheck,
  config: ConstraintStrengthField,
): ConstraintEvalResult {
  // 1. Exception list / always_enforce → always block, regardless of strength.
  //    Per §3.2, these constraints cannot be downgraded.
  if (
    check.always_enforce ||
    BUILTIN_CONSTRAINT_EXCEPTIONS.includes(check.id)
  ) {
    return {
      action: 'block',
      reason: `exception: always enforce (check "${check.id}" is in BUILTIN_CONSTRAINT_EXCEPTIONS or marked always_enforce)`,
      check_id: check.id,
      dimension: check.dimension,
    };
  }

  // 2. Explicit workflow override (non-`inherit`) takes priority over strength.
  if (check.workflowRule) {
    const override = config.overrides?.workflow?.[check.workflowRule];
    if (override && override !== 'inherit') {
      // `override` is `'true' | 'false'` (WorkflowOverride excluding 'inherit').
      // `true` → enforce as block (the rule is explicitly on).
      // `false` → skip entirely (the rule is explicitly off).
      return override === 'true'
        ? {
            action: 'block',
            reason: `workflow override: ${check.workflowRule}=true (explicitly enforced)`,
            check_id: check.id,
            dimension: check.dimension,
          }
        : {
            action: 'info',
            reason: `workflow override: ${check.workflowRule}=false (explicitly disabled)`,
            check_id: check.id,
            dimension: check.dimension,
          };
    }
  }

  // 3. Explicit capability override (non-`inherit`) takes priority.
  if (check.capabilityOverride) {
    const override = config.overrides?.[check.capabilityOverride];
    if (override && override !== 'inherit') {
      return actionFromCapabilityOverride(override, check);
    }
  }

  // 4. Action by current strength level.
  //    high → block, medium → warn, low → info.
  //
  // The action is determined by the current strength alone; `min_strength`
  // does NOT downgrade the action. Rationale (per design §9.2 and the test
  // suite at tests/constraint-strength.test.ts):
  //   - A check with `min_strength=high` at `medium` strength still fires
  //     as `warn` (not skipped to `info`) — the project has chosen a softer
  //     posture, but the check is still relevant.
  //   - At `low` strength the action naturally becomes `info` via
  //     STRENGTH_ACTION_MAP; `min_strength` only affects the reason text
  //     so callers can see "this check would have blocked at high strength".
  const currentStrength = config[check.dimension];
  const action = STRENGTH_ACTION_MAP[currentStrength];
  const below = strengthRank(currentStrength) < strengthRank(check.min_strength);
  return {
    action,
    reason: below
      ? `${check.dimension} strength=${currentStrength} < min_strength=${check.min_strength} (downgraded to ${action})`
      : `${check.dimension} strength=${currentStrength} ≥ min_strength=${check.min_strength}`,
    check_id: check.id,
    dimension: check.dimension,
  };
}

/**
 * Map a `CapabilityOverride` value to an enforcement action.
 *
 * `CapabilityOverride` is a union: `'inherit' | 'required' | 'optional' |
 * 'conditional' | 'lightweight' | 'recommended' | 'strict' | 'design_only' |
 * 'off'`. The caller has already excluded `'inherit'` (handled in step 3).
 */
function actionFromCapabilityOverride(
  override: Exclude<CapabilityOverride, 'inherit'>,
  check: ConstraintCheck,
): ConstraintEvalResult {
  // 'required' / 'strict' → block
  // 'recommended' / 'optional' / 'conditional' / 'lightweight' / 'design_only' → warn
  // 'off' → info
  let action: ConstraintEvalResult['action'];
  switch (override) {
    case 'required':
    case 'strict':
      action = 'block';
      break;
    case 'recommended':
    case 'optional':
    case 'conditional':
    case 'lightweight':
    case 'design_only':
      action = 'warn';
      break;
    case 'off':
      action = 'info';
      break;
    default:
      // Defensive — exhaustiveness check via `never`.
      const _exhaustive: never = override;
      throw new Error(`actionFromCapabilityOverride: unhandled override "${String(_exhaustive)}"`);
  }
  return {
    action,
    reason: `capability override: ${String(check.capabilityOverride)}=${override}`,
    check_id: check.id,
    dimension: check.dimension,
  };
}

/**
 * Batch-evaluate multiple checks, partitioning results by action.
 *
 * Convenience wrapper for Guard Layer code that wants to know "which checks
 * block, which warn, which are info" without iterating results manually.
 */
export function evaluateChecks(
  checks: ConstraintCheck[],
  config: ConstraintStrengthField,
): {
  results: ConstraintEvalResult[];
  blockers: ConstraintEvalResult[];
  warnings: ConstraintEvalResult[];
  infos: ConstraintEvalResult[];
} {
  const results = checks.map((c) => evaluateConstraint(c, config));
  const blockers = results.filter((r) => r.action === 'block');
  const warnings = results.filter((r) => r.action === 'warn');
  const infos = results.filter((r) => r.action === 'info');
  return { results, blockers, warnings, infos };
}

/**
 * Resolve the effective value of a workflow rule, accounting for both
 * explicit overrides and strength-derived defaults.
 *
 * Used by Change Layer / Guard Layer to answer questions like:
 *   "Is worktree_isolation currently in effect?"
 *
 * Resolution order:
 *   1. `config.overrides.workflow.<rule>` if non-`inherit` → explicit true/false
 *   2. `WORKFLOW_STRENGTH_MATRIX[strength.<dim>][<rule>]` → strength-derived
 *   3. Fallback: `true` (safest posture)
 *
 * Note: this function does NOT consult `config.workflow.<rule>` (the legacy
 * boolean field). Per the 0.12.0 migration, the strength-aware path is
 * authoritative. The legacy `workflow.*` booleans on `MumuSpecConfig` are
 * populated from the same matrix during `getDefaultConfig()` and kept in
 * sync by `loadConfig()` — callers that want the raw config value can read
 * it directly.
 */
export function resolveWorkflowRule(
  rule: 'worktree_isolation' | 'single_active_change' | 'top_down_design' | 'tdd_enforced',
  config: ConstraintStrengthField,
  workflowRuleDimension: Readonly<Record<typeof rule, ConstraintDimension>>,
  workflowStrengthMatrix: Readonly<
    Record<ConstraintStrength, Record<typeof rule, boolean>>
  >,
): boolean {
  // 1. Explicit override wins.
  const override: WorkflowOverride | undefined = config.overrides?.workflow?.[rule];
  if (override === 'true') return true;
  if (override === 'false') return false;
  // `undefined` or `'inherit'` → fall through to strength-derived value.

  // 2. Strength-derived value from the matrix.
  const dimension = workflowRuleDimension[rule];
  const strength = config[dimension];
  return workflowStrengthMatrix[strength][rule];
}
