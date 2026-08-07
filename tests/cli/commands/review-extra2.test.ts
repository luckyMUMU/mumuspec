/**
 * Extra tests for review command (round 2) — printReviewReport via action callback,
 * executeReview edge-case branches (contractCompleteness deep deductions,
 * workflow max score, specConsistency clean BOUNDARY.md, test coverage = 2),
 * plus listModuleFiles / countTestFiles error paths.
 *
 * Targets previously uncovered lines: 105-206, 230-270.
 * Goal: push review.ts line coverage from ~78% to 95%+.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ── Hoisted mocks (before imports) ─────────────────────────────────────────

const mockFindProjectRoot = vi.fn();

vi.mock('../../../src/core/utils.js', () => ({
  findProjectRoot: () => mockFindProjectRoot(),
  now: () => '2026-08-22T10:00:00.000Z',
}));

// Import after mocks are set up
const { registerReviewCommand, executeReview } = await import(
  '../../../src/cli/commands/review.js'
);

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Create a minimal Commander program that captures subcommand registration.
 */
function createMockProgram() {
  let capturedCallback: ((opts: any) => void) | null = null;

  const mockProgram = {
    command: vi.fn().mockImplementation(() => {
      return {
        description: vi.fn().mockReturnThis(),
        option: vi.fn().mockReturnThis(),
        action: vi.fn().mockImplementation((cb: any) => {
          capturedCallback = cb;
        }),
      };
    }),
  };

  return { mockProgram: mockProgram as any, getCapturedCallback: () => capturedCallback };
}

let testRoot: string;

/** Create a module directory under src/ with optional BOUNDARY.md and files. */
function createModule(
  name: string,
  files: Record<string, string>,
  opts?: {
    noBoundary?: boolean;
    boundaryContent?: string;
  }
): void {
  const modPath = join(testRoot, 'src', name);
  mkdirSync(modPath, { recursive: true });

  if (!opts?.noBoundary) {
    const defaultBoundary = opts?.boundaryContent ?? [
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
    writeFileSync(join(modPath, 'BOUNDARY.md'), defaultBoundary);
  }

  for (const [fname, content] of Object.entries(files)) {
    writeFileSync(join(modPath, fname), content);
  }
}

/** Create test files for a module in the tests/ directory. */
function createTestFiles(moduleName: string, count: number): void {
  const testDir = join(testRoot, 'tests', moduleName);
  mkdirSync(testDir, { recursive: true });
  for (let i = 0; i < count; i++) {
    writeFileSync(
      join(testDir, `fn-${i}.test.ts`),
      `describe('test ${i}', () => { it('works', () => {}); });\n`
    );
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('registerReviewCommand — action callback with printReviewReport', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-print-'));
    mkdirSync(testRoot, { recursive: true });
    mkdirSync(join(testRoot, 'src'), { recursive: true });
    mockFindProjectRoot.mockReturnValue(testRoot);
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should render report header with 0 modules when src/ is empty', () => {
    const { mockProgram, getCapturedCallback } = createMockProgram();
    registerReviewCommand(mockProgram);
    const callback = getCapturedCallback();

    callback!({ module: undefined, json: false, minScore: '9' });

    // Header lines
    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('MumuSpec Module Review');
    expect(output).toContain('Modules reviewed: 0');
    expect(output).toContain('Overall average:  0/10');
  });

  it('should render a passing module with checkmark (overall >= minScore)', () => {
    createModule('goodmod', {
      'index.ts': 'export * from "./impl.js";',
      'impl.ts': 'export const bar = (x: number): string => String(x);',
    });
    createTestFiles('goodmod', 4);

    const { mockProgram, getCapturedCallback } = createMockProgram();
    registerReviewCommand(mockProgram);
    const callback = getCapturedCallback();

    callback!({ module: undefined, json: false, minScore: '5' });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    // ✓ flag for passing module
    expect(output).toContain('✓');
    expect(output).toContain('goodmod');
    // formatDimensions output: "k=v | k=v"
    expect(output).toMatch(/规范层一致性=\d+/);
    expect(output).toMatch(/契约层完整性=\d+/);
  });

  it('should render a failing module with warning (overall < minScore)', () => {
    createModule('badmod', {
      'bad.ts': 'export const x: any = 1;',
    }, { noBoundary: true });

    const { mockProgram, getCapturedCallback } = createMockProgram();
    registerReviewCommand(mockProgram);
    const callback = getCapturedCallback();

    callback!({ module: undefined, json: false, minScore: '9' });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    // ⚠ flag for failing module
    expect(output).toContain('⚠');
    expect(output).toContain('badmod');
  });

  it('should print issues for modules that have them', () => {
    createModule('issuemod', {
      'impl.ts': 'export const val: any = 1; // @ts-ignore\n',
    });

    const { mockProgram, getCapturedCallback } = createMockProgram();
    registerReviewCommand(mockProgram);
    const callback = getCapturedCallback();

    callback!({ module: undefined, json: false, minScore: '5' });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    // Issues prefixed with "!"
    expect(output).toContain('!');
    expect(output).toContain('Uses any type');
  });

  it('should render below-min-score summary when some modules are flagged', () => {
    createModule('highmod', {
      'index.ts': 'export * from "./impl.js";',
      'impl.ts': 'export const bar = (x: number): string => String(x);',
    });
    createModule('lowmod', {
      'x.ts': 'export const v: any = 1;',
    }, { noBoundary: true });

    createTestFiles('highmod', 4);

    const { mockProgram, getCapturedCallback } = createMockProgram();
    registerReviewCommand(mockProgram);
    const callback = getCapturedCallback();

    callback!({ module: undefined, json: false, minScore: '9' });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('module(s) below 9/10 threshold');
    expect(output).toContain('lowmod');
  });

  it('should NOT render below-min-score summary when all modules pass', () => {
    createModule('passing', {
      'index.ts': 'export * from "./impl.js";',
      'impl.ts': 'export const bar = (x: number): string => String(x);',
    });
    createTestFiles('passing', 4);

    const { mockProgram, getCapturedCallback } = createMockProgram();
    registerReviewCommand(mockProgram);
    const callback = getCapturedCallback();

    callback!({ module: undefined, json: false, minScore: '5' });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).not.toContain('module(s) below');
  });

  it('should pad moduleName to 12 characters', () => {
    createModule('ab', {
      'impl.ts': 'export const x = 1;',
    });
    createTestFiles('ab', 4);

    const { mockProgram, getCapturedCallback } = createMockProgram();
    registerReviewCommand(mockProgram);
    const callback = getCapturedCallback();

    callback!({ module: undefined, json: false, minScore: '5' });

    const output = consoleLogSpy.mock.calls.map((c) => c[0]).join('\n');
    // moduleName pads to 12 chars: "ab" → "ab          " (12 total)
    // The padEnd(12) means the name segment is 12 chars wide
    expect(output).toMatch(/ab {10}/);
  });
});

