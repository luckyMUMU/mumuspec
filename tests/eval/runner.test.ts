import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  loadScenario,
  discoverScenarios,
  runScenario,
  runAllEvals,
  initEvalsDir,
} from '../../src/eval/runner.js';
import type { EvalScenario } from '../../src/eval/runner.js';

// L0 corpus 编排用例（L0-C15~C30）mock spawnSync，不真跑子进程（R-6）。
// src/guard 与 src/eval 的其余模块不调用 child_process，故整文件 mock 无副作用。
vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

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

// ============================================================================
// Layer 0 — corpus 编排（L0-C15~C30）+ custom 修复（L0-C31~C32）
// 隔离方式：tmp 目录 + mock spawnSync（不真跑子进程，R-6）
// ============================================================================

interface ProbeResponse {
  stdout?: string;
  stderr?: string;
  error?: Error;
}

function setProbeResponses(map: Record<string, ProbeResponse>): void {
  vi.mocked(spawnSync).mockImplementation(((
    _cmd: string,
    _args: string[],
    opts: { cwd?: string },
  ) => {
    const cwd = (opts?.cwd ?? '').replace(/\\/g, '/');
    const key = Object.keys(map).find((k) => cwd.endsWith('/' + k));
    const resp: ProbeResponse = key ? map[key] : {};
    return {
      pid: 1,
      output: [],
      stdout: resp.stdout ?? '',
      stderr: resp.stderr ?? '',
      status: 0,
      signal: null,
      error: resp.error,
    };
  }) as unknown as typeof spawnSync);
}

function makeCorpusDir(projectDir: string): string {
  const corpusDir = join(projectDir, '.eval-corpus');
  mkdirSync(corpusDir, { recursive: true });
  return corpusDir;
}

function writeFixture(corpusDir: string, name: string, lines: string[]): string {
  const dir = join(corpusDir, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'expected.yaml'), lines.join('\n') + '\n');
  return dir;
}

const CLEAN_STDOUT = JSON.stringify({ passed: true });

function covStdout(over: Partial<Record<string, number>> = {}): string {
  return JSON.stringify({
    coverage: {
      total: 20,
      enforced_strong: 10,
      enforced_weak: 4,
      manual: 4,
      unverifiable: 2,
      ...over,
    },
  });
}

function runCorpus(projectDir: string, extra: Partial<EvalScenario> = {}) {
  return runScenario({
    name: 'corpus-scenario',
    type: 'corpus',
    projectRoot: projectDir,
    corpusDir: '.eval-corpus',
    ...extra,
  });
}

describe('runScenario — corpus 检出/漏检（L0-C15~C16）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  it('L0-C15 — 检出态 → killed=true 计入 recall', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', [
      'kind: bad-case',
      'severity: error',
      'mustContain: [E-SPEC-004]',
    ]);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004', message: 'x' }] }) },
    });

    const result = runCorpus(dir);
    const fixture = result.corpus!.fixtures.find((f) => f.name === 'bad-spec-004')!;
    expect(fixture.killed).toBe(true);
    expect(fixture.newCodes).toContain('E-SPEC-004');
    expect(fixture.mustContainSatisfied).toBe(true);
    expect(result.corpus!.recall.value).toBe(1);
    expect(result.corpus!.recall.n).toBe(1);
  });

  it('L0-C16 — 漏检态 → killed=false', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case', 'severity: error']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: CLEAN_STDOUT },
    });

    const result = runCorpus(dir);
    const fixture = result.corpus!.fixtures.find((f) => f.name === 'bad-spec-004')!;
    expect(fixture.killed).toBe(false);
    expect(fixture.newCodes).toEqual([]);
    expect(fixture.changedCoverageFields).toEqual([]);
    expect(result.corpus!.recall.value).toBe(0);
    expect(result.corpus!.recall.n).toBe(1);
  });
});

