/**
 * Unit tests for src/i18n/locales.ts — locale management, string lookup, skill path resolution.
 *
 * Tests the actual implementation (not mocked) to improve i18n test coverage (D8 dimension).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  initLocale,
  getLocale,
  setLocale,
  resolveSkillPath,
  listAvailableLocales,
  t,
  uiString,
  UI_STRINGS,
  type Locale,
} from '../../src/i18n/locales.js';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), `mumuspec-i18n-${Date.now()}-${Math.random().toString(36).slice(2)}`));
}

function safeRemove(dir: string): void {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────

describe('i18n/locales.ts', () => {
  let tempDir: string;
  const savedLang = process.env.MUMUSPEC_LANG;
  const savedEnvLang = process.env.LANG;

  beforeEach(() => {
    tempDir = makeTempDir();
    delete process.env.MUMUSPEC_LANG;
    delete process.env.LANG;
    setLocale('zh'); // reset to default
  });

  afterEach(() => {
    safeRemove(tempDir);
    if (savedLang !== undefined) process.env.MUMUSPEC_LANG = savedLang;
    else delete process.env.MUMUSPEC_LANG;
    if (savedEnvLang !== undefined) process.env.LANG = savedEnvLang;
    else delete process.env.LANG;
  });

  // ── initLocale ──

  describe('initLocale', () => {
    it('defaults to zh when no env vars set', () => {
      const locale = initLocale();
      expect(locale).toBe('zh');
      expect(getLocale()).toBe('zh');
    });

    it('detects en from MUMUSPEC_LANG env var', () => {
      process.env.MUMUSPEC_LANG = 'en';
      expect(initLocale()).toBe('en');
    });

    it('detects zh from MUMUSPEC_LANG env var', () => {
      process.env.MUMUSPEC_LANG = 'zh';
      expect(initLocale()).toBe('zh');
    });

    it('falls back to LANG env var', () => {
      process.env.LANG = 'en_US.UTF-8';
      expect(initLocale()).toBe('en');
    });

    it('detects zh from LANG env var', () => {
      process.env.LANG = 'zh_CN.UTF-8';
      expect(initLocale()).toBe('zh');
    });

    it('MUMUSPEC_LANG takes priority over LANG', () => {
      process.env.MUMUSPEC_LANG = 'zh';
      process.env.LANG = 'en_US.UTF-8';
      expect(initLocale()).toBe('zh');
    });

    it('reads locale from workspace config file', () => {
      writeFileSync(join(tempDir, '.mumuspec.yaml'), 'language: en\n');
      expect(initLocale(tempDir)).toBe('en');
    });

    it('reads zh from workspace config file', () => {
      writeFileSync(join(tempDir, '.mumuspec.yaml'), 'language: zh\n');
      expect(initLocale(tempDir)).toBe('zh');
    });

    it('handles missing workspace config gracefully', () => {
      expect(initLocale(tempDir)).toBe('zh');
    });

    it('handles malformed workspace config gracefully', () => {
      writeFileSync(join(tempDir, '.mumuspec.yaml'), 'not valid yaml: [broken');
      expect(initLocale(tempDir)).toBe('zh');
    });
  });

  // ── getLocale / setLocale ──

  describe('getLocale / setLocale', () => {
    it('setLocale changes current locale', () => {
      setLocale('en');
      expect(getLocale()).toBe('en');
    });

    it('setLocale to zh works', () => {
      setLocale('en');
      setLocale('zh');
      expect(getLocale()).toBe('zh');
    });
  });

  // ── resolveSkillPath ──

  describe('resolveSkillPath', () => {
    it('returns localized path when locale is en and file exists', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills', 'en');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'my-skill.md'), '# Skill');

      setLocale('en');
      const result = resolveSkillPath(tempDir, 'my-skill');
      expect(result).toBe(join(skillsDir, 'my-skill.md'));
    });

    it('falls back to default path when localized file does not exist', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'my-skill.md'), '# Skill');

      setLocale('en');
      const result = resolveSkillPath(tempDir, 'my-skill');
      expect(result).toBe(join(skillsDir, 'my-skill.md'));
    });

    it('returns default path for zh locale', () => {
      const skillsDir = join(tempDir, '.mumuspec', 'skills');
      mkdirSync(skillsDir, { recursive: true });
      writeFileSync(join(skillsDir, 'my-skill.md'), '# Skill');

      setLocale('zh');
      const result = resolveSkillPath(tempDir, 'my-skill');
      expect(result).toBe(join(skillsDir, 'my-skill.md'));
    });

    it('returns null when skill file does not exist', () => {
      setLocale('zh');
      const result = resolveSkillPath(tempDir, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── listAvailableLocales ──

  describe('listAvailableLocales', () => {
    it('returns only zh when no en directory exists', () => {
      const result = listAvailableLocales(tempDir);
      expect(result).toEqual(['zh']);
    });

    it('returns zh and en when en directory exists', () => {
      mkdirSync(join(tempDir, '.mumuspec', 'skills', 'en'), { recursive: true });
      const result = listAvailableLocales(tempDir);
      expect(result).toContain('zh');
      expect(result).toContain('en');
      expect(result.length).toBe(2);
    });

    it('always includes zh as first locale', () => {
      mkdirSync(join(tempDir, '.mumuspec', 'skills', 'en'), { recursive: true });
      const result = listAvailableLocales(tempDir);
      expect(result[0]).toBe('zh');
    });
  });

  // ── t (template substitution) ──

  describe('t', () => {
    it('returns template as-is when no vars', () => {
      expect(t('Hello World')).toBe('Hello World');
    });

    it('substitutes single variable', () => {
      expect(t('Hello {name}', { name: 'World' })).toBe('Hello World');
    });

    it('substitutes multiple variables', () => {
      expect(t('{greeting}, {name}!', { greeting: 'Hi', name: 'Bob' })).toBe('Hi, Bob!');
    });

    it('handles numeric values', () => {
      expect(t('Count: {n}', { n: 42 })).toBe('Count: 42');
    });

    it('leaves placeholder when key not in vars', () => {
      expect(t('Hello {missing}', { name: 'World' })).toBe('Hello {missing}');
    });

    it('handles empty vars object', () => {
      expect(t('Hello {name}', {})).toBe('Hello {name}');
    });
  });

  // ── uiString ──

  describe('uiString', () => {
    it('returns zh string when locale is zh', () => {
      setLocale('zh');
      expect(uiString('common.done')).toBe('完成');
    });

    it('returns en string when locale is en', () => {
      setLocale('en');
      expect(uiString('common.done')).toBe('Done');
    });

    it('falls back to zh when key missing in en', () => {
      setLocale('en');
      // Use a key that only exists in zh (if any) — but all keys exist in both
      // So test with a non-existent key instead
      expect(uiString('nonexistent.key')).toBe('nonexistent.key');
    });

    it('falls back to key when not found in any locale', () => {
      setLocale('zh');
      expect(uiString('totally.missing')).toBe('totally.missing');
    });
  });

  // ── UI_STRINGS ──

  describe('UI_STRINGS', () => {
    it('has both zh and en locales', () => {
      expect(UI_STRINGS.zh).toBeDefined();
      expect(UI_STRINGS.en).toBeDefined();
    });

    it('has same keys in zh and en', () => {
      const zhKeys = Object.keys(UI_STRINGS.zh).sort();
      const enKeys = Object.keys(UI_STRINGS.en).sort();
      expect(zhKeys).toEqual(enKeys);
    });
  });
});
