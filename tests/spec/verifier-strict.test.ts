/**
 * Verifier semantics — validator gate tests (P0, 2026-08-29).
 *
 * Covers proposal test cases:
 *   T3/T8  — E-SPEC-015 fires as ERROR when `constraint_strength.enforcement_strict: true`
 *   T5/T9  — E-SPEC-004 (SHALL unverifiable) always visible, never folded away at TD=low
 *   T12    — gate off (default): E-SPEC-015 surfaces as warning (not blocking), coverage still counts
 *   T7v    — validateAllSpecs returns `coverage` in the result
 *
 * Design reference: proposal §3.3 (error code changes), §3.4 (orthogonality).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAllSpecs } from '../../src/spec/validator.js';
import { applyStrengthToGuardResult } from '../../src/guard/checker.js';
import type { MumuSpecConfig, ConstraintStrengthField } from '../../src/core/types.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-verifier-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const SPEC_UNVERIFIABLE = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '## Requirement: 依赖管理',
  '',
  '### SHALL',
  '- 所有公开函数必须有 TSDoc 注释',
  '',
  '### SHALL NOT',
  '- 禁止引入未被请求的抽象层与第三方依赖',
  '',
].join('\n');

function makeStrength(strict: boolean): ConstraintStrengthField {
  return {
    technical_design: 'high',
    requirement_goals: 'high',
    exceptions: [],
    enforcement_strict: strict,
  } as ConstraintStrengthField;
}

function makeConfig(strength?: ConstraintStrengthField): MumuSpecConfig {
  // validateSpecMd only touches config.specs.max_layer_depth / require_design_doc
  return {
    specs: { max_layer_depth: 5, require_design_doc: false },
    constraint_strength: strength,
  } as unknown as MumuSpecConfig;
}

describe('validator verifier gate (E-SPEC-015 / E-SPEC-004 / coverage)', () => {
  let dir: string;

  beforeEach(() => {
    dir = createTmpProject();
    mkdirSync(join(dir, '.mumuspec'), { recursive: true });
    writeFileSync(join(dir, '.mumuspec', 'spec.md'), SPEC_UNVERIFIABLE);
  });

  afterEach(() => cleanup(dir));

  it('T8: enforcement_strict=true → SHALL NOT unverifiable is ERROR E-SPEC-015', () => {
    const result = validateAllSpecs(dir, makeConfig(makeStrength(true)));
    const e015 = result.errors.filter((e) => e.code === 'E-SPEC-015');
    expect(e015.length).toBe(1);
    expect(e015[0].message).toContain('依赖管理');
    expect(result.passed).toBe(false);
  });

  it('T12 (M2): gate key absent → strict ON by default → E-SPEC-015 is ERROR', () => {
    const result = validateAllSpecs(dir, makeConfig(undefined));
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('T12 (M2): explicit opt-out enforcement_strict=false → warning observation mode', () => {
    const result = validateAllSpecs(dir, makeConfig({ ...makeStrength(false), enforcement_strict: false }));
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(false);
    expect(result.warnings.some((w) => w.code === 'E-SPEC-015')).toBe(true);
  });

  it('T5: SHALL unverifiable → E-SPEC-004 warning emitted', () => {
    const result = validateAllSpecs(dir, makeConfig());
    expect(result.warnings.some((w) => w.code === 'E-SPEC-004')).toBe(true);
  });

  it('T7v: result carries enforcement_coverage with unverifiable counted', () => {
    const result = validateAllSpecs(dir, makeConfig());
    expect(result.coverage).toBeDefined();
    // 1 SHALL (unverifiable) + 1 SHALL NOT (unverifiable)
    expect(result.coverage!.total).toBe(2);
    expect(result.coverage!.unverifiable).toBe(2);
    expect(result.coverage!.declared_ratio).toBe(0);
  });

  it('annotated SHALL NOT counts as enforced-strong in coverage', () => {
    writeFileSync(
      join(dir, '.mumuspec', 'spec.md'),
      [
        '---',
        'layer: 0',
        'scope: "."',
        'prohibitions:',
        '  - text: "禁止引入未被请求的依赖"',
        '    annotation:',
        '      type: no-new-dependency',
        '      scope: module',
        '---',
        '',
        '## Requirement: 依赖管理',
        '',
        '### SHALL NOT',
        '- 禁止引入未被请求的依赖',
        '',
        '### Enforcement',
        '- ENF-1: manual(人工核对)',
        '',
      ].join('\n'),
    );
    const result = validateAllSpecs(dir, makeConfig(makeStrength(true)));
    expect(result.coverage!.total).toBe(1);
    expect(result.coverage!.enforced_strong).toBe(1);
    // E-SPEC-015 must not fire for an annotated prohibition
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(false);
  });
});

describe('strength folding (T9 — verifiability is orthogonal to strength)', () => {
  const baseStrength: ConstraintStrengthField = {
    technical_design: 'low',
    requirement_goals: 'low',
    exceptions: [],
  } as ConstraintStrengthField;

  it('T9: E-SPEC-004 warning survives TD=low folding (always visible)', () => {
    const result = applyStrengthToGuardResult(
      { passed: true, errors: [], warnings: [{ code: 'E-SPEC-004', message: 'SHALL without enforcement: "x"' }] },
      baseStrength,
    );
    expect(result.warnings.some((w) => w.code === 'E-SPEC-004')).toBe(true);
  });

  it('T9b: E-SPEC-015 error survives any strength (always block)', () => {
    const result = applyStrengthToGuardResult(
      { passed: false, errors: [{ code: 'E-SPEC-015', message: 'SHALL NOT unverifiable' }], warnings: [] },
      baseStrength,
    );
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('T9c: E-VERIFY-003 error survives any strength (verify is a result gate)', () => {
    const result = applyStrengthToGuardResult(
      { passed: false, errors: [{ code: 'E-VERIFY-003', message: 'manual evidence missing' }], warnings: [] },
      baseStrength,
    );
    expect(result.errors.some((e) => e.code === 'E-VERIFY-003')).toBe(true);
  });
});
