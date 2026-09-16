/**
 * Structure Validator tests — .mumuspec/ root file whitelist (E-SPEC-014).
 *
 * Covers change structure-validator-workflow-yaml (2026-09-05):
 * - TC-1: project-level workflow.yaml is a defined root file (CHG-6/7)
 * - TC-2: undefined files are still rejected (whitelist not loosened)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateMumuSpecStructure } from '../src/spec/structure-validator.js';

let testDir: string;

beforeEach(() => {
  testDir = mkdtempSync(join(tmpdir(), 'mumuspec-structure-'));
  mkdirSync(join(testDir, '.mumuspec'), { recursive: true });
  writeFileSync(join(testDir, '.mumuspec', 'spec.md'), '---\nlayer: 0\nscope: "."\n---\n');
});

afterEach(() => {
  rmSync(testDir, { recursive: true, force: true });
});

describe('validateMumuSpecStructure — workflow.yaml whitelist', () => {
  it('TC-1: does not flag project-level workflow.yaml as undefined', () => {
    writeFileSync(
      join(testDir, '.mumuspec', 'workflow.yaml'),
      'version: 1\nphases: [open, build]\n',
    );
    const result = validateMumuSpecStructure(testDir);
    const workflowErrors = result.errors.filter(
      (e) => e.code === 'E-SPEC-014' && (e.detail ?? '').includes('workflow.yaml'),
    );
    expect(workflowErrors).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('TC-3: evolution/ is a whitelisted directory (P0-1 stats landing dir)', () => {
    mkdirSync(join(testDir, '.mumuspec', 'evolution'));
    const result = validateMumuSpecStructure(testDir);
    const evolutionErrors = result.errors.filter(
      (e) => e.code === 'E-SPEC-013' && (e.detail ?? '').includes('evolution'),
    );
    expect(evolutionErrors).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('TC-4: evals/ is a whitelisted directory (eval scenario discovery dir)', () => {
    mkdirSync(join(testDir, '.mumuspec', 'evals'));
    const result = validateMumuSpecStructure(testDir);
    const evalsErrors = result.errors.filter(
      (e) => e.code === 'E-SPEC-013' && (e.detail ?? '').includes('evals'),
    );
    expect(evalsErrors).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('TC-2: still rejects undefined root files (whitelist not loosened)', () => {
    writeFileSync(join(testDir, '.mumuspec', 'random-junk.md'), 'junk');
    const result = validateMumuSpecStructure(testDir);
    const junkErrors = result.errors.filter(
      (e) => e.code === 'E-SPEC-014' && (e.detail ?? '').includes('random-junk.md'),
    );
    expect(junkErrors).toHaveLength(1);
    expect(result.passed).toBe(false);
  });
});