describe('runScenario — corpus 多信号并集（L0-C17~C18）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  it('L0-C17 — coverage-only fixture → killed=true', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-002', ['kind: bad-case', 'severity: error']);
    setProbeResponses({
      '_baseline': { stdout: covStdout() },
      'bad-spec-002': { stdout: covStdout({ total: 19, enforced_weak: 3 }) },
    });

    const result = runCorpus(dir);
    const fixture = result.corpus!.fixtures.find((f) => f.name === 'bad-spec-002')!;
    expect(fixture.killed).toBe(true);
    expect(fixture.newCodes).toEqual([]);
    expect(fixture.changedCoverageFields.length).toBeGreaterThan(0);
    expect(fixture.changedCoverageFields).toContain('total');
    expect(fixture.changedCoverageFields).toContain('enforced_weak');
  });

  it('L0-C18 — code-only fixture → killed=true（两侧 coverage=null）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-016', ['kind: bad-case', 'severity: warn']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-016': { stdout: JSON.stringify({ warnings: [{ code: 'W-SPEC-016' }] }) },
    });

    const result = runCorpus(dir);
    const fixture = result.corpus!.fixtures.find((f) => f.name === 'bad-spec-016')!;
    expect(fixture.killed).toBe(true);
    expect(fixture.newCodes).toContain('W-SPEC-016');
    expect(fixture.changedCoverageFields).toEqual([]);
  });
});

describe('runScenario — corpus 边界与 fail-fast（L0-C19~C23）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  it('L0-C19 — 空 corpusDir → warning + ratio.value=null + 不抛', () => {
    const corpusDir = makeCorpusDir(dir);
    mkdirSync(join(corpusDir, 'empty-sub'), { recursive: true }); // 无 expected.yaml
    let result: ReturnType<typeof runCorpus> | undefined;
    expect(() => { result = runCorpus(dir); }).not.toThrow();
    expect(result!.warnings).toContain('corpus dir empty');
    expect(result!.corpus!.total).toBe(0);
    expect(result!.corpus!.recall.value).toBeNull();
    expect(result!.corpus!.recall.n).toBe(0);
    expect(result!.corpus!.noise.value).toBeNull();
  });

  it('L0-C20 — corpusDir 不存在 → resultErrors', () => {
    const result = runCorpus(dir); // 未创建 .eval-corpus
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('corpus dir not found'))).toBe(true);
    expect(result.corpus).toBeUndefined();
  });

  it('L0-C21 — 缺 _baseline → resultErrors（不静默）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case']);
    writeFixture(corpusDir, 'clean-01', ['kind: clean']);
    const result = runCorpus(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('corpus requires _baseline'))).toBe(true);
    expect(result.corpus).toBeUndefined();
  });

  it('L0-C22 — _baseline 不干净 → fail-fast 报错', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case']);
    setProbeResponses({
      '_baseline': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
      'bad-spec-004': { stdout: CLEAN_STDOUT },
    });
    const result = runCorpus(dir);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('baseline must be clean but produced codes'))).toBe(true);
    expect(result.corpus).toBeUndefined(); // 不基于被污染 baseline 继续 diff
  });

  it('L0-C23 — fixture 缺 expected.yaml → 不视为 fixture', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case']);
    mkdirSync(join(corpusDir, 'stray-dir'), { recursive: true }); // 无 expected.yaml
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });
    const result = runCorpus(dir);
    expect(result.corpus!.fixtures.some((f) => f.name === 'stray-dir')).toBe(false);
    expect(result.corpus!.total).toBe(1);
  });
});

describe('runScenario — corpus 跨域码与噪声口径（L0-C24~C25）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  it('L0-C24 — 跨域码经 stderr 通道捕获（E-CHANGE-022）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline', 'probe: archive']);
    writeFixture(corpusDir, 'bad-change-022', [
      'kind: bad-case',
      'severity: veto',
      'probe: archive',
      'change: cX',
      'mustContain: [E-CHANGE-022]',
    ]);
    setProbeResponses({
      '_baseline': { stdout: '' },
      'bad-change-022': { stdout: '', stderr: 'archive failed: E-CHANGE-022 cannot archive' },
    });
    const result = runCorpus(dir);
    const fixture = result.corpus!.fixtures.find((f) => f.name === 'bad-change-022')!;
    expect(fixture.newCodes).toContain('E-CHANGE-022');
    expect(fixture.killed).toBe(true);
    expect(fixture.changedCoverageFields).toEqual([]);
  });

  it('L0-C25 — noise 只计码：clean 结构性 coverage 差异 → falsePositive=false', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'clean-01', ['kind: clean']);
    setProbeResponses({
      '_baseline': { stdout: covStdout() },
      'clean-01': { stdout: covStdout({ total: 5, enforced_strong: 2 }) }, // 结构性差异，零码
    });
    const result = runCorpus(dir);
    const fixture = result.corpus!.fixtures.find((f) => f.name === 'clean-01')!;
    expect(fixture.falsePositive).toBe(false);
    expect(result.corpus!.noise.value).toBe(0);
    expect(result.corpus!.noise.n).toBe(1);
  });

  it('L0-C25b — clean 产生一个码 → falsePositive=true、noise=1', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'clean-02', ['kind: clean']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'clean-02': { stdout: JSON.stringify({ warnings: [{ code: 'W-SPEC-016' }] }) },
    });
    const result = runCorpus(dir);
    const fixture = result.corpus!.fixtures.find((f) => f.name === 'clean-02')!;
    expect(fixture.falsePositive).toBe(true);
    expect(result.corpus!.noise.value).toBe(1);
  });
});

