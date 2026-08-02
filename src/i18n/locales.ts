import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Locale = 'zh' | 'en';

export interface LocaleConfig {
  locale: Locale;
  fallback: Locale;
}

export interface SkillI18n {
  name: string;
  description: string;
  instructions: string;
}

// Default locale storage
let currentLocale: Locale = 'zh';
// ponytail: fallback tracked for future locale chaining

/**
 * Initialize locale from config or environment.
 */
export function initLocale(workspacePath?: string): Locale {
  // 1. Check environment variable
  const envLang = process.env.MUMUSPEC_LANG || process.env.LANG || '';
  if (envLang.startsWith('en')) {
    currentLocale = 'en';
  } else if (envLang.startsWith('zh')) {
    currentLocale = 'zh';
  }

  // 2. Check workspace config
  if (workspacePath) {
    try {
      const configPath = join(workspacePath, '.mumuspec.yaml');
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf8');
        // Simple key: value lookup
        const match = content.match(/^language:\s*["']?(\w+)/m);
        if (match) {
          currentLocale = match[1] === 'en' ? 'en' : 'zh';
        }
      }
    } catch {
      // ignore
    }
  }

  // ponytail: fallback chaining deferred
  return currentLocale;
}

/**
 * Get current locale.
 */
export function getLocale(): Locale {
  return currentLocale;
}

/**
 * Set locale explicitly.
 */
export function setLocale(locale: Locale): void {
  currentLocale = locale;
}

/**
 * Resolve a skill file path with locale fallback.
 *
 * Looks for:
 * 1. .mumuspec/skills/<locale>/<name>.md
 * 2. .mumuspec/skills/<name>.md (fallback)
 * 3. null (not found)
 */
export function resolveSkillPath(projectRoot: string, skillName: string): string | null {
  const skillsDir = join(projectRoot, '.mumuspec', 'skills');

  // Try locale-specific path first
  if (currentLocale !== 'zh') {
    const localizedPath = join(skillsDir, currentLocale, `${skillName}.md`);
    if (existsSync(localizedPath)) {
      return localizedPath;
    }
  }

  // Try default path
  const defaultPath = join(skillsDir, `${skillName}.md`);
  if (existsSync(defaultPath)) {
    return defaultPath;
  }

  return null;
}

/**
 * List available locales based on existing skill directories.
 */
export function listAvailableLocales(projectRoot: string): Locale[] {
  const skillsDir = join(projectRoot, '.mumuspec', 'skills');
  const locales: Locale[] = ['zh']; // zh is always available (default)

  if (existsSync(join(skillsDir, 'en'))) {
    locales.push('en');
  }

  return locales;
}

/**
 * Templated string substitution.
 * Usage: t('Hello {name}', { name: 'World' }) → 'Hello World'
 */
export function t(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

/**
 * Common UI strings with i18n.
 *
 * In a full implementation these would come from .po/.json files;
 * ponytail: keeping them inline for zero dependency overhead
 */
export const UI_STRINGS: Record<Locale, Record<string, string>> = {
  zh: {
    'dashboard.title': 'MUMUSPEC 状态面板',
    'dashboard.noChange': '无活跃变更',
    'hooks.installed': '已安装',
    'hooks.notInstalled': '未安装',
    'eval.passed': '全部通过',
    'eval.failed': '失败',
    'common.errors': '错误',
    'common.warnings': '警告',
    'common.done': '完成',
  },
  en: {
    'dashboard.title': 'MUMUSPEC DASHBOARD',
    'dashboard.noChange': 'No active change',
    'hooks.installed': 'Installed',
    'hooks.notInstalled': 'Not installed',
    'eval.passed': 'All passed',
    'eval.failed': 'Failed',
    'common.errors': 'Errors',
    'common.warnings': 'Warnings',
    'common.done': 'Done',
  },
};

/**
 * Get a UI string for the current locale.
 */
export function uiString(key: string): string {
  const strings = UI_STRINGS[currentLocale] || UI_STRINGS.zh;
  return strings[key] || UI_STRINGS.zh[key] || key;
}