describe('executeReview — contractCompleteness deep deductions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-contract-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should deduct all three sections from contractCompleteness when BOUNDARY.md has none', () => {
    const modPath = join(testRoot, 'src', 'bare');
    mkdirSync(modPath, { recursive: true });
    // BOUNDARY.md exists but has none of: 对外接口, 数据契约, 依赖_DECLARATION
    writeFileSync(join(modPath, 'BOUNDARY.md'), '# Empty Boundary\n');
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    // contractCompleteness = 10 - 2 - 2 - 2 = 4
    expect(mod.dimensions['契约层完整性']).toBe(4);
  });

  it('should deduct only for missing sections (对外接口 present, others missing)', () => {
    const modPath = join(testRoot, 'src', 'partial');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      'api surface',
      '',
    ].join('\n'));
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    // contractCompleteness = 10 - 2 - 2 = 6 (对外接口 present: no deduction)
    expect(mod.dimensions['契约层完整性']).toBe(6);
  });
});

describe('executeReview — specConsistency with clean BOUNDARY.md', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-specclean-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should give specConsistency = 10 when BOUNDARY.md has all sections', () => {
    createModule('cleanmod', {
      'impl.ts': 'export const x: number = 1;',
    }, {
      boundaryContent: [
        '# Boundary',
        '',
        '## 对外接口',
        'api',
        '',
        '## 数据契约',
        'data',
        '',
        '## 依赖声明',
        'none',
        '',
        '## 变更日志',
        '- 2026-08: initial',
        '',
      ].join('\n'),
    });

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    expect(mod.dimensions['规范层一致性']).toBe(10);
  });

  it('should give specConsistency = 9 when BOUNDARY.md is missing only 变更日志', () => {
    const modPath = join(testRoot, 'src', 'nochangelog');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      'api',
      '',
      '## 依赖声明',
      'none',
      '',
    ].join('\n'));
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    // specConsistency = 10 - 1 (missing 变更日志) - 1 (missing 数据契约) = 8
    // Wait: code checks for 依赖_DECLARATION not 数据契约 for specConsistency
    // Line 112: !boundaryContent.includes('变更日志') → -1
    // Line 115: !boundaryContent.includes('依赖_DECLARATION') → -1
    // This BOUNDARY.md has 对外接口 and 依赖_DECLARATION, but NOT 变更日志
    // specConsistency = 10 - 1 (missing 变更日志) = 9
    expect(mod.dimensions['规范层一致性']).toBe(9);
  });
});

