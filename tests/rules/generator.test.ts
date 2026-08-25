/**
 * Tests for rules/generator.ts — pure functions and content generation logic.
 */
import { describe, it, expect } from 'vitest';
import { PONYTAIL_LADDER, NON_LAZY_DOMAINS } from '../../src/spec/ponytail.js';

describe('rules/generator (ponytail ladder)', () => {
  it('ponytail ladder has 7 levels', () => {
    expect(PONYTAIL_LADDER.length).toBe(7);
  });

  it('non-lazy domains is non-empty', () => {
    expect(NON_LAZY_DOMAINS.length).toBeGreaterThan(0);
  });

  it('ponytail ladder entries have action and question', () => {
    for (const level of PONYTAIL_LADDER) {
      expect(level).toHaveProperty('level');
      expect(level).toHaveProperty('question');
      expect(level).toHaveProperty('action');
      expect(typeof level.level).toBe('number');
      expect(typeof level.question).toBe('string');
      expect(typeof level.action).toBe('string');
    }
  });

  it('ponytail ladder is sorted by level ascending', () => {
    const levels = PONYTAIL_LADDER.map((l) => l.level);
    const sorted = [...levels].sort((a, b) => a - b);
    expect(levels).toEqual(sorted);
  });

  it('non-lazy domains includes important domains', () => {
    // Domains are in Chinese (matches catdesk memory profile)
    expect(NON_LAZY_DOMAINS).toContain('错误处理');
    expect(NON_LAZY_DOMAINS).toContain('安全性');
  });
});
