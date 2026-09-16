/**
 * Handler-level tests for eval subcommands (init, list, run).
 *
 * Strategy: mock lower-level modules (eval/runner, core/utils),
 * register commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import type { CorpusScenarioReport, EvalReport } from '../../../src/eval/runner.js';

// ── Mock functions (shared references) ──
const mockFindProjectRoot = vi.fn();
const mockInitEvalsDir = vi.fn();
const mockDiscoverScenarios = vi.fn();
const mockLoadScenario = vi.fn();
const mockRunScenario = vi.fn();
const mockRunAllEvals = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/eval/runner.js', () => ({
  loadScenario: mockLoadScenario,
  runScenario: mockRunScenario,
  runAllEvals: mockRunAllEvals,
  discoverScenarios: mockDiscoverScenarios,
  initEvalsDir: mockInitEvalsDir,
}));

// L2-C15：report.metrics 由进程内直调 L1 两评估器得到 —— mock 评估器依赖
// （spawn / audit.log），避免测试真跑子进程（R-6）。
const mockVerifiableRatioEvaluate = vi.fn();
const mockFailOpenEvaluate = vi.fn();

vi.mock('../../../src/core/metrics/verifiable-ratio.js', () => ({
  VERIFIABLE_RATIO_NAME: 'verifiable-ratio',
  verifiableRatioEvaluator: {
    name: 'verifiable-ratio',
    defaultWeight: 0,
    evaluate: mockVerifiableRatioEvaluate,
  },
}));

vi.mock('../../../src/core/metrics/fail-open-count.js', () => ({
  FAIL_OPEN_COUNT_NAME: 'fail-open-count',
  FAIL_OPEN_COUNT_CAP: 10,
  failOpenCountEvaluator: {
    name: 'fail-open-count',
    defaultWeight: 0,
    evaluate: mockFailOpenEvaluate,
  },
}));

// ── Helpers ──

let tempDir: string;

function setupTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'mumuspec-eval-test-'));
  mkdirSync(join(dir, '.mumuspec', 'evals'), { recursive: true });
  return dir;
}

async function createProgram() {
  const { registerEvalCommands } = await import('../../../src/cli/commands/eval.js');
  const program = new Command();
  registerEvalCommands(program);
  return program;
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('eval handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = setupTempDir();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    // Reset all mock functions (factory mocks are NOT reset by restoreAllMocks)
    mockFindProjectRoot.mockReset();
    mockInitEvalsDir.mockReset();
    mockDiscoverScenarios.mockReset();
    mockLoadScenario.mockReset();
    mockRunScenario.mockReset();
    mockRunAllEvals.mockReset();
    mockFindProjectRoot.mockReturnValue(tempDir);
    // L1 评估器 mock：默认健康态（verifiable-ratio strong 0.75 / fail-open 0 条）
    mockVerifiableRatioEvaluate.mockReset();
    mockFailOpenEvaluate.mockReset();
    mockVerifiableRatioEvaluate.mockResolvedValue({
      name: 'verifiable-ratio',
      value: 0.75,
      weight: 0,
      details: 'strong 15/20 (strong_ratio 0.750); weak 3 manual 2 unverifiable 0',
      rawData: { total: 20, enforced_strong: 15, enforced_weak: 3, manual: 2, unverifiable: 0 },
    });
    mockFailOpenEvaluate.mockResolvedValue({
      name: 'fail-open-count',
      value: 1,
      weight: 0,
      details: '0 non-success audit entries across 0 action(s)',
      rawData: { total: 0, cap: 10, byAction: {}, entries: [] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ── init subcommand ──

  describe('init handler', () => {
    it('should print created files on success', async () => {
      mockInitEvalsDir.mockReturnValue({
        created: [
          join(tempDir, '.mumuspec', 'evals', 'sample-compliance.yaml'),
          join(tempDir, '.mumuspec', 'evals', 'sample-drift.yaml'),
        ],
        errors: [],
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'init', '--workspace-path', tempDir], { from: 'user' });

      expect(mockInitEvalsDir).toHaveBeenCalledWith(tempDir);
      expect(logSpy).toHaveBeenCalledWith('✓ Created eval scenarios:');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should print errors and exit(1) when init fails', async () => {
      mockInitEvalsDir.mockReturnValue({
        created: [],
        errors: ['Failed to create evals dir: EACCES'],
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'init', '--workspace-path', tempDir], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ Failed to create evals dir: EACCES');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when not in a project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const program = await createProgram();
      await program.parseAsync(['eval', 'init', '--workspace-path', '/no/such/dir'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── list subcommand ──

  describe('list handler', () => {
    it('should print guidance when no scenarios found', async () => {
      mockDiscoverScenarios.mockReturnValue([]);

      const program = await createProgram();
      await program.parseAsync(['eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No eval scenarios found.');
      expect(logSpy).toHaveBeenCalledWith('  Run `mumuspec eval init` to create sample scenarios.');
    });

    it('should print each scenario name and type', async () => {
      const scenarioFile = join(tempDir, '.mumuspec', 'evals', 'sample-compliance.yaml');
      writeFileSync(scenarioFile, 'name: sample-compliance\ntype: compliance\n');

      mockDiscoverScenarios.mockReturnValue([scenarioFile]);
      mockLoadScenario.mockReturnValue({
        name: 'sample-compliance',
        description: 'Verify compliance',
        type: 'compliance',
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('sample-compliance'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('compliance'));
    });

    it('should print error for unloadable scenario', async () => {
      const badFile = join(tempDir, '.mumuspec', 'evals', 'broken.yaml');
      writeFileSync(badFile, 'corrupted content');

      mockDiscoverScenarios.mockReturnValue([badFile]);
      mockLoadScenario.mockImplementation(() => {
        throw new Error('Invalid scenario: missing name');
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'list', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid scenario: missing name')
      );
    });
  });

  // ── run subcommand ──

  describe('run handler', () => {
    it('should run all scenarios when no name given', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 2,
        passed: 2,
        failed: 0,
        results: [
          { scenario: 'test-1', passed: true, errors: [], warnings: [], details: 'ok', duration: 10 },
          { scenario: 'test-2', passed: true, errors: [], warnings: [], details: 'ok', duration: 20 },
        ],
        duration: 30,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--workspace-path', tempDir], { from: 'user' });

      expect(mockRunAllEvals).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('2/2 passed'));
      expect(logSpy).toHaveBeenCalledWith('✓ All scenarios passed.');
    });

    it('should exit(1) and print failure when scenarios fail', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 2,
        passed: 1,
        failed: 1,
        results: [
          { scenario: 'good', passed: true, errors: [], warnings: [], details: 'ok', duration: 10 },
          { scenario: 'bad', passed: false, errors: ['Assertion failed'], warnings: [], details: 'fail', duration: 10 },
        ],
        duration: 20,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--workspace-path', tempDir], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('✗ 1 scenario(s) failed.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should run specific scenario when name provided', async () => {
      const scenarioFile = join(tempDir, '.mumuspec', 'evals', 'my-test.yaml');
      writeFileSync(scenarioFile, 'name: my-test\ntype: compliance\n');

      mockLoadScenario.mockReturnValue({
        name: 'my-test',
        type: 'compliance',
        projectRoot: tempDir,
      });
      mockRunScenario.mockReturnValue({
        scenario: 'my-test',
        passed: true,
        errors: [],
        warnings: [],
        details: 'Compliance: 0 errors, 0 warnings',
        duration: 15,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', 'my-test', '--workspace-path', tempDir], { from: 'user' });

      expect(mockLoadScenario).toHaveBeenCalledWith(scenarioFile);
      // The handler prints: `  ${icon} ${result.scenario}` which has leading spaces
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ my-test'));
    });

    it('should exit(1) when specific scenario file not found', async () => {
      const program = await createProgram();
      await program.parseAsync(
        ['eval', 'run', 'nonexistent', '--workspace-path', tempDir],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scenario "nonexistent" not found')
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should show details in verbose mode', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 1,
        passed: 1,
        failed: 0,
        results: [
          { scenario: 'verbose-test', passed: true, errors: [], warnings: ['Some warning'], details: 'Detailed info here', duration: 5 },
        ],
        duration: 5,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--verbose', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('    Detailed info here');
      expect(logSpy).toHaveBeenCalledWith('    ⚠ Some warning');
    });

    it('should print guidance when running all with zero scenarios', async () => {
      mockRunAllEvals.mockReturnValue({
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
        duration: 0,
      });

      const program = await createProgram();
      await program.parseAsync(['eval', 'run', '--workspace-path', tempDir], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        'No eval scenarios found. Run `mumuspec eval init` to get started.'
      );
    });
  });

  // ── default action (no subcommand) ──

  describe('default eval action', () => {
    it('should print usage information', async () => {
      const program = await createProgram();
      await program.parseAsync(['eval'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Create sample eval scenarios')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('List available scenarios')
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Run scenarios (all or specific)')
      );
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// eval run --report（L2 消费层，design §2.3.1 / DS-EVAL-004）
// ════════════════════════════════════════════════════════════════════

function makeCi(n: number, lower = 0.3, upper = 0.9) {
  return { lower, upper, n, confidence: 0.95 as const, insufficient: n < 3 };
}

function makeCorpusReport(overrides: Partial<CorpusScenarioReport> = {}): CorpusScenarioReport {
  const base: CorpusScenarioReport = {
    scenario: 'corpus-eval',
    corpusDir: '.eval-corpus',
    total: 6,
    counts: { killed: 4, missed: 1, errored: 0 },
    errored: 0,
    erroredFixtures: [],
    recall: { value: 0.8, n: 5, ci: makeCi(5, 0.376, 0.964), excluded: 0 },
    recallBySeverity: {
      veto: { value: 1, n: 2, ci: makeCi(2, 0.34, 1) },
      error: { value: 0.667, n: 3, ci: makeCi(3, 0.207, 0.939) },
      warn: { value: 0, n: 0, ci: null },
    },
    noise: { value: 0, n: 3, ci: makeCi(3, 0, 0.561) },
    precision: { mustContainSatisfied: 4, mustContainTotal: 5, ratio: 0.8 },
    baseline: { codes: [], coverage: null },
    fixtures: [],
  };
  return { ...base, ...overrides };
}

function makeReport(corpusReports: CorpusScenarioReport[]): EvalReport {
  return {
    total: corpusReports.length || 1,
    passed: corpusReports.length || 1,
    failed: 0,
    results: [
      {
        scenario: 'corpus-eval',
        passed: true,
        errors: [],
        warnings: [],
        details: 'ok',
        duration: 10,
        corpus: corpusReports[0],
      },
    ],
    duration: 10,
    corpusReports,
  };
}

/** 递归快照目录树（相对路径 + 尾斜杠标记目录），用于「不落盘」断言。 */
function snapshotTree(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      out.push(relative(root, p).replace(/\\/g, '/') + (e.isDirectory() ? '/' : ''));
      if (e.isDirectory()) walk(p);
    }
  };
  walk(root);
  return out.sort();
}