describe('runScenario — corpus 无 cwd 依赖（L0-C26）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  it('L0-C26 — runProbe cwd 为绝对 fixture 路径', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });

    runCorpus(dir);

    const calls = vi.mocked(spawnSync).mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const seen = new Set<string>();
    for (const call of calls) {
      const opts = call[2] as { cwd?: string };
      const cwd = opts.cwd!;
      expect(isAbsolute(cwd)).toBe(true);
      expect(cwd).not.toBe(process.cwd());
      seen.add(cwd.replace(/\\/g, '/'));
    }
    expect(seen.has(resolve(corpusDir, '_baseline').replace(/\\/g, '/'))).toBe(true);
    expect(seen.has(resolve(corpusDir, 'bad-spec-004').replace(/\\/g, '/'))).toBe(true);
  });
});

describe('runScenario — corpusExpect 断言（L0-C27）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  it('L0-C27 — 断言违反 → resultErrors（含 minRecall/maxNoise/recallBySeverity）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-veto-1', ['kind: bad-case', 'severity: veto']);
    writeFixture(corpusDir, 'bad-veto-2', ['kind: bad-case', 'severity: veto']);
    writeFixture(corpusDir, 'clean-01', ['kind: clean']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-veto-1': { stdout: JSON.stringify({ errors: [{ code: 'E-GUARD-010' }] }) },
      'bad-veto-2': { stdout: CLEAN_STDOUT }, // 漏检
      'clean-01': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-001' }] }) }, // 误报
    });

    const result = runCorpus(dir, {
      corpusExpect: { minRecall: 0.9, maxNoise: 0, recallBySeverity: { veto: 1.0 } },
    });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('minRecall'))).toBe(true);
    expect(result.errors.some((e) => e.includes('maxNoise'))).toBe(true);
    expect(result.errors.some((e) => e.includes('recallBySeverity'))).toBe(true);
    expect(result.corpus!.recall.value).toBe(0.5); // 2 坏样本，1 检出
  });

  it('L0-C27b — 断言满足 → passed=true', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-veto-1', ['kind: bad-case', 'severity: veto']);
    // BP-12-4 / D-corpus-6：声明 maxNoise 须有有效 clean 分母（空分母 fail-closed），故附 1 个净样本
    writeFixture(corpusDir, 'clean-01', ['kind: clean']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-veto-1': { stdout: JSON.stringify({ errors: [{ code: 'E-GUARD-010' }] }) },
      'clean-01': { stdout: CLEAN_STDOUT },
    });
    const result = runCorpus(dir, {
      corpusExpect: { minRecall: 1.0, maxNoise: 0, recallBySeverity: { veto: 1.0 } },
    });
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// BP-12 修订（L0-C33~C39）：三态聚合 / errored 不进分母 / 三条 warning /
// 空分母 fail-closed / precision 聚合。均 mock spawnSync，不真跑（R-6）。
describe('runScenario — corpus BP-12 三态与精度（L0-C33~C39）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  it('L0-C33 — 探针启动失败 → errored，不进 recall 分母（不误计 missed）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case', 'severity: error']);
    writeFixture(corpusDir, 'bad-spec-001', ['kind: bad-case', 'severity: error']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) }, // 检出
      'bad-spec-001': { error: new Error('spawn boom') }, // 启动失败 → errored
    });

    const result = runCorpus(dir);
    const erroredFix = result.corpus!.fixtures.find((f) => f.name === 'bad-spec-001')!;
    expect(erroredFix.errored).toBe(true);
    expect(erroredFix.killed).toBeUndefined(); // errored ≠ missed
    expect(result.corpus!.counts).toEqual({ killed: 1, missed: 0, errored: 1 });
    expect(result.corpus!.errored).toBe(1);
    expect(result.corpus!.erroredFixtures).toEqual(['bad-spec-001']);
    expect(result.corpus!.recall.n).toBe(1); // 分母 = killed + missed（errored 排除）
    expect(result.corpus!.recall.value).toBe(1);
    expect(result.corpus!.recall.excluded).toBe(1);
    expect(result.warnings.some((w) => w.includes('errored'))).toBe(true);
  });

  it('L0-C34 — 输出不可解析（无 JSON、无码、无 coverage）→ errored（E-10）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline', 'probe: guard', 'change: b']);
    writeFixture(corpusDir, 'bad-guard-010', [
      'kind: bad-case', 'severity: veto', 'probe: guard', 'change: b',
    ]);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-guard-010': { stdout: 'Invalid command: change archive b' },
    });

    const result = runCorpus(dir);
    expect(result.corpus!.fixtures.find((f) => f.name === 'bad-guard-010')!.errored).toBe(true);
    expect(result.corpus!.counts.errored).toBe(1);
  });

  it('L0-C35 — 输出非 JSON 但 stderr 含码 → 不 errored（regex 兜底，仍计入检出）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline', 'probe: archive', 'change: b']);
    writeFixture(corpusDir, 'bad-change-022', [
      'kind: bad-case', 'severity: veto', 'probe: archive', 'change: b',
    ]);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-change-022': { stdout: '', stderr: '[E-CHANGE-022] DELTA_MERGE_INCOMPLETE' },
    });

    const result = runCorpus(dir);
    const fix = result.corpus!.fixtures.find((f) => f.name === 'bad-change-022')!;
    expect(fix.errored).toBeFalsy();
    expect(fix.killed).toBe(true);
    expect(fix.newCodes).toContain('E-CHANGE-022');
  });

  it('L0-C36 — 未声明 corpusExpect → report-only warning；orphan 目录列明', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case', 'severity: error']);
    mkdirSync(join(corpusDir, 'orphan-x', '.mumuspec'), { recursive: true }); // 无 expected.yaml
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });

    const result = runCorpus(dir);
    expect(result.warnings.some((w) => w.includes('report-only'))).toBe(true);
    expect(result.warnings.some((w) => w.includes('no expected.yaml'))).toBe(true);
    expect(result.passed).toBe(true); // 三条 warning 不改变 passed 语义
  });

  it('L0-C37 — 声明 maxNoise 但零有效 clean → resultErrors（fail-closed，D-corpus-6）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case', 'severity: error']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });

    const result = runCorpus(dir, { corpusExpect: { maxNoise: 0 } });
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.includes('empty denominator for maxNoise'))).toBe(true);
  });

  it('L0-C38 — precision 聚合（命中/总数/比值；仅展示不设阈值）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', [
      'kind: bad-case', 'severity: error', 'mustContain: [E-SPEC-004]',
    ]);
    writeFixture(corpusDir, 'bad-spec-001', [
      'kind: bad-case', 'severity: error', 'mustContain: [E-SPEC-001, E-SPEC-002]',
    ]);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) }, // 1/1
      'bad-spec-001': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-001' }] }) }, // 1/2
    });

    const result = runCorpus(dir);
    expect(result.corpus!.precision.mustContainSatisfied).toBe(2);
    expect(result.corpus!.precision.mustContainTotal).toBe(3);
    expect(Math.abs((result.corpus!.precision.ratio ?? 0) - 2 / 3)).toBeLessThan(1e-9);
    expect(result.errors).toEqual([]); // 仅展示：不参与 passed / resultErrors
  });

  it('L0-C39 — 无 mustContain → precision.ratio=null（不做 0/0）', () => {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case', 'severity: error']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });

    const result = runCorpus(dir);
    expect(result.corpus!.precision).toEqual({
      mustContainSatisfied: 0,
      mustContainTotal: 0,
      ratio: null,
    });
  });
});

