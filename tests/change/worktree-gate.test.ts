/**
 * Isolation and capacity gates (core-consolidation L4, R-0017 / R-0016).
 *
 * Locks TC-L4-001 / TC-L4-002 / TC-L4-005-adjacent facts:
 *  - a declared-but-unenforced workflow rule is a dangling gate pointer, so the
 *    isolation rule must actually decide something;
 *  - a downgrade is allowed only when it is visible (reason returned, and the
 *    caller audits it) — never a silent substitution;
 *  - once the single-active rule is off, the declared cap must bind.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../src/core/config.js';
import { MumuSpecError } from '../../src/core/errors.js';
import { createChange, ensureWorktreeIsolation } from '../../src/change/lifecycle.js';

function scratchProject(label: string): string {
  const root = join(tmpdir(), `mumu-gate-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
  writeFileSync(join(root, '.mumuspec', 'config.yaml'), '');
  return root;
}

describe('ensureWorktreeIsolation — 门与降级', () => {
  it('resolves to enforcement under a high result-constraint strength', () => {
    const root = scratchProject('enforce');
    try {
      const config = loadConfig(root);
      config.constraint_strength = {
        technical_design: 'high',
        requirement_goals: 'high',
        exceptions: [],
      };
      const result = ensureWorktreeIsolation(root, 'probe-change', config);
      expect(result.enforced).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('downgrades with a stated reason instead of silently skipping', () => {
    const root = scratchProject('downgrade');
    try {
      const config = loadConfig(root);
      config.constraint_strength = {
        technical_design: 'high',
        requirement_goals: 'high',
        exceptions: [],
      };
      config.changes.default_isolation = 'branch';
      const result = ensureWorktreeIsolation(root, 'probe-change', config);
      expect(result.enforced).toBe(true);
      expect(result.created).toBe(false);
      expect(result.downgraded).toBe(true);
      expect(result.reason).toContain('branch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('is inert when the rule resolves off, and never reports a downgrade', () => {
    const root = scratchProject('inert');
    try {
      const config = loadConfig(root);
      config.constraint_strength = {
        technical_design: 'low',
        requirement_goals: 'low',
        exceptions: [],
      };
      const result = ensureWorktreeIsolation(root, 'probe-change', config);
      expect(result).toEqual({ enforced: false, created: false, downgraded: false });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('workflow.max_active_changes — 容量门', () => {
  function fillActive(root: string, names: string[]): void {
    const config = loadConfig(root);
    config.workflow.single_active_change = false;
    for (const name of names) {
      createChange(root, name, 'hotfix', config, [], '.', undefined);
      expect(existsSync(join(root, '.mumuspec', 'changes', name, '.mumuspec.yaml'))).toBe(true);
    }
  }

  it('blocks beyond the declared cap once single-active is off', () => {
    const root = scratchProject('cap');
    try {
      const config = loadConfig(root);
      config.workflow.single_active_change = false;
      config.workflow.max_active_changes = 2;
      fillActive(root, ['c-one', 'c-two']);
      expect(() => createChange(root, 'c-three', 'hotfix', config, [], '.')).toThrow(MumuSpecError);
      try {
        createChange(root, 'c-three', 'hotfix', config, [], '.');
      } catch (err) {
        expect(err).toBeInstanceOf(MumuSpecError);
        expect((err as MumuSpecError).code).toBe('E-CHANGE-013');
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows creation up to the cap and is inert while single-active is on', () => {
    const root = scratchProject('cap-ok');
    try {
      const config = loadConfig(root);
      config.workflow.single_active_change = false;
      config.workflow.max_active_changes = 3;
      fillActive(root, ['only-one']);
      expect(() => createChange(root, 'second', 'hotfix', config, [], '.')).not.toThrow();

      const strict = loadConfig(root);
      strict.workflow.single_active_change = true;
      expect(() => createChange(root, 'third', 'hotfix', strict, [], '.')).toThrow(MumuSpecError);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
