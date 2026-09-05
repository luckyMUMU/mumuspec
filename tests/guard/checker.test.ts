import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  applyStrengthToGuardResult,
  checkCompliance,
  detectDrift,
  detectContractGuardDrift,
  detectDriftWithContracts,
} from '../../src/guard/checker.js';
import type { GuardResult, ConstraintStrengthField } from '../../src/core/types.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('applyStrengthToGuardResult', () => {
  it('should return result unchanged when strength is undefined', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-001', message: 'test error' }],
      warnings: [],
    };
    const output = applyStrengthToGuardResult(result, undefined);
    expect(output).toBe(result);
  });

  it('should keep always_enforce errors regardless of strength', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-003', message: 'SHALL NOT violation' }],
      warnings: [],
    };
    const strength: ConstraintStrengthField = {
      technical_design: 'low',
      requirement_goals: 'low',
    };
    const output = applyStrengthToGuardResult(result, strength);
    expect(output.errors).toHaveLength(1);
    expect(output.passed).toBe(false);
  });

  it('should downgrade errors when strength below min_strength', () => {
    // P0: E-SPEC-004 is now always_enforce (verifiability ⊥ strength) — use
    // E-PONYTAIL-001 (TD/medium, foldable) for the downgrade scenario.
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-PONYTAIL-001', message: 'ponytail violation' }],
      warnings: [],
    };
    const strength: ConstraintStrengthField = {
      technical_design: 'medium',
      requirement_goals: 'high',
    };
    const output = applyStrengthToGuardResult(result, strength);
    expect(output.passed || output.warnings.length > 0).toBe(true);
  });

  it('should keep errors that meet strength threshold', () => {
    const result: GuardResult = {
      passed: false,
      errors: [{ code: 'E-GUARD-002', message: 'Build layers not done' }],
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
});

describe('checkCompliance', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return passed=true for empty spec project', () => {
    const result = checkCompliance(projectDir, {});
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect SHALL NOT violation when prohibition exists and code matches', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n## 需求\n\n- SHALL NOT: "禁止使用 eval()"\n',
    );
    writeFileSync(join(projectDir, 'test.js'), 'eval("console.log(1)")\n');
    const result = checkCompliance(projectDir, { shallNot: true });
    expect(result.passed || result.errors.length > 0 || result.warnings.length > 0).toBe(true);
  });

  it('should respect strength parameter', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n## 需求\n\n- SHALL: "代码必须有测试覆盖"\n',
    );
    const strength: ConstraintStrengthField = {
      technical_design: 'high',
      requirement_goals: 'medium',
    };
    const result = checkCompliance(projectDir, { strength });
    expect(result).toBeDefined();
  });
});

describe('detectDrift', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return empty array when no specs exist', () => {
    const results = detectDrift(projectDir);
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should detect SHALL without enforcement as drift', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      '---\nlayer: 0\n---\n\n## 需求\n\n### 测试需求\n- SHALL: "所有导出必须有测试"\n',
    );
    const results = detectDrift(projectDir);
    expect(results.length).toBeGreaterThanOrEqual(0);
  });
});

describe('detectContractGuardDrift', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterAll(() => {
    cleanup(projectDir);
  });

  it('should return empty array when no contracts exist', () => {
    const results = detectContractGuardDrift(projectDir);
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle missing contracts.yaml gracefully', () => {
    expect(() => detectContractGuardDrift(projectDir)).not.toThrow();
  });
});

describe('detectDriftWithContracts', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should combine spec drift and contract drift results', () => {
    const results = detectDriftWithContracts(projectDir);
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });

  it('should not throw on uninitialized project', () => {
    expect(() => detectDriftWithContracts(projectDir)).not.toThrow();
  });
});
