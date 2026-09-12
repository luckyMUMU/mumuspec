/**
 * 插件包产出 —— 把技能源目录组装成宿主可直接识别的**市场包**。
 *
 * 布局（与宿主既有市场目录同构，使 source 相对路径自洽）：
 *   <outDir>/.codebuddy-plugin/marketplace.json
 *   <outDir>/plugins/<plugin-name>/.codebuddy-plugin/plugin.json
 *   <outDir>/plugins/<plugin-name>/skills/<skill-name>/SKILL.md
 *
 * 纪律：**先校验器后产出物**——清单必须先通过校验器，否则不写盘。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  validateMarketplaceManifest,
  validatePluginManifest,
  type ManifestViolation,
} from './plugin-manifest.js';

export interface BuildPluginPackageOptions {
  outDir: string;
  marketplaceName?: string;
  pluginName?: string;
  author?: { name: string; email?: string };
  description?: string;
  /** 只计算并返回计划，不写盘 */
  dryRun?: boolean;
}

export interface BuildPluginPackageResult {
  ok: boolean;
  outDir?: string;
  /** 插件包根：<outDir>/plugins/<pluginName>，即 install --from 的入参 */
  pluginRoot?: string;
  pluginName?: string;
  version?: string;
  skills?: string[];
  violations?: ManifestViolation[];
  error?: string;
}

/** 版本单一源：读包自身 package.json，不回退到配置 schema 版本或硬编码字面量。 */
export function readPackageVersion(root: string): string {
  const pkgPath = join(root, 'package.json');
  if (!existsSync(pkgPath)) return '0.1.0';
  const parsed = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: unknown };
  return typeof parsed.version === 'string' ? parsed.version : '0.1.0';
}

/**
 * 发现可打包的技能：同时支持两种既有布局，且**两者可共存于同一父目录**。
 *   skills/<name>/SKILL.md            扁平
 *   skills/mumuspec/<name>/SKILL.md   嵌套
 * 注意：`skills/mumuspec/` 自身既是扁平技能（中文编排器），又是嵌套技能的容器——
 * 因此不能"扁平命中就跳过子目录"，否则 phase-* / workflow-presets 会被整体漏掉。
 * 同名冲突时扁平布局优先（installer 的 findMumuspecWorkflowSource 亦以扁平优先）。
 */
export function discoverSkills(root: string): Array<{ name: string; path: string }> {
  const skillsRoot = join(root, 'skills');
  const found = new Map<string, string>();
  if (!existsSync(skillsRoot)) return [];

  for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(skillsRoot, entry.name);

    const flat = join(dir, 'SKILL.md');
    if (existsSync(flat)) found.set(entry.name, flat);

    // 子目录技能：无论扁平是否命中都要扫，因为容器目录可以同时是技能本体
    for (const nested of readdirSync(dir, { withFileTypes: true })) {
      if (!nested.isDirectory()) continue;
      if (found.has(nested.name)) continue;
      const nestedSkill = join(dir, nested.name, 'SKILL.md');
      if (existsSync(nestedSkill)) found.set(nested.name, nestedSkill);
    }
  }

  return [...found.entries()]
    .map(([name, path]) => ({ name, path }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function buildPluginPackage(
  root: string,
  opts: BuildPluginPackageOptions,
): BuildPluginPackageResult {
  const pluginName = opts.pluginName ?? 'mumuspec';
  const marketplaceName = opts.marketplaceName ?? 'mumuspec';
  const version = readPackageVersion(root);
  const skills = discoverSkills(root);
  const pluginRoot = join(opts.outDir, 'plugins', pluginName);

  if (skills.length === 0) {
    return { ok: false, error: '未发现任何技能（skills/<name>/SKILL.md）' };
  }

  const description =
    opts.description ??
    'MumuSpec spec-as-DSL 工作流：以规范树为唯一事实源驱动 open → design → build → verify → archive 变更生命周期，含 CLI 守卫、漂移检测与知识回流。';

  const pluginManifest = {
    name: pluginName,
    version,
    description,
    author: opts.author ?? { name: 'MumuSpec Contributors' },
    homepage: 'https://github.com/mumuspec/mumuspec',
    repository: 'https://github.com/mumuspec/mumuspec',
    license: 'MIT',
    keywords: ['spec-driven', 'workflow', 'change-lifecycle', 'guards', 'cli'],
  };

  // 先校验：清单不合法即不写盘
  const pluginViolations = validatePluginManifest(pluginManifest, { pluginRoot });
  if (pluginViolations.length > 0) {
    return { ok: false, violations: pluginViolations, error: 'E-SKILL-002 插件清单未通过校验' };
  }

  if (opts.dryRun) {
    return {
      ok: true,
      outDir: opts.outDir,
      pluginRoot,
      pluginName,
      version,
      skills: skills.map((s) => s.name),
    };
  }

  // 技能与插件清单先落盘：市场清单的 source 存在性校验依赖实际目录
  try {
    for (const s of skills) {
      const dest = join(pluginRoot, 'skills', s.name, 'SKILL.md');
      mkdirSync(join(dest, '..'), { recursive: true });
      cpSync(s.path, dest);
    }
    mkdirSync(join(pluginRoot, '.codebuddy-plugin'), { recursive: true });
    writeFileSync(
      join(pluginRoot, '.codebuddy-plugin', 'plugin.json'),
      JSON.stringify(pluginManifest, null, 2) + '\n',
      'utf8',
    );
  } catch (err) {
    return { ok: false, error: `写入插件包失败：${(err as Error).message}` };
  }

  const marketplaceManifest = {
    name: marketplaceName,
    description: 'MumuSpec 本地分发市场',
    owner: { name: 'MumuSpec Contributors' },
    metadata: { version, pluginRoot: './plugins' },
    plugins: [
      {
        name: pluginName,
        description,
        version,
        source: `./plugins/${pluginName}`,
        category: 'development',
        license: 'MIT',
      },
    ],
  };

  const marketplaceViolations = validateMarketplaceManifest(marketplaceManifest, {
    marketplaceRoot: opts.outDir,
  });
  if (marketplaceViolations.length > 0) {
    return { ok: false, violations: marketplaceViolations, error: 'E-SKILL-002 市场清单未通过校验' };
  }

  try {
    const metaDir = join(opts.outDir, '.codebuddy-plugin');
    mkdirSync(metaDir, { recursive: true });
    writeFileSync(
      join(metaDir, 'marketplace.json'),
      JSON.stringify(marketplaceManifest, null, 2) + '\n',
      'utf8',
    );
  } catch (err) {
    return { ok: false, error: `写入市场清单失败：${(err as Error).message}` };
  }

  return {
    ok: true,
    outDir: opts.outDir,
    pluginRoot,
    pluginName,
    version,
    skills: skills.map((s) => s.name),
  };
}
