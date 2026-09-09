/**
 * Design→Build First-Pass Evaluator — freedom-metrics
 *
 * Derives the goal.md north-star metric "Design→Build 一次通过率 ≥ 80%"
 * objectively from change state artifacts: the ratio of changes whose
 * rollback_count and rebuild_count are both 0.
 *
 * Discipline (delta-spec SHALL NOT, design signed 2026-09-09T13:57:55.564Z):
 * the metric is computed by code from state artifacts — never hand-written
 * by an LLM (same rule as hash-class fields).
 *
 * Identification (AS-1, signed): a change is recognized by the presence of
 * .mumuspec.yaml — directory naming is never used as a proxy, so special
 * directories (discarded/ etc.) without a state file are skipped naturally.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getMumuSpecDir } from '../utils.js';
import type { Evaluator, EvaluatorContext, MetricResult } from './types.js';

/** Default weight in the composite (design D2, sums to 1 with the rest). */
export const FIRST_PASS_DEFAULT_WEIGHT = 0.2;

interface ChangeStateCounts {
  rollback_count?: unknown;
  rebuild_count?: unknown;
}

function readCounts(statePath: string): { rollback: number; rebuild: number } | null {
  try {
    const state = parseYaml(readFileSync(statePath, 'utf8')) as ChangeStateCounts | null;
    if (state === null || typeof state !== 'object') return null;
    const rollback = typeof state.rollback_count === 'number' ? state.rollback_count : 0;
    const rebuild = typeof state.rebuild_count === 'number' ? state.rebuild_count : 0;
    return { rollback, rebuild };
  } catch {
    return null; // unparseable state → skip rather than miscount
  }
}

export const designBuildFirstPassEvaluator: Evaluator = {
  name: 'design-build-first-pass',
  defaultWeight: FIRST_PASS_DEFAULT_WEIGHT,

  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    try {
      // Archive changes + active changes. Scanning is by direct children that
      // carry a .mumuspec.yaml; the nested archive/ directory under changes/
      // has no state file at its root and is skipped naturally.
      // (Path computation stays inside core — arch-boundaries invariant.)
      const changesRoot = join(getMumuSpecDir(ctx.projectRoot), 'changes');
      const roots = [join(changesRoot, 'archive'), changesRoot];
      let firstPass = 0;
      let total = 0;
      const scanned: string[] = [];

      for (const root of roots) {
        if (!existsSync(root)) continue;
        for (const entry of readdirSync(root, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const statePath = join(root, entry.name, '.mumuspec.yaml');
          if (!existsSync(statePath)) continue;
          const counts = readCounts(statePath);
          if (counts === null) continue;
          total += 1;
          scanned.push(entry.name);
          if (counts.rollback === 0 && counts.rebuild === 0) firstPass += 1;
        }
      }

      if (total === 0) {
        return nullResult('no change state artifacts found (archive + active)');
      }

      const value = firstPass / total;
      return {
        name: 'design-build-first-pass',
        value,
        weight: FIRST_PASS_DEFAULT_WEIGHT,
        details: `${firstPass}/${total} changes reached build without rollback/rebuild (${Math.round(value * 100)}%)`,
        rawData: { firstPass, total, scanned },
      };
    } catch (err) {
      return nullResult(`change state scan failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  },
};

function nullResult(details: string): MetricResult {
  return {
    name: 'design-build-first-pass',
    value: 0,
    weight: 0,
    details,
    rawData: { firstPass: 0, total: 0, scanned: [] },
  };
}
