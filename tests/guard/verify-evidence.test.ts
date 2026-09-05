/**
 * Verifier semantics — verify-stage manual evidence gate (P0, 2026-08-29).
 *
 * Covers proposal test cases:
 *   T10 — manual constraint without evidence in verify.md → E-VERIFY-003 (strict gate on)
 *   T11 — evidence anchored by enforcement id or constraint text → passes
 *   T12g — gate off (enforcement_strict undefined) → E-VERIFY-003 never emitted
 *
 * Design reference: proposal §3.3 (E-VERIFY-003), §3.4 (result gate, strength-orthogonal).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runPhaseGuard } from '../../src/guard/phase-guard.js';
import type { ConstraintStrengthField } from '../../src/core/types.js';

const STATE = [
  'name: evid-test',
  'phase: verify',
  'workflow: full',
  'created_at: "2026-08-29T00:00:00.000Z"',
  'updated_at: "2026-08-29T00:00:00.000Z"',
  'affected_scopes:',
  '  - "."',
  'build_layers: []',
  'test_cases:',
  '  design_locked: true',
  '  suites_locked: true',
  '  suites_locked_layers: []',
  '  suites_hash: {}',
  'rollback_count: 0',
  'rebuild_count: 0',
  'rollback_limit: 3',
  'rebuild_limit: 5',
  'build_mode: incremental',
  'tdd_mode: tdd',
  'isolation: worktree',
  'verify_result: pass',
  'branch_status: handled',
].join('\n');

// One explicit-manual SHALL (ENF-1) + one implicit-manual SHALL NOT (legacy free text)
const SPEC = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '## Requirement: 文档约束',
  '',
  '### SHALL',
  '- 所有公开函数必须有 TSDoc 注释',
  '',
  '### Enforcement',
  '- ENF-1: manual(文档在 code review 逐项核对)',
  '',
  '## Requirement: 依赖红线',
  '',
  '### SHALL NOT',
  '- 禁止引入未被请求的抽象层',
  '',
  '### Enforcement',
  '- ENF-2: 依赖清单人工核对',
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

describe('verify_to_archive manual evidence gate (E-VERIFY-003)', () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `mumuspec-evid-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const changeDir = join(dir, '.mumuspec', 'changes', 'evid-test');
    mkdirSync(changeDir, { recursive: true });
    writeFileSync(join(changeDir, '.mumuspec.yaml'), STATE);
    writeFileSync(join(changeDir, 'verify.md'), '# Verify\n\n测试全绿。\n');
    writeFileSync(join(dir, '.mumuspec', 'spec.md'), SPEC);
  });

  afterEach(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it('T10: strict gate on + missing evidence → E-VERIFY-003 error blocks archive', () => {
    const result = runPhaseGuard(dir, 'evid-test', 'archive-in-progress', { strength: makeStrength(true) });
    const e003 = result.errors.filter((e) => e.code === 'E-VERIFY-003');
    expect(e003.length).toBeGreaterThanOrEqual(1);
    expect(result.passed).toBe(false);
  });

  it('T11: evidence anchored by enforcement id satisfies the check for that item', () => {
    writeFileSync(join(dir, '.mumuspec', 'changes', 'evid-test', 'verify.md'),
      '# Verify\n\nENF-1 — 文档约束已由 code review 核对。\n');
    const result = runPhaseGuard(dir, 'evid-test', 'archive-in-progress', { strength: makeStrength(true) });
    const e003 = result.errors.filter((e) => e.code === 'E-VERIFY-003');
    // ENF-1 covered; the implicit-manual SHALL NOT (ENF-2) is still missing
    expect(e003.length).toBe(1);
    expect(e003[0].message).toContain('依赖红线');
  });

  it('T11b: evidence anchored by verbatim constraint text satisfies the check', () => {
    writeFileSync(join(dir, '.mumuspec', 'changes', 'evid-test', 'verify.md'),
      '# Verify\n\nSHALL NOT 校验记录：禁止引入未被请求的抽象层 — 已人工核对。\n\n所有公开函数必须有 TSDoc 注释 — 已核对。\n');
    const result = runPhaseGuard(dir, 'evid-test', 'archive-in-progress', { strength: makeStrength(true) });
    expect(result.errors.some((e) => e.code === 'E-VERIFY-003')).toBe(false);
    expect(result.passed).toBe(true);
  });

  it('T12g (M2): gate key absent → strict ON by default → E-VERIFY-003 emitted', () => {
    const result = runPhaseGuard(dir, 'evid-test', 'archive-in-progress');
    expect(result.errors.some((e) => e.code === 'E-VERIFY-003')).toBe(true);
  });

  it('T12g (M2): explicit opt-out enforcement_strict=false → E-VERIFY-003 never emitted', () => {
    const result = runPhaseGuard(dir, 'evid-test', 'archive-in-progress', {
      strength: {
        technical_design: 'high',
        requirement_goals: 'high',
        exceptions: [],
        enforcement_strict: false,
      } as ConstraintStrengthField,
    });
    expect(result.errors.some((e) => e.code === 'E-VERIFY-003')).toBe(false);
  });
});
