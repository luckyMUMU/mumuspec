/**
 * Tests for core/errors.ts — error code definitions, formatError, MumuSpecError class.
 * Also tests config-tree.ts pure functions for constraint-strength logic.
 */
import { describe, it, expect } from 'vitest';
import { ERROR_CODES, getErrorCode, formatError, MumuSpecError } from '../../src/core/errors.js';
import { getDefaultConfig } from '../../src/core/config.js';
import {
  isValidStrength,
  strengthRank,
  safeStrengthRank,
  normalizeScope,
  isTightening,
  resolveConstraintTree,
  BUILTIN_CONSTRAINT_EXCEPTIONS,
  STRENGTH_ACTION_MAP,
} from '../../src/core/config-tree.js';
import type { ConstraintEntry, ConstraintsFile } from '../../src/core/types.js';

describe('core/errors', () => {
  it('has error codes defined', () => {
    expect(Object.keys(ERROR_CODES).length).toBeGreaterThan(0);
  });

  it('each error code has required fields', () => {
    for (const [code, def] of Object.entries(ERROR_CODES)) {
      expect(def.code).toBe(code);
      expect(def.name).toBeTruthy();
      expect(def.severity).toMatch(/^(ERROR|WARN|INFO)$/);
      expect(def.description).toBeTruthy();
      expect(Array.isArray(def.fixSteps)).toBe(true);
      expect(typeof def.forceable).toBe('boolean');
    }
  });

  it('getErrorCode returns correct definition', () => {
    const def = getErrorCode('E-SPEC-001');
    expect(def).toBeDefined();
    expect(def!.name).toBe('SPEC_FORMAT_INVALID');
  });

  it('getErrorCode returns undefined for unknown', () => {
    expect(getErrorCode('E-UNKNOWN-999')).toBeUndefined();
  });

  it('formatError formats error with context', () => {
    const msg = formatError('E-SPEC-001', { path: '/foo/bar' });
    expect(msg).toContain('E-SPEC-001');
    expect(msg).toContain('SPEC_FORMAT_INVALID');
    expect(msg).toContain('/foo/bar');
  });

  it('formatError handles unknown error', () => {
    const msg = formatError('NOPE');
    expect(msg).toContain('Unknown error');
  });

  it('MumuSpecError class has proper fields', () => {
    const err = new MumuSpecError('E-GUARD-002');
    expect(err.code).toBe('E-GUARD-002');
    expect(err.severity).toBe('ERROR');
    expect(err.forceable).toBe(true);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('core/config', () => {
  it('getDefaultConfig returns valid shape', () => {
    const cfg = getDefaultConfig('test-proj');
    expect(cfg.project.name).toBe('test-proj');
    expect(cfg.version).toBeTruthy();
    expect(cfg.workflow).toBeDefined();
    expect(cfg.constraint_strength).toBeDefined();
  });

  it('has constraint_strength defaults', () => {
    const cfg = getDefaultConfig();
    expect(['high', 'medium', 'low']).toContain(cfg.constraint_strength.technical_design);
    expect(['high', 'medium', 'low']).toContain(cfg.constraint_strength.requirement_goals);
    expect(Array.isArray(cfg.constraint_strength.exceptions)).toBe(true);
  });

  it('has skills config enabled by default', () => {
    const cfg = getDefaultConfig();
    expect(cfg.skills.enabled).toBe(true);
  });

  it('has workflow rules (CHG-5: top_down_design and tdd_enforced relaxed)', () => {
    const cfg = getDefaultConfig();
    expect(cfg.workflow.worktree_isolation).toBe(true);
    expect(cfg.workflow.single_active_change).toBe(true);
    // CHG-5 (0.20): process constraints relaxed for LLM autonomy
    expect(cfg.workflow.top_down_design).toBe(false);
    expect(cfg.workflow.tdd_enforced).toBe(false);
  });

  it('has ponytail enabled by default', () => {
    const cfg = getDefaultConfig();
    expect(cfg.ponytail.enabled).toBe(true);
    expect(cfg.ponytail.comment_marker).toBe('ponytail:');
  });

  it('has contracts config', () => {
    const cfg = getDefaultConfig();
    expect(cfg.contracts.enabled).toBe(true);
    expect(cfg.contracts.auto_derive).toBe(true);
  });
});

describe('core/config-tree', () => {
  it('isValidStrength accepts valid values', () => {
    expect(isValidStrength('high')).toBe(true);
    expect(isValidStrength('medium')).toBe(true);
    expect(isValidStrength('low')).toBe(true);
  });

  it('isValidStrength rejects invalid values', () => {
    expect(isValidStrength('invalid')).toBe(false);
    expect(isValidStrength(123)).toBe(false);
    expect(isValidStrength(null)).toBe(false);
    expect(isValidStrength(undefined)).toBe(false);
  });

  it('strengthRank returns correct ordering', () => {
    expect(strengthRank('high')).toBe(3);
    expect(strengthRank('medium')).toBe(2);
    expect(strengthRank('low')).toBe(1);
  });

  it('strengthRank throws on invalid input', () => {
    expect(() => strengthRank('invalid' as any)).toThrow();
  });

  it('safeStrengthRank returns fallback for invalid', () => {
    expect(safeStrengthRank('invalid').valid).toBe(false);
    expect(safeStrengthRank('invalid').rank).toBe(1);
  });

  it('safeStrengthRank returns rank for valid', () => {
    expect(safeStrengthRank('high')).toEqual({ rank: 3, valid: true });
  });

  it('normalizeScope normalizes various forms', () => {
    expect(normalizeScope('')).toBe('.');
    expect(normalizeScope('.')).toBe('.');
    expect(normalizeScope('./')).toBe('.');
    expect(normalizeScope('./src')).toBe('src');
    expect(normalizeScope('src/utils')).toBe('src/utils');
    expect(normalizeScope('.\\windows')).toBe('windows');
  });

  it('STRENGTH_ACTION_MAP is correct', () => {
    expect(STRENGTH_ACTION_MAP.high).toBe('block');
    expect(STRENGTH_ACTION_MAP.medium).toBe('warn');
    expect(STRENGTH_ACTION_MAP.low).toBe('info');
  });

  it('BUILTIN_CONSTRAINT_EXCEPTIONS is non-empty array', () => {
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS.length).toBeGreaterThan(0);
    expect(BUILTIN_CONSTRAINT_EXCEPTIONS).toContain('archive_terminal_state');
  });

  it('isTightening validates child >= parent', () => {
    const parent: ConstraintEntry = {
      id: 'test-rule',
      description: 'parent',
      min_strength: 'medium',
      enforcement: 'MANUAL',
    };
    const validChild: ConstraintEntry = {
      id: 'test-rule',
      description: 'child tightens',
      min_strength: 'high',
      enforcement: 'MANUAL',
    };
    const invalidChild: ConstraintEntry = {
      id: 'test-rule',
      description: 'child relaxes',
      min_strength: 'low',
      enforcement: 'MANUAL',
    };
    expect(isTightening(parent, validChild).valid).toBe(true);
    expect(isTightening(parent, invalidChild).valid).toBe(false);
  });

  it('isTightening rejects different ids', () => {
    const a: ConstraintEntry = { id: 'a', description: '', min_strength: 'medium', enforcement: 'MANUAL' };
    const b: ConstraintEntry = { id: 'b', description: '', min_strength: 'high', enforcement: 'MANUAL' };
    expect(isTightening(a, b).valid).toBe(false);
  });

  it('resolveConstraintTree builds tree from files', () => {
    const files: ConstraintsFile[] = [
      {
        version: '1.0',
        scope: '.',
        strength: { technical_design: 'high', requirement_goals: 'high' },
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      },
    ];
    const result = resolveConstraintTree(files, {
      technical_design: 'high',
      requirement_goals: 'high',
    });
    expect(result.root.scope).toBe('.');
    expect(result.root.layer).toBe(0);
    expect(result.conflicts.length).toBe(0);
  });

  it('resolveConstraintTree handles empty files', () => {
    const result = resolveConstraintTree([], {
      technical_design: 'medium',
      requirement_goals: 'medium',
    });
    expect(result.root.scope).toBe('.');
    expect(result.root.strength.technical_design).toBe('medium');
  });

  it('resolveConstraintTree detects duplicate scopes', () => {
    const files: ConstraintsFile[] = [
      {
        version: '1.0',
        scope: '.',
        strength: { technical_design: 'high', requirement_goals: 'high' },
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      },
      {
        version: '1.0',
        scope: '.',
        strength: { technical_design: 'low', requirement_goals: 'low' },
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      },
    ];
    const result = resolveConstraintTree(files, {
      technical_design: 'high',
      requirement_goals: 'high',
    });
    expect(result.warnings.some((w) => w.includes('duplicate'))).toBe(true);
  });
});
