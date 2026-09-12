/**
 * 插件清单校验器测试（对应 delta-spec ENF-1/2/3/4）。
 *
 * 校验器规则取自宿主官方规范文档，故正负样例必须双向覆盖——
 * 只测正例的校验器与没有校验器等价（都会放过一切）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  PLUGIN_NAME_RE,
  SEMVER_RE,
  MARKETPLACE_CATEGORIES,
  isRelativeComponentPath,
  validatePluginManifest,
  validateMarketplaceManifest,
} from '../../src/bundle/plugin-manifest.js';

describe('PLUGIN_NAME_RE（官方 kebab-case 规则）', () => {
  it.each(['api-tester', 'code-review', 'git-workflow-automation', 'a1'])('接受 %s', (n) => {
    expect(PLUGIN_NAME_RE.test(n)).toBe(true);
  });

  it.each(['API Tester', 'code_review', '-git-workflow', 'test-', '9lives', 'MumuSpec'])(
    '拒绝 %s',
    (n) => {
      expect(PLUGIN_NAME_RE.test(n)).toBe(false);
    },
  );
});

describe('SEMVER_RE', () => {
  it.each(['1.0.0', '0.1.0', '0.19.2-alpha.10', '2.3.1'])('接受 %s', (v) => {
    expect(SEMVER_RE.test(v)).toBe(true);
  });

  it.each(['1.0', 'v1.0.0', '1', ''])('拒绝 %s', (v) => {
    expect(SEMVER_RE.test(v)).toBe(false);
  });
});

describe('isRelativeComponentPath（路径规则）', () => {
  it.each(['./commands', './src/commands', './configs/hooks.json'])('接受 %s', (p) => {
    expect(isRelativeComponentPath(p)).toBe(true);
  });

  it.each(['commands', '../shared/commands', '/abs/commands', '.\\commands'])('拒绝 %s', (p) => {
    expect(isRelativeComponentPath(p)).toBe(false);
  });
});

describe('validatePluginManifest', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plugin-manifest-'));
    mkdirSync(join(root, 'commands'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const valid = {
    name: 'mumuspec',
    version: '1.0.0',
    description: 'A'.repeat(80),
    author: { name: 'MumuSpec Contributors' },
    license: 'MIT',
    keywords: ['spec', 'workflow'],
  };

  it('合规清单零违例（ENF-1）', () => {
    expect(validatePluginManifest(valid, { pluginRoot: root })).toEqual([]);
  });

  it('name 非 kebab-case 违例', () => {
    const v = validatePluginManifest({ ...valid, name: 'Mumu Spec' }, { pluginRoot: root });
    expect(v.map((x) => x.rule)).toContain('name-format');
  });

  it('version 非语义化违例', () => {
    const v = validatePluginManifest({ ...valid, version: '1.0' }, { pluginRoot: root });
    expect(v.map((x) => x.rule)).toContain('version-semver');
  });

  it('description 长度越界违例（两侧都测）', () => {
    expect(
      validatePluginManifest({ ...valid, description: 'short' }, { pluginRoot: root }).map((x) => x.rule),
    ).toContain('description-length');
    expect(
      validatePluginManifest({ ...valid, description: 'B'.repeat(260) }, { pluginRoot: root }).map(
        (x) => x.rule,
      ),
    ).toContain('description-length');
  });

  it('author 双形态：字符串通过，缺 name 的对象违例', () => {
    expect(validatePluginManifest({ ...valid, author: 'Someone' }, { pluginRoot: root })).toEqual([]);
    expect(
      validatePluginManifest({ ...valid, author: { email: 'a@b.c' } }, { pluginRoot: root }).map(
        (x) => x.rule,
      ),
    ).toContain('author-format');
  });

  it('组件路径正负样例（ENF-2）', () => {
    expect(validatePluginManifest({ ...valid, commands: './commands' }, { pluginRoot: root })).toEqual([]);
    for (const bad of ['commands', '../shared', '/abs', '.\\commands']) {
      const v = validatePluginManifest({ ...valid, commands: bad }, { pluginRoot: root });
      expect(v.map((x) => x.rule)).toContain('component-path-relative');
    }
  });

  it('引用的组件路径不存在即违例（ENF-3）', () => {
    const v = validatePluginManifest({ ...valid, commands: './nowhere' }, { pluginRoot: root });
    expect(v.map((x) => x.rule)).toContain('component-path-missing');
  });
});

describe('validateMarketplaceManifest', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'mk-manifest-'));
    mkdirSync(join(root, 'plugins', 'mumuspec'), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const mk = (source: string) => ({
    name: 'mumuspec',
    owner: { name: 'MumuSpec Contributors' },
    plugins: [{ name: 'mumuspec', source, description: 'MumuSpec workflow' }],
  });

  it('source 指向存在目录时通过', () => {
    expect(validateMarketplaceManifest(mk('./plugins/mumuspec'), { marketplaceRoot: root })).toEqual([]);
  });

  it('source 指向不存在目录时违例（ENF-3）', () => {
    const v = validateMarketplaceManifest(mk('./plugins/absent'), { marketplaceRoot: root });
    expect(v.map((x) => x.rule)).toContain('source-missing');
  });

  it('source 缺 ./ 前缀时违例', () => {
    const v = validateMarketplaceManifest(mk('plugins/mumuspec'), { marketplaceRoot: root });
    expect(v.map((x) => x.rule)).toContain('source-relative');
  });

  it('source 对象形态要求含 source 字段', () => {
    const bad = {
      name: 'mumuspec',
      owner: { name: 'x' },
      plugins: [{ name: 'mumuspec', source: {}, description: 'd' }],
    };
    expect(
      validateMarketplaceManifest(bad, { marketplaceRoot: root }).map((x) => x.rule),
    ).toContain('source-object');
  });

  it('category 必须取规范枚举（ENF-1）', () => {
    const entry = { name: 'mumuspec', source: './plugins/mumuspec', description: 'd' };
    expect(
      validateMarketplaceManifest(
        { name: 'm', owner: { name: 'o' }, plugins: [{ ...entry, category: 'development' }] },
        { marketplaceRoot: root },
      ),
    ).toEqual([]);
    expect(
      validateMarketplaceManifest(
        { name: 'm', owner: { name: 'o' }, plugins: [{ ...entry, category: 'misc' }] },
        { marketplaceRoot: root },
      ).map((x) => x.rule),
    ).toContain('category-enum');
    expect(MARKETPLACE_CATEGORIES).toContain('development');
  });

  it('缺 owner.name 与 plugins 时均违例', () => {
    const v = validateMarketplaceManifest({ name: 'm' }, { marketplaceRoot: root });
    expect(v.map((x) => x.rule)).toContain('owner-required');
    expect(v.map((x) => x.rule)).toContain('plugins-required');
  });
});
