/**
 * Extra tests for src/core/config-tree.ts -- constants and utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  BUILTIN_CONSTRAINT_EXCEPTIONS,
  STRENGTH_ACTION_MAP,
  WORKFLOW_RULE_DIMENSION,
  WORKFLOW_STRENGTH_MATRIX,
} from '../../src/core/config-tree.js';

describe('BUILTIN_CONSTRAINT_EXCEPTIONS', () => {
  it('should be a non-empty readonly array', () => {
    expect(Array.isArray(BUILTIN_CONSTRAINT_EXCEPTIONS)).toBe(true);
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS.length).toBeGreaterThan(0);
  });

  it('should contain critical safety constraints', () => {
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('archive_terminal_state');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('commit_sha_immutability');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('shall_not_violation_in_ci');
  });

  it('should contain all blocking point constraints', () => {
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_03_user_confirmation');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_04_design_confirmation');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_14_verify_failure');
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('bp_17_archive_confirmation');
  });

  it('should contain sensitive_info_scan', () => {
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('sensitive_info_scan');
  });

  it('should contain discard_user_confirmation', () => {
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('discard_user_confirmation');
  });
});

describe('STRENGTH_ACTION_MAP', () => {
  it('should map high to block', () => {
    expect(STRENGTH_ACTION_MAP.high).toBe('block');
  });

  it('should map medium to warn', () => {
    expect(STRENGTH_ACTION_MAP.medium).toBe('warn');
  });

  it('should map low to info', () => {
    expect(STRENGTH_ACTION_MAP.low).toBe('info');
  });
});

describe('WORKFLOW_RULE_DIMENSION', () => {
  it('should map all workflow keys to dimensions', () => {
    expect(WORKFLOW_RULE_DIMENSION.worktree_isolation).toBe('requirement_goals');
    expect(WORKFLOW_RULE_DIMENSION.single_active_change).toBe('requirement_goals');
    expect(WORKFLOW_RULE_DIMENSION.top_down_design).toBe('technical_design');
    expect(WORKFLOW_RULE_DIMENSION.tdd_enforced).toBe('technical_design');
    expect(WORKFLOW_RULE_DIMENSION.max_active_changes).toBe('requirement_goals');
  });
});

describe('WORKFLOW_STRENGTH_MATRIX', () => {
  it('high strength should enforce all workflows', () => {
    const high = WORKFLOW_STRENGTH_MATRIX.high;
    expect(high.worktree_isolation).toBe(true);
    expect(high.single_active_change).toBe(true);
    expect(high.top_down_design).toBe(true);
    expect(high.tdd_enforced).toBe(true);
  });

  it('medium strength should relax some workflows', () => {
const med = WORKFLOW_STRENGTH_MATRIX.medium;
expect(med.worktree_isolation).toBe(true);
expect(med.single_active_change).toBe(false);
expect(med.top_down_design).toBe(false);
expect(med.tdd_enforced).toBe(false); // 0.20.0+: tdd_enforced relaxed at medium for LLM freedom
});

  it('low strength should relax most workflows', () => {
    const low = WORKFLOW_STRENGTH_MATRIX.low;
    expect(low.worktree_isolation).toBe(false);
    expect(low.single_active_change).toBe(false);
    expect(low.top_down_design).toBe(false);
    expect(low.tdd_enforced).toBe(false);
  });

  it('monotonicity: high implies medium implies low for each rule', () => {
    const rules = ['worktree_isolation', 'single_active_change', 'top_down_design', 'tdd_enforced'] as const;
    for (const rule of rules) {
      if (!WORKFLOW_STRENGTH_MATRIX.high[rule]) {
        expect(WORKFLOW_STRENGTH_MATRIX.medium[rule]).toBe(false);
      }
      if (!WORKFLOW_STRENGTH_MATRIX.medium[rule]) {
        expect(WORKFLOW_STRENGTH_MATRIX.low[rule]).toBe(false);
      }
    }
  });
});
