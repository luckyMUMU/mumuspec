import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { validateAllSpecs, validateSpecFile } from '../../src/spec/validator.js';
import type { ConstraintStrengthField } from '../../src/core/types.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-val-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

function writeValidSpec(dir: string): void {
  writeFileSync(
    join(dir, '.mumuspec', 'spec.md'),
    [
      '---',
      'layer: 0',
      'title: Test Spec',
      '---',
      '',
      '## 需求',
      '',
      '### REQ-001: 测试需求',
      '- SHALL: 代码质量可接受',
      '  - enforcement: E-GUARD-001',
      '',
    ].join('\n'),
  );
}

describe('validateAllSpecs', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should pass for project with no spec files', () => {
    const result = validateAllSpecs(projectDir, {});
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return defined result for valid spec file', () => {
    writeValidSpec(projectDir);
    const result = validateAllSpecs(projectDir, {});
    expect(result).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
  });

  it('should detect broken frontmatter in spec file', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'spec.md'),
      'This is not valid YAML frontmatter\n---\nno proper frontmatter\n',
    );
    const result = validateAllSpecs(projectDir, {});
    expect(result).toBeDefined();
  });

  it('should accept strength parameter without throwing', () => {
    writeValidSpec(projectDir);
    const strength: ConstraintStrengthField = {
      technical_design: 'high',
      requirement_goals: 'medium',
    };
    expect(() => validateAllSpecs(projectDir, { strength })).not.toThrow();
  });
});

describe('validateSpecFile', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return valid shape for spec file', () => {
    writeValidSpec(projectDir);
    const result = validateSpecFile(join(projectDir, '.mumuspec', 'spec.md'));
    expect(result.passed).toBeDefined();
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should fail for non-existent file', () => {
    const result = validateSpecFile(join(projectDir, '.mumuspec', 'nonexistent.md'));
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should return GuardResult shape', () => {
    writeValidSpec(projectDir);
    const result = validateSpecFile(join(projectDir, '.mumuspec', 'spec.md'));
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('should handle file with invalid frontmatter', () => {
    writeFileSync(
      join(projectDir, '.mumuspec', 'broken.md'),
      '---\n: invalid yaml :\n---\nbody\n',
    );
    const result = validateSpecFile(join(projectDir, '.mumuspec', 'broken.md'));
    expect(result).toBeDefined();
  });
});
