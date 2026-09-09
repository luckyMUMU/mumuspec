/**
 * Unit Tests — advisory feedback suggestions (freedom-metrics)
 *
 * Covers ENF-3 of delta-spec freedom-metrics:
 * - 建议必须引用本轮 metric 数值
 * - 低通过率 + 高密度 → 放宽建议；高通过 + 低密度 → 收紧建议
 * - 指标缺失 → 无建议（禁止引用 stale 数值）
 * - weight=0 指标不进 composite；建议产出不修改任何配置文件
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildSuggestions,
  autoEvaluate,
  registerBuiltInEvaluators,
  clearHistory,
} from '../../../src/core/metrics/auto-evaluate.js';
import {
  clearEvaluatorRegistry,
  registerEvaluator,
} from '../../../src/core/metrics/evaluator-registry.js';
import { getActiveEvaluators } from '../../../src/core/metrics/evaluator-registry.js';
import type { Evaluator, EvaluatorContext, MetricResult } from '../../../src/core/metrics/types.js';

function mock(name: string, value: number, weight: number): Evaluator {
  return {
    name,
    defaultWeight: weight,
    async evaluate(): Promise<MetricResult> {
      return { name, value, weight, details: `${name}: ${value}` };
    },
  };
}

const baseCtx: EvaluatorContext = { projectRoot: '.', changeName: 'sugg-test', roundHistory: [] };

beforeEach(() => {
  clearEvaluatorRegistry();
  clearHistory('sugg-test');
});
afterEach(() => clearEvaluatorRegistry());

describe('buildSuggestions', () => {
  it('emits relax suggestion with concrete values when pass-rate low and density high', () => {
    const metrics: MetricResult[] = [
      { name: 'design-build-first-pass', value: 0.6, weight: 0.2, details: '' },
      { name: 'constraint-density', value: 0.9, weight: 0, details: '' },
    ];
    const suggestions = buildSuggestions(metrics);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain('放宽');
    expect(suggestions[0]).toContain('0.60');
    expect(suggestions[0]).toContain('0.90');
    expect(suggestions[0]).toContain('人工签收');
  });

  it('emits tighten suggestion when pass-rate high and density low', () => {
    const metrics: MetricResult[] = [
      { name: 'design-build-first-pass', value: 0.95, weight: 0.2, details: '' },
      { name: 'constraint-density', value: 0.2, weight: 0, details: '' },
    ];
    const suggestions = buildSuggestions(metrics);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toContain('收紧');
    expect(suggestions[0]).toContain('0.95');
  });

  it('emits nothing in neutral zone', () => {
    const metrics: MetricResult[] = [
      { name: 'design-build-first-pass', value: 0.85, weight: 0.2, details: '' },
      { name: 'constraint-density', value: 0.5, weight: 0, details: '' },
    ];
    expect(buildSuggestions(metrics)).toHaveLength(0);
  });

  it('emits nothing when either metric is missing (no stale references)', () => {
    expect(buildSuggestions([{ name: 'constraint-density', value: 0.9, weight: 0, details: '' }])).toHaveLength(0);
    expect(buildSuggestions([{ name: 'design-build-first-pass', value: 0.6, weight: 0.2, details: '' }])).toHaveLength(0);
  });
});

describe('autoEvaluate integration with freedom metrics', () => {
  it('keeps weight-0 density out of composite but visible in metrics, and attaches suggestions', async () => {
    registerEvaluator(mock('test-pass-rate', 0.9, 0.3));
    registerEvaluator(mock('drift-score', 0.9, 0.2));
    registerEvaluator(mock('spec-compliance', 0.9, 0.2));
    registerEvaluator(mock('code-delta', 0.9, 0.1));
    registerEvaluator(mock('design-build-first-pass', 0.6, 0.2));
    registerEvaluator(mock('constraint-density', 0.9, 0));

    const result = await autoEvaluate(baseCtx);

    const density = result.metrics.find((m) => m.name === 'constraint-density');
    expect(density).toBeDefined();
    expect(density!.weight).toBe(0);
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toContain('放宽');
    // composite unaffected by weight-0 metric: 5 active metrics renormalized
    expect(result.progress).toBeGreaterThan(0.8);
  });

  it('built-in registry exposes 6 evaluators; active weights sum to 1; density is 0 (W1 single-source invariant)', () => {
    registerBuiltInEvaluators();
    const evaluators = getActiveEvaluators();
    expect(evaluators).toHaveLength(6);
    const active = evaluators.filter((e) => e.defaultWeight > 0);
    expect(active.reduce((s, e) => s + e.defaultWeight, 0)).toBeCloseTo(1, 9);
    const density = evaluators.find((e) => e.name === 'constraint-density');
    expect(density).toBeDefined();
    expect(density!.defaultWeight).toBe(0);
    const firstPass = evaluators.find((e) => e.name === 'design-build-first-pass');
    expect(firstPass).toBeDefined();
    expect(firstPass!.defaultWeight).toBe(0.2);
  });

  it('suggestion production never mutates any file in the project root', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mumu-sugg-'));
    try {
      mkdirSync(join(root, '.mumuspec'), { recursive: true });
      const configPath = join(root, '.mumuspec', 'config.yaml');
      writeFileSync(configPath, 'version: 0.16.0-beta.0\n', 'utf8');
      const before = readFileSync(configPath, 'utf8');

      registerEvaluator(mock('design-build-first-pass', 0.6, 0.2));
      registerEvaluator(mock('constraint-density', 0.9, 0));
      registerEvaluator(mock('test-pass-rate', 0.9, 0.3));
      registerEvaluator(mock('drift-score', 0.9, 0.2));
      registerEvaluator(mock('spec-compliance', 0.9, 0.2));
      registerEvaluator(mock('code-delta', 0.9, 0.1));

      const result = await autoEvaluate({ ...baseCtx, projectRoot: root });
      expect(result.suggestions.length).toBe(1);
      expect(readFileSync(configPath, 'utf8')).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
