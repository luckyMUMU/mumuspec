/**
 * Drafting aspect coverage classifier (core-consolidation L1, R-0014).
 *
 * Locks TC-L1-001 / TC-L1-002: Q4 convergence is decided by aspect IDENTITY,
 * not by the number of cognitive-map rows. Three rows carrying the same aspect
 * must not read as coverage, and the security-and-compliance aspect is always
 * required — today's gate counts rows (src/cli/commands/cognitive-map.ts:177),
 * which lets the blind-spot scan skip security silently.
 */

import { describe, it, expect } from 'vitest';
import {
  ASPECTS,
  SECURITY_ASPECT,
  classifyAspects,
  missingRequiredAspects,
  isAspectCoverageConverged,
} from '../../src/spec/aspects.js';
import type { AspectEntry } from '../../src/spec/aspects.js';

// ── Helpers ──────────────────────────────────────────────────────────

function q4(category?: string): AspectEntry {
  return { quadrant: 'Q4', category, question: 'q', answer: 'a' };
}

// ── TC-L1-001: identity, not row count ───────────────────────────────

describe('classifyAspects — TC-L1-001', () => {
  it('three rows of the same aspect do not count as coverage', () => {
    const cov = classifyAspects([q4('concurrency'), q4('concurrency'), q4('concurrency')]);
    expect(cov.rows).toBe(3);
    expect(cov.distinct).toEqual(['concurrency']);
    expect(missingRequiredAspects(cov)).toContain(SECURITY_ASPECT);
    expect(isAspectCoverageConverged(cov, { minDistinct: 3 })).toBe(false);
  });

  it('three distinct required aspects including security converge', () => {
    const cov = classifyAspects([q4('concurrency'), q4('compat'), q4(SECURITY_ASPECT)]);
    expect(missingRequiredAspects(cov)).toEqual([]);
    expect(isAspectCoverageConverged(cov, { minDistinct: 3 })).toBe(true);
  });

  it('rows without an aspect identity never converge', () => {
    const cov = classifyAspects([q4(), q4(), q4()]);
    expect(cov.distinct).toEqual([]);
    expect(isAspectCoverageConverged(cov, { minDistinct: 3 })).toBe(false);
  });

  it('unknown aspect labels are reported, not silently counted', () => {
    const cov = classifyAspects([q4('typo-dimension'), q4('compat'), q4(SECURITY_ASPECT)]);
    expect(cov.unknown).toEqual(['typo-dimension']);
    expect(cov.distinct).toEqual(['compat', SECURITY_ASPECT]);
  });

  it('rows outside Q4 never enter the aspect set', () => {
    const cov = classifyAspects([
      { quadrant: 'Q1', category: SECURITY_ASPECT },
      q4('compat'),
      q4('concurrency'),
      q4(SECURITY_ASPECT),
    ]);
    expect(cov.distinct).toEqual(['compat', 'concurrency', SECURITY_ASPECT]);
  });

  it('below minDistinct still fails even when security is present', () => {
    const cov = classifyAspects([q4(SECURITY_ASPECT), q4(SECURITY_ASPECT)]);
    expect(missingRequiredAspects(cov)).toEqual([]);
    expect(isAspectCoverageConverged(cov, { minDistinct: 3 })).toBe(false);
  });
});

// ── TC-L1-002: single source of truth, orthogonal to strength axes ───

describe('ASPECTS — TC-L1-002', () => {
  it('enumerates the eight drafting aspects', () => {
    expect(ASPECTS).toEqual([
      'function',
      'boundary',
      'data',
      'concurrency',
      'compat',
      'performance',
      'security-compliance',
      'observability',
    ]);
  });

  it('stays orthogonal to constraint strength axes', () => {
    // strength axes must never leak into the coverage vocabulary
    expect(ASPECTS).not.toContain('technical_design');
    expect(ASPECTS).not.toContain('requirement_goals');
  });

  it('security aspect is a member and is required by default', () => {
    expect(ASPECTS).toContain(SECURITY_ASPECT);
    const empty = classifyAspects([]);
    expect(missingRequiredAspects(empty)).toEqual([SECURITY_ASPECT]);
  });
});
