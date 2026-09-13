/**
 * Delta channel gate tests (delta-channel-gate, 2026-09-13).
 *
 * Carried constraints (constraints/ + delta-specs/) must have a verification
 * channel before the verify phase — E-GUARD-010.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { collectUnchanneledDeltaConstraints } from '../../src/guard/delta-channels.js';

function createTmpChange(): string {
  const dir = join(tmpdir(), `mumuspec-delta-ch-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

describe('collectUnchanneledDeltaConstraints', () => {
  let dir: string;

  beforeEach(() => {
    dir = createTmpChange();
    mkdirSync(join(dir, 'constraints'), { recursive: true });
    mkdirSync(join(dir, 'delta-specs'), { recursive: true });
  });

  afterEach(() => cleanup(dir));

  it('TC1: unchanneled SHALL and SHALL NOT are reported with file + requirement', () => {
    writeFileSync(
      join(dir, 'constraints', 'new-shall.md'),
      [
        '# New SHALL Constraints',
        '',
        '## Requirement: 日志',
        '',
        '- SHALL: 所有操作必须记录审计日志',
        '',
      ].join('\n'),
    );
    writeFileSync(
      join(dir, 'delta-specs', 'cache-tech.md'),
      [
        '## Requirement: 缓存',
        '',
        '- SHALL NOT 禁止随机跳过缓存失效',
        '',
      ].join('\n'),
    );

    const items = collectUnchanneledDeltaConstraints(dir);
    expect(items.length).toBe(2);
    expect(items.map((i) => i.file).sort()).toEqual(['constraints/new-shall.md', 'delta-specs/cache-tech.md']);
    expect(items.every((i) => i.reason.length > 0)).toBe(true);
  });

  it('TC2: manual declaration, lexical anchor, and ast: prefix all pass', () => {
    writeFileSync(
      join(dir, 'constraints', 'new-shall-not.md'),
      [
        '## Requirement: 合并完整性',
        '',
        'Enforcement: manual(MRGT-01: 负向测试断言)',
        '',
        '- SHALL NOT 归档时静默丢弃无法合并的文件',
        '',
        '## Requirement: 词法',
        '',
        '- SHALL NOT 引入未被登记的 `unknown-flag` 选项',
        '',
        '## Requirement: AST 通道',
        '',
        '- SHALL NOT ast: 生产代码包含裸 eval 调用',
        '',
      ].join('\n'),
    );

    expect(collectUnchanneledDeltaConstraints(dir)).toEqual([]);
  });

  it('TC3: empty dirs and missing dirs pass trivially; fenced examples ignored', () => {
    writeFileSync(
      join(dir, 'delta-specs', 'doc.md'),
      [
        '用法示例：',
        '',
        '```markdown',
        '- SHALL NOT 围栏内的示例不是真条目',
        '```',
        '',
      ].join('\n'),
    );

    expect(collectUnchanneledDeltaConstraints(dir)).toEqual([]);
  });

  it('TC4: mixed — channeled item does not mask unchanneled sibling in same file', () => {
    writeFileSync(
      join(dir, 'constraints', 'mixed.md'),
      [
        '## Requirement: 报告',
        '',
        '- SHALL: 报告必须包含结论',
        '',
        '## Requirement: 清理',
        '',
        'Enforcement: manual(MRGT-02: 人工核查)',
        '',
        '- SHALL NOT 遗留临时文件',
        '',
      ].join('\n'),
    );

    const items = collectUnchanneledDeltaConstraints(dir);
    expect(items.length).toBe(1);
    expect(items[0].requirement).toBe('报告');
  });
});