describe('executeReview — workflow max score', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-workflowmax-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should give workflow = 9 when index.ts exists and BOUNDARY.md has all sections', () => {
    createModule('wfmax', {
      'index.ts': 'export * from "./impl.js";',
      'impl.ts': 'export const x: number = 1;',
    }, {
      boundaryContent: [
        '# Boundary',
        '',
        '## 对外接口',
        'api',
        '',
        '## 依赖声明',
        'none',
        '',
        '## 变更日志',
        '- 2026-08: initial',
        '',
      ].join('\n'),
    });

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    // workflow = 6 + 1 (index.ts) + 1 (对外接口 && 依赖声明) + 1 (变更日志) = 9
    expect(mod.dimensions['工作流完整性']).toBe(9);
  });
});

describe('executeReview — test coverage branch with exactly 2 tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-twotests-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should give testCoverage = 8 when exactly 2 test files exist', () => {
    createModule('twotests', {
      'impl.ts': 'export const x: number = 1;',
    });
    createTestFiles('twotests', 2);

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    // testFiles = 2 → testCoverage = 8
    expect(mod.dimensions['测试覆盖度']).toBe(8);
  });
});

describe('executeReview — docSync deduction branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-docsync-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should deduct docSync when BOUNDARY.md lacks current month and 2026-08', () => {
    const modPath = join(testRoot, 'src', 'olddocs');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      'api',
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
    createTestFiles('olddocs', 4);

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    // docSync = 10 - 2 = 8 (no '2026-08' in content)
    expect(mod.dimensions['文档同步']).toBe(8);
  });

  it('should give docSync = 10 when BOUNDARY.md contains current month string', () => {
    const modPath = join(testRoot, 'src', 'newdocs');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary',
      '',
      '## 对外接口',
      'api',
      '',
      '## 数据契约',
      'data',
      '',
      '## 依赖声明',
      'none',
      '',
      '## 变更日志',
      '- 2026-08-15: fresh entry',
      '',
    ].join('\n'));
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');
    createTestFiles('newdocs', 4);

    const result = executeReview(testRoot);
    const mod = result.modules.find((m) => m.module === 'newdocs')!;
    expect(mod.dimensions['文档同步']).toBe(10);
  });

  it('should give docSync = 10 when no BOUNDARY.md exists (no deduction)', () => {
    const modPath = join(testRoot, 'src', 'noboundary');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'impl.ts'), 'export const x: number = 1;');
    createTestFiles('noboundary', 4);

    const result = executeReview(testRoot);
    const mod = result.modules.find((m) => m.module === 'noboundary')!;
    // No BOUNDARY.md → docSync stays at 10
    expect(mod.dimensions['文档同步']).toBe(10);
  });
});

describe('executeReview — overall average with single module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-avgsingle-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should set overall_average equal to the single module overall score', () => {
    createModule('single', {
      'impl.ts': 'export const x: number = 1;',
    });
    createTestFiles('single', 4);

    const result = executeReview(testRoot);
    expect(result.modules_reviewed).toBe(1);
    expect(result.overall_average).toBe(result.modules[0].overall);
  });
});

describe('executeReview — overall average rounding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-avground-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should round overall_average to 1 decimal place', () => {
    // Create two modules with different scores to produce a non-trivial average
    createModule('moda', {
      'impl.ts': 'export const a: number = 1;',
    });
    createModule('modb', {
      'impl.ts': 'export const b: string = "hello";',
    }, { noBoundary: true });

    createTestFiles('moda', 5);

    const result = executeReview(testRoot);
    // overall_average should be a number
    expect(typeof result.overall_average).toBe('number');
    // At most 1 decimal place
    const str = String(result.overall_average);
    const parts = str.split('.');
    expect(parts.length).toBeLessThanOrEqual(2);
    if (parts.length === 2) {
      expect(parts[1].length).toBeLessThanOrEqual(1);
    }
  });
});

describe('executeReview — as any type detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testRoot = mkdtempSync(join(tmpdir(), 'review-extra2-asany-'));
  });

  afterEach(() => {
    rmSync(testRoot, { recursive: true, force: true });
  });

  it('should detect both ": any" and "as any" patterns', () => {
    const modPath = join(testRoot, 'src', 'anymod');
    mkdirSync(modPath, { recursive: true });
    writeFileSync(join(modPath, 'BOUNDARY.md'), [
      '# Boundary', '', '## 对外接口', 'api', '', '## 数据契约', 'd', '',
      '## 依赖声明', 'none', '', '## 变更日志', '- 2026-08 entry', '',
    ].join('\n'));
    // Contains both patterns
    writeFileSync(
      join(modPath, 'impl.ts'),
      'export const a: any = {};\nexport const b = foo as any;\n'
    );
    createTestFiles('anymod', 4);

    const result = executeReview(testRoot);
    const mod = result.modules[0];
    // typeSystem -= 3 (for any), but only once regardless of count
    // No @ts-ignore or @ts-nocheck
    // typeSystem = 10 - 3 = 7
    expect(mod.dimensions['类型系统']).toBe(7);
    expect(mod.issues).toContain('Uses any type');
  });
});
