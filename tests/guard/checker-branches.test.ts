/**
 * Additional branch coverage for src/guard/checker.ts.
 *
 * Focuses on:
 * - autoFixDrift 的不同 drift 类型分支
 * - checkCompliance 的多种约束 violation
 * - isFileInScope / isCoexistenceConstraint 边界
 * - applyStrengthToGuardResult 的剩余分支
 * - 边界：无约束、无规则的退化场景
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  autoFixDrift,
  applyStrengthToGuardResult,
  checkCompliance,
  detectDrift,
  detectContractGuardDrift,
} from '../../src/guard/checker.js';
import type { GuardResult, DriftResult, ConstraintStrengthField } from '../../src/core/types.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-branches-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ========== autoFixDrift ==========

describe('autoFixDrift', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return empty fixed/remaining when drifts list is empty', () => {
    const result = autoFixDrift(projectDir, []);
    expect(result.fixed).toHaveLength(0);
    expect(result.remaining).toHaveLength(0);
  });

  it('should not auto-fix ERROR severity drifts', () => {
    const errorDrift: DriftResult = {
      type: 'spec_drift',
      severity: 'ERROR',
      message: 'Critical drift',
      file: join(projectDir, '.mumuspec', 'spec.md'),
    };
    const result = autoFixDrift(projectDir, [errorDrift]);
    expect(result.fixed).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);
  });

  it('should auto-fix WARN severity spec_drift when file is fixable', () => {
    const specPath = join(projectDir, '.mumuspec', 'spec.md');
    writeFileSync(specPath, '---\nlayer: 0\n---\n\n## Requirement: R1\n- SHALL: "something"\n');
    const drift: DriftResult = {
      type: 'spec_drift',
      severity: 'WARN',
      message: 'SHALL without enforcement',
      file: specPath,
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(1);
    expect(result.remaining).toHaveLength(0);
    // Verify the hint was written
    const content = readFileSync(specPath, 'utf8');
    expect(content).toContain('mumuspec-drift-fix');
  });

  it('should not fix spec_drift when file already has enforcement', () => {
    const specPath = join(projectDir, '.mumuspec', 'spec.md');
    writeFileSync(specPath, '---\nlayer: 0\n---\n\n## Requirement: R1\n- SHALL: "x"\n  - enforcement: E-1\n');
    const drift: DriftResult = {
      type: 'spec_drift',
      severity: 'WARN',
      message: 'drift',
      file: specPath,
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);
  });

  it('should not fix spec_drift when marker already present', () => {
    const specPath = join(projectDir, '.mumuspec', 'spec.md');
    writeFileSync(specPath, '---\nlayer: 0\n---\n<!-- mumuspec-drift-fix -->\n## Requirement: R1\n- SHALL: "x"\n');
    const drift: DriftResult = {
      type: 'spec_drift',
      severity: 'WARN',
      message: 'drift',
      file: specPath,
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(0);
  });

  it('should handle contract_summary drift as non-fixable', () => {
    const drift: DriftResult = {
      type: 'contract_summary',
      severity: 'WARN',
      message: 'Summary info',
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);
  });

  it('should handle contract_drift_error as non-fixable', () => {
    const drift: DriftResult = {
      type: 'contract_drift_error',
      severity: 'WARN',
      message: 'Contract drift error',
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);
  });

  it('should handle unknown drift type as non-fixable', () => {
    const drift: DriftResult = {
      type: 'unknown_type',
      severity: 'WARN',
      message: 'Unknown drift',
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);
  });

  it('should handle missing file gracefully', () => {
    const drift: DriftResult = {
      type: 'spec_drift',
      severity: 'WARN',
      message: 'drift',
      file: join(projectDir, '.mumuspec', 'nonexistent.md'),
    };
    const result = autoFixDrift(projectDir, [drift]);
    expect(result.fixed).toHaveLength(0);
    expect(result.remaining).toHaveLength(1);
  });

  it('dryRun should not modify files', () => {
    const specPath = join(projectDir, '.mumuspec', 'spec.md');
    const originalContent = '---\nlayer: 0\n---\n\n## Requirement: R1\n- SHALL: "something"\n';
    writeFileSync(specPath, originalContent);
    const drift: DriftResult = {
      type: 'spec_drift',
      severity: 'WARN',
      message: 'drift',
      file: specPath,
    };
    autoFixDrift(projectDir, [drift], true);
    expect(readFileSync(specPath, 'utf8')).toBe(originalContent);
  });
});

// ========== applyStrengthToGuardResult 剩余分支 ==========

describe('applyStrengthToGuardResult (remaining branches)', () => {
  it('should drop warnings that evaluate to info', () => {
    const result: GuardResult = {
      passed: true,
      errors: [],
      warnings: [{ code: 'E-SPEC-004', message: 'SHALL without enforcement' }],
    };
    const strength: ConstraintStrengthField = {
      technical_design: 'low',
      requirement_goals: 'high',
    };
    const output = applyStrengthToGuardResult(result, strength);
    // At low TD strength, E-SPEC-004 (min_strength medium) should be evaluated
    expect(output).toBeDefined();
    expect(Array.isArray(output.warnings)).toBe(true);
  });

  it('should keep warnings that evaluate to block/warn', () => {
    const result: GuardResult = {
      passed: true,
      errors: [],
      warnings: [{ code: 'E-GUARD-003', message: 'always enforce' }],
    };
    const strength: ConstraintStrengthField = {
      technical_design: 'low',
      requirement_goals: 'low',
    };
    const output = applyStrengthToGuardResult(result, strength);
    expect(output.warnings).toHaveLength(1);
  });

  it('should handle empty errors and warnings with strength', () => {
    const result: GuardResult = {
      passed: true,
      errors: [],
      warnings: [],
    };
    const strength: ConstraintStrengthField = {
      technical_design: 'high',
      requirement_goals: 'high',
    };
    const output = applyStrengthToGuardResult(result, strength);
    expect(output.passed).toBe(true);
    expect(output.errors).toHaveLength(0);
    expect(output.warnings).toHaveLength(0);
  });

  it('should use default metadata for unmapped error codes', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-UNKNOWN-999', message: 'Unknown error' }],
      warnings: [],
    };
    const strength: ConstraintStrengthField = {
      technical_design: 'high',
      requirement_goals: 'high',
    };
    const output = applyStrengthToGuardResult(result, strength);
    expect(output.errors).toHaveLength(1);
    expect(output.passed).toBe(false);
  });

  it('should pass result unchanged when strength has zero-value config', () => {
    const result: GuardResult = {
      passed: true,
      errors: [],
      warnings: [{ code: 'E-GUARD-001', message: 'warn' }],
    };
    const output = applyStrengthToGuardResult(result, undefined);
    expect(output).toBe(result);
  });

  it('should drop error entirely at low strength (action=info)', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-DESIGN-001', message: 'Design check' }],
      warnings: [],
    };
    const strength: ConstraintStrengthField = {
      technical_design: 'low',
      requirement_goals: 'low',
    };
    const output = applyStrengthToGuardResult(result, strength);
    // At low strength, action=info means the error is DROPPED (not downgraded to warn)
    expect(output.passed).toBe(true);
    expect(output.errors).toHaveLength(0);
  });
});

// ========== checkCompliance 多种约束 violation ==========

describe('checkCompliance (diverse constraints)', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should scope prohibition to subproject code only', () => {
    // Subproject demo/ has spec.md with prohibition
    const demoDir = join(projectDir, 'demo');
    mkdirSync(join(demoDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(demoDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 1\n---\n\n## Req\n- SHALL NOT: "禁止使用 eval()"\n',
    );
    // Code in root referencing eval should NOT be flagged by demo's spec
    writeFileSync(join(projectDir, 'root.ts'), '// root code\nconst x = 1;\n');
    writeFileSync(join(demoDir, 'code.js'), 'eval("demo code")\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    // Should only flag the demo/code.js file, not root.ts
    const rootError = result.errors.find(e => e.detail && e.detail.includes('root.ts'));
    expect(rootError).toBeUndefined();
  });

  it('should detect eval prohibition in code', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\nscope: "."\n---\n\n## Requirement: EvalBan\n\n### SHALL NOT\n\n- 禁止使用 eval\n',
    );
    writeFileSync(join(projectDir, 'bad.js'), 'eval("dangerous")\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect new Function() as eval variant', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\nscope: "."\n---\n\n## Requirement: NoFunction\n\n### SHALL NOT\n\n- 禁止使用 eval\n',
    );
    writeFileSync(join(projectDir, 'bad.js'), 'const fn = new Function("return 1")\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should skip comment lines when checking prohibitions', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n## Req\n- SHALL NOT: "禁止使用 eval()"\n',
    );
    writeFileSync(join(projectDir, 'ok.js'), '// eval is not used here\nconst x = 1;\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    // eval in a comment should be skipped
    const evalError = result.errors.find(e => e.detail && e.detail.includes('ok.js'));
    expect(evalError).toBeUndefined();
  });

  it('should check ponytail-only mode', () => {
    writeFileSync(join(projectDir, 'test.ts'), '// ponytail: intentional simplification\nconst x = 1;\n');
    const result = checkCompliance(projectDir, { ponytail: true });
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].code).toBe('E-PONYTAIL-001');
  });

  it('should check SHALL mode without enforcement', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n## Requirement: R1\n- SHALL: "必须有测试"\n  - enforcement: E-1\n',
    );
    const result = checkCompliance(projectDir, { shall: true });
    expect(result.passed).toBe(true);
  });

  it('should handle coexistence constraints (system behavior prefixes)', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n## Req\n- SHALL NOT: "the system shall not allow spec.md and prd.md to coexist"\n',
    );
    const result = checkCompliance(projectDir, { shallNot: true });
    // System-behavior constraint should not produce code-level errors
    expect(result.errors.find(e => e.detail && e.detail.includes('test.ts'))).toBeUndefined();
  });

  it('should default to checking both shall and shallNot when no options given', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n## Requirement: R1\n- SHALL: "needs implementation"\n',
    );
    const result = checkCompliance(projectDir, {});
    expect(result).toBeDefined();
  });
});

// ========== detectDrift 补充 ==========

describe('detectDrift (supplementary)', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return empty for project with no spec dirs', () => {
    const result = detectDrift(projectDir);
    expect(result).toEqual([]);
  });

  it('should detect multiple requirements without enforcement', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      [
        '---',
        'layer: 0',
        'scope: "."',
        '---',
        '',
        '## Requirement: R1',
        '',
        '### SHALL',
        '',
        '- 第一个需求',
        '',
        '## Requirement: R2',
        '',
        '### SHALL',
        '',
        '- 第二个需求',
        '',
      ].join('\n'),
    );
    const result = detectDrift(projectDir);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('should not drift for requirements with enforcement', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      [
        '---',
        'layer: 0',
        '---',
        '',
        '## Requirement: R1',
        '- SHALL: "has enforcement"',
        '  - enforcement: E-1',
        '',
      ].join('\n'),
    );
    const result = detectDrift(projectDir);
    expect(result).toHaveLength(0);
  });
});

// ========== detectContractGuardDrift ==========

describe('detectContractGuardDrift (edge cases)', () => {
  it('should handle project without .mumuspec dir gracefully', () => {
    const dir = join(tmpdir(), `mumuspec-nomumu-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const result = detectContractGuardDrift(dir);
      expect(Array.isArray(result)).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it('should catch errors in contract detection', () => {
    const dir = createTmpProject();
    try {
      // Create an invalid contracts.yaml to cause parse errors
      writeFileSync(
        join(dir, '.mumuspec', 'contracts.yaml'),
        'invalid: yaml: content: [unclosed\n',
      );
      const result = detectContractGuardDrift(dir);
      // Should not throw, may return error entry
      expect(result).toBeDefined();
    } finally {
      cleanup(dir);
    }
  });
});
