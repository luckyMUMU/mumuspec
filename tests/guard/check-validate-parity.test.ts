/**
 * G5 — 门禁结论一致性：check 与 validate 不得给出相反结论。
 *
 * 背景：checkCompliance 仅覆盖 E-SPEC-004 / E-SPEC-015，不调用 validator 的
 * 规范结构校验（E-SPEC-001/002/003/010/011...）。结果 validate 报 ERROR 时
 * check 仍报「All checks passed」，而根 spec.md:87 要求「归档前必须通过
 * mumuspec check 全量校验」——真实规范缺陷在主力门禁下静默通过。
 *
 * 本测试锁定：check = validate（规范层）+ 代码合规层。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCompliance } from '../../src/guard/checker.js';
import { validateAllSpecs } from '../../src/spec/validator.js';
import { loadConfig } from '../../src/core/config.js';

function createTmpProject(): string {
  const dir = join(tmpdir(), `mumuspec-parity-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

/** 最小合法 tech.md — 满足格式校验，便于隔离出单一缺陷 */
function validTech(name: string): string {
  return [
    '---',
    `title: "技术规格: ${name}"`,
    'layer: 1',
    '---',
    '',
    `# 技术规格: ${name}`,
    '',
    '## R1: 示例约束',
    '',
    '### SHALL',
    '- 应当存在实现',
    '',
    '### Enforcement',
    '- type: manual',
    `  target: src/${name}/`,
    '',
  ].join('\n');
}

describe('check ↔ validate 门禁结论一致性', () => {
  let root: string;

  beforeEach(() => { root = createTmpProject(); });
  afterEach(() => { cleanup(root); });

  it('断链的 parent_prd 必须同时被 validate 与 check 拦截（E-SPEC-010）', () => {
    // 根层 prd.md
    writeFileSync(
      join(root, '.mumuspec', 'prd.md'),
      ['---', 'title: "产品需求: root"', 'layer: 0', '---', '', '# 产品需求: root', ''].join('\n'),
    );
    // 子层 tech.md 引用一个不存在的父 prd
    const childDir = join(root, 'src', 'widget');
    mkdirSync(join(childDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(childDir, '.mumuspec', 'tech.md'),
      validTech('widget').replace('layer: 1', 'layer: 1\nparent_prd: ../../../nope/prd.md'),
    );

    const vResult = validateAllSpecs(root, loadConfig(root));
    expect(vResult.errors.some((e) => e.code === 'E-SPEC-010')).toBe(true);

    const cResult = checkCompliance(root, {});
    expect(cResult.errors.some((e) => e.code === 'E-SPEC-010')).toBe(true);
  });

  it('健康项目：check 不得因并入规范校验而误报', () => {
    writeFileSync(
      join(root, '.mumuspec', 'prd.md'),
      ['---', 'title: "产品需求: root"', 'layer: 0', '---', '', '# 产品需求: root', ''].join('\n'),
    );
    const childDir = join(root, 'src', 'widget');
    mkdirSync(join(childDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(childDir, '.mumuspec', 'tech.md'),
      validTech('widget').replace('layer: 1', 'layer: 1\nparent_prd: ../../../.mumuspec/prd.md'),
    );

    const cResult = checkCompliance(root, {});
    expect(cResult.errors.filter((e) => e.code === 'E-SPEC-010')).toHaveLength(0);
  });

  it('同一项目下 check 与 validate 的 ERROR 结论不得相反', () => {
    // 构造一个规范层有缺陷、代码层干净的项目
    const childDir = join(root, 'src', 'widget');
    mkdirSync(join(childDir, '.mumuspec'), { recursive: true });
    writeFileSync(
      join(childDir, '.mumuspec', 'tech.md'),
      validTech('widget').replace('layer: 1', 'layer: 1\nparent_tech: ../../../ghost/tech.md'),
    );

    const vResult = validateAllSpecs(root, loadConfig(root));
    const cResult = checkCompliance(root, {});

    if (vResult.errors.length > 0) {
      expect(cResult.errors.length).toBeGreaterThan(0);
      expect(cResult.passed).toBe(false);
    }
  });
});