describe('loadScenario — corpus 字段解析（L0-C28）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); });

  it('L0-C28 — 解析 corpusDir + corpusExpect（三层嵌套）', () => {
    const file = join(dir, 'corpus.yaml');
    writeFileSync(file, [
      'name: corpus-scenario',
      'type: corpus',
      'corpusDir: .eval-corpus',
      'corpusExpect:',
      '  minRecall: 0.9',
      '  maxNoise: 0',
      '  recallBySeverity:',
      '    veto: 1.0',
      'expected:',
      '  maxErrors: 100',
      'assertions:',
      '  - "true"',
      '',
    ].join('\n'));

    const scenario = loadScenario(file);
    expect(scenario.type).toBe('corpus');
    expect(scenario.corpusDir).toBe('.eval-corpus');
    expect(scenario.corpusExpect!.minRecall).toBe(0.9);
    expect(scenario.corpusExpect!.maxNoise).toBe(0);
    expect(scenario.corpusExpect!.recallBySeverity!.veto).toBe(1.0);
    // 既有字段不受影响
    expect(scenario.expected!.maxErrors).toBe(100);
    expect(scenario.assertions).toHaveLength(1);
  });
});

describe('runAllEvals — corpus 收集与引用一致（L0-C29~C30）', () => {
  let dir: string;
  beforeEach(() => { dir = createTmpProject(); });
  afterEach(() => { cleanup(dir); vi.mocked(spawnSync).mockReset(); });

  function seedEvals(): void {
    const corpusDir = makeCorpusDir(dir);
    writeFixture(corpusDir, '_baseline', ['kind: baseline']);
    writeFixture(corpusDir, 'bad-spec-004', ['kind: bad-case', 'severity: error']);
    setProbeResponses({
      '_baseline': { stdout: CLEAN_STDOUT },
      'bad-spec-004': { stdout: CLEAN_STDOUT }, // 漏检 → recall 0 → corpusExpect 失败
    });

    const evalsDir = join(dir, '.mumuspec', 'evals');
    mkdirSync(evalsDir, { recursive: true });
    writeFileSync(join(evalsDir, 'corpus.yaml'), [
      'name: corpus-scenario',
      'type: corpus',
      'corpusDir: .eval-corpus',
      'corpusExpect:',
      '  minRecall: 0.9',
      '',
    ].join('\n'));
    writeFileSync(join(evalsDir, 'custom.yaml'), 'name: custom-scenario\ntype: custom\n');
  }

  it('L0-C29 — 收集 corpusReports，total/passed/failed 语义不变', () => {
    seedEvals();
    const report = runAllEvals(dir);
    expect(report.corpusReports).toHaveLength(1);
    expect(report.corpusReports![0].scenario).toBe('corpus-scenario');
    expect(report.total).toBe(2);
    expect(report.passed + report.failed).toBe(2);
    expect(report.failed).toBe(1); // corpus 场景 corpusExpect 失败计入 failed
    expect(report.passed).toBe(1);
  });

  it('L0-C30 — EvalResult.corpus 与 corpusReports 引用一致', () => {
    seedEvals();
    const report = runAllEvals(dir);
    const corpusResult = report.results.find((r) => r.scenario === 'corpus-scenario')!;
    expect(corpusResult.corpus).toBeDefined();
    expect(corpusResult.corpus).toBe(report.corpusReports![0]); // 同一对象引用
  });
});

