/**
 * Deep tests for src/cli/commands/review.ts — executeReview scoring branches.
 *
 * Goal: increase coverage of review.ts beyond current ~78%.
 *
 * Strategy: use real temporary directories + vi.mock for findProjectRoot/now.
 * Covers all scoreModule branches: high/medium/low modules, no tests,
 * missing BOUNDARY.md, any type, ts-ignore, self-import, etc.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Hoisted mocks ──────────────────────────────────────────────────────

vi.mock('../../../src/core/utils.js', () => ({
  findProjectRoot: () => '/tmp/mumuspec-test',
  now: () => '2026-08-22T10:00:00.000Z',
}));

// Import after mock is set up
const { executeReview } = await import('../../../src/cli/commands/review.js');

// ── Helpers ────────────────────────────────────────────────────────────

let testRoot: string;

/** Create a fake module directory under src/ with given name and content */
function createModule(name: string, files: Record<string, string>, opts?: { noBoundary?: boolean }): void {
  const modPath = join(testRoot, 'src', name);
  mkdirSync(modPath, { recursive: true });

  if (!opts?.noBoundary) {
    const boundaryContent = [
      '# Boundary',
      '',
      '## 对外接口',
      'Some API',
      '',
      '## 数据契约',
      'Some data contract',
      '',
      '## 依赖声明',
      'Some deps',
      '',
      '## 变更日志',
      '- 2026-08-20: initial',
      '',
    ].join('\n');
    writeFileSync(join(modPath, 'BOUNDARY.md'), boundaryContent);
  }

  for (const [fname, content] of Object.entries(files)) {
    writeFileSync(join(modPath, fname), content);
  }
}

/** Create test files for a module in the tests/ directory */
function createTestFiles(moduleName: string, count: number): void {
  const testDir = join(testRoot, 'tests', moduleName);
  mkdirSync(testDir, { recursive: true });
  for (let i = 0; i < count; i++) {
    writeFileSync(join(testDir, `fn-${i}.test.ts`), `describe('test ${i}', () => { it('works', () => {}); });\n`);
  }
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('executeReview — high score module', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-high-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('scores high when module has BOUNDARY.md with all sections, no any, no ts-ignore, and 4+ test files', () => {
    createModule('highmod', {
      'index.ts': 'export * from "./impl.js";',
      'impl.ts': 'export const bar = (x: number): string => String(x);',
    }, { noBoundary: false });

    createTestFiles('highmod', 4);

    const summary = executeReview(testRoot);
    expect(summary.modules).toHaveLength(1);
    expect(summary.modules[0].module).toBe('highmod');
    expect(summary.modules[0].overall).toBeGreaterThanOrEqual(8);
    expect(summary.modules[0].issues).toHaveLength(0);
  });

  it('scores high with BOUNDARY.md that has no changelog or deps deductions', () => {
    // All-but-changelog boundary
    const modPath = join(testRoot, 'src', 'nobound');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      'API surface',
      '',
      '## 依赖声明',
      'Dep list',
      '',
    ].join('\n'));
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');

    createTestFiles('nobound', 5);

    const summary = executeReview(testRoot, 'nobound');
    expect(summary.modules).toHaveLength(1);
    expect(summary.modules[0].overall).toBeGreaterThanOrEqual(7);
  });
});

describe('executeReview — medium score module', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-med-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('scores ~8-9 when module has 2-3 test files (medium test coverage)', () => {
    createModule('medmod', {
      'core.ts': 'export function process(): boolean { return true; }',
    });

    createTestFiles('medmod', 3);

    const summary = executeReview(testRoot);
    expect(summary.modules).toHaveLength(1);
    expect(summary.modules[0].overall).toBeGreaterThanOrEqual(7);
    expect(summary.modules[0].overall).toBeLessThan(10);
  });

  it('scores ~7-8 with 2 test files', () => {
    createModule('twomod', {
      'util.ts': 'export const add = (a: number, b: number): number => a + b;',
    });

    createTestFiles('twomod', 2);

    const summary = executeReview(testRoot);
    expect(summary.modules[0].overall).toBeGreaterThanOrEqual(6);
  });
});

describe('executeReview — low score module', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-low-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testRoot, { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('scores low when BOUNDARY.md is entirely missing (spec + contract deductions + test suggestion)', () => {
    createModule('lowmod', {
      'bad.ts': 'export const x: any = 1; // @ts-ignore: testing\n',
    }, { noBoundary: true });

    // No test files at all

    const summary = executeReview(testRoot);
    expect(summary.modules).toHaveLength(1);
    expect(summary.modules[0].overall).toBeLessThan(7);
    expect(summary.modules[0].issues).toContain('Missing BOUNDARY.md');
    expect(summary.modules[0].issues).toContain('Uses any type');
    expect(summary.modules[0].issues).toContain('Has @ts-ignore or @ts-nocheck');
    expect(summary.modules[0].suggestions.some((s) => s.includes('unit tests'))).toBe(true);
  });

  it('detects self-import risk and deducts architecture score', () => {
    mkdirSync(join(testRoot, 'src', 'selfimp'), { recursive: true });
    writeFileSync(join(testRoot, 'src', 'selfimp', 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      '- doWork',
      '',
      '## 数据契约',
      'Data shapes',
      '',
      '## 依赖声明',
      'None',
      '',
      '## 变更日志',
      '- 2026-08 initial',
      '',
    ].join('\n'));
    writeFileSync(join(testRoot, 'src', 'selfimp', 'impl.ts'), `
import { helper } from '../selfimp/helper.js';
export const doWork = (): any => helper();
`);
    writeFileSync(join(testRoot, 'src', 'selfimp', 'index.ts'), 'export * from "./impl.js";');

    createTestFiles('selfimp', 4);

    const summary = executeReview(testRoot);
    const mod = summary.modules.find((m) => m.module === 'selfimp')!;
    expect(mod.issues).toContain('Possible self-import or circular dependency');
  });

  it('deducts for ts-nocheck', () => {
    createModule('nocheckmod', {
      'handler.ts': '// @ts-nocheck\nexport const handler = () => 42;\n',
    });

    createTestFiles('nocheckmod', 4);

    const summary = executeReview(testRoot);
    expect(summary.modules[0].issues).toContain('Has @ts-ignore or @ts-nocheck');
  });
});

