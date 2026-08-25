/**
 * Unit Tests — workflow-recommender.ts
 *
 * Covers: estimateScope, deriveRiskTier, checkSafetyFence, recommendPath, formatRecommendation
 */
import { describe, it, expect } from 'vitest';
import {
  estimateScope,
  deriveRiskTier,
  checkSafetyFence,
  recommendPath,
  formatRecommendation,
} from '../../src/core/workflow-recommender.js';
import type { ScopeEstimation, PathRecommendation } from '../../src/core/types-workflow.js';

describe('workflow-recommender', () => {
  // ─── deriveRiskTier ───
  describe('deriveRiskTier', () => {
    it('returns low risk for small single-module change', () => {
      const tier = deriveRiskTier({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(tier).toBe('low');
    });

    it('returns medium risk when files > 4', () => {
      const tier = deriveRiskTier({
        estimated_files: 5,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(tier).toBe('medium');
    });

    it('returns medium risk when modules > 1 (but not cross_module)', () => {
      const tier = deriveRiskTier({
        estimated_files: 2,
        modules_affected: 2,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(tier).toBe('medium');
    });

    it('returns high risk when cross_module', () => {
      const tier = deriveRiskTier({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(tier).toBe('high');
    });

    it('returns high risk when files > 10', () => {
      const tier = deriveRiskTier({
        estimated_files: 15,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(tier).toBe('high');
    });

    it('returns high risk when new_public_api', () => {
      const tier = deriveRiskTier({
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: true,
        new_external_dep: false,
        data_migration: false,
      });
      expect(tier).toBe('high');
    });

    it('returns high risk when data_migration', () => {
      const tier = deriveRiskTier({
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: true,
      });
      expect(tier).toBe('high');
    });

    it('cross_module takes precedence over low file count', () => {
      const tier = deriveRiskTier({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(tier).toBe('high');
    });
  });

  // ─── estimateScope ───
  describe('estimateScope', () => {
    it('computes risk_level from signals (low)', () => {
      const scope = estimateScope({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(scope.risk_level).toBe('low');
    });

    it('computes risk_level from signals (high via cross_module)', () => {
      const scope = estimateScope({
        estimated_files: 2,
        modules_affected: 1,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(scope.risk_level).toBe('high');
    });

    it('passes through optional fields (is_doc_only, is_pure_bugfix)', () => {
      const scope = estimateScope({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_doc_only: true,
        is_pure_bugfix: true,
      });
      expect(scope.is_doc_only).toBe(true);
      expect(scope.is_pure_bugfix).toBe(true);
    });

    it('defaults optional boolean fields to false', () => {
      const scope = estimateScope({
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      expect(scope.is_doc_only).toBe(false);
      expect(scope.is_pure_bugfix).toBe(false);
    });
  });

  // ─── checkSafetyFence ───
  describe('checkSafetyFence', () => {
    it('does not block when no fence conditions', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(false);
      expect(result.triggers).toHaveLength(0);
    });

    it('blocks on cross_module and reports trigger', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(true);
      expect(result.triggers).toContain('cross_module');
    });

    it('blocks on new_public_api', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: true,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(true);
      expect(result.triggers).toContain('new_public_api');
    });

    it('blocks on new_external_dep', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: true,
        data_migration: false,
        risk_level: 'medium',
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(true);
      expect(result.triggers).toContain('new_external_dep');
    });

    it('blocks on data_migration', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: true,
        risk_level: 'high',
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(true);
      expect(result.triggers).toContain('data_migration');
    });

    it('reports multiple triggers when multiple conditions met', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: true,
        new_public_api: true,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
      };
      const result = checkSafetyFence(scope);
      expect(result.blocks).toBe(true);
      expect(result.triggers).toHaveLength(2);
      expect(result.triggers).toContain('cross_module');
      expect(result.triggers).toContain('new_public_api');
    });
  });

  // ─── recommendPath ───
  describe('recommendPath', () => {
    it('safety fence forces full path (95% confidence)', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
      };
      const rec = recommendPath(scope);
      expect(rec.path).toBe('full');
      expect(rec.confidence).toBe(0.95);
      expect(rec.safety_fence_blocks).toBe(true);
      expect(rec.fence_triggers).toContain('cross_module');
    });

    it('high risk → full path (85% confidence)', () => {
      const scope: ScopeEstimation = {
        estimated_files: 15,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
      };
      const rec = recommendPath(scope);
      expect(rec.path).toBe('full');
      expect(rec.confidence).toBe(0.85);
      expect(rec.safety_fence_blocks).toBe(false);
    });

    it('doc_only → tweak path (90% confidence)', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_doc_only: true,
        risk_level: 'low',
      };
      const rec = recommendPath(scope);
      expect(rec.path).toBe('tweak');
      expect(rec.confidence).toBe(0.9);
    });

    it('pure_bugfix + low risk → hotfix (80% confidence)', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        is_pure_bugfix: true,
        risk_level: 'low',
      };
      const rec = recommendPath(scope);
      expect(rec.path).toBe('hotfix');
      expect(rec.confidence).toBe(0.8);
    });

    it('medium risk → tweak (75% confidence)', () => {
      const scope: ScopeEstimation = {
        estimated_files: 6,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'medium',
      };
      const rec = recommendPath(scope);
      expect(rec.path).toBe('tweak');
      expect(rec.confidence).toBe(0.75);
    });

    it('small change (<=2 files) → tweak (85% confidence)', () => {
      const scope: ScopeEstimation = {
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
      };
      const rec = recommendPath(scope);
      expect(rec.path).toBe('tweak');
      expect(rec.confidence).toBe(0.85);
    });

    it('moderate change (3-4 files, low risk) → tweak (65% confidence)', () => {
      const scope: ScopeEstimation = {
        estimated_files: 4,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
      };
      const rec = recommendPath(scope);
      expect(rec.path).toBe('tweak');
      expect(rec.confidence).toBe(0.65);
    });

    it('never returns safety_fence_blocks=true when no fence triggers', () => {
      const scope: ScopeEstimation = {
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'low',
      };
      const rec = recommendPath(scope);
      expect(rec.safety_fence_blocks).toBe(false);
      expect(rec.fence_triggers).toBeUndefined();
    });

    it('rationale is non-empty string', () => {
      const scope: ScopeEstimation = {
        estimated_files: 1,
        modules_affected: 1,
        cross_module: true,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
        risk_level: 'high',
      };
      const rec = recommendPath(scope);
      expect(rec.rationale).toBeTruthy();
      expect(rec.rationale.length).toBeGreaterThan(10);
    });
  });

  // ─── formatRecommendation ───
  describe('formatRecommendation', () => {
    it('includes recommended path name', () => {
      const rec: PathRecommendation = {
        path: 'full',
        confidence: 0.95,
        rationale: 'test rationale',
        safety_fence_blocks: false,
      };
      const text = formatRecommendation(rec);
      expect(text).toContain('Recommended Path:** full');
    });

    it('includes confidence percentage', () => {
      const rec: PathRecommendation = {
        path: 'tweak',
        confidence: 0.85,
        rationale: 'test',
        safety_fence_blocks: false,
      };
      const text = formatRecommendation(rec);
      expect(text).toContain('Confidence:** 85%');
    });

    it('includes rationale', () => {
      const rec: PathRecommendation = {
        path: 'hotfix',
        confidence: 0.8,
        rationale: 'Pure bugfix with confirmed root cause',
        safety_fence_blocks: false,
      };
      const text = formatRecommendation(rec);
      expect(text).toContain('Pure bugfix with confirmed root cause');
    });

    it('includes safety fence triggers when active', () => {
      const rec: PathRecommendation = {
        path: 'full',
        confidence: 0.95,
        rationale: 'test',
        safety_fence_blocks: true,
        fence_triggers: ['cross_module', 'new_public_api'],
      };
      const text = formatRecommendation(rec);
      expect(text).toContain('Safety Fence Active');
      expect(text).toContain('cross_module');
      expect(text).toContain('new_public_api');
    });

    it('does NOT mention safety fence when not active', () => {
      const rec: PathRecommendation = {
        path: 'tweak',
        confidence: 0.9,
        rationale: 'test',
        safety_fence_blocks: false,
      };
      const text = formatRecommendation(rec);
      expect(text).not.toContain('Safety Fence Active');
    });

    it('always ends with L1 Suggestion mode notice', () => {
      const rec: PathRecommendation = {
        path: 'full',
        confidence: 0.95,
        rationale: 'test',
        safety_fence_blocks: false,
      };
      const text = formatRecommendation(rec);
      expect(text).toContain('L1 Suggestion mode');
    });
  });
});
