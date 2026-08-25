/**
 * T1: Scope Estimation + Path Recommendation (RED → GREEN)
 *
 * Tests for workflow-recommender.ts
 */

import { describe, it, expect } from 'vitest';
import {
  estimateScope,
  deriveRiskTier,
  checkSafetyFence,
  recommendPath,
  formatRecommendation,
} from '../src/core/workflow-recommender.js';
import type { ScopeEstimation } from '../src/core/types-workflow.js';

describe('workflow-recommender', () => {
  // ─── deriveRiskTier ───────────────────────────────────────────

  describe('deriveRiskTier', () => {
    it('returns low for trivial scope', () => {
      const scope = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      expect(deriveRiskTier(scope)).toBe('low');
    });

    it('returns medium for new dependency', () => {
      const scope = {
        estimated_files: 3,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: true,
        data_migration: false,
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      expect(deriveRiskTier(scope)).toBe('medium');
    });

    it('returns high for cross-module change', () => {
      const scope = {
        estimated_files: 5,
        modules_affected: 2,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      expect(deriveRiskTier(scope)).toBe('high');
    });

    it('returns high for data migration', () => {
      const scope = {
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: true,
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      expect(deriveRiskTier(scope)).toBe('high');
    });

    it('returns high for > 10 files', () => {
      const scope = {
        estimated_files: 15,
        modules_affected: 2,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      expect(deriveRiskTier(scope)).toBe('high');
    });
  });

  // ─── estimateScope ────────────────────────────────────────────

  describe('estimateScope', () => {
    it('returns complete ScopeEstimation with derived risk', () => {
      const result = estimateScope({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });

      expect(result.estimated_files).toBe(1);
      expect(result.modules_affected).toBe(1);
      expect(result.risk_level).toBe('low');
      expect(result.is_doc_only).toBe(false);
      expect(result.is_pure_bugfix).toBe(false);
    });

    it('respects doc_only flag', () => {
      const result = estimateScope({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_doc_only: true,
      });
      expect(result.is_doc_only).toBe(true);
    });

    it('respects pure_bugfix flag', () => {
      const result = estimateScope({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_pure_bugfix: true,
      });
      expect(result.is_pure_bugfix).toBe(true);
    });

    it('correctly derives high risk for new_public_api', () => {
      const result = estimateScope({
        estimated_files: 3,
        modules_affected: 1,
        cross_module: false,
        new_public_api: true,
        new_external_dep: false,
        data_migration: false,
      });
      expect(result.risk_level).toBe('high');
    });
  });

  // ─── checkSafetyFence ─────────────────────────────────────────

  describe('checkSafetyFence', () => {
    it('returns blocks=false for clean scope', () => {
      const scope: ScopeEstimation = {
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(false);
      expect(result.triggers).toEqual([]);
    });

    it('returns blocks=true with triggers for cross_module', () => {
      const scope: ScopeEstimation = {
        estimated_files: 3,
        modules_affected: 2,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(true);
      expect(result.triggers).toContain('cross_module');
    });

    it('detects multiple fence triggers', () => {
      const scope: ScopeEstimation = {
        estimated_files: 5,
        modules_affected: 3,
        cross_module: true,
        new_public_api: true,
        new_external_dep: false,
        data_migration: true,
        risk_level: 'high',
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(true);
      expect(result.triggers).toContain('cross_module');
      expect(result.triggers).toContain('new_public_api');
      expect(result.triggers).toContain('data_migration');
    });
  });

  // ─── recommendPath ────────────────────────────────────────────

  describe('recommendPath', () => {
    it('recommends full when safety fence triggers', () => {
      const scope: ScopeEstimation = {
        estimated_files: 2,
        modules_affected: 1,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      const result = recommendPath(scope);
      expect(result.path).toBe('full');
      expect(result.safety_fence_blocks).toBe(true);
      expect(result.fence_triggers).toContain('cross_module');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('recommends tweak for documentation-only change', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
        is_doc_only: true,
        is_pure_bugfix: false,
      };
      const result = recommendPath(scope);
      expect(result.path).toBe('tweak');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('recommends hotfix for pure bugfix low risk', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
        is_doc_only: false,
        is_pure_bugfix: true,
      };
      const result = recommendPath(scope);
      expect(result.path).toBe('hotfix');
    });

    it('recommends tweak for small low-risk change', () => {
      const scope: ScopeEstimation = {
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      const result = recommendPath(scope);
      expect(result.path).toBe('tweak');
    });

    it('recommends full for high risk', () => {
      const scope: ScopeEstimation = {
        estimated_files: 12,
        modules_affected: 4,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      const result = recommendPath(scope);
      expect(result.path).toBe('full');
    });

    it('recommends tweak for medium risk', () => {
      const scope: ScopeEstimation = {
        estimated_files: 4,
        modules_affected: 2,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'medium',
        is_doc_only: false,
        is_pure_bugfix: false,
      };
      const result = recommendPath(scope);
      expect(result.path).toBe('tweak');
    });

    it('path is always one of: full, tweak, hotfix', () => {
      const scopes: ScopeEstimation[] = [
        {
          estimated_files: 1, modules_affected: 1, cross_module: false,
          new_public_api: false, new_external_dep: false, data_migration: false,
          risk_level: 'low', is_doc_only: false, is_pure_bugfix: false,
        },
        {
          estimated_files: 20, modules_affected: 5, cross_module: true,
          new_public_api: true, new_external_dep: true, data_migration: true,
          risk_level: 'high', is_doc_only: false, is_pure_bugfix: false,
        },
        {
          estimated_files: 1, modules_affected: 1, cross_module: false,
          new_public_api: false, new_external_dep: false, data_migration: false,
          risk_level: 'low', is_doc_only: false, is_pure_bugfix: true,
        },
      ];
      const validPaths: Set<string> = new Set(['full', 'tweak', 'hotfix']);
      for (const scope of scopes) {
        const result = recommendPath(scope);
        expect(validPaths.has(result.path)).toBe(true);
      }
    });

    it('confidence is always between 0 and 1', () => {
      const scope: ScopeEstimation = {
        estimated_files: 3, modules_affected: 1, cross_module: false,
        new_public_api: false, new_external_dep: false, data_migration: false,
        risk_level: 'low', is_doc_only: false, is_pure_bugfix: false,
      };
      const result = recommendPath(scope);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ─── formatRecommendation ─────────────────────────────────────

  describe('formatRecommendation', () => {
    it('includes path, confidence, and rationale', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1, modules_affected: 1, cross_module: false,
        new_public_api: false, new_external_dep: false, data_migration: false,
        risk_level: 'low', is_doc_only: true, is_pure_bugfix: false,
      };
      const rec = recommendPath(scope);
      const formatted = formatRecommendation(rec);
      expect(formatted).toContain('tweak');
      expect(formatted).toContain('90%');
      expect(formatted).toContain('Documentation-only');
    });

    it('shows safety fence when blocked', () => {
      const scope: ScopeEstimation = {
        estimated_files: 3, modules_affected: 2, cross_module: true,
        new_public_api: false, new_external_dep: false, data_migration: false,
        risk_level: 'high', is_doc_only: false, is_pure_bugfix: false,
      };
      const rec = recommendPath(scope);
      const formatted = formatRecommendation(rec);
      expect(formatted).toContain('Safety Fence');
      expect(formatted).toContain('cross_module');
    });
  });
});