describe('runScenario — custom 修复（L0-C31~C32）', () => {
  afterEach(() => { vi.mocked(spawnSync).mockReset(); });

  it('L0-C31 — custom 断言通过/失败两态 + 零 warning', () => {
    const pass = runScenario({
      name: 'custom-pass',
      type: 'custom',
      assertions: ['errors.length === 0'],
    });
    expect(pass.passed).toBe(true);
    expect(pass.errors).toHaveLength(0);
    expect(pass.warnings).toHaveLength(0);

    const fail = runScenario({
      name: 'custom-fail',
      type: 'custom',
      assertions: ['errors.length === 99'],
    });
    expect(fail.passed).toBe(false);
    expect(fail.errors.some((e) => e.includes('Assertion failed'))).toBe(true);
    expect(fail.warnings).toHaveLength(0); // 不含 'Unknown scenario type: custom'
  });

  it('L0-C32 — default 分支仅对真正未知类型告警', () => {
    const unknown = runScenario({
      name: 'unknown-test',
      type: 'nonexistent-type',
    } as EvalScenario);
    expect(unknown.warnings.some((w) => w.includes('Unknown scenario type: nonexistent-type'))).toBe(true);

    const custom = runScenario({ name: 'custom-guard', type: 'custom' });
    expect(custom.warnings.some((w) => w.includes('Unknown'))).toBe(false);
  });
});
