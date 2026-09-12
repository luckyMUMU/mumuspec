/**
 * 插件包安装测试（对应 delta-spec ENF-6/7/8）。
 *
 * 关键断言是**幂等**与**fail-closed**：
 * 前者防止复制语义每跑一次就污染登记表，后者防止"装了但没登记"的中间态
 * （宿主与命令对"是否已安装"给出相反答案，比直接失败更难排查）。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installPluginPackage, readRegistry, listInstalledPlugins } from '../../src/install/plugin-install.js';

function makePackage(root: string, version = '1.0.0'): string {
  const pkg = join(root, 'pkg');
  mkdirSync(join(pkg, '.codebuddy-plugin'), { recursive: true });
  mkdirSync(join(pkg, 'skills', 'demo'), { recursive: true });
  writeFileSync(
    join(pkg, '.codebuddy-plugin', 'plugin.json'),
    JSON.stringify({
      name: 'mumuspec',
      version,
      description: 'D'.repeat(60),
      author: { name: 'MumuSpec Contributors' },
      license: 'MIT',
    }),
    'utf8',
  );
  writeFileSync(join(pkg, 'skills', 'demo', 'SKILL.md'), '# demo\n', 'utf8');
  return pkg;
}

describe('installPluginPackage', () => {
  let root: string;
  let cacheRoot: string;
  let registryPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plugin-install-'));
    cacheRoot = join(root, 'cache');
    registryPath = join(root, 'installed_plugins.json');
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('安装落到三段布局并写入登记（ENF-8）', () => {
    const pkg = makePackage(root);
    const r = installPluginPackage(pkg, { cacheRoot, registryPath, marketplaceName: 'mumuspec' });
    expect(r.ok).toBe(true);
    expect(r.installPath).toBe(join(cacheRoot, 'mumuspec', 'mumuspec', '1.0.0'));
    expect(existsSync(join(r.installPath!, '.codebuddy-plugin', 'plugin.json'))).toBe(true);
    expect(existsSync(join(r.installPath!, 'skills', 'demo', 'SKILL.md'))).toBe(true);

    const reg = readRegistry(registryPath);
    expect(Object.keys(reg.plugins)).toEqual(['mumuspec@mumuspec']);
    expect(reg.plugins['mumuspec@mumuspec']).toHaveLength(1);
  });

  it('幂等：同版本重复安装条目数仍为 1，且保留 installedAt（ENF-6）', () => {
    const pkg = makePackage(root);
    installPluginPackage(pkg, { cacheRoot, registryPath, marketplaceName: 'mumuspec' });
    const first = readRegistry(registryPath).plugins['mumuspec@mumuspec'][0];

    installPluginPackage(pkg, { cacheRoot, registryPath, marketplaceName: 'mumuspec' });
    const second = readRegistry(registryPath).plugins['mumuspec@mumuspec'];

    expect(second).toHaveLength(1);
    expect(second[0].installedAt).toBe(first.installedAt);
    expect(second[0].version).toBe('1.0.0');
  });

  it('不同版本并存为两条条目', () => {
    installPluginPackage(makePackage(root, '1.0.0'), { cacheRoot, registryPath, marketplaceName: 'mumuspec' });
    installPluginPackage(makePackage(root, '2.0.0'), { cacheRoot, registryPath, marketplaceName: 'mumuspec' });
    expect(readRegistry(registryPath).plugins['mumuspec@mumuspec']).toHaveLength(2);
  });

  it('登记文件非法 JSON 时 fail-closed，且不覆盖既有文件（ENF-7）', () => {
    const pkg = makePackage(root);
    writeFileSync(registryPath, '{ broken', 'utf8');

    const r = installPluginPackage(pkg, { cacheRoot, registryPath, marketplaceName: 'mumuspec' });

    expect(r.ok).toBe(false);
    expect(r.error).toContain('E-SKILL-003');
    expect(readFileSync(registryPath, 'utf8')).toBe('{ broken');
  });

  it('清单不合规时拒绝安装并逐条给出违例', () => {
    const pkg = makePackage(root);
    writeFileSync(
      join(pkg, '.codebuddy-plugin', 'plugin.json'),
      JSON.stringify({ name: 'Bad Name' }),
      'utf8',
    );

    const r = installPluginPackage(pkg, { cacheRoot, registryPath, marketplaceName: 'mumuspec' });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('E-SKILL-002');
    expect(r.violations?.map((v) => v.rule)).toContain('name-format');
    expect(existsSync(cacheRoot)).toBe(false);
  });

  it('dry-run 不写盘但返回同一计划（R1 风险缓解）', () => {
    const pkg = makePackage(root);
    const r = installPluginPackage(pkg, {
      cacheRoot,
      registryPath,
      marketplaceName: 'mumuspec',
      dryRun: true,
    });

    expect(r.ok).toBe(true);
    expect(r.installPath).toBe(join(cacheRoot, 'mumuspec', 'mumuspec', '1.0.0'));
    expect(r.registryEntry?.version).toBe('1.0.0');
    expect(existsSync(cacheRoot)).toBe(false);
    expect(existsSync(registryPath)).toBe(false);
  });

  it('缺清单时直接失败', () => {
    const r = installPluginPackage(join(root, 'absent'), {
      cacheRoot,
      registryPath,
      marketplaceName: 'mumuspec',
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('缺少清单');
  });

  it('listInstalledPlugins 枚举既有缓存', () => {
    installPluginPackage(makePackage(root), { cacheRoot, registryPath, marketplaceName: 'mumuspec' });
    expect(listInstalledPlugins(cacheRoot)).toEqual(['mumuspec@mumuspec@1.0.0']);
  });
});
