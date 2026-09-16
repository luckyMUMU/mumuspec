/**
 * runner-boundaries.test.ts — QA 独立边界验证（eval-corpus 收口，L2 + Build 级）。
 *
 * 目的：以**独立于工程师**的断言，锁定 corpus 编排的三条边界语义：
 *   ① errored 三态：探针未产出可用信号 → errored，**不进 recall 分母**（分母 = killed+missed），
 *      且场景 warning **列明** errored fixture 名称；
 *   ② 未声明 corpusExpect → report-only warning，**不改变 passed 语义**；
 *   ③ orphan 目录（含 .mumuspec 但缺 expected.yaml）warning 计数，
 *      且证明 **two warnings 由 `fixtureNames.length === 0` 提前 return 隔开、每次运行至多命中其一**：
 *         - 空语料（无 fixture）→ early-return 分支（runner.ts step 2）
 *         - 非空语料 → step 8 分支
 *      注：工程师 runner.test.ts 的 L0-C36 只覆盖「非空 + orphan」；本套补齐**空语料 + orphan**（此前未覆盖）。
 *
 * 隔离：tmp 目录 + mock spawnSync（不真跑子进程，R-6）。真实（unmocked）errored 取证见 temp/qa-probe。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runScenario, type EvalScenario } from '../../src/eval/runner.js';

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

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

let dir = '';
beforeEach(() => {
  dir = join(tmpdir(), `mumuspec-boundary-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.mocked(spawnSync).mockReset();
});

const CLEAN = JSON.stringify({ passed: true });

function corpusDirPath(): string {
  const c = join(dir, '.eval-corpus');
  mkdirSync(c, { recursive: true });
  return c;
}
function writeFixture(corpus: string, name: string, lines: string[]): void {
  const d = join(corpus, name);
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, 'expected.yaml'), lines.join('\n') + '\n');
}
function runCorpus(extra: Partial<EvalScenario> = {}) {
  return runScenario({
    name: 'boundary-corpus',
    type: 'corpus',
    projectRoot: dir,
    corpusDir: '.eval-corpus',
    ...extra,
  });
}

describe('QA 边界：errored 三态（不进分母 + warning 列名）', () => {
  it('B1 — 探针启动失败 → errored，不进 recall 分母，warning 列明名称', () => {
    const corpus = corpusDirPath();
    writeFixture(corpus, '_baseline', ['kind: baseline']);
    writeFixture(corpus, 'bad-killed', ['kind: bad-case', 'severity: error']);
    writeFixture(corpus, 'bad-errored', ['kind: bad-case', 'severity: veto']);
    setProbeResponses({
      _baseline: { stdout: CLEAN },
      'bad-killed': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) }, // 检出
      'bad-errored': { error: new Error('probe spawn boom') }, // 未产出可用信号 → errored
    });

    const result = runCorpus();
    const erroredFx = result.corpus!.fixtures.find((f) => f.name === 'bad-errored')!;

    // errored ≠ missed
    expect(erroredFx.errored).toBe(true);
    expect(erroredFx.killed).toBeUndefined();
    expect(result.corpus!.counts).toEqual({ killed: 1, missed: 0, errored: 1 });

    // 分母 = killed + missed（errored 排除）；excluded 记 1
    expect(result.corpus!.recall.n).toBe(1);
    expect(result.corpus!.recall.value).toBe(1);
    expect(result.corpus!.recall.excluded).toBe(1);

    // warning 列明 errored fixture 名称
    expect(result.corpus!.erroredFixtures).toEqual(['bad-errored']);
    const w = result.warnings.join('\n');
    expect(w).toContain('errored');
    expect(w).toContain('bad-errored');
  });

  it('B1b — 输出不可解析且无码无 coverage → errored（E-10）', () => {
    const corpus = corpusDirPath();
    writeFixture(corpus, '_baseline', ['kind: baseline']);
    writeFixture(corpus, 'bad-garbled', ['kind: bad-case', 'severity: error']);
    setProbeResponses({
      _baseline: { stdout: CLEAN },
      'bad-garbled': { stdout: 'not json; no diagnostic code here' },
    });
    const result = runCorpus();
    expect(result.corpus!.fixtures.find((f) => f.name === 'bad-garbled')!.errored).toBe(true);
    expect(result.corpus!.counts.errored).toBe(1);
  });
});

describe('QA 边界：未声明 corpusExpect → report-only warning', () => {
  it('B2 — 无 corpusExpect：report-only warning，且 passed 不被改变', () => {
    const corpus = corpusDirPath();
    writeFixture(corpus, '_baseline', ['kind: baseline']);
    writeFixture(corpus, 'bad-spec-004', [
      'kind: bad-case',
      'severity: error',
      'mustContain: [E-SPEC-004]',
    ]);
    setProbeResponses({
      _baseline: { stdout: CLEAN },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });

    const result = runCorpus(); // 不声明 corpusExpect
    expect(result.warnings.some((w) => w.includes('report-only'))).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.passed).toBe(true);
  });
});

describe('QA 边界：orphan warning 两分支互斥（每次至多其一）', () => {
  it('B3a — 空语料（无 fixture）+ orphan → early-return 分支：corpus dir empty + orphan 计数', () => {
    const corpus = corpusDirPath();
    // 仅一个 orphan（含 .mumuspec，无 expected.yaml）；无任何 fixture
    mkdirSync(join(corpus, 'orphan-only', '.mumuspec'), { recursive: true });

    const result = runCorpus();
    expect(result.corpus!.total).toBe(0);
    expect(result.corpus!.recall.value).toBeNull(); // n=0，不做 0/0
    const w = result.warnings.join('\n');
    expect(w).toContain('corpus dir empty');
    expect(w).toContain('no expected.yaml');
    expect(w).toContain('orphan-only');
  });

  it('B3b — 非空语料 + orphan → step-8 分支：orphan 计数，且**不含** corpus dir empty', () => {
    const corpus = corpusDirPath();
    writeFixture(corpus, '_baseline', ['kind: baseline']);
    writeFixture(corpus, 'bad-spec-004', [
      'kind: bad-case',
      'severity: error',
      'mustContain: [E-SPEC-004]',
    ]);
    mkdirSync(join(corpus, 'orphan-z', '.mumuspec'), { recursive: true });
    setProbeResponses({
      _baseline: { stdout: CLEAN },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });

    const result = runCorpus();
    const w = result.warnings.join('\n');
    expect(w).toContain('no expected.yaml');
    expect(w).toContain('orphan-z');
    // 关键：非空路径**不得**再命中 early-return 的 'corpus dir empty'
    expect(w).not.toContain('corpus dir empty');
    expect(result.corpus!.total).toBe(1);
    expect(result.corpus!.counts.killed).toBe(1);
  });

  it('B3c — orphan 不进任何分母；total 只计含 expected.yaml 的 fixture', () => {
    const corpus = corpusDirPath();
    writeFixture(corpus, '_baseline', ['kind: baseline']);
    writeFixture(corpus, 'clean-01', ['kind: clean']);
    writeFixture(corpus, 'bad-spec-004', ['kind: bad-case', 'severity: error']);
    mkdirSync(join(corpus, 'orphan-a', '.mumuspec'), { recursive: true });
    mkdirSync(join(corpus, 'orphan-b', '.mumuspec'), { recursive: true });
    setProbeResponses({
      _baseline: { stdout: CLEAN },
      'clean-01': { stdout: CLEAN },
      'bad-spec-004': { stdout: JSON.stringify({ errors: [{ code: 'E-SPEC-004' }] }) },
    });

    const result = runCorpus();
    // 3 fixture（不含 _baseline）：clean-01 + bad-spec-004 = 2；两个 orphan 不计
    expect(result.corpus!.total).toBe(2);
    expect(result.warnings.join('\n')).toContain('2 subdir(s) with .mumuspec but no expected.yaml');
  });
});
