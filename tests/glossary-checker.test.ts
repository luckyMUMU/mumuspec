/**
 * CHG-4 — 术语漂移扫描器（AC-07/AC-08 及边界用例）。
 *
 * 覆盖：
 *   TC-4-1  fixture 含 4 类混用 → 检出 ≥4 且类型齐全
 *   TC-4-2  修复+白名单 → 0
 *   TC-4-3  白名单压制误报
 *   TC-4-4  glossary.md 缺失 → WARN 不崩溃
 *   TC-4-5  二进制跳过
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkGlossary } from '../src/guard/glossary-checker.js';

let root: string;

beforeEach(() => {
  root = join(tmpdir(), `mumuspec-glossary-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(root, { recursive: true });
  mkdirSync(join(root, '.mumuspec'), { recursive: true });
  mkdirSync(join(root, 'docs', 'reference'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('CHG-4 术语扫描器', () => {
  it('TC-4-1 fixture 含 4 类混用 → 检出 ≥4 且类型齐全', () => {
    // glossary.md 存在，避免 glossary-missing 干扰
    writeFileSync(join(root, 'docs', 'reference', 'glossary.md'), '# Glossary\n\n## Rollback\n回退\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'guide.md'),
      '# Guide\n\n提交失败时需要回滚数据。\n\n规则 MUST NOT 使用旧写法。\n\n状态 archive-inprogress 已被废弃。\n',
      'utf8',
    );
    writeFileSync(join(root, 'src', 'util.ts'), '// 门禁检查通过后才能提交\nconst ok = true;\n', 'utf8');

    const result = checkGlossary(root);
    const termFindings = result.findings.filter((f) => f.type !== 'glossary-missing');
    expect(termFindings.length).toBeGreaterThanOrEqual(4);
    const types = new Set(termFindings.map((f) => f.type));
    expect(types.has('rollback')).toBe(true);
    expect(types.has('must-not')).toBe(true);
    expect(types.has('archive-inprogress')).toBe(true);
    expect(types.has('gate')).toBe(true);
  });

  it('TC-4-2 修复+白名单 → 0', () => {
    writeFileSync(join(root, 'docs', 'reference', 'glossary.md'), '# Glossary\n', 'utf8');
    writeFileSync(
      join(root, 'docs', 'guide.md'),
      '# Guide\n\n提交失败时需要回退数据。\n\n规则 SHALL NOT 使用旧写法。\n\n状态 archive-in-progress 已被废弃。\n',
      'utf8',
    );
    writeFileSync(join(root, 'src', 'util.ts'), '// 阶段守卫检查通过后才能提交\nconst ok = true;\n', 'utf8');

    const result = checkGlossary(root);
    expect(result.count).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('TC-4-3 白名单压制误报', () => {
    writeFileSync(join(root, 'docs', 'reference', 'glossary.md'), '# Glossary\n', 'utf8');
    writeFileSync(join(root, 'docs', 'guide.md'), '# Guide\n\n数据回滚（legacy 兼容说明）。\n', 'utf8');
    writeFileSync(
      join(root, '.mumuspec', 'glossary-allowlist.yaml'),
      '- file: docs/guide.md\n  line: 3\n  pattern: 回滚\n',
      'utf8',
    );

    const result = checkGlossary(root);
    expect(result.findings.filter((f) => f.type === 'rollback')).toHaveLength(0);
    expect(result.count).toBe(0);
  });

  it('TC-4-4 边界：glossary.md 缺失 → WARN 不崩溃', () => {
    writeFileSync(join(root, 'docs', 'guide.md'), '# Guide\n', 'utf8');

    let result;
    expect(() => {
      result = checkGlossary(root);
    }).not.toThrow();

    const missing = result!.findings.find((f) => f.type === 'glossary-missing');
    expect(missing).toBeDefined();
    expect(missing!.file).toContain('glossary.md');
    expect(missing!.suggestion).toContain('唯一基准');
  });

  it('TC-4-5 边界：二进制跳过', () => {
    writeFileSync(join(root, 'docs', 'reference', 'glossary.md'), '# Glossary\n', 'utf8');
    // 含 null 字节 → 视为二进制，跳过（尽管含禁用写法）
    writeFileSync(join(root, 'docs', 'binary.md'), '# Binary\n\n回滚\x00\x00\x00data\n', 'utf8');

    const result = checkGlossary(root);
    expect(result.findings.filter((f) => f.type === 'rollback')).toHaveLength(0);
  });

  it('边界：strict 模式下 docs 中的 门禁 也报 suspect', () => {
    writeFileSync(join(root, 'docs', 'reference', 'glossary.md'), '# Glossary\n', 'utf8');
    writeFileSync(join(root, 'docs', 'guide.md'), '# Guide\n\n门禁 用于流程控制。\n', 'utf8');

    const loose = checkGlossary(root);
    expect(loose.findings.filter((f) => f.type === 'gate')).toHaveLength(0);

    const strict = checkGlossary(root, { strict: true });
    expect(strict.findings.filter((f) => f.type === 'gate').length).toBeGreaterThan(0);
  });
});
