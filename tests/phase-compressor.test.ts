import { describe, it, expect } from 'vitest';
import { canCompress } from '../src/core/phase-compressor.js';
import type { ChangeState } from '../src/core/types-workflow.js';

function makeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: 'test-change',
    phase: 'open',
    workflow: 'full',
    created_at: '2026-08-02T00:00:00Z',
    updated_at: '2026-08-02T00:00:00Z',
    scope: '.',
    affected_scopes: [],
    build_layers: [],
    test_cases: {
      design_locked: false,
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'layered',
    tdd_mode: 'tdd',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {} },
    rollback_history: [],
    ...overrides,
  };
}

describe('phase-compressor', () => {
  describe('canCompress — allowed cases', () => {
    it('should allow compression for small change (≤2 files, no API change)', () => {
      const state = makeState({
        estimated_files: 2,
        modules_affected: 1,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(true);
      expect(result.compressed_path).toBe('tweak');
    });

    it('should allow compression for doc-only change', () => {
      const state = makeState({
        estimated_files: 5,
        is_doc_only: true,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(true);
      expect(result.compressed_path).toBe('tweak');
    });

    it('should allow compression for pure bugfix with low risk', () => {
      const state = makeState({
        estimated_files: 1,
        is_pure_bugfix: true,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(true);
      expect(result.compressed_path).toBe('hotfix');
    });
  });

  describe('canCompress — denied by safety fence', () => {
    it('should deny compression when cross_module', () => {
      const state = makeState({
        estimated_files: 1,
        cross_module: true,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(false);
      expect(result.blocking_conditions).toContain('cross_module');
    });

    it('should deny compression when new_public_api', () => {
      const state = makeState({
        estimated_files: 1,
        new_public_api: true,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(false);
      expect(result.blocking_conditions).toContain('new_public_api');
    });

    it('should deny compression when new_external_dep', () => {
      const state = makeState({
        estimated_files: 1,
        new_external_dep: true,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(false);
      expect(result.blocking_conditions).toContain('new_external_dep');
    });

    it('should deny compression when data_migration', () => {
      const state = makeState({
        estimated_files: 1,
        data_migration: true,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(false);
      expect(result.blocking_conditions).toContain('data_migration');
    });

    it('should list multiple blocking conditions', () => {
      const state = makeState({
        cross_module: true,
        new_external_dep: true,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(false);
      expect(result.blocking_conditions?.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('canCompress — denied by risk level', () => {
    it('should deny compression when estimated_files > 4', () => {
      const state = makeState({
        estimated_files: 6,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(false);
    });

    it('should deny compression when modules_affected > 2', () => {
      const state = makeState({
        estimated_files: 2,
        modules_affected: 4,
        cross_module: false,
        new_public_api: false,
        new_external_dep: false,
        data_migration: false,
      });
      const result = canCompress(state);
      expect(result.allowed).toBe(false);
    });
  });
});
