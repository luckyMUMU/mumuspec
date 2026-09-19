/**
 * SHALL 机读注解通道（shall-annotation-channel）——guard 执行语义。
 *
 * TC-L0-02/03/04/05/06：注解 SHALL 执行 E-GUARD-012、无通道回落、测试文件豁免、
 * 子范围过滤、E-SPEC-004/015 回归。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkCompliance } from '../../src/guard/checker.js';

const ANNOTATED_SHALL_SPEC = [
  '---',
  'layer: 0',
  'scope: "."',
  'prohibitions:',
  '  - text: "所有函数必须是纯函数（无赋值副作用）"',
  '    annotation:',
  '      type: pure-function',
  '      scope: function',
  '---',
  '',
  '## Requirement: 纯函数',
  '',
  '### SHALL',
  '- 所有函数必须是纯函数（无赋值副作用）',
  '',
].join('\n');

const UNANNOTATED_SHALL_SPEC = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '## Requirement: 文档',
  '',
  '### SHALL',
  '- 所有公开 API 必须有 JSDoc',
  '',
].join('\n');

const UNANNOTATED_SHALL_NOT_SPEC = [
  '---',
  'layer: 0',
  'scope: "."',
  '---',
  '',
  '## Requirement: 依赖',
  '',
  '### SHALL NOT',
  '- 禁止引入未被请求的抽象层',
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
  const dir = join(tmpdir(), `mumuspec-shall-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

describe('checkShall 注解执行（E-GUARD-012）', () => {
  let dir: string;
  beforeEach(() => { dir = createProject({}); });
  afterEach(() => cleanup(dir));

  it('TC-L0-02: 注解 SHALL + 含赋值副作用的 ts 文件 → E-GUARD-012', () => {
    writeProjectFiles(dir, {
      '.mumuspec/spec.md': ANNOTATED_SHALL_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/impure.ts': 'export function impure(): void {\n  let acc = 0;\n  acc = 1;\n}\n',
    });
    const result = checkCompliance(dir, {});
    expect(result.passed).toBe(false);
    const hit = result.errors.find((e) => e.code === 'E-GUARD-012');
    expect(hit).toBeDefined();
    expect(hit!.message).toContain('SHALL 未满足');
    expect(hit!.detail).toContain(join('src', 'impure.ts'));
  });

  it('TC-L0-02 反例: 注解 SHALL + 纯函数 → 无 E-GUARD-012', () => {
    writeProjectFiles(dir, {
      '.mumuspec/spec.md': ANNOTATED_SHALL_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'src/pure.ts': 'export function pure(): number {\n  return 1;\n}\n',
    });
    const result = checkCompliance(dir, {});
    expect(result.errors.some((e) => e.code === 'E-GUARD-012')).toBe(false);
  });

  it('TC-L0-05: 违规文件位于 tests/ → 测试文件豁免，无 E-GUARD-012', () => {
    writeProjectFiles(dir, {
      '.mumuspec/spec.md': ANNOTATED_SHALL_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
      'tests/impure.test.ts': 'export function helper(): void {\n  let acc = 0;\n  acc = 1;\n}\n',
    });
    const result = checkCompliance(dir, {});
    expect(result.errors.some((e) => e.code === 'E-GUARD-012')).toBe(false);
  });

  it('TC-L0-06: 子目录 spec 只检查范围内文件', () => {
    const subSpec = ANNOTATED_SHALL_SPEC.replace('scope: "."', 'scope: "sub"');
    writeProjectFiles(dir, {
      'sub/.mumuspec/spec.md': subSpec,
      'sub/.mumuspec/design.md': DESIGN_DOC.replace('scope: "."', 'scope: "sub"'),
      'sub/src/impure.ts': 'export function f(): void {\n  let a = 0;\n  a = 1;\n}\n',
      'lib/impure.ts': 'export function g(): void {\n  let b = 0;\n  b = 1;\n}\n',
    });
    const result = checkCompliance(dir, {});
    const hits = result.errors.filter((e) => e.code === 'E-GUARD-012');
    expect(hits).toHaveLength(1);
    expect(hits[0].detail).toContain(join('sub', 'src'));
  });
});

describe('无通道回落回归（E-SPEC-004/015）', () => {
  let dir: string;
  beforeEach(() => { dir = createProject({}); });
  afterEach(() => cleanup(dir));

  it('TC-L0-03: 无注解 SHALL → 仅 E-SPEC-004 告警，无 errors', () => {
    writeProjectFiles(dir, {
      '.mumuspec/spec.md': UNANNOTATED_SHALL_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
    });
    const result = checkCompliance(dir, {});
    expect(result.errors).toHaveLength(0);
    expect(result.warnings.some((w) => w.code === 'E-SPEC-004')).toBe(true);
  });

  it('TC-L0-04: 无通道 SHALL NOT → E-SPEC-015 阻断（strict 默认）', () => {
    writeProjectFiles(dir, {
      '.mumuspec/spec.md': UNANNOTATED_SHALL_NOT_SPEC,
      '.mumuspec/design.md': DESIGN_DOC,
    });
    const result = checkCompliance(dir, {});
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-SPEC-015')).toBe(true);
  });
});