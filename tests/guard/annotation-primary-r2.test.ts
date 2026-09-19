/**
 * 词法通道显式化（annotation-primary-r2）——guard 执行层 + 配置接线。
 *
 * TC-L0-01（checker 回归）、TC-L0-04、TC-L0-06：legacy 默认兜底执行、
 * legacy=false 去沉默词法 + E-SPEC-015 出口、lex: 前缀显式入口、config.yaml 驱动。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCompliance } from '../../src/guard/checker.js';

const EVAL_SHALL_NOT_SPEC = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '## Requirement: 运行时安全',
  '',
  '### SHALL NOT',
  '- 禁止使用 `eval`',
  '',
].join('\n');

const LEX_SHALL_NOT_SPEC = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '## Requirement: 运行时安全',
  '',
  '### SHALL NOT',
  '- lex:禁止使用 `eval`',
  '',
].join('\n');

const DESIGN_DOC = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '# Design',
  '',
  'test fixture',
  '',
].join('\n');

function createProject(files: Record<string, string>): string {
  const dir = join(tmpdir(), `mumuspec-lex-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  writeFileSync(join(dir, '.mumuspec', 'config.yaml'), 'language: en\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"test","version":"1.0.0"}\n');
  writeProjectFiles(dir, files);
  return dir;
}

function writeProjectFiles(dir: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const idx = rel.lastIndexOf('/');
    const parent = idx >= 0 ? join(dir, rel.slice(0, idx)) : dir;
    mkdirSync(parent, { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

const EVAL_SRC = 'function run(code) {\n  return eval(code);\n}\n';

describe('legacy 词法兜底策略', () => {
  let dir: string;
  beforeEach(() => { dir = createProject({}); });
  afterEach(() => cleanup(dir));

  it('TC-L0-01 回归: 缺省配置（无键）→ 词法兜底照常执行（E-GUARD-003 命中，无 E-SPEC-015）', () => {
    writeProjectFiles(dir, {
      '.mumuspec/spec.md': EVAL_SHALL_NOT_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/run.js': EVAL_SRC,
    });
    const result = checkCompliance(dir, {});
    expect(result.errors.some((e) => e.code === 'E-GUARD-003')).toBe(true);
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(false);
  });

  it('TC-L0-04: legacy=false（config 显式）→ 无注解文本不再静默词法：无 E-GUARD-003，出 E-SPEC-015 出口', () => {
    writeProjectFiles(dir, {
      '.mumuspec/config.yaml': 'specs:\n  legacy_lexical_channel: false\n',
      '.mumuspec/spec.md': EVAL_SHALL_NOT_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/run.js': EVAL_SRC,
    });
    const result = checkCompliance(dir, {});
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(true);
    expect(result.errors.some((e) => e.code === 'E-GUARD-003')).toBe(false);
  });

  it('TC-L0-06: legacy=false 下 lex: 前缀显式入口 → 词法执行命中 E-GUARD-003，无 E-SPEC-015', () => {
    writeProjectFiles(dir, {
      '.mumuspec/config.yaml': 'specs:\n  legacy_lexical_channel: false\n',
      '.mumuspec/spec.md': LEX_SHALL_NOT_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/run.js': EVAL_SRC,
    });
    const result = checkCompliance(dir, {});
    expect(result.errors.some((e) => e.code === 'E-GUARD-003')).toBe(true);
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(false);
  });

  it('TC-L0-01b: legacy=false 时注解 SHALL NOT 仍走 AST 通道（E-GUARD-003 命中）', () => {
    const annotatedSpec = [
      '---',
      'layer: 0',
      'scope: "."',
      'prohibitions:',
      '  - text: "禁止引入可变状态"',
      '    annotation:',
      '      type: no-mutable-state',
      '---',
      '',
      '## Requirement: 状态管理',
      '',
      '### SHALL NOT',
      '- 禁止引入可变状态',
      '',
    ].join('\n');
    writeProjectFiles(dir, {
      '.mumuspec/config.yaml': 'specs:\n  legacy_lexical_channel: false\n',
      '.mumuspec/spec.md': annotatedSpec,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/state.ts': 'let counter = 0;\nexport function next(): number {\n  counter += 1;\n  return counter;\n}\n',
    });
    const result = checkCompliance(dir, {});
    expect(result.errors.some((e) => e.code === 'E-GUARD-003')).toBe(true);
  });
});