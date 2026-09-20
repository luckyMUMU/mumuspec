/**
 * corpus-fixtures.test.ts — 语料内容校验（eval-corpus / DS-EVAL-004，L2-C13/C14）。
 *
 * 枚举仓库根 `.eval-corpus/` 全部 fixture（含 expected.yaml），断言：
 * - 覆盖目标 = **17 个可发射码**各恰好 1 例；
 * - `E-SPEC-005/007/012` 为 registered-but-not-emitted，**不出现**在任何 mustContain（反向断言）；
 * - severity 分档由 expected.yaml 显式声明，veto 档恰为 E-GUARD-010 / E-CHANGE-022 / E-SPEC-015。
 *
 * 复用 L0 单一权威解析器 `loadFixtureExpectation`（纯读，不 spawn）。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadFixtureExpectation, type FixtureExpectation } from '../../src/eval/corpus.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = join(REPO_ROOT, '.eval-corpus');

/** 覆盖目标：17 个可发射码（各恰 1 例）。 */
const EMITTABLE_CODES = [
  'E-SPEC-001',
  'E-SPEC-002',
  'E-SPEC-003',
  'E-SPEC-004',
  'E-SPEC-006',
  'E-SPEC-008',
  'E-SPEC-009',
  'E-SPEC-010',
  'E-SPEC-011',
  'E-SPEC-013',
  'E-SPEC-014',
  'E-SPEC-015',
  'W-SPEC-016',
  'E-GUARD-010',
  'E-CHANGE-022',
  'E-DRIFT-016',
  'E-GUARD-013',
] as const;

/** registered-but-not-emitted（M1 出范围，不建必须命中语料）。 */
const NOT_EMITTED_CODES = ['E-SPEC-005', 'E-SPEC-007', 'E-SPEC-012'] as const;

interface Fixture {
  name: string;
  exp: FixtureExpectation;
}

function enumerateFixtures(): Fixture[] {
  return readdirSync(CORPUS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => ({
      name: d.name,
      exp: loadFixtureExpectation(join(CORPUS, d.name, 'expected.yaml')),
    }));
}

/** code → 声明该码的 bad-case fixture 名列表。 */
function codesByFixture(fixtures: Fixture[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of fixtures) {
    if (f.exp.kind !== 'bad-case') continue;
    for (const code of f.exp.mustContain) {
      const list = map.get(code) ?? [];
      list.push(f.name);
      map.set(code, list);
    }
  }
  return map;
}

describe('corpus-fixtures 内容校验 (eval-corpus)', () => {
  // ── L2-C13 · 覆盖码清单完整（15 个可发射码，各恰 1 例） ──

  it('L2-C13 — 17 个可发射码各恰 1 例；005/007/012 不出现在任何 mustContain', () => {
    expect(existsSync(CORPUS)).toBe(true);
    const fixtures = enumerateFixtures();

    // 结构：恰 1 个 _baseline；≥1 个 clean-*；命名规则
    const baselines = fixtures.filter((f) => f.name === '_baseline');
    expect(baselines).toHaveLength(1);
    expect(baselines[0].exp.kind).toBe('baseline');

    const cleans = fixtures.filter((f) => f.name.startsWith('clean-'));
    expect(cleans.length).toBeGreaterThanOrEqual(1);
    for (const c of cleans) expect(c.exp.kind).toBe('clean');

    for (const f of fixtures) {
      expect(f.name).toMatch(/^(_baseline|bad-.+|clean-\d+)$/);
    }

    const badCases = fixtures.filter((f) => f.exp.kind === 'bad-case');
    expect(badCases).toHaveLength(17);

    // 16 个可发射码：各恰好 1 例
    const byCode = codesByFixture(fixtures);
    for (const code of EMITTABLE_CODES) {
      const owners = byCode.get(code) ?? [];
      expect(owners, `${code} 应恰 1 例`).toHaveLength(1);
    }

    // 反向断言：E-SPEC-005/007/012 不得出现在任何 mustContain
    for (const code of NOT_EMITTED_CODES) {
      expect(byCode.get(code) ?? [], `${code} 为 registered-but-not-emitted`).toEqual([]);
    }

    // 覆盖总数一致性：17 个 bad-case 各声明 1 码
    const totalDeclared = badCases.reduce((sum, f) => sum + f.exp.mustContain.length, 0);
    expect(totalDeclared).toBe(17);

    // 跨域探针：E-GUARD-010→guard、E-CHANGE-022→archive（均需 change）；其余 default validate/check
    const guardFx = badCases.find((f) => f.exp.mustContain.includes('E-GUARD-010'))!;
    expect(guardFx.exp.probe).toBe('guard');
    expect(guardFx.exp.change).toBeTruthy();

    const archiveFx = badCases.find((f) => f.exp.mustContain.includes('E-CHANGE-022'))!;
    expect(archiveFx.exp.probe).toBe('archive');
    expect(archiveFx.exp.change).toBeTruthy();

    for (const f of badCases) {
      if (f.exp.mustContain.includes('E-GUARD-010') || f.exp.mustContain.includes('E-CHANGE-022')) {
        continue;
      }
      expect(['validate', 'check']).toContain(f.exp.probe);
    }
  });

  // ── L2-C14 · severity 分档由 expected.yaml 声明 ──

  it('L2-C14 — 每个 bad-case 声明 severity∈{veto,error,warn}；veto 档恰为 3 个 fail-closed 码', () => {
    const badCases = enumerateFixtures().filter((f) => f.exp.kind === 'bad-case');
    expect(badCases.length).toBeGreaterThan(0);

    // 全部声明合法 severity
    for (const f of badCases) {
      expect(['veto', 'error', 'warn']).toContain(f.exp.severity);
      expect(f.exp.severity).toBeDefined();
    }

    // veto 档恰为 E-GUARD-010 / E-CHANGE-022 / E-SPEC-015
    const vetoCodes = badCases
      .filter((f) => f.exp.severity === 'veto')
      .flatMap((f) => f.exp.mustContain)
      .sort();
    expect(vetoCodes).toEqual(['E-CHANGE-022', 'E-GUARD-010', 'E-SPEC-015']);

    // warn 档 = W- 码（W-SPEC-016）
    const warnCodes = badCases
      .filter((f) => f.exp.severity === 'warn')
      .flatMap((f) => f.exp.mustContain);
    expect(warnCodes).toEqual(['W-SPEC-016']);

    // 其余为 error，且均为 E- 码
    for (const f of badCases.filter((x) => x.exp.severity === 'error')) {
      for (const code of f.exp.mustContain) {
        expect(code.startsWith('E-')).toBe(true);
      }
    }
  });
});
