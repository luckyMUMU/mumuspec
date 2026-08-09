/**
 * Tests for Effectiveness Scoring Engine (R-0005 TC-META-01~06, 12).
 *
 * Covers:
 * - computeScore algorithm correctness
 * - computeEffectivenessScores grouping and thresholds
 * - generateReport with low-performing detection
 * - Goal Preservation (excludeIds)
 * - empty input handling
 */
import { describe, it, expect } from 'vitest';
import {
  computeScore,
  computeEffectivenessScores,
  generateReport,
} from '../../src/meta-evolution/scoring.js';
import type { CheckRecord, ScoringConfig } from '../../src/meta-evolution/types.js';
import { DEFAULT_SCORING_CONFIG } from '../../src/meta-evolution/types.js';

// ════════════════════════════════════════════════════════════════════
// computeScore
// ════════════════════════════════════════════════════════════════════

describe('computeScore', () => {
  // TC-META-01
  it('computes score for typical pass/false positive rates', () => {
    const score = computeScore(0.8, 0.1);
    // 0.8 * (1 - 0.1 * 1.5) = 0.8 * 0.85 = 0.68
    expect(score).toBeCloseTo(0.68, 5);
  });

  // TC-META-02
  it('returns 1.0 for perfect constraint', () => {
    expect(computeScore(1.0, 0)).toBe(1.0);
  });

  // TC-META-03
  it('clamps to 0 when penalty exceeds passRate', () => {
    // 0.5 * (1 - 1.0 * 1.5) = 0.5 * (-0.5) = -0.25 → 0
    expect(computeScore(0.5, 1.0)).toBe(0);
  });

  it('uses custom penalty weight', () => {
    const score = computeScore(0.5, 0.2, 2.0);
    // 0.5 * (1 - 0.2 * 2.0) = 0.5 * 0.6 = 0.3
    expect(score).toBeCloseTo(0.3, 5);
  });
});

// ════════════════════════════════════════════════════════════════════
// computeEffectivenessScores
// ════════════════════════════════════════════════════════════════════

function makeRecords(constraintId: string, passed: boolean, count: number): CheckRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: `2026-08-09T10:00:${i.toString().padStart(2, '0')}Z`,
    constraintId,
    passed,
    falsePositive: !passed && i % 2 === 0, // half of failures are false positives
  }));
}

describe('computeEffectivenessScores', () => {
  it('groups records by constraintId', () => {
    const records = [
      ...makeRecords('C-001', true, 10),
      ...makeRecords('C-002', false, 5),
    ];

    const scores = computeEffectivenessScores(records);
    expect(scores).toHaveLength(2);

    const c001 = scores.find((s) => s.constraintId === 'C-001');
    expect(c001?.passRate).toBe(1.0);
    expect(c001?.sampleSize).toBe(10);
  });

  it('respects window size', () => {
    const config: ScoringConfig = { ...DEFAULT_SCORING_CONFIG, windowSize: 5 };
    const records = makeRecords('C-001', true, 20);

    const scores = computeEffectivenessScores(records, config);
    expect(scores[0].sampleSize).toBe(5);
  });

  it('marks low sample size as unreliable', () => {
    const records = makeRecords('C-001', true, 2);
    const scores = computeEffectivenessScores(records);
    expect(scores[0].reliable).toBe(false);
  });

  it('marks sufficient sample as reliable', () => {
    const records = makeRecords('C-001', true, 5);
    const scores = computeEffectivenessScores(records);
    expect(scores[0].reliable).toBe(true);
  });

  // TC-META-05: Goal Preservation
  it('excludes specified constraint ids', () => {
    const records = [
      ...makeRecords('C-001', true, 5),
      ...makeRecords('EXCLUDED', true, 5),
    ];

    const scores = computeEffectivenessScores(records, DEFAULT_SCORING_CONFIG, undefined, ['EXCLUDED']);
    expect(scores.find((s) => s.constraintId === 'EXCLUDED')).toBeUndefined();
    expect(scores.find((s) => s.constraintId === 'C-001')).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// generateReport
// ════════════════════════════════════════════════════════════════════

describe('generateReport', () => {
  // TC-META-04
  it('detects low performing constraints', () => {
    // Reliable low scorer
    const lowRecords = makeRecords('LOW-001', false, 10);
    // Reliable high scorer
    const highRecords = makeRecords('HIGH-001', true, 10);

    const report = generateReport([...lowRecords, ...highRecords]);
    expect(report.lowPerformingIds).toContain('LOW-001');
    expect(report.lowPerformingIds).not.toContain('HIGH-001');
  });

  it('does not include unreliable scores in low performing', () => {
    // Unreliable low score
    const records = makeRecords('UNRELIABLE', false, 2);
    const report = generateReport(records);
    expect(report.lowPerformingIds).not.toContain('UNRELIABLE');
  });

  it('produces recommendations for low performers', () => {
    const records = makeRecords('LOW-001', false, 10);
    const report = generateReport(records);
    expect(report.recommendations.length).toBeGreaterThan(0);
    expect(report.recommendations[0]).toContain('LOW-001');
  });

  it('includes generation metadata', () => {
    const report = generateReport([]);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.totalEvaluated).toBe(0);
  });

  // TC-META-12
  it('handles empty records gracefully', () => {
    const report = generateReport([]);
    expect(report.scores).toEqual([]);
    expect(report.lowPerformingIds).toEqual([]);
    expect(report.totalEvaluated).toBe(0);
  });

  it('respects excludeIds for Goal Preservation', () => {
    const records = makeRecords('ANCHOR-001', false, 10);
    const report = generateReport(records, DEFAULT_SCORING_CONFIG, ['ANCHOR-001']);
    expect(report.totalEvaluated).toBe(0);
  });
});
