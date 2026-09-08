/**
 * P0 后续修复：技能安装版本单一源（SKILL.md metadata.version 注入）
 *
 * 背景：skills 下各 SKILL.md 源文件内嵌硬编码 version（如 0.19.2-alpha.0），
 * 安装时原样拷贝 → 安装产物版本与构建产物（package.json）漂移。
 * 修复：安装写入时将 frontmatter 的 metadata.version 替换为运行时包版本。
 */
import { describe, it, expect } from 'vitest';
import { stampSkillVersion } from '../../src/install/installer-ops.js';

describe('stampSkillVersion', () => {
  it('should replace metadata.version in frontmatter with the given version', () => {
    const src = `---
name: mumuspec-workflow
description: "Drive AI-assisted development"
license: MIT
metadata:
  author: MumuSpec Contributors
  version: 0.19.2-alpha.0
  homepage: https://github.com/mumuspec/mumuspec
---

# content
`;
    const out = stampSkillVersion(src, '0.19.2-alpha.10');
    expect(out).toContain('version: 0.19.2-alpha.10');
    expect(out).not.toContain('0.19.2-alpha.0');
    // 其它 frontmatter 字段不动
    expect(out).toContain('author: MumuSpec Contributors');
  });

  it('should inject version when metadata block lacks a version field', () => {
    const src = `---
name: foo
metadata:
  author: x
---
body`;
    const out = stampSkillVersion(src, '1.2.3');
    expect(out).toContain('version: 1.2.3');
    expect(out).toContain('author: x');
  });

  it('should leave content without frontmatter unchanged', () => {
    const src = '# just markdown\nversion: 9.9.9\n';
    expect(stampSkillVersion(src, '1.2.3')).toBe(src);
  });

  it('should only touch the frontmatter, not body occurrences', () => {
    const src = `---
metadata:
  version: 0.1.0
---
\`version: 0.1.0\` inline mention`;
    const out = stampSkillVersion(src, '2.0.0');
    expect(out).toContain('  version: 2.0.0');
    // 正文中的行内提及不替换（反引号包裹的 `version: 0.1.0`）
    expect(out).toContain('`version: 0.1.0`');
  });
});
