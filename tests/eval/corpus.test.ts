/**
 * tests/eval/corpus.test.ts — L0 corpus.ts 纯函数单测（L0-C01~C14）。
 *
 * 依据：design.md §2.1.0 / §4 L0；DS-EVAL-001、DS-EVAL-002。
 * 隔离方式：纯函数直测（无 IO、无 spawn）；loadFixtureExpectation 用 tmp 文件。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  wilsonInterval,
  makeRatio,
  collectCodes,
  findCoverage,
  diffSignals,
  loadFixtureExpectation,
  PROBE_ARGS,
  COVERAGE_FIELDS,
  type FixtureSignals,
  type CoverageVector,
} from '../../src/eval/corpus.js';

// ============ L0-C01~C05: Wilson / makeRatio ============

describe('L0 Wilson interval (L0-C01~C03)', () => {
  it('L0-C01 — n<=0 / 非有限 返回 null（除零兜底）', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(wilsonInterval(1, 0)).toBeNull();
    expect(wilsonInterval(0, -1)).toBeNull();
    expect(wilsonInterval(0, Number.NaN)).toBeNull();
    expect(wilsonInterval(0, Number.POSITIVE_INFINITY)).toBeNull();
    // 不抛异常
    expect(() => wilsonInterval(0, 0)).not.toThrow();
  });

  it('L0-C02 — n=2 置 insufficient=true 且区间合法', () => {
    for (const r of [wilsonInterval(2, 2), wilsonInterval(1, 2)]) {
      expect(r).not.toBeNull();
      expect(r!.confidence).toBe(0.95);
      expect(r!.insufficient).toBe(true);
      expect(r!.n).toBe(2);
      expect(r!.lower).toBeGreaterThanOrEqual(0);
      expect(r!.upper).toBeLessThanOrEqual(1);
      expect(r!.lower).toBeLessThanOrEqual(r!.upper);
    }
  });

  it('L0-C03 — n>=3 符合公式 + 上界钳制', () => {
    const a = wilsonInterval(6, 10)!;
    expect(a.insufficient).toBe(false);
    expect(a.n).toBe(10);
    expect(a.confidence).toBe(0.95);
    expect(a.lower).toBeCloseTo(0.3127, 3);
    expect(a.upper).toBeCloseTo(0.8318, 3);

    const b = wilsonInterval(3, 3)!;
    expect(b.upper).toBe(1); // Math.min(1, ·) 钳制
    expect(b.lower).toBeCloseTo(0.4385, 3);
  });
});

describe('L0 makeRatio (L0-C04~C05)', () => {
  it('L0-C04 — n=0 → value/ci 双 null（不做 0/0）', () => {
    const r = makeRatio(0, 0);
    expect(r.value).toBeNull();
    expect(r.n).toBe(0);
    expect(r.ci).toBeNull();
    expect(() => makeRatio(0, 0)).not.toThrow();
  });

  it('L0-C05 — n>0 值与 CI', () => {
    const r3 = makeRatio(2, 3);
    expect(r3.value).toBeCloseTo(0.6667, 3);
    expect(r3.ci!.n).toBe(3);
    expect(r3.ci!.insufficient).toBe(false);

    const r2 = makeRatio(2, 2);
    expect(r2.value).toBe(1);
    expect(r2.ci!.insufficient).toBe(true);
  });
});

// ============ L0-C06~C11: 信号提取与 diff ============

describe('L0 collectCodes (L0-C06)', () => {
  it('L0-C06 — 递归收集 + 去重，忽略非 code 与原始值', () => {
    const nested = {
      errors: [
        { code: 'E-SPEC-001', message: 'a' },
        { detail: { code: 'E-SPEC-002' } },
        { code: 'E-SPEC-001' }, // 重复
        null,
      ],
      checks: [
        { nested: [{ code: 'W-SPEC-016' }] },
        'plain-string',
        42,
      ],
      coverage: { total: 5, enforced_strong: 1 }, // 无 code → 忽略
    };
    const codes = collectCodes(nested);
    expect(codes).toBeInstanceOf(Set);
    expect([...codes].sort()).toEqual(['E-SPEC-001', 'E-SPEC-002', 'W-SPEC-016']);
    expect(codes.size).toBe(3);
  });

  it('L0-C06b — null / 原始值不抛异常', () => {
    expect(collectCodes(null).size).toBe(0);
    expect(collectCodes('x').size).toBe(0);
    expect(collectCodes(0).size).toBe(0);
    expect(() => collectCodes([null, undefined, 1, 'a'])).not.toThrow();
  });
});

describe('L0 findCoverage (L0-C07)', () => {
  it('L0-C07 — validate 顶层 / check 嵌套 双形态命中；缺四分类/无 coverage → null', () => {
    const validateShape = {
      coverage: { total: 5, enforced_strong: 1, enforced_weak: 1, manual: 2, unverifiable: 1 },
    };
    const checkShape = {
      compliance: {
        coverage: { total: 5, enforced_strong: 1, enforced_weak: 1, manual: 2, unverifiable: 1 },
      },
    };
    for (const shape of [validateShape, checkShape]) {
      const cov = findCoverage(shape);
      expect(cov).not.toBeNull();
      expect(cov!.total).toBe(5);
      expect(cov!.enforced_strong).toBe(1);
      expect(cov!.enforced_weak).toBe(1);
      expect(cov!.manual).toBe(2);
      expect(cov!.unverifiable).toBe(1);
    }

    expect(findCoverage({ passed: true })).toBeNull();
    expect(findCoverage({ coverage: { total: 5 } })).toBeNull(); // 缺四分类
  });
});

describe('L0 diffSignals (L0-C08~C11)', () => {
  const cov = (over: Partial<CoverageVector> = {}): CoverageVector => ({
    total: 20,
    enforced_strong: 10,
    enforced_weak: 4,
    manual: 4,
    unverifiable: 2,
    ...over,
  });

  it('L0-C08 — code-only 检出', () => {
    const baseline: FixtureSignals = { codes: [], coverage: null };
    const fixture: FixtureSignals = { codes: ['E-SPEC-004'], coverage: null };
    const d = diffSignals(baseline, fixture);
    expect(d.newCodes).toEqual(['E-SPEC-004']);
    expect(d.changedCoverageFields).toEqual([]);
    expect(d.killed).toBe(true);
  });

  it('L0-C09 — coverage-only 检出（并集）', () => {
    const baseline: FixtureSignals = { codes: [], coverage: cov() };
    const fixture: FixtureSignals = { codes: [], coverage: cov({ total: 19 }) };
    const d = diffSignals(baseline, fixture);
    expect(d.newCodes).toEqual([]);
    expect(d.changedCoverageFields).toEqual(['total']);
    expect(d.killed).toBe(true);
  });

  it('L0-C10 — 单侧 coverage=null → 降级纯码', () => {
    const d1 = diffSignals(
      { codes: [], coverage: null },
      { codes: [], coverage: cov() },
    );
    expect(d1.changedCoverageFields).toEqual([]);
    expect(d1.killed).toBe(false);

    const d2 = diffSignals(
      { codes: ['E-GUARD-010'], coverage: null },
      { codes: ['E-GUARD-010', 'E-GUARD-011'], coverage: null },
    );
    expect(d2.newCodes).toEqual(['E-GUARD-011']);
    expect(d2.killed).toBe(true);
  });

  it('L0-C11 — 无变化 → killed=false', () => {
    const baseline: FixtureSignals = { codes: ['E-A'], coverage: cov() };
    const fixture: FixtureSignals = { codes: ['E-A'], coverage: cov() };
    const d = diffSignals(baseline, fixture);
    expect(d.newCodes).toEqual([]);
    expect(d.changedCoverageFields).toEqual([]);
    expect(d.killed).toBe(false);
  });

  it('L0-C11b — COVERAGE_FIELDS 五字段顺序与变化检测一致', () => {
    expect([...COVERAGE_FIELDS]).toEqual([
      'total',
      'enforced_strong',
      'enforced_weak',
      'manual',
      'unverifiable',
    ]);
    const baseline: FixtureSignals = { codes: [], coverage: cov() };
    const fixture: FixtureSignals = {
      codes: [],
      coverage: cov({ manual: 5, unverifiable: 1 }),
    };
    const d = diffSignals(baseline, fixture);
    expect(d.changedCoverageFields).toEqual(['manual', 'unverifiable']);
  });
});

// ============ L0-C12~C14: expected.yaml 解析 + 探针白名单 ============

describe('L0 loadFixtureExpectation (L0-C12~C13)', () => {
  let root: string;

  beforeEach(() => {
    root = join(tmpdir(), `mumuspec-corpus-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(root, { recursive: true });
  });

  afterEach(() => {
    try { rmSync(root, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  function writeExp(fixtureDir: string, lines: string[]): string {
    const dir = join(root, fixtureDir);
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'expected.yaml');
    writeFileSync(file, lines.join('\n') + '\n');
    return file;
  }

  it('L0-C12 — 全字段解析', () => {
    const file = writeExp('bad-guard-010', [
      'kind: bad-case',
      'severity: error',
      'probe: guard',
      'change: c1',
      'mustContain: [E-GUARD-010]',
      'mustNotContain: [W-SPEC-016]',
    ]);
    const exp = loadFixtureExpectation(file);
    expect(exp.kind).toBe('bad-case');
    expect(exp.severity).toBe('error');
    expect(exp.probe).toBe('guard');
    expect(exp.change).toBe('c1');
    expect(exp.mustContain).toEqual(['E-GUARD-010']);
    expect(exp.mustNotContain).toEqual(['W-SPEC-016']);
  });

  it('L0-C13 — kind 目录名推断 + 缺省补齐', () => {
    const baseline = loadFixtureExpectation(writeExp('_baseline', ['# empty']));
    expect(baseline.kind).toBe('baseline');
    expect(baseline.probe).toBe('validate');
    expect(baseline.mustContain).toEqual([]);
    expect(baseline.mustNotContain).toEqual([]);

    const clean = loadFixtureExpectation(writeExp('clean-01', ['# empty']));
    expect(clean.kind).toBe('clean');
    expect(clean.probe).toBe('validate');

    const bad = loadFixtureExpectation(writeExp('bad-spec-004', ['# empty']));
    expect(bad.kind).toBe('bad-case');
    expect(bad.probe).toBe('validate');
    expect(bad.mustContain).toEqual([]);
  });

  it('L0-C13b — 文件缺失时按目录名推断，不抛异常', () => {
    const missing = join(root, '_baseline', 'expected.yaml');
    expect(() => loadFixtureExpectation(missing)).not.toThrow();
    expect(loadFixtureExpectation(missing).kind).toBe('baseline');
  });

  it('L0-C13c — 坏行/非法字段被跳过', () => {
    const file = writeExp('bad-spec-004', [
      'garbage-without-colon',
      'kind: not-a-real-kind',
      'severity: nonsense',
      'probe: rm -rf',
      'mustContain: [E-SPEC-004]',
    ]);
    const exp = loadFixtureExpectation(file);
    expect(exp.kind).toBe('bad-case'); // 非法值 → 回退目录名推断
    expect(exp.severity).toBeUndefined();
    expect(exp.probe).toBe('validate');
    expect(exp.mustContain).toEqual(['E-SPEC-004']);
  });
});

describe('L0 PROBE_ARGS 白名单 (L0-C14)', () => {
  it('L0-C14 — 固定 argv 模板，无注入面', () => {
    expect(PROBE_ARGS.validate()).toEqual(['validate', '--json']);
    expect(PROBE_ARGS.check()).toEqual(['check', '--json']);
    expect(PROBE_ARGS.guard('c1')).toEqual(['guard', 'c1', 'verify', '--json']);
    // `archive` 为顶层命令（`mumuspec archive <name> --confirm`），非子命令 `change archive`
    expect(PROBE_ARGS.archive('c1')).toEqual(['archive', 'c1', '--confirm']);
    // 缺省 change → 空串占位（不拼接任意命令）
    expect(PROBE_ARGS.guard()).toEqual(['guard', '', 'verify', '--json']);
    expect(PROBE_ARGS.archive()).toEqual(['archive', '', '--confirm']);
  });
});
