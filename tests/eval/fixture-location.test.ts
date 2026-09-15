/**
 * fixture-location.test.ts — 语料位置隔离断言（eval-corpus / DS-EVAL-004 Enforcement，L2-C06/07/08/09）。
 *
 * 背景（探测 4）：`findSpecDirs` 仅排除「隐藏目录（name 以 . 开头）」与共享 `SKIP_DIRS`
 * （temp/dist/node_modules 等）；若评测语料落进被扫描路径（如 `tests/fixtures/...`），
 * 仓库根 `validate` 会递归进入并把语料约束计入 `coverage.total`（实证 327 → 331 污染）。
 *
 * 本套用例锁死位置隔离，防回归：语料一旦被挪进被扫描路径，L2-C06/C07 即红。
 * 全部断言在**仓库根**或**受控 temp 项目根**进程内运行（真实 `validateAllSpecs`），
 * 不依赖 CLI 子进程（除 L2-C09 的 report 只读验证外）。
 */
import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findSpecDirs } from '../../src/core/utils.js';
import { validateAllSpecs } from '../../src/spec/validator.js';
import { loadConfig } from '../../src/core/config-io.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS_DIRNAME = '.eval-corpus';

/** 语料 fixture 的最小干净 spec 骨架（含 Enforcement 块 → 4 条约束被分类计数）。 */
function makeSpec(label: string): string {
  return [
    '---',
    'layer: 0',
    'scope: "."',
    'last_updated: "2026-09-15"',
    '---',
    '',
    `## Requirement: ${label} 模块`,
    '',
    '### SHALL',
    `- ${label} 导出必须经由统一入口文件`,
    `- ${label} 新增函数前必须登记导出清单`,
    '',
    '### SHALL NOT',
    `- ${label} 禁止直接引用内部函数 internalHelper`,
    `- ${label} 禁止绕过公共门面 publicFacade 访问内部状态`,
    '',
    '### Enforcement',
    '- ENF-1: lint 规则扫描跨模块私有引用',
    '- ENF-2: 导出清单比对（构建期校验）',
    '',
  ].join('\n');
}

/** 递归收集名为 `name` 的目录（跳过 node_modules / .git）。 */
function findDirsNamed(root: string, name: string): string[] {
  const out: string[] = [];
  const stack: string[] = [root];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const p = join(cur, e.name);
      if (e.name === name) out.push(p);
      if (e.name !== 'node_modules' && e.name !== '.git') stack.push(p);
    }
  }
  return out;
}

function coverageTotal(root: string): number {
  return validateAllSpecs(root, loadConfig(root)).coverage?.total ?? 0;
}

let tempRoot = '';
afterAll(() => {
  if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
});

describe('fixture-location 位置隔离 (eval-corpus)', () => {
  // ── L2-C06 · 仓库根 total 不含 .eval-corpus ──

  it('L2-C06 — 仓库根扫描不含任何 .eval-corpus 路径，且 coverage.total>0', () => {
    // 前置：语料确实存在（否则本用例无意义）
    expect(existsSync(join(REPO_ROOT, CORPUS_DIRNAME))).toBe(true);

    const specDirs = findSpecDirs(REPO_ROOT);
    const corpusPaths = specDirs.filter((d) =>
      d.split(/[\\/]/).some((seg) => seg === CORPUS_DIRNAME),
    );
    expect(corpusPaths).toEqual([]);

    // 参与计量的 spec 路径清单不含 .eval-corpus；total 由真实规范贡献（>0）
    const result = validateAllSpecs(REPO_ROOT, loadConfig(REPO_ROOT));
    expect(result.coverage?.total).toBeGreaterThan(0);
    for (const dir of specDirs) {
      expect(dir).not.toContain(CORPUS_DIRNAME);
    }
  });

  // ── L2-C07 · 有/无语料两次 total 相等（受控实验） ──

  it('L2-C07 — 隐藏 .eval-corpus 不移位 total；非隐藏扫描路径则污染 total', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'mumuspec-fixture-location-'));
    mkdirSync(join(tempRoot, '.mumuspec'), { recursive: true });
    writeFileSync(join(tempRoot, '.mumuspec', 'spec.md'), makeSpec('Base'), 'utf8');

    const totalBase = coverageTotal(tempRoot);
    expect(totalBase).toBeGreaterThan(0);

    // ① 隐藏目录（.eval-corpus）→ findSpecDirs 天然跳过 → total 不变
    const hidden = join(tempRoot, CORPUS_DIRNAME, '_baseline', '.mumuspec');
    mkdirSync(hidden, { recursive: true });
    writeFileSync(join(hidden, 'spec.md'), makeSpec('HiddenCorpus'), 'utf8');
    const totalWithHidden = coverageTotal(tempRoot);
    expect(totalWithHidden).toBe(totalBase); // 有语料 vs 无语料：严格相等

    // ② 非隐藏被扫描路径（tests/fixtures/eval-corpus）→ 复现 327→331 污染基线
    const scanned = join(tempRoot, 'tests', 'fixtures', 'eval-corpus', '.mumuspec');
    mkdirSync(scanned, { recursive: true });
    writeFileSync(join(scanned, 'spec.md'), makeSpec('ScannedCorpus'), 'utf8');
    const totalWithScanned = coverageTotal(tempRoot);
    expect(totalWithScanned).toBeGreaterThan(totalWithHidden); // 位置敏感 → 隔离断言有效
  });

  // ── L2-C08 · 语料位于隐藏目录、不在被扫描路径 ──

  it('L2-C08 — 语料仅位于隐藏目录；tests/ 与 temp/ 下无 eval-corpus 目录', () => {
    // 语料目录基名以 . 开头（隐藏 → findSpecDirs 跳过）
    expect(CORPUS_DIRNAME.startsWith('.')).toBe(true);
    expect(existsSync(join(REPO_ROOT, CORPUS_DIRNAME))).toBe(true);

    for (const scannedRoot of ['tests', 'temp']) {
      const hits = findDirsNamed(join(REPO_ROOT, scannedRoot), 'eval-corpus');
      expect(hits).toEqual([]);
    }
  });

  // ── L2-C09 · report 机制不改 validate/check JSON schema（report 只读） ──

  it('L2-C09 — 两次 validateAllSpecs 顶层键集与 total 一致；report 命名空间与 validate 不相交', async () => {
    const before = validateAllSpecs(REPO_ROOT, loadConfig(REPO_ROOT));

    // 触发 report 汇总（read-only 消费链：buildSummaryReport → L1 评估器）
    const { buildSummaryReport } = await import('../../src/cli/commands/eval.js');
    const summary = await buildSummaryReport(
      { total: 0, passed: 0, failed: 0, results: [], duration: 0, corpusReports: [] },
      REPO_ROOT,
    );

    const after = validateAllSpecs(REPO_ROOT, loadConfig(REPO_ROOT));

    // report 只读：不改变 validate 的 schema 与计量
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect(after.coverage?.total).toBe(before.coverage?.total);

    // report 报告自带独立命名空间，不向 validate/check schema 注入任何键
    const validateKeys = new Set(Object.keys(before));
    for (const key of Object.keys(summary)) {
      expect(validateKeys.has(key)).toBe(false);
    }
  });
});
