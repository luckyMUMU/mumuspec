/**
 * 插件包安装 —— 落到宿主插件缓存三段布局，并幂等登记 installed_plugins.json。
 *
 * 两条不变量：
 *  1. **动作必须留下可判定的事实**：复制成功但登记失败 = 失败（fail-closed），
 *     不允许出现"装了但没登记"的中间态（否则宿主与命令对"是否已安装"给出相反答案）。
 *  2. **幂等**：同一版本重复安装不产生重复条目，且保留首次 installedAt。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePluginManifest, type ManifestViolation } from '../bundle/plugin-manifest.js';

export interface PluginRegistryEntry {
  scope: 'user' | 'project';
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
}

export interface PluginRegistry {
  version: number;
  plugins: Record<string, PluginRegistryEntry[]>;
}

export interface InstallPluginOptions {
  cacheRoot: string;
  registryPath: string;
  marketplaceName: string;
  scope?: 'user' | 'project';
  /** 只报告待安装路径与待登记条目，不写盘 */
  dryRun?: boolean;
}

export interface InstallPluginResult {
  ok: boolean;
  installPath?: string;
  registryUpdated?: boolean;
  registryEntry?: PluginRegistryEntry;
  error?: string;
  violations?: ManifestViolation[];
}

/** 读取并解析登记文件；不存在则视为空登记表；不可解析则抛错（由调用方转为 fail-closed）。 */
export function readRegistry(registryPath: string): PluginRegistry {
  if (!existsSync(registryPath)) return { version: 2, plugins: {} };
  const raw = readFileSync(registryPath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('plugins' in parsed) ||
    typeof (parsed as PluginRegistry).plugins !== 'object' ||
    (parsed as PluginRegistry).plugins === null
  ) {
    throw new Error('登记文件结构不合法：缺少 plugins 对象');
  }
  const reg = parsed as PluginRegistry;
  if (typeof reg.version !== 'number') reg.version = 2;
  return reg;
}

export function installPluginPackage(
  pkgDir: string,
  opts: InstallPluginOptions,
): InstallPluginResult {
  const manifestPath = join(pkgDir, '.codebuddy-plugin', 'plugin.json');
  if (!existsSync(manifestPath)) {
    return { ok: false, error: `插件包缺少清单：${manifestPath}` };
  }

  let manifest: { name?: unknown; version?: unknown };
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { name?: unknown; version?: unknown };
  } catch (err) {
    return { ok: false, error: `清单不是合法 JSON：${(err as Error).message}` };
  }

  const violations = validatePluginManifest(manifest, { pluginRoot: pkgDir });
  if (violations.length > 0) {
    return { ok: false, error: 'E-SKILL-002 插件清单未通过校验', violations };
  }

  const pluginName = manifest.name as string;
  const version = typeof manifest.version === 'string' ? manifest.version : '0.1.0';
  const installPath = join(opts.cacheRoot, opts.marketplaceName, pluginName, version);
  const registryKey = `${pluginName}@${opts.marketplaceName}`;
  const scope = opts.scope ?? 'user';
  const nowIso = new Date().toISOString();

  // 登记表先读后写：读取失败即整体失败，绝不在读取失败时臆造空表覆盖既有登记
  let registry: PluginRegistry;
  try {
    registry = readRegistry(opts.registryPath);
  } catch (err) {
    return {
      ok: false,
      error: `E-SKILL-003 登记文件不可解析，安装中止（未写入任何内容）：${(err as Error).message}`,
    };
  }

  const existing = registry.plugins[registryKey] ?? [];
  const sameVersion = existing.find((e) => e.version === version && e.scope === scope);
  const entry: PluginRegistryEntry = sameVersion
    ? { ...sameVersion, installPath, lastUpdated: nowIso }
    : { scope, installPath, version, installedAt: nowIso, lastUpdated: nowIso };

  if (opts.dryRun) {
    return { ok: true, installPath, registryUpdated: false, registryEntry: entry };
  }

  try {
    mkdirSync(installPath, { recursive: true });
    cpSync(pkgDir, installPath, { recursive: true, force: true });
  } catch (err) {
    return { ok: false, error: `复制插件包失败：${(err as Error).message}` };
  }

  const nextPlugins = { ...registry.plugins };
  nextPlugins[registryKey] = sameVersion
    ? existing.map((e) => (e === sameVersion ? entry : e))
    : [...existing, entry];
  const next: PluginRegistry = { version: registry.version || 2, plugins: nextPlugins };

  try {
    mkdirSync(join(opts.registryPath, '..'), { recursive: true });
    writeFileSync(opts.registryPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
  } catch (err) {
    return {
      ok: false,
      installPath,
      error: `E-SKILL-003 登记写入失败（已复制未登记）：${(err as Error).message}`,
    };
  }

  return { ok: true, installPath, registryUpdated: true, registryEntry: entry };
}

/** 列出缓存根下已安装的插件（读操作，供命令展示）。 */
export function listInstalledPlugins(cacheRoot: string): string[] {
  if (!existsSync(cacheRoot)) return [];
  try {
    const out: string[] = [];
    for (const mk of readdirSync(cacheRoot, { withFileTypes: true })) {
      if (!mk.isDirectory()) continue;
      for (const pl of readdirSync(join(cacheRoot, mk.name), { withFileTypes: true })) {
        if (!pl.isDirectory()) continue;
        for (const ver of readdirSync(join(cacheRoot, mk.name, pl.name), { withFileTypes: true })) {
          if (ver.isDirectory()) out.push(`${pl.name}@${mk.name}@${ver.name}`);
        }
      }
    }
    return out.sort();
  } catch {
    return [];
  }
}
