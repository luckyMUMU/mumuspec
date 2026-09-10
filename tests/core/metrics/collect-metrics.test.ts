/**
 * Tests — read-only metric collection (freedom-metrics-loop-closure ENF-3 / ENF-4).
 *
 * `collectMetrics` is the collection path used by the read-only `metrics`
 * command. Unlike `autoEvaluate` it must NOT call `recordProgress` (which feeds
 * the convergence stability window) and must NOT touch any file on disk.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  collectMetrics,
  autoEvaluate,
  registerBuiltInEvaluators,
  clearHistory,
} from '../../../src/core/metrics/auto-evaluate.js';
import {
  clearEvaluatorRegistry,
  registerEvaluator,
  getEvaluator,
} from '../../../src/core/metrics/evaluator-registry.js';
import type { Evaluator, EvaluatorContext, MetricResult } from '../../../src/core/metrics/types.js';

function mockEvaluator(name: string, value: number, weight: number): Evaluator {
  return {
    name,
    defaultWeight: weight,
    async evaluate(): Promise<MetricResult> {
      return { name, value, weight, details: `${name}: ${value}` };
    },
  };
}

/** Recursively snapshot file contents so any write is detectable. */
function snapshotTree(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      Object.assign(out, snapshotTree(full));
    } else {
      out[full] = readFileSync(full, 'utf8');
    }
  }
  return out;
}

let root: string;

beforeEach(() => {
  clearEvaluatorRegistry();
  clearHistory('ro-test');
  root = mkdtempSync(join(tmpdir(), 'mumuspec-metrics-'));
  mkdirSync(join(root, '.mumuspec', 'changes', 'ro-change'), { recursive: true });
  writeFileSync(
    join(root, '.mumuspec', 'changes', 'ro-change', '.mumuspec.yaml'),
    'name: ro-change\nphase: build\nrollback_count: 0\nrebuild_count: 0\n',
    'utf8'
  );
});

afterEach(() => {
  clearEvaluatorRegistry();
  rmSync(root, { recursive: true, force: true });
});

const ctx = (): EvaluatorContext => ({ projectRoot: root, changeName: 'ro-test', roundHistory: [] });

describe('collectMetrics — collection contract (ENF-3)', () => {
  it('returns results from every registered evaluator', async () => {
    registerEvaluator(mockEvaluator('alpha', 0.5, 0.5));
    registerEvaluator(mockEvaluator('beta', 0.75, 0.5));

    const metrics = await collectMetrics(ctx());
    expect(metrics.map((m) => m.name).sort()).toEqual(['alpha', 'beta']);
  });

  it('drops failing evaluators instead of substituting a fake value', async () => {
    registerEvaluator(mockEvaluator('ok', 0.5, 0.5));
    registerEvaluator({
      name: 'boom',
      defaultWeight: 0.5,
      async evaluate(): Promise<MetricResult> {
        throw new Error('collection failed');
      },
    });

    const metrics = await collectMetrics(ctx());
    expect(metrics.map((m) => m.name)).toEqual(['ok']);
  });

  it('registers the two freedom-metrics evaluators among the built-ins', () => {
    registerBuiltInEvaluators();
    expect(getEvaluator('constraint-density')).not.toBeNull();
    expect(getEvaluator('design-build-first-pass')).not.toBeNull();
  });
});

describe('collectMetrics — read-only guarantees (ENF-4)', () => {
  it('does not write anything to disk', async () => {
    registerEvaluator(mockEvaluator('alpha', 0.5, 0.5));
    const before = snapshotTree(root);

    await collectMetrics(ctx());
    await collectMetrics(ctx());

    expect(snapshotTree(root)).toEqual(before);
  });

  it('does not feed the convergence history (no recordProgress side effect)', async () => {
    registerEvaluator(mockEvaluator('alpha', 0.9, 1));

    // Five read-only collections must leave the stability window untouched.
    for (let i = 0; i < 5; i++) {
      await collectMetrics(ctx());
    }

    const evaluated = await autoEvaluate(ctx());
    // stabilityWindow default is 3 — a single recorded round can never converge,
    // so a longer history here would prove collectMetrics leaked into it.
    expect(evaluated.history).toHaveLength(1);
    expect(evaluated.goalAchieved).toBe(false);
  });
});