describe('executeReview — directory does not exist', () => {
  it('returns empty summary when src/ does not exist', () => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-nosrc-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testRoot, { recursive: true });

    const summary = executeReview(testRoot);
    expect(summary.modules).toHaveLength(0);
    expect(summary.modules_reviewed).toBe(0);
    expect(summary.overall_average).toBe(0);

    rmSync(testRoot, { recursive: true, force: true });
  });
});

describe('executeReview — filterModule', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testRoot, 'src/keep'), { recursive: true });
    mkdirSync(join(testRoot, 'src/skip'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('returns only the specified module when --module filter is used', () => {
    createModule('keep', { 'a.ts': 'export const a = 1;' });
    createModule('skip', { 'b.ts': 'export const b = 2;' });

    createTestFiles('keep', 4);
    createTestFiles('skip', 4);

    const summary = executeReview(testRoot, 'keep');
    expect(summary.modules).toHaveLength(1);
    expect(summary.modules[0].module).toBe('keep');
  });

  it('returns empty when filter does not match any module', () => {
    createModule('exists', { 'a.ts': 'export const a = 1;' });
    createTestFiles('exists', 4);

    const summary = executeReview(testRoot, 'nonexistent');
    expect(summary.modules).toHaveLength(0);
  });
});

describe('executeReview — dot-prefixed directories are skipped', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-dot-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('skips dot-prefixed and cli directories', () => {
    mkdirSync(join(testRoot, 'src', '.hidden'), { recursive: true });
    mkdirSync(join(testRoot, 'src', 'cli'), { recursive: true });
    createModule('real', { 'a.ts': 'export const a = 1;' });
    createTestFiles('real', 4);

    const summary = executeReview(testRoot);
    const names = summary.modules.map((m) => m.module);
    expect(names).not.toContain('.hidden');
    expect(names).not.toContain('cli');
    expect(names).toContain('real');
  });
});

describe('executeReview — docSync date check', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-dates-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testRoot, 'src/datecheck'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('deducts docSync when BOUNDARY.md lacks current month string', () => {
    const modPath = join(testRoot, 'src', 'datecheck');
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      '- api',
      '',
      '## 数据契约',
      'data',
      '',
      '## 依赖声明',
      'none',
      '',
      '## 变更日志',
      '- 2025-01-01: old entry',
      '',
    ].join('\n'));
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');

    createTestFiles('datecheck', 4);

    const summary = executeReview(testRoot);
    const mod = summary.modules[0];
    expect(mod.dimensions['文档同步']).toBeLessThanOrEqual(10);
  });

  it('does not deduct docSync when BOUNDARY.md contains 2026-08', () => {
    const modPath = join(testRoot, 'src', 'datemod');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      '- api',
      '',
      '## 数据契约',
      'data',
      '',
      '## 依赖声明',
      'none',
      '',
      '## 变更日志',
      '- 2026-08-01: recent entry',
      '',
    ].join('\n'));
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');

    createTestFiles('datemod', 4);

    const summary = executeReview(testRoot);
    const mod = summary.modules.find((m) => m.module === 'datemod')!;
    expect(mod.dimensions['文档同步']).toBe(10);
  });
});

describe('executeReview — overall average computation', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-avg-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('computes overall average across all modules', () => {
    createModule('moda', { 'a.ts': 'export const a = 1;' });
    createModule('modb', { 'b.ts': 'export const b = 2;' });

    createTestFiles('moda', 4);
    createTestFiles('modb', 4);

    const summary = executeReview(testRoot);
    expect(summary.modules).toHaveLength(2);
    expect(summary.modules_reviewed).toBe(2);
    expect(summary.overall_average).toBeGreaterThan(0);
  });
});

describe('executeReview — flat test files pattern (tests/<module>*.test.ts)', () => {
  beforeEach(() => {
    testRoot = join(tmpdir(), `mumuspec-review-deep-flat-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testRoot, 'src/flatmod'), { recursive: true });
    mkdirSync(join(testRoot, 'tests'), { recursive: true });
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('counts flat test files in tests/ directory that start with module name', () => {
    const modPath = join(testRoot, 'src', 'flatmod');
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary', '', '## 对外接口', 'api', '', '## 数据契约', 'd', '',
      '## 依赖声明', 'none', '', '## 变更日志', '- 2026-08 entry', '',
    ].join('\n'));
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');

    // Flat test files
    writeFileSync(join(testRoot, 'tests', 'flatmod.test.ts'), 'test("1");');
    writeFileSync(join(testRoot, 'tests', 'flatmod-extra.test.ts'), 'test("2");');
    writeFileSync(join(testRoot, 'tests', 'flatmod-special.test.ts'), 'test("3");');

    const summary = executeReview(testRoot);
    const mod = summary.modules.find((m) => m.module === 'flatmod')!;
    expect(mod.dimensions['测试覆盖度']).toBeGreaterThanOrEqual(9);
  });
});
