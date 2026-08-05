/**
 * T3: Blocking Point Advisor Framework (Tests)
 */

import { describe, it, expect } from 'vitest';
import {
  getBPAdvisor,
  formatBPRecommendation,
  bp1Advisor,
  bp4Advisor,
  bp9Advisor,
} from '../src/core/bp-advisor.js';
import type { BPContext } from '../src/core/bp-advisor.js';

describe('bp-advisor', () => {
  const defaultCtx: BPContext = {
    phase: 'build',
    changeName: 'test-change',
    hasDistSpec: true,
    designComplete: true,
    buildLayersComplete: false,
  };

  describe('BP-1 advisor', () => {
    it('returns 3 options', () => {
      const rec = bp1Advisor(defaultCtx);
      expect(rec.bp_id).toBe('BP-1');
      expect(rec.options.length).toBeGreaterThanOrEqual(2);
      expect(rec.options.length).toBeLessThanOrEqual(3);
    });

    it('has one recommended option', () => {
      const rec = bp1Advisor(defaultCtx);
      const recommended = rec.options.filter((o) => o.recommended);
      expect(recommended.length).toBe(1);
      expect(rec.recommended_option_id).toBe(recommended[0].id);
    });
  });

  describe('BP-4 advisor', () => {
    it('returns options related to design creation', () => {
      const rec = bp4Advisor(defaultCtx);
      expect(rec.bp_id).toBe('BP-4');
      expect(rec.options.some((o) => o.id === 'create-design')).toBe(true);
      expect(rec.options.some((o) => o.id === 'use-tweak')).toBe(true);
    });
  });

  describe('BP-9 advisor', () => {
    it('recommends writing RED first for TDD', () => {
      const rec = bp9Advisor(defaultCtx);
      expect(rec.bp_id).toBe('BP-9');
      const recommended = rec.options.find((o) => o.id === rec.recommended_option_id);
      expect(recommended?.id).toBe('write-red-first');
    });
  });

  describe('getBPAdvisor fallback', () => {
    it('returns fallback for unknown BP', () => {
      const advisor = getBPAdvisor('BP-99');
      const rec = advisor(defaultCtx);
      expect(rec.bp_id).toBe('BP-99');
      expect(rec.options.length).toBeGreaterThanOrEqual(2);
    });

    it('returns registered advisor for known BP', () => {
      const advisor = getBPAdvisor('BP-1');
      const rec = advisor(defaultCtx);
      expect(rec.options.length).toBe(3);
    });
  });

  describe('formatBPRecommendation', () => {
    it('includes BP ID, analysis, and options', () => {
      const rec = bp4Advisor(defaultCtx);
      const formatted = formatBPRecommendation(rec);
      expect(formatted).toContain('BP-4');
      expect(formatted).toContain('Analysis');
      expect(formatted).toContain('Options');
      expect(formatted).toContain('[Recommended]');
    });
  });
});
