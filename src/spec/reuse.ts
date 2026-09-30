/**
 * Constraint reuse planning (core-consolidation L4, R-0018).
 *
 * Reuse is not copy-paste: a reused entry must carry an upstream source, because
 * a constraint without one is an over-reaching constraint (E-CONSTRAINT-001
 * already treats it as such). Reuse also may not loosen strength — a lower layer
 * may tighten, never relax.
 *
 * Pure planning: it decides what would be written and why a request is refused;
 * the caller performs the I/O.
 */

import type {
  ConstraintEntry,
  ConstraintStrength,
  ConstraintsFile,
} from '../core/types-constraint.js';

const STRENGTH_ORDER: Record<ConstraintStrength, number> = { low: 0, medium: 1, high: 2 };

type Direction = 'forward' | 'reverse';
type Dimension = 'technical_design' | 'requirement_goals';

export interface LocatedConstraint {
  entry: ConstraintEntry;
  direction: Direction;
  dimension: Dimension;
  scope: string;
}

export type ReuseRefusal =
  | { code: 'E-SPEC-016'; reason: 'source-scope-missing' | 'entry-not-found' | 'no-upstream-source'; detail: string }
  | { code: 'E-SPEC-017'; reason: 'strength-loosening'; detail: string };

export type ReusePlan =
  | { ok: true; located: LocatedConstraint; reuseId: string; min_strength: ConstraintStrength }
  | { ok: false; refusal: ReuseRefusal; available?: string[] };

/** Walk every entry of every loaded constraints file with its coordinates. */
export function listConstraints(files: readonly ConstraintsFile[]): LocatedConstraint[] {
  const out: LocatedConstraint[] = [];
  for (const file of files) {
    const scope = file.scope ?? '.';
    for (const direction of ['forward', 'reverse'] as const) {
      for (const dimension of ['technical_design', 'requirement_goals'] as const) {
        for (const entry of file[direction]?.[dimension] ?? []) {
          out.push({ entry, direction, dimension, scope });
        }
      }
    }
  }
  return out;
}

/** Identifier for the reused copy: unique per (source scope, source id). */
export function reuseId(fromScope: string, id: string): string {
  const tag = fromScope.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'root';
  return `${id}@${tag}`;
}

export function planConstraintReuse(
  files: readonly ConstraintsFile[],
  opts: { id: string; fromScope?: string; tighten?: ConstraintStrength },
): ReusePlan {
  const located = listConstraints(files).filter(
    (c) => c.entry.id === opts.id && (!opts.fromScope || c.scope === opts.fromScope),
  );

  if (located.length === 0) {
    const wanted = opts.fromScope ? `${opts.fromScope}#${opts.id}` : opts.id;
    const scopeExists =
      !opts.fromScope || files.some((f) => (f.scope ?? '.') === opts.fromScope);
    // When the requested scope itself is unknown, listing scopes that do exist
    // is what makes the failure actionable.
    const available = listConstraints(files)
      .filter((c) => !opts.fromScope || !scopeExists || c.scope === opts.fromScope)
      .map((c) => `${c.scope}#${c.entry.id}`);
    return {
      ok: false,
      refusal: {
        code: 'E-SPEC-016',
        reason: scopeExists ? 'entry-not-found' : 'source-scope-missing',
        detail: `找不到可复用的约束 "${wanted}"`,
      },
      available,
    };
  }

  const source = located[0];
  const upstream = source.entry.source_specs ?? [];
  if (upstream.length === 0) {
    return {
      ok: false,
      refusal: {
        code: 'E-SPEC-016',
        reason: 'no-upstream-source',
        detail:
          `来源约束 ${source.scope}#${source.entry.id} 自身没有上游来源，` +
          `复用它会扩散越权约束——先为它补 source_specs`,
      },
    };
  }

  const base = STRENGTH_ORDER[source.entry.min_strength] ?? 0;
  if (opts.tighten && STRENGTH_ORDER[opts.tighten] < base) {
    return {
      ok: false,
      refusal: {
        code: 'E-SPEC-017',
        reason: 'strength-loosening',
        detail:
          `不得放宽来源强度：来源为 ${source.entry.min_strength}，` +
          `请求为 ${opts.tighten}（只可收紧）`,
      },
    };
  }

  return {
    ok: true,
    located: source,
    reuseId: reuseId(source.scope, source.entry.id),
    min_strength: opts.tighten ?? source.entry.min_strength,
  };
}

/** The entry as it should be written into the target scope. */
export function buildReusedEntry(
  plan: Extract<ReusePlan, { ok: true }>,
  target: { layer: number; scope: string },
): ConstraintEntry {
  const { entry } = plan.located;
  return {
    id: plan.reuseId,
    content: entry.content,
    min_strength: plan.min_strength,
    enforcement: entry.enforcement,
    ...(entry.annotation ? { annotation: entry.annotation } : {}),
    category: entry.category,
    ...(entry.always_enforce ? { always_enforce: true } : {}),
    source_specs: [...(entry.source_specs ?? [])],
    layer: target.layer,
    scope: target.scope,
    inherited: true,
    tightens: {
      layer: target.layer,
      scope: target.scope,
      id: entry.id,
    },
  };
}
