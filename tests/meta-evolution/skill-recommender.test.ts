/**
 * Tests for Skill Recommendation Engine (R1) — TC-META-08.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  recommendSkills,
  recordRecommendationOutcome,
  getRecommendationAccuracy,
  clearTracking,
} from '../../src/meta-evolution/skill-recommender.js';

describe('recommendSkills', () => {
  // TC-META-08
  it('returns matching skills based on scope', () => {
    const result = recommendSkills(['mumuspec', 'workflow']);

    expect(result.recommendations.length).toBeGreaterThan(0);
    // mumuspec skill should match
    const topIds = result.recommendations.map((r) => r.skillId);
    expect(topIds).toContain('mumuspec');
  });

  it('sorts by relevance score descending', () => {
    const result = recommendSkills(['mumuspec', 'workflow']);

    for (let i = 1; i < result.recommendations.length; i++) {
      expect(result.recommendations[i - 1].relevanceScore)
        .toBeGreaterThanOrEqual(result.recommendations[i].relevanceScore);
    }
  });

  it('returns defaults for empty scopes', () => {
    const result = recommendSkills([]);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('respects limit parameter', () => {
    const result = recommendSkills(['mumuspec'], 2);
    expect(result.recommendations.length).toBeLessThanOrEqual(2);
  });

  it('includes 60% confidence threshold', () => {
    const result = recommendSkills(['test']);
    expect(result.confidenceThreshold).toBe(0.6);
  });
});

describe('recommendation tracking', () => {
  beforeEach(() => {
    clearTracking();
  });

  it('tracks adoption rate', () => {
    recordRecommendationOutcome('sk-1', true);
    recordRecommendationOutcome('sk-1', false);
    recordRecommendationOutcome('sk-1', true);

    const accuracy = getRecommendationAccuracy('sk-1');
    expect(accuracy).toBeCloseTo(2 / 3, 5);
  });

  it('returns undefined for untracked skill', () => {
    expect(getRecommendationAccuracy('nonexistent')).toBeUndefined();
  });
});