describe('eval run --report', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tempDir = setupTempDir();
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockRunAllEvals.mockReset();
    mockFindProjectRoot.mockReturnValue(tempDir);
    mockVerifiableRatioEvaluate.mockReset();
    mockFailOpenEvaluate.mockReset();
    mockVerifiableRatioEvaluate.mockResolvedValue({
      name: 'verifiable-ratio',
      value: 0.75,
      weight: 0,
      details: 'strong 15/20 (strong_ratio 0.750); weak 3 manual 2 unverifiable 0',
      rawData: { total: 20, enforced_strong: 15, enforced_weak: 3, manual: 2, unverifiable: 0 },
    });
    mockFailOpenEvaluate.mockResolvedValue({
      name: 'fail-open-count',
      value: 1,
      weight: 0,
      details: '0 non-success audit entries across 0 action(s)',
      rawData: { total: 0, cap: 10, byAction: {}, entries: [] },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function loadEvalModule() {
    return await import('../../../src/cli/commands/eval.js');
  }

  // ── L2-C01 · report 文本形态四段 ──

  it('L2-C01 — renderSummaryText 含四段（corpus / A1 / B4 / coverageRef）', async () => {
    const { buildSummaryReport, renderSummaryText } = await loadEvalModule();
    const summary = await buildSummaryReport(makeReport([makeCorpusReport()]), tempDir);
    const text = renderSummaryText(summary);

    // ① corpus 段
    expect(text).toContain('recall=');
    expect(text).toContain('noise=');
    expect(text).toContain('CI=[');
    expect(text).toContain('precision=');
    // ② A1
    expect(text).toContain('verifiable-ratio');
    expect(text).toContain('strong_ratio 0.750');
    // ③ B4
    expect(text).toContain('fail-open-count');
    // ④ coverageRef
    expect(text).toContain('vitest-v8');
    expect(text).toContain('thresholds');
  });

  // ── L2-C02 · report JSON 形态 EvalSummaryReport 结构 ──

  it('L2-C02 — JSON 形态结构完整', async () => {
    const { buildSummaryReport } = await loadEvalModule();
    const report = makeReport([makeCorpusReport()]);
    const summary = await buildSummaryReport(report, tempDir);
    const parsed = JSON.parse(JSON.stringify(summary));

    expect(parsed.version).toBe(1);
    expect(parsed.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(parsed.evals).toEqual({ total: 1, passed: 1, failed: 0, duration: 10 });
    expect(parsed.corpus).toHaveLength(1);
    expect(parsed.corpus[0].scenario).toBe('corpus-eval');
    expect(Object.keys(parsed.metrics).sort()).toEqual(['fail-open-count', 'verifiable-ratio']);
    for (const key of ['verifiable-ratio', 'fail-open-count'] as const) {
      expect(parsed.metrics[key]).toHaveProperty('value');
      expect(parsed.metrics[key]).toHaveProperty('weight');
      expect(parsed.metrics[key]).toHaveProperty('details');
    }
    expect(parsed.precision).toEqual({
      mustContainSatisfied: 4,
      mustContainTotal: 5,
      ratio: 0.8,
    });
    expect(parsed.coverageRef.metric).toBe('vitest-v8');
  });

  // ── L2-C03 · 冻结契约 version===1 + 字段集 ──

  it('L2-C03 — version===1（number）且顶层字段集恰为冻结集', async () => {
    const { buildSummaryReport } = await loadEvalModule();
    const summary = await buildSummaryReport(makeReport([makeCorpusReport()]), tempDir);

    expect(summary.version).toBe(1);
    expect(typeof summary.version).toBe('number');
    expect(Object.keys(summary).sort()).toEqual([
      'corpus',
      'coverageRef',
      'evals',
      'generatedAt',
      'metrics',
      'precision',
      'version',
    ]);
    expect(Object.keys(summary.metrics).sort()).toEqual(['fail-open-count', 'verifiable-ratio']);
  });

  // ── L2-C04 · coverageRef 四维阈值 + command 指针 ──

  it('L2-C04 — coverageRef 阈值严格四维 95 且 command 为非空字符串', async () => {
    const { buildSummaryReport } = await loadEvalModule();
    const summary = await buildSummaryReport(makeReport([makeCorpusReport()]), tempDir);

    expect(summary.coverageRef.metric).toBe('vitest-v8');
    expect(summary.coverageRef.thresholds).toEqual({
      lines: 95,
      branches: 95,
      functions: 95,
      statements: 95,
    });
    expect(typeof summary.coverageRef.command).toBe('string');
    expect(summary.coverageRef.command.length).toBeGreaterThan(0);
  });

  // ── L2-C05 · n<3 文本标注「置信不足」 ──

  it('L2-C05 — recall n<3 场景行含「置信不足」，n>=3 不含', async () => {
    const { buildSummaryReport, renderSummaryText } = await loadEvalModule();

    const small = makeCorpusReport({
      recall: { value: 0.5, n: 2, ci: makeCi(2, 0.095, 0.905), excluded: 0 },
    });
    const smallText = renderSummaryText(await buildSummaryReport(makeReport([small]), tempDir));
    expect(smallText).toContain('置信不足');
    expect(smallText).toContain('n=2');

    const largeText = renderSummaryText(
      await buildSummaryReport(makeReport([makeCorpusReport()]), tempDir),
    );
    expect(largeText).not.toContain('置信不足');
  });

  // ── L2-C16 · 空 corpus 场景消费不崩溃 ──

  it('L2-C16 — 空 corpus（n=0/ci=null）渲染不产 NaN 且 JSON value===null', async () => {
    const { buildSummaryReport, renderSummaryText } = await loadEvalModule();
    const empty = makeCorpusReport({
      scenario: 'empty-corpus',
      total: 0,
      counts: { killed: 0, missed: 0, errored: 0 },
      recall: { value: null, n: 0, ci: null },
      noise: { value: null, n: 0, ci: null },
      recallBySeverity: {
        veto: { value: null, n: 0, ci: null },
        error: { value: null, n: 0, ci: null },
        warn: { value: null, n: 0, ci: null },
      },
      precision: { mustContainSatisfied: 0, mustContainTotal: 0, ratio: null },
    });

    const summary = await buildSummaryReport(makeReport([empty]), tempDir);
    const text = renderSummaryText(summary);

    expect(text).toContain('n=0');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('Infinity');
    const parsed = JSON.parse(JSON.stringify(summary));
    expect(parsed.corpus[0].recall.value).toBeNull();
    expect(parsed.corpus[0].noise.value).toBeNull();
  });

  // ── L2-C15 · report.metrics 与评估器同源 ──

  it('L2-C15 — metrics 与进程内直调评估器结果一致（weight===0）', async () => {
    const { buildSummaryReport } = await loadEvalModule();
    const summary = await buildSummaryReport(makeReport([makeCorpusReport()]), tempDir);

    expect(summary.metrics['verifiable-ratio'].value).toBe(0.75);
    expect(summary.metrics['verifiable-ratio'].weight).toBe(0);
    expect(summary.metrics['verifiable-ratio'].details).toBe(
      'strong 15/20 (strong_ratio 0.750); weak 3 manual 2 unverifiable 0',
    );
    expect(summary.metrics['fail-open-count'].value).toBe(1);
    expect(summary.metrics['fail-open-count'].weight).toBe(0);
    expect(mockVerifiableRatioEvaluate).toHaveBeenCalledTimes(1);
    expect(mockFailOpenEvaluate).toHaveBeenCalledTimes(1);
  });

  // ── L2-C17 · report JSON 新增 precision 聚合（version 仍 1） ──

  it('L2-C17 — 跨场景 precision 求和；分母 0 → ratio===null；version 仍 1', async () => {
    const { buildSummaryReport } = await loadEvalModule();

    const r1 = makeCorpusReport({ precision: { mustContainSatisfied: 4, mustContainTotal: 5, ratio: 0.8 } });
    const r2 = makeCorpusReport({
      scenario: 'corpus-two',
      precision: { mustContainSatisfied: 2, mustContainTotal: 3, ratio: 2 / 3 },
    });
    const summary = await buildSummaryReport(makeReport([r1, r2]), tempDir);
    expect(summary.precision.mustContainSatisfied).toBe(6);
    expect(summary.precision.mustContainTotal).toBe(8);
    expect(summary.precision.ratio).toBeCloseTo(0.75, 10);
    expect(summary.version).toBe(1);

    // 分母为 0 → ratio===null（非 NaN）
    const zero = makeCorpusReport({
      precision: { mustContainSatisfied: 0, mustContainTotal: 0, ratio: null },
    });
    const zeroSummary = await buildSummaryReport(makeReport([zero]), tempDir);
    expect(zeroSummary.precision.ratio).toBeNull();
  });

  // ── L2-C18 · 文本渲染 errored 提示 + 「置信不足」 ──

  it('L2-C18 — errored 提示与置信不足独立呈现、互不吞没，行含 precision', async () => {
    const { buildSummaryReport, renderSummaryText } = await loadEvalModule();
    const report = makeCorpusReport({
      errored: 2,
      erroredFixtures: ['bad-a', 'bad-b'],
      recall: { value: 0.5, n: 2, ci: makeCi(2, 0.095, 0.905), excluded: 2 },
    });
    const text = renderSummaryText(await buildSummaryReport(makeReport([report]), tempDir));

    expect(text).toContain('precision=');
    expect(text).toContain('2 errored 已排除分母');
    expect(text).toContain('置信不足');
  });

  // ── CLI 旗标接线：--report（文本 / JSON）──

  it('CLI — eval run --report 输出文本汇总', async () => {
    const { registerEvalCommands } = await loadEvalModule();
    mockRunAllEvals.mockReturnValue(makeReport([makeCorpusReport()]));
    mockFindProjectRoot.mockReturnValue(tempDir);

    const program = new Command();
    registerEvalCommands(program);
    await program.parseAsync(['eval', 'run', '--report', '--workspace-path', tempDir], {
      from: 'user',
    });

    const all = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(all).toContain('Eval Summary');
    expect(all).toContain('verifiable-ratio');
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('CLI — eval run --report --json 输出可解析 JSON（version 1）', async () => {
    const { registerEvalCommands } = await loadEvalModule();
    mockRunAllEvals.mockReturnValue(makeReport([makeCorpusReport()]));
    mockFindProjectRoot.mockReturnValue(tempDir);

    const program = new Command();
    registerEvalCommands(program);
    await program.parseAsync(
      ['eval', 'run', '--report', '--json', '--workspace-path', tempDir],
      { from: 'user' },
    );

    const jsonArg = logSpy.mock.calls
      .map((c) => c[0])
      .find((s) => typeof s === 'string' && s.trim().startsWith('{'));
    expect(jsonArg).toBeTruthy();
    const parsed = JSON.parse(jsonArg as string);
    expect(parsed.version).toBe(1);
    expect(Object.keys(parsed.metrics).sort()).toEqual(['fail-open-count', 'verifiable-ratio']);
  });

  // ── L2-C10 · report 仅 stdout 不落盘 ──

  it('L2-C10 — report 仅 stdout：文本/JSON 两次运行后目录树不变（无新增文件）', async () => {
    const { registerEvalCommands } = await loadEvalModule();
    mockRunAllEvals.mockReturnValue(makeReport([makeCorpusReport()]));
    mockFindProjectRoot.mockReturnValue(tempDir);

    const before = snapshotTree(tempDir);

    const p1 = new Command();
    registerEvalCommands(p1);
    await p1.parseAsync(['eval', 'run', '--report', '--workspace-path', tempDir], { from: 'user' });

    const p2 = new Command();
    registerEvalCommands(p2);
    await p2.parseAsync(['eval', 'run', '--report', '--json', '--workspace-path', tempDir], {
      from: 'user',
    });

    const after = snapshotTree(tempDir);
    expect(after).toEqual(before); // 无新增/删除文件（report 不落盘）

    const all = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(all).toContain('Eval Summary'); // 报告正文仅经 stdout
    expect(exitSpy).not.toHaveBeenCalled();
  });

  // ── L2-C11 · 退出码语义不变 ──

  it('L2-C11 — 退出码由 report.failed 决定，--report 不改变语义', async () => {
    const { registerEvalCommands } = await loadEvalModule();
    mockFindProjectRoot.mockReturnValue(tempDir);

    const run = async (argv: string[]) => {
      const program = new Command();
      registerEvalCommands(program);
      await program.parseAsync(argv, { from: 'user' }).catch(() => {});
    };

    // ① 全通过：无 corpus 失败 → exit 码 0（未调用 exit），加不加 --report 一致
    mockRunAllEvals.mockReturnValue(makeReport([makeCorpusReport()]));
    await run(['eval', 'run', '--workspace-path', tempDir]);
    expect(exitSpy).not.toHaveBeenCalled();

    await run(['eval', 'run', '--report', '--workspace-path', tempDir]);
    expect(exitSpy).not.toHaveBeenCalled();

    // ② corpusExpect 违反 → 该场景 passed=false → failed>0 → exit 1
    const failedReport: EvalReport = {
      total: 1,
      passed: 0,
      failed: 1,
      duration: 5,
      results: [
        {
          scenario: 'corpus-eval',
          passed: false,
          errors: ['corpusExpect.minRecall 0.9 not met (recall=0.000)'],
          warnings: [],
          details: 'fail',
          duration: 5,
          corpus: makeCorpusReport(),
        },
      ],
      corpusReports: [makeCorpusReport()],
    };

    exitSpy.mockClear();
    mockRunAllEvals.mockReturnValue(failedReport);
    await run(['eval', 'run', '--workspace-path', tempDir]);
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockClear();
    await run(['eval', 'run', '--report', '--workspace-path', tempDir]);
    expect(exitSpy).toHaveBeenCalledWith(1); // --report 不改变退出码语义
  });

  // ── 按名跑 corpus 场景 + --report：corpus 段必须非空（回归 L2-C20） ──
  // 背景：按名跑分支曾漏填 `corpusReports` → `eval run <name> --report` 的 corpus 恒空。
  // 本用例锁定「按名 + corpus 场景 + --report」的 corpus 段非空且数值真实。

  it('L2-C20 — 按名 corpus 场景 + --report --json → corpus 段非空（counts/recall/precision 真实）', async () => {
    const { registerEvalCommands } = await loadEvalModule();
    mockFindProjectRoot.mockReturnValue(tempDir);

    // 场景文件须存在（handler 用 existsSync 判定）
    const scenarioFile = join(tempDir, '.mumuspec', 'evals', 'corpus-named.yaml');
    writeFileSync(scenarioFile, 'name: corpus-named\ntype: corpus\ncorpusDir: .eval-corpus\n');
    mockLoadScenario.mockReturnValue({ name: 'corpus-named', type: 'corpus', projectRoot: tempDir });

    // runScenario 返回带 corpus 报告的结果（真实基线形态）
    const corpusReport = makeCorpusReport({
      scenario: 'corpus-named',
      counts: { killed: 15, missed: 0, errored: 0 },
      recall: { value: 1, n: 15, ci: makeCi(15, 0.796, 1), excluded: 0 },
      precision: { mustContainSatisfied: 15, mustContainTotal: 15, ratio: 1 },
    });
    mockRunScenario.mockReturnValue({
      scenario: 'corpus-named',
      passed: true,
      errors: [],
      warnings: [],
      details: 'ok',
      duration: 5,
      corpus: corpusReport,
    });

    const program = new Command();
    registerEvalCommands(program);
    await program.parseAsync(
      ['eval', 'run', 'corpus-named', '--report', '--json', '--workspace-path', tempDir],
      { from: 'user' },
    );

    const jsonArg = logSpy.mock.calls
      .map((c) => c[0])
      .find((s) => typeof s === 'string' && s.trim().startsWith('{'));
    expect(jsonArg).toBeTruthy();
    const parsed = JSON.parse(jsonArg as string);

    // corpus 段非空（回归点：修复前恒为 []）
    expect(parsed.corpus).toHaveLength(1);
    expect(parsed.corpus[0].scenario).toBe('corpus-named');
    expect(parsed.corpus[0].counts).toEqual({ killed: 15, missed: 0, errored: 0 });
    expect(parsed.corpus[0].recall.value).toBe(1);
    expect(parsed.corpus[0].recall.n).toBe(15);

    // 顶层 precision 反映真实 mustContain 命中（非 null/0）
    expect(parsed.precision.mustContainSatisfied).toBe(15);
    expect(parsed.precision.mustContainTotal).toBe(15);
    expect(parsed.precision.ratio).toBe(1);
  });
});
