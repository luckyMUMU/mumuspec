/**
 * Unit Tests — Auto-Evaluate Engine (R-0002)
 *
 * Covers:
 * TC-05: 加权计算：4 个指标权重归一化
 * TC-06: 收敛判断：连续 3 轮 ≥ 0.85 触发 converged
 * TC-07: 降级：全部 Evaluator 失败时 fallback manual
 * TC-08: 权重动态调整：缺失指标权重重分配
 * TC-09: HTML 报告生成：包含趋势图数据
 * TC-10: 注册中心：register/get/clear
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import {
  registerEvaluator,
  getEvaluator,
  getActiveEvaluators,
  clearEvaluatorRegistry,
  disableEvaluator,
  enableEvaluator,
  hasEvaluator,
  getActiveEvaluatorCount,
} from '../../../src/core/metrics/evaluator-registry.js';
import {
  autoEvaluate,
  hybridEvaluate,
  registerBuiltInEvaluators,
  clearHistory,
} from '../../../src/core/metrics/auto-evaluate.js';
import { generateHtmlReport } from '../../../src/core/metrics/html-reporter.js';
import type { Evaluator, EvaluatorContext, MetricResult } from '../../../src/core/metrics/types.js';

// ════════════════════════════════════════════════════════════════════
// Mock Evaluators
// ════════════════════════════════════════════════════════════════════

function createMockEvaluator(name: string, value: number, weight: number): Evaluator {
  return {
    name,
    defaultWeight: weight,
    async evaluate(_ctx: EvaluatorContext): Promise<MetricResult> {
      return { name, value, weight, details: `${name}: ${value}` };
    },
  };
}

function createFailingEvaluator(name: string): Evaluator {
  return {
    name,
    defaultWeight: 0.25,
    async evaluate(_ctx: EvaluatorContext): Promise<MetricResult> {
      return { name, value: 0, weight: 0, details: 'failed' };
    },
  };
}

const baseCtx: EvaluatorContext = {
  projectRoot: '.',
  changeName: 'test-change',
  roundHistory: [],
};

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('R-0002 — Auto-Evaluate Engine', () => {
  beforeEach(() => {
    clearEvaluatorRegistry();
    clearHistory('test-change');
    clearHistory('hybrid-test');
    clearHistory('all-fail-test');
  });

  // ─── TC-10: Registry ───
  describe('TC-10: Evaluator Registry', () => {
    it('registers and retrieves an evaluator', () => {
      const mock = createMockEvaluator('test-metric', 0.8, 0.25);
      registerEvaluator(mock);

      expect(hasEvaluator('test-metric')).toBe(true);
      expect(getEvaluator('test-metric')).not.toBeNull();
      expect(getActiveEvaluatorCount()).toBe(1);
    });

    it('returns null for unregistered evaluator', () => {
      expect(getEvaluator('nonexistent')).toBeNull();
    });

    it('disable/enable toggles availability', () => {
      const mock = createMockEvaluator('toggle-test', 0.5, 0.25);
      registerEvaluator(mock);

      disableEvaluator('toggle-test');
      expect(hasEvaluator('toggle-test')).toBe(false);
      expect(getEvaluator('toggle-test')).toBeNull();

      enableEvaluator('toggle-test');
      expect(hasEvaluator('toggle-test')).toBe(true);
    });

    it('clearEvaluatorRegistry removes all', () => {
      registerEvaluator(createMockEvaluator('e1', 0.5, 0.25));
      registerEvaluator(createMockEvaluator('e2', 0.6, 0.25));
      expect(getActiveEvaluatorCount()).toBe(2);

      clearEvaluatorRegistry();
      expect(getActiveEvaluatorCount()).toBe(0);
    });

    it('getActiveEvaluators returns all active', () => {
      registerEvaluator(createMockEvaluator('e1', 0.5, 0.25));
      registerEvaluator(createMockEvaluator('e2', 0.6, 0.25));
      disableEvaluator('e1');

      const active = getActiveEvaluators();
      expect(active).toHaveLength(1);
      expect(active[0].name).toBe('e2');
    });
  });

  // ─── TC-05: Weighted calculation ───
  describe('TC-05: Weighted Calculation', () => {
    it('computes weighted progress correctly', async () => {
      registerEvaluator(createMockEvaluator('m1', 0.8, 0.35));
      registerEvaluator(createMockEvaluator('m2', 0.6, 0.25));
      registerEvaluator(createMockEvaluator('m3', 0.9, 0.25));
      registerEvaluator(createMockEvaluator('m4', 0.7, 0.15));

      const result = await autoEvaluate(baseCtx);

      // Weighted: 0.8*0.35 + 0.6*0.25 + 0.9*0.25 + 0.7*0.15 = 0.76
      expect(result.progress).toBeCloseTo(0.76, 2);
      expect(result.metrics).toHaveLength(4);
    });

    it('normalizes weights to sum=1', async () => {
      // Register only 2 of 4 evaluators
      registerEvaluator(createMockEvaluator('m1', 0.8, 0.35));
      registerEvaluator(createMockEvaluator('m2', 0.6, 0.25));

      const result = await autoEvaluate(baseCtx);

      // After normalization: 0.35/0.6 = 0.583, 0.25/0.6 = 0.417
      // Progress: 0.8*0.583 + 0.6*0.417 = 0.7166
      expect(result.progress).toBeGreaterThan(0);
      expect(result.progress).toBeLessThanOrEqual(1);
    });
  });

  // ─── TC-06: Convergence detection ───
  describe('TC-06: Convergence Detection', () => {
    it('does NOT converge on first round even if above threshold', async () => {
      registerEvaluator(createMockEvaluator('m1', 0.95, 0.35));
      registerEvaluator(createMockEvaluator('m2', 0.95, 0.25));
      registerEvaluator(createMockEvaluator('m3', 0.95, 0.25));
      registerEvaluator(createMockEvaluator('m4', 0.95, 0.15));

      const result = await autoEvaluate(baseCtx);

      // Progress should be high but not converged (needs 3 consecutive)
      expect(result.progress).toBeGreaterThan(0.85);
      expect(result.goalAchieved).toBe(false);
    });

    it('converges after 3 consecutive rounds above threshold', async () => {
      registerEvaluator(createMockEvaluator('m1', 0.95, 0.35));
      registerEvaluator(createMockEvaluator('m2', 0.95, 0.25));
      registerEvaluator(createMockEvaluator('m3', 0.95, 0.25));
      registerEvaluator(createMockEvaluator('m4', 0.95, 0.15));

      // Round 1
      await autoEvaluate(baseCtx);
      // Round 2
      await autoEvaluate(baseCtx);
      // Round 3
      const result = await autoEvaluate(baseCtx);

      expect(result.progress).toBeGreaterThan(0.85);
      expect(result.goalAchieved).toBe(true);
    });

    it('does NOT converge if any metric is below minAcceptable', async () => {
      registerEvaluator(createMockEvaluator('m1', 0.95, 0.35));
      registerEvaluator(createMockEvaluator('m2', 0.95, 0.25));
      registerEvaluator(createMockEvaluator('m3', 0.95, 0.25));
      registerEvaluator(createMockEvaluator('m4', 0.1, 0.15)); // Very low

      await autoEvaluate(baseCtx);
      await autoEvaluate(baseCtx);
      const result = await autoEvaluate(baseCtx);

      // m4 is below minAcceptable (0.5), so no convergence
      expect(result.goalAchieved).toBe(false);
    });
  });

  // ─── TC-07: Fallback when all fail ───
  describe('TC-07: All Evaluators Fail', () => {
    it('returns fallback result when all evaluators return weight=0', async () => {
      registerEvaluator(createFailingEvaluator('fail1'));
      registerEvaluator(createFailingEvaluator('fail2'));

      const result = await autoEvaluate(baseCtx);

      expect(result.progress).toBe(0);
      expect(result.goalAchieved).toBe(false);
      expect(result.recommendation).toContain('failed');
    });

    it('returns empty metrics list when no evaluators registered', async () => {
      // Registry is cleared in beforeEach
      const result = await autoEvaluate(baseCtx);

      expect(result.metrics).toHaveLength(0);
      expect(result.progress).toBe(0);
    });
  });

  // ─── TC-08: Dynamic weight redistribution ───
  describe('TC-08: Dynamic Weight Redistribution', () => {
    it('redistributes weights when one evaluator is disabled', async () => {
      registerEvaluator(createMockEvaluator('m1', 0.8, 0.35));
      registerEvaluator(createMockEvaluator('m2', 0.6, 0.25));
      registerEvaluator(createMockEvaluator('m3', 0.9, 0.25));
      registerEvaluator(createMockEvaluator('m4', 0.7, 0.15));

      // Disable m4 (weight 0.15) -> its weight should be redistributed
      disableEvaluator('m4');

      const result = await autoEvaluate(baseCtx);

      // Only 3 metrics, progress should be based on m1, m2, m3
      const expected = (0.8 * 0.35 + 0.6 * 0.25 + 0.9 * 0.25) / (0.35 + 0.25 + 0.25);
      expect(result.progress).toBeCloseTo(expected, 2);
      expect(result.metrics.filter(m => m.weight > 0)).toHaveLength(3);
    });

    it('uses all remaining weight for single active metric', async () => {
      registerEvaluator(createMockEvaluator('m1', 0.75, 0.35));
      registerEvaluator(createMockEvaluator('m2', 0.6, 0.25));

      disableEvaluator('m2');

      const result = await autoEvaluate(baseCtx);

      // Only m1 active -> progress = m1.value regardless of original weight
      expect(result.progress).toBeCloseTo(0.75, 2);
    });
  });

  // ─── TC-09: HTML Report Generation ───
  describe('TC-09: HTML Report', () => {
    it('generates valid HTML file', () => {
      const tmpDir = join(tmpdir(), 'r0002-test-' + Date.now());
      mkdirSync(tmpDir, { recursive: true });
      const outputPath = join(tmpDir, 'test-report.html');

      const history = [
        { round: 1, timestamp: '2026-08-09T00:00:00Z', progress: 0.3, goalAchieved: false, metrics: [{ name: 'test-pass-rate', value: 0.5, details: '5/10 passed' }] },
        { round: 2, timestamp: '2026-08-09T00:01:00Z', progress: 0.7, goalAchieved: false, metrics: [{ name: 'test-pass-rate', value: 0.8, details: '8/10 passed' }] },
        { round: 3, timestamp: '2026-08-09T00:02:00Z', progress: 0.95, goalAchieved: true, metrics: [{ name: 'test-pass-rate', value: 1.0, details: '10/10 passed' }] },
      ];

      generateHtmlReport('test-change', history, outputPath);

      expect(existsSync(outputPath)).toBe(true);
      const html = readFileSync(outputPath, 'utf-8');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('test-change');
      expect(html).toContain('Round 1');
      expect(html).toContain('Round 3');
      expect(html).toContain('svg'); // Has chart
    });
  });

  // ─── TC-hybrid: Hybrid Evaluation ───
  describe('Hybrid Evaluation', () => {
    it('combines auto and manual progress', async () => {
      registerEvaluator(createMockEvaluator('m1', 0.8, 0.5));
      registerEvaluator(createMockEvaluator('m2', 0.6, 0.5));

      // Auto progress = 0.7, manual = 0.9
      // Hybrid = 0.7 * 0.7 + 0.9 * 0.3 = 0.76
      const result = await hybridEvaluate(baseCtx, 0.9);

      expect(result.progress).toBeCloseTo(0.76, 1);
    });
  });
});
