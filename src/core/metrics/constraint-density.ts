/**
 * Constraint Density Evaluator — freedom-metrics
 *
 * Measures normalized constraint density (SHALL + SHALL NOT count) over the
 * spec chain of the active change's affected scopes.
 *
 * Semantics (design D1, signed 2026-09-09T13:57:55.564Z):
 * - weight = 0: density is a REGULATION SIGNAL, not a progress signal. It is
 *   collected into AutoEvaluateResult.metrics for observation and advisory
 *   suggestions, but excluded from the convergence composite — otherwise high
 *   density would drag progress down and perversely reward spec deletion.
 * - value: normalized density [0,1] (higher = denser = less agent freedom).
 *
 * Data source: `mumuspec context <scope> --json` (same CLI-first spawn
 * discipline as spec-compliance — src/core must not import upper-layer
 * domains, arch-boundaries invariant). Scopes come from the change state
 * artifact (.mumuspec.yaml `affected_scopes`), falling back to root '.'.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getMumuSpecDir } from '../utils.js';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

/** Normalization cap: constraint counts at or above this saturate to 1.0. */
export const DENSITY_CAP = 150;

// ════════════════════════════════════════════════════════════════════
// Pure helpers (unit-tested directly)
// ════════════════════════════════════════════════════════════════════

interface RequirementLike {
  shall?: unknown;
  shallNot?: unknown;
}

/** Extract SHALL / SHALL NOT counts from a parsed `mumuspec context --json` report. */
export function extractConstraintCounts(context: unknown): { shall: number; shallNot: number } {
  let shall = 0;
  let shallNot = 0;
  const layers = (context as { layers?: unknown })?.layers;
  if (!Array.isArray(layers)) return { shall, shallNot };
  for (const layer of layers) {
    const reqs = (layer as { tech?: { requirements?: unknown } })?.tech?.requirements;
    if (!Array.isArray(reqs)) continue;
    for (const req of reqs as RequirementLike[]) {
      if (Array.isArray(req.shall)) shall += req.shall.length;
      if (Array.isArray(req.shallNot)) shallNot += req.shallNot.length;
    }
  }
  return { shall, shallNot };
}

/** Normalize a raw constraint count to [0,1] against DENSITY_CAP. */
export function normalizeDensity(total: number, cap: number = DENSITY_CAP): number {
  return Math.min(1, total / cap);
}

function readAffectedScopes(projectRoot: string, changeName: string): string[] {
  try {
    const statePath = join(getMumuSpecDir(projectRoot), 'changes', changeName, '.mumuspec.yaml');
    if (!existsSync(statePath)) return [];
    const state = parseYaml(readFileSync(statePath, 'utf8')) as { affected_scopes?: unknown } | null;
    const scopes = state?.affected_scopes;
    return Array.isArray(scopes) ? (scopes.filter(s => typeof s === 'string') as string[]) : [];
  } catch {
    return [];
  }
}

// ════════════════════════════════════════════════════════════════════
// Evaluator
// ════════════════════════════════════════════════════════════════════

export const constraintDensityEvaluator: Evaluator = {
  name: 'constraint-density',
  defaultWeight: 0,

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const scopes = readAffectedScopes(ctx.projectRoot, ctx.changeName);
    const effectiveScopes = scopes.length > 0 ? scopes : ['.'];
    const cwd = ctx.worktreePath || ctx.projectRoot;

    let shall = 0;
    let shallNot = 0;

    try {
      for (const scope of effectiveScopes) {
        const result = spawnSync(
          'npx',
          ['mumuspec', 'context', scope === '.' ? '.' : scope, '--json'],
          // ponytail: `npx` resolves to npx.cmd on Windows, which spawnSync cannot
          // exec without a shell — without this the metric silently degrades to
          // "skipped" on win32 and the freedom signal is never collected there.
          { cwd, encoding: 'utf-8', timeout: 30_000, shell: process.platform === 'win32' },
        );

        if (result.error || result.status !== 0) {
          return nullResult(
            `context command failed for scope "${scope}" (status: ${result.error ? result.error.message : result.status})`,
          );
        }

        // `context --json` emits pretty-printed multi-line JSON — slicing from the
        // first brace (rather than taking the first `{`-prefixed LINE) is what makes
        // this survive the real CLI output instead of only mocked single-line stdout.
        const stdout = (result.stdout ?? '').trim();
        const jsonStart = stdout.indexOf('{');
        if (jsonStart < 0) {
          return nullResult(`context produced no JSON output for scope "${scope}"`);
        }

        const counts = extractConstraintCounts(JSON.parse(stdout.slice(jsonStart)));
        shall += counts.shall;
        shallNot += counts.shallNot;
      }
    } catch (err) {
      return nullResult(`constraint density collection failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const total = shall + shallNot;
    if (total === 0) {
      return nullResult('no SHALL/SHALL NOT constraints found in spec chain');
    }

    const value = normalizeDensity(total);
    return {
      name: 'constraint-density',
      value,
      weight: 0,
      details: `${total} constraints (SHALL ${shall} / SHALL NOT ${shallNot}) across ${effectiveScopes.length} scope(s); normalized ${value.toFixed(3)} (cap ${DENSITY_CAP})`,
      rawData: { shall, shallNot, total, scopes: effectiveScopes, cap: DENSITY_CAP },
    };
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: 'constraint-density',
    value: 0,
    weight: 0,
    details,
    rawData: { shall: 0, shallNot: 0, total: 0, scopes: [], cap: DENSITY_CAP },
  };
}
