/**
 * 技能副本漂移检测测试（对应 delta-spec ENF-9）。
 *
 * 核心断言是**双向**的：改正文必须报，仅改版本行必须不报。
 * 单向断言（只测"改了会报"）会漏掉"恒亮告警"这个失败模式——
 * 而恒亮的告警会训练读者忽略整条通道。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  stripFrontmatterVersion,
  detectSkillDrift,
  buildSkillPairs,
} from '../../src/guard/skill-drift.js';

const SKILL = (version: string, body: string) =>
  `---\nname: demo\ndescription: "demo skill"\nmetadata:\n  version: ${version}\n---\n\n# Demo\n\n${body}\n`;

describe('stripFrontmatterVersion', () => {
  it('只替换 frontmatter 内的版本行，其余字节不变', () => {
    const src = SKILL('1.0.0', 'body line');
    const out = stripFrontmatterVersion(src);
    expect(out).toContain('name: demo');
    expect(out).toContain('description: "demo skill"');
    expect(out).toContain('body line');
    expect(out).not.toContain('1.0.0');
  });

  it('无 frontmatter 时原样返回', () => {
    const src = '# No frontmatter\n\ncontent\n';
    expect(stripFrontmatterVersion(src)).toBe(src);
  });

  it('正文中出现 version: 字样不被误剥（只动 frontmatter 区块）', () => {
    const src = `---\nname: demo\nmetadata:\n  version: 1.0.0\n---\n\nusage: version: keep-me\n`;
    expect(stripFrontmatterVersion(src)).toContain('keep-me');
  });
});

describe('detectSkillDrift', () => {
  let root: string;
  let srcDir: string;
  let dstDir: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'skill-drift-'));
    srcDir = join(root, 'skills');
    dstDir = join(root, 'installed');
    mkdirSync(join(srcDir, 'demo'), { recursive: true });
    mkdirSync(join(dstDir, 'demo'), { recursive: true });
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const write = (dir: string, content: string) =>
    writeFileSync(join(dir, 'demo', 'SKILL.md'), content, 'utf8');

  it('改正文必报（ENF-9）', () => {
    write(srcDir, SKILL('1.0.0', 'new body'));
    write(dstDir, SKILL('1.0.0', 'old body'));

    const out = detectSkillDrift(buildSkillPairs(srcDir, dstDir));
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe('W-SKILL-001');
    expect(out[0].severity).toBe('WARN');
    expect(out[0].message).toContain('源：');
    expect(out[0].message).toContain('副本：');
  });

  it('仅改版本行必不报（剥离版本行生效）', () => {
    write(srcDir, SKILL('1.0.0', 'same body'));
    write(dstDir, SKILL('0.19.2-alpha.10', 'same body'));

    expect(detectSkillDrift(buildSkillPairs(srcDir, dstDir))).toEqual([]);
  });

  it('正文一致且版本一致时不报', () => {
    write(srcDir, SKILL('1.0.0', 'same body'));
    write(dstDir, SKILL('1.0.0', 'same body'));

    expect(detectSkillDrift(buildSkillPairs(srcDir, dstDir))).toEqual([]);
  });

  it('副本缺失单独成一条诊断', () => {
    write(srcDir, SKILL('1.0.0', 'body'));
    const out = detectSkillDrift(buildSkillPairs(srcDir, dstDir));
    expect(out).toHaveLength(1);
    expect(out[0].message).toContain('未安装');
  });

  it('诊断给出可执行的修复提示', () => {
    write(srcDir, SKILL('1.0.0', 'a'));
    write(dstDir, SKILL('1.0.0', 'b'));
    const out = detectSkillDrift(buildSkillPairs(srcDir, dstDir));
    expect(out[0].fixHint).toContain('install');
  });
});
