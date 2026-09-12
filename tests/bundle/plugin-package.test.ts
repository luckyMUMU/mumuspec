/**
 * 插件包产出测试（对应 delta-spec ENF-1/4）。
 *
 * 断言两条：产物必须过校验器；版本必须来自包版本单一源而非硬编码回退值。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildPluginPackage,
  discoverSkills,
  readPackageVersion,
} from '../../src/bundle/plugin-package.js';
import {
  validateMarketplaceManifest,
  validatePluginManifest,
} from '../../src/bundle/plugin-manifest.js';

function scaffold(root: string, version = '0.19.2-alpha.10'): void {
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'mumuspec', version }), 'utf8');

  // 扁平布局：skills/<name>/SKILL.md
  mkdirSync(join(root, 'skills', 'mumuspec-workflow'), { recursive: true });
  writeFileSync(join(root, 'skills', 'mumuspec-workflow', 'SKILL.md'), '# orchestrator\n', 'utf8');

  // 嵌套布局：skills/mumuspec/<name>/SKILL.md，且容器目录自身也是技能
  mkdirSync(join(root, 'skills', 'mumuspec'), { recursive: true });
  writeFileSync(join(root, 'skills', 'mumuspec', 'SKILL.md'), '# orchestrator (zh)\n', 'utf8');
  for (const name of ['phase-open', 'phase-build']) {
    mkdirSync(join(root, 'skills', 'mumuspec', name), { recursive: true });
    writeFileSync(join(root, 'skills', 'mumuspec', name, 'SKILL.md'), `# ${name}\n`, 'utf8');
  }
}

describe('discoverSkills', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plugin-pkg-'));
    scaffold(root);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('同时支持扁平与嵌套两种既有布局（容器目录自身也是技能）', () => {
    expect(discoverSkills(root).map((s) => s.name)).toEqual([
      'mumuspec',
      'mumuspec-workflow',
      'phase-build',
      'phase-open',
    ]);
  });

  it('skills 目录缺失时返回空数组', () => {
    const empty = mkdtempSync(join(tmpdir(), 'plugin-pkg-empty-'));
    try {
      expect(discoverSkills(empty)).toEqual([]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe('readPackageVersion', () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plugin-pkg-'));
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('读取 package.json 的版本（单一源）', () => {
    scaffold(root, '0.23.0-alpha.4');
    expect(readPackageVersion(root)).toBe('0.23.0-alpha.4');
  });

  it('缺 package.json 时回退 0.1.0，而不是硬编码的旧版本', () => {
    expect(readPackageVersion(root)).toBe('0.1.0');
    expect(readPackageVersion(root)).not.toBe('0.12.2');
  });
});

describe('buildPluginPackage', () => {
  let root: string;
  let outDir: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plugin-pkg-'));
    scaffold(root);
    outDir = join(root, 'dist-plugin');
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('产出可被宿主识别的包结构（ENF-1）', () => {
    const r = buildPluginPackage(root, { outDir });
    expect(r.ok).toBe(true);
    expect(r.skills).toEqual(['mumuspec', 'mumuspec-workflow', 'phase-build', 'phase-open']);

    const pluginPath = join(outDir, 'plugins', 'mumuspec', '.codebuddy-plugin', 'plugin.json');
    const mkPath = join(outDir, '.codebuddy-plugin', 'marketplace.json');
    expect(existsSync(pluginPath)).toBe(true);
    expect(existsSync(mkPath)).toBe(true);
    expect(existsSync(join(outDir, 'plugins', 'mumuspec', 'skills', 'phase-open', 'SKILL.md'))).toBe(true);
    expect(r.pluginRoot).toBe(join(outDir, 'plugins', 'mumuspec'));
  });

  it('产物通过官方规则校验器（ENF-1）', () => {
    const r = buildPluginPackage(root, { outDir });
    const plugin = JSON.parse(
      readFileSync(join(r.pluginRoot!, '.codebuddy-plugin', 'plugin.json'), 'utf8'),
    );
    const market = JSON.parse(readFileSync(join(outDir, '.codebuddy-plugin', 'marketplace.json'), 'utf8'));

    expect(validatePluginManifest(plugin, { pluginRoot: r.pluginRoot! })).toEqual([]);
    expect(validateMarketplaceManifest(market, { marketplaceRoot: outDir })).toEqual([]);
  });

  it('版本取自包版本单一源（ENF-4）', () => {
    scaffold(root, '0.23.0-alpha.4');
    const r = buildPluginPackage(root, { outDir });
    expect(r.version).toBe('0.23.0-alpha.4');

    const plugin = JSON.parse(
      readFileSync(join(r.pluginRoot!, '.codebuddy-plugin', 'plugin.json'), 'utf8'),
    );
    expect(plugin.version).toBe('0.23.0-alpha.4');
  });

  it('dry-run 只报告不写盘', () => {
    const r = buildPluginPackage(root, { outDir, dryRun: true });
    expect(r.ok).toBe(true);
    expect(r.skills).toHaveLength(4);
    expect(existsSync(outDir)).toBe(false);
  });

  it('无技能可打包时失败', () => {
    const bare = mkdtempSync(join(tmpdir(), 'plugin-pkg-bare-'));
    try {
      const r = buildPluginPackage(bare, { outDir });
      expect(r.ok).toBe(false);
      expect(r.error).toContain('未发现任何技能');
    } finally {
      rmSync(bare, { recursive: true, force: true });
    }
  });
});
