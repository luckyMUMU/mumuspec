/**
 * Tests for Impact Analysis Engine (R-0005).
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeImpact,
  formatImpactAnalysis,
  PRESERVATION_ANCHORS,
} from '../../src/meta-evolution/impact-analysis.js';
import type { EvolutionReport, KnowledgeEvolutionAction } from '../../src/meta-evolution/types.js';

function makeReport(lowIds: string[]): EvolutionReport {
  return {
    generatedAt: '2026-08-09T10:00:00Z',
    scores: lowIds.map((id) => ({
      constraintId: id,
      passRate: 0.2,
      falsePositiveRate: 0.1,
      score: 0.17,
      lastEvaluated: '2026-08-09T10:00:00Z',
      sampleSize: 10,
      reliable: true,
    })),
    lowPerformingIds: lowIds,
    recommendations: [],
    totalEvaluated: lowIds.length,
  };
}

describe('analyzeImpact', () => {
  it('separates modifiable from protected constraints', () => {
    const report = makeReport(['LOW-001', 'E-GUARD-003']);
    const analysis = analyzeImpact(report);

    expect(analysis.affectedConstraints).toContain('LOW-001');
    expect(analysis.affectedConstraints).not.toContain('E-GUARD-003');
    expect(analysis.protectedAnchors).toContain('E-GUARD-003');
  });

  it('list affected knowledge pages', () => {
    const report = makeReport([]);
    const actions: KnowledgeEvolutionAction[] = [
      { pageId: 'kb-1', action: 'promote_freshness', reason: 'active', previousValue: 'aging', newValue: 'active' },
    ];

    const analysis = analyzeImpact(report, actions);
    expect(analysis.affectedKnowledgePages).toContain('kb-1');
  });

  it('builds affected files list', () => {
    const report = makeReport(['LOW-001']);
    const analysis = analyzeImpact(report);

    expect(analysis.affectedFiles).toContain('.mumuspec/constraints.yaml');
    expect(analysis.affectedFiles).toContain('.mumuspec/evolution/stats.jsonl');
  });

  it('requires confirmation when changes exist', () => {
    const report = makeReport(['LOW-001']);
    const analysis = analyzeImpact(report);
    expect(analysis.requiresConfirmation).toBe(true);
  });

  it('does not require confirmation for empty report', () => {
    const report = makeReport([]);
    const analysis = analyzeImpact(report);
    expect(analysis.requiresConfirmation).toBe(false);
  });
});

describe('formatImpactAnalysis', () => {
  it('includes affected constraint ids', () => {
    const analysis = analyzeImpact(makeReport(['LOW-001']));
    const formatted = formatImpactAnalysis(analysis);
    expect(formatted).toContain('LOW-001');
    expect(formatted).toContain('Impact Analysis');
  });

  it('lists protected anchor when present', () => {
    const analysis = analyzeImpact(makeReport(['LOW-001', 'E-GUARD-003']));
    const formatted = formatImpactAnalysis(analysis);
    expect(formatted).toContain('Goal Preservation');
  });

  it('lists protected anchors', () => {
    const analysis = analyzeImpact(makeReport(['E-GUARD-003']));
    const formatted = formatImpactAnalysis(analysis);
    expect(formatted).toContain('E-GUARD-003');
  });
});

describe('PRESERVATION_ANCHORS', () => {
  it('contains core SHALL NOT entries', () => {
    expect(PRESERVATION_ANCHORS).toContain('E-GUARD-003');
    expect(PRESERVATION_ANCHORS).toContain('E-CHANGE-007');
    expect(PRESERVATION_ANCHORS).toContain('E-CHANGE-006');
  });
});
