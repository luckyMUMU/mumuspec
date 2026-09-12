/**
 * 插件清单规范校验器 —— 纯模块（无 I/O 副作用，路径存在性通过注入的根目录探测）。
 *
 * 规则来源：宿主官方规范文档
 *   plugin-structure/references/manifest-reference.md
 *   plugin-discovery/references/marketplace-format.md
 *
 * 设计约束（KP-0060 规则-实现分离）：规则是声明式的，校验是代码；本模块不做写盘，
 * 只回答"这份清单是否合规、违例在哪"，由产出侧决定是否落盘（先校验器后消费者）。
 */
import { existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

export interface ManifestViolation {
  /** 违例字段的路径，如 "name" / "plugins[0].source" */
  path: string;
  /** 命中的规则标识，便于逐条断言 */
  rule: string;
  message: string;
}

export interface PluginManifestInput {
  name?: unknown;
  version?: unknown;
  description?: unknown;
  author?: unknown;
  homepage?: unknown;
  repository?: unknown;
  license?: unknown;
  keywords?: unknown;
  commands?: unknown;
  agents?: unknown;
  hooks?: unknown;
  mcpServers?: unknown;
}

export interface MarketplacePluginEntryInput {
  name?: unknown;
  source?: unknown;
  description?: unknown;
  version?: unknown;
  category?: unknown;
}

export interface MarketplaceManifestInput {
  name?: unknown;
  owner?: unknown;
  metadata?: unknown;
  plugins?: unknown;
}

/** kebab-case：字母开头，字母或数字结尾，仅小写字母数字与连字符 */
export const PLUGIN_NAME_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** 语义化版本主次修订三段式，可带预发布后缀 */
export const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** 宿主规范定义的分类枚举 */
export const MARKETPLACE_CATEGORIES = [
  'development',
  'productivity',
  'security',
  'testing',
  'database',
  'deployment',
  'design',
  'monitoring',
  'learning',
] as const;

const DESCRIPTION_MIN = 50;
const DESCRIPTION_MAX = 200;

/** 组件路径必须：以 ./ 开头、不含上溯段、使用正斜杠 */
export function isRelativeComponentPath(p: string): boolean {
  if (!p.startsWith('./')) return false;
  if (p.includes('\\')) return false;
  if (isAbsolute(p)) return false;
  const segments = p.split('/');
  return !segments.includes('..');
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function checkComponentPathField(
  field: string,
  value: unknown,
  violations: ManifestViolation[],
): void {
  if (value === undefined) return;
  // hooks / mcpServers 允许内联对象配置，等同于"不由路径解析"
  if (isPlainObject(value)) return;
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    if (typeof v !== 'string') {
      violations.push({
        path: field,
        rule: 'component-path-type',
        message: `${field} 的元素必须是字符串路径或内联对象`,
      });
      continue;
    }
    if (!isRelativeComponentPath(v)) {
      violations.push({
        path: field,
        rule: 'component-path-relative',
        message: `${field} 的路径 "${v}" 必须以 ./ 开头、不得含上溯段、必须使用正斜杠`,
      });
    }
  }
}

function checkReferencedPathsExist(
  root: string,
  field: string,
  value: unknown,
  violations: ManifestViolation[],
): void {
  if (value === undefined || isPlainObject(value)) return;
  const values = Array.isArray(value) ? value : [value];
  for (const v of values) {
    if (typeof v !== 'string' || !isRelativeComponentPath(v)) continue;
    if (!existsSync(join(root, v))) {
      violations.push({
        path: field,
        rule: 'component-path-missing',
        message: `${field} 引用的路径 "${v}" 不存在`,
      });
    }
  }
}

/** 校验单插件清单（plugin.json）。pluginRoot 用于探测被引用路径是否存在。 */
export function validatePluginManifest(
  manifest: unknown,
  opts: { pluginRoot: string },
): ManifestViolation[] {
  const violations: ManifestViolation[] = [];
  if (!isPlainObject(manifest)) {
    return [{ path: '.', rule: 'manifest-object', message: '清单必须是 JSON 对象' }];
  }
  const m = manifest as PluginManifestInput;

  // name（必需）
  if (typeof m.name !== 'string' || !PLUGIN_NAME_RE.test(m.name)) {
    violations.push({
      path: 'name',
      rule: 'name-format',
      message: 'name 必需且必须为 kebab-case（字母开头、字母或数字结尾、仅小写字母数字与连字符）',
    });
  }

  // version（可选，缺省由消费者取默认 0.1.0；存在则必须语义化）
  if (m.version !== undefined && (typeof m.version !== 'string' || !SEMVER_RE.test(m.version))) {
    violations.push({
      path: 'version',
      rule: 'version-semver',
      message: 'version 若存在必须为主次修订三段式语义化版本，可带预发布后缀',
    });
  }

  // description（可选；存在时长度 50-200）
  if (m.description !== undefined) {
    if (typeof m.description !== 'string') {
      violations.push({ path: 'description', rule: 'description-type', message: 'description 必须是字符串' });
    } else if (m.description.length < DESCRIPTION_MIN || m.description.length > DESCRIPTION_MAX) {
      violations.push({
        path: 'description',
        rule: 'description-length',
        message: `description 长度应在 ${DESCRIPTION_MIN}-${DESCRIPTION_MAX} 字符之间（当前 ${m.description.length}）`,
      });
    }
  }

  // author（对象须含 name；或字符串形态）
  if (m.author !== undefined) {
    if (typeof m.author === 'string') {
      if (m.author.trim().length === 0) {
        violations.push({ path: 'author', rule: 'author-format', message: 'author 字符串不得为空' });
      }
    } else if (isPlainObject(m.author)) {
      if (typeof m.author.name !== 'string' || m.author.name.trim().length === 0) {
        violations.push({
          path: 'author.name',
          rule: 'author-format',
          message: 'author 对象必须含非空 name',
        });
      }
    } else {
      violations.push({
        path: 'author',
        rule: 'author-format',
        message: 'author 必须是含 name 的对象，或等价字符串',
      });
    }
  }

  // repository（字符串或含 url 的对象）
  if (m.repository !== undefined) {
    const ok =
      (typeof m.repository === 'string' && m.repository.length > 0) ||
      (isPlainObject(m.repository) && typeof m.repository.url === 'string');
    if (!ok) {
      violations.push({
        path: 'repository',
        rule: 'repository-format',
        message: 'repository 必须是 URL 字符串，或含 url 字段的对象',
      });
    }
  }

  // keywords（字符串数组）
  if (m.keywords !== undefined) {
    const ok = Array.isArray(m.keywords) && m.keywords.every((k) => typeof k === 'string');
    if (!ok) {
      violations.push({ path: 'keywords', rule: 'keywords-format', message: 'keywords 必须是字符串数组' });
    }
  }

  // 组件路径
  for (const field of ['commands', 'agents', 'hooks', 'mcpServers'] as const) {
    checkComponentPathField(field, m[field], violations);
    checkReferencedPathsExist(opts.pluginRoot, field, m[field], violations);
  }

  return violations;
}

/** 校验市场清单（marketplace.json）。marketplaceRoot 用于探测 source 是否存在。 */
export function validateMarketplaceManifest(
  manifest: unknown,
  opts: { marketplaceRoot: string },
): ManifestViolation[] {
  const violations: ManifestViolation[] = [];
  if (!isPlainObject(manifest)) {
    return [{ path: '.', rule: 'manifest-object', message: '市场清单必须是 JSON 对象' }];
  }
  const m = manifest as MarketplaceManifestInput;

  if (typeof m.name !== 'string' || !PLUGIN_NAME_RE.test(m.name)) {
    violations.push({
      path: 'name',
      rule: 'name-format',
      message: '市场 name 必需且必须为 kebab-case',
    });
  }

  if (!isPlainObject(m.owner) || typeof m.owner.name !== 'string' || m.owner.name.trim().length === 0) {
    violations.push({
      path: 'owner.name',
      rule: 'owner-required',
      message: 'owner.name 为必需字段',
    });
  }

  if (!Array.isArray(m.plugins)) {
    violations.push({ path: 'plugins', rule: 'plugins-required', message: 'plugins 必须是数组' });
    return violations;
  }

  m.plugins.forEach((entry: unknown, i: number) => {
    const at = `plugins[${i}]`;
    if (!isPlainObject(entry)) {
      violations.push({ path: at, rule: 'entry-object', message: '插件条目必须是对象' });
      return;
    }
    const e = entry as MarketplacePluginEntryInput;

    if (typeof e.name !== 'string' || !PLUGIN_NAME_RE.test(e.name)) {
      violations.push({ path: `${at}.name`, rule: 'name-format', message: '条目 name 必需且必须为 kebab-case' });
    }
    if (typeof e.description !== 'string' || e.description.trim().length === 0) {
      violations.push({ path: `${at}.description`, rule: 'description-required', message: '条目 description 必需' });
    }
    if (e.version !== undefined && (typeof e.version !== 'string' || !SEMVER_RE.test(e.version))) {
      violations.push({ path: `${at}.version`, rule: 'version-semver', message: '条目 version 若存在必须语义化' });
    }
    if (e.category !== undefined) {
      if (typeof e.category !== 'string' || !(MARKETPLACE_CATEGORIES as readonly string[]).includes(e.category)) {
        violations.push({
          path: `${at}.category`,
          rule: 'category-enum',
          message: `category 必须取自规范枚举：${MARKETPLACE_CATEGORIES.join(' / ')}`,
        });
      }
    }

    // source：相对路径字符串 或 含 source 字段的对象
    if (typeof e.source === 'string') {
      if (!isRelativeComponentPath(e.source)) {
        violations.push({
          path: `${at}.source`,
          rule: 'source-relative',
          message: `source "${e.source}" 必须以 ./ 开头、不得含上溯段、必须使用正斜杠`,
        });
      } else if (!existsSync(join(opts.marketplaceRoot, e.source))) {
        violations.push({
          path: `${at}.source`,
          rule: 'source-missing',
          message: `source 指向的目录不存在：${e.source}`,
        });
      }
    } else if (isPlainObject(e.source)) {
      if (typeof e.source.source !== 'string' || e.source.source.trim().length === 0) {
        violations.push({
          path: `${at}.source.source`,
          rule: 'source-object',
          message: 'source 对象的 source 字段必需（github / git / url 等来源类型）',
        });
      }
    } else {
      violations.push({
        path: `${at}.source`,
        rule: 'source-format',
        message: 'source 必须是以 ./ 开头的相对路径字符串，或含 source 字段的对象',
      });
    }
  });

  return violations;
}
