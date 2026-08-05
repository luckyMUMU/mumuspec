import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadScenario,
  discoverScenarios,
  runScenario,
  runAllEvals,
  initEvalsDir,
} from '../../src/eval/runner.js';
import type { EvalScenario } from '../../src/eval/runner.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-eval-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('loadScenario', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should throw for non-existent file', () => {
    expect(() => loadScenario(join(projectDir, 'nonexistent.yaml'))).toThrow();
  });

  it('should load a minimal scenario', () => {
    const file = join(projectDir, 'test.yaml');
    writeFileSync(file, 'name: test-scenario\ntype: custom\n');
    const scenario = loadScenario(file);
    expect(scenario.name).toBe('test-scenario');
    expect(scenario.type).toBe('custom');
  });

  it('should parse expected section', () => {
    const file = join(projectDir, 'test.yaml');
    writeFileSync(file, 'name: test\ntype: compliance\nexpected:\n  maxErrors: 0\n');
    const scenario = loadScenario(file);
    expect(scenario.expected?.maxErrors).toBe(0);
  });

  it('should parse assertions list', () => {
    const file = join(projectDir, 'assert.yaml');
    writeFileSync(file, [
      'name: assert-test',
      'type: custom',
      'assertions:',
      '  - "errors.length === 0"',
      '',
    ].join('\n'));
    const scenario = loadScenario(file);
    expect(scenario.assertions).toBeDefined();
  });

  it('should default type to compliance', () => {
    const file = join(projectDir, 'default.yaml');
    writeFileSync(file, 'name: default-test\n');
    const scenario = loadScenario(file);
    expect(scenario.type).toBe('compliance');
  });

  it('should use filename as fallback name', () => {
    const file = join(projectDir, 'my-scenario.yaml');
    writeFileSync(file, 'type: custom\n');
    const scenario = loadScenario(file);
    expect(scenario.name).toBe('my-scenario');
  });
});

describe('discoverScenarios', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return empty for missing evals dir', () => {
    const result = discoverScenarios(projectDir);
    expect(result).toEqual([]);
  });

  it('should discover YAML files in evals dir', () => {
    const evalsDir = join(projectDir, '.mumuspec', 'evals');
    mkdirSync(evalsDir, { recursive: true });
    writeFileSync(join(evalsDir, 'test1.yaml'), 'name: t1\ntype: custom\n');
    writeFileSync(join(evalsDir, 'test2.yml'), 'name: t2\ntype: custom\n');
    writeFileSync(join(evalsDir, 'readme.txt'), 'not a yaml');

    const result = discoverScenarios(projectDir);
    expect(result.length).toBe(2);
  });
});

describe('runScenario', () => {
  it('should return result with passed flag', () => {
    const scenario: EvalScenario = {
      name: 'test-pass',
      type: 'custom',
    };
    const result = runScenario(scenario);
    expect(result).toHaveProperty('passed');
    expect(result.scenario).toBe('test-pass');
    expect(typeof result.duration).toBe('number');
  });

  it('should handle compliance type', () => {
    const dir = createTmpProject();
    try {
      const scenario: EvalScenario = {
        name: 'compliance-test',
        type: 'compliance',
        projectRoot: dir,
        expected: { maxErrors: 100 },
      };
      const result = runScenario(scenario);
      expect(result.details).toContain('Compliance');
    } finally {
      cleanup(dir);
    }
  });

  it('should handle phase-guard missing params', () => {
    const scenario: EvalScenario = {
      name: 'guard-test',
      type: 'phase-guard',
      // Missing changeName and targetPhase
    };
    const result = runScenario(scenario);
    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle unknown scenario type gracefully', () => {
    const scenario = {
      name: 'unknown-test',
      type: 'nonexistent-type',
    } as EvalScenario;
    const result = runScenario(scenario);
    expect(result.warnings.some((w) => w.includes('Unknown'))).toBe(true);
  });

  it('should check assertion errors.length correctly', () => {
    const scenario: EvalScenario = {
      name: 'assertion-test',
      type: 'custom',
      assertions: ['errors.length === 0'],
    };
    const result = runScenario(scenario);
    expect(result.passed).toBe(true);
  });
});

describe('runAllEvals', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should return zero report for empty evals dir', () => {
    mkdirSync(join(projectDir, '.mumuspec', 'evals'), { recursive: true });
    const report = runAllEvals(projectDir);
    expect(report.total).toBe(0);
    expect(report.passed).toBe(0);
  });

  it('should run all discovered scenarios', () => {
    const evalsDir = join(projectDir, '.mumuspec', 'evals');
    mkdirSync(evalsDir, { recursive: true });
    writeFileSync(join(evalsDir, 'test.yaml'), 'name: t1\ntype: custom\n');

    const report = runAllEvals(projectDir);
    expect(report.total).toBe(1);
    expect(report.results).toHaveLength(1);
  });
});

describe('initEvalsDir', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = createTmpProject();
  });

  afterEach(() => {
    cleanup(projectDir);
  });

  it('should create evals dir with sample files', () => {
    const result = initEvalsDir(projectDir);
    expect(result.errors).toHaveLength(0);
    expect(result.created.length).toBeGreaterThanOrEqual(2);
    expect(existsSync(join(projectDir, '.mumuspec', 'evals'))).toBe(true);
  });

  it('should not overwrite existing files', () => {
    initEvalsDir(projectDir);
    const result2 = initEvalsDir(projectDir);
    expect(result2.created).toHaveLength(0);
  });
});
