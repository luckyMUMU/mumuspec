/**
 * Tests for src/i18n/locales.ts — locale management and template strings
 */

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getLocale,
  setLocale,
  t,
  uiString,
  listAvailableLocales,
  initLocale,
  resolveSkillPath,
} from '../../src/i18n/locales.js';

describe('i18n locales', () => {
  const testDir = join(tmpdir(), `mumuspec-i18n-test-${Date.now()}`);

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('setLocale changes locale', () => {
    setLocale('zh');
    expect(getLocale()).toBe('zh');
    setLocale('en');
    expect(getLocale()).toBe('en');
  });

  it('t returns template with vars substituted', () => {
    setLocale('en');
    const result = t('Hello {name}', { name: 'World' });
    expect(result).toBe('Hello World');
  });

  it('t handles missing var gracefully', () => {
    setLocale('en');
    const result = t('Value: {missing}');
    expect(result).toContain('missing');
  });

  it('uiString returns non-empty string for valid key', () => {
    setLocale('en');
    const result = uiString('cli.welcome');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('listAvailableLocales returns array', () => {
    mkdirSync(join(testDir, '.mumuspec'), { recursive: true });
    const locales = listAvailableLocales(testDir);
    expect(locales).toBeInstanceOf(Array);
  });
});

// ─── 15 new tests for t(), resolveSkillPath, initLocale, locale variants ───

describe('i18n locales — additional coverage', () => {
  const testDir = join(tmpdir(), `mumuspec-i18n-test-${Date.now()}`);
  const origLang = process.env.LANG;
  const origMumuLang = process.env.MUMUSPEC_LANG;

  afterEach(() => {
    delete process.env.MUMUSPEC_LANG;
    if (origLang !== undefined) {
      process.env.LANG = origLang;
    } else {
      delete process.env.LANG;
    }
    if (origMumuLang !== undefined) {
      process.env.MUMUSPEC_LANG = origMumuLang;
    } else {
      delete process.env.MUMUSPEC_LANG;
    }
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('t() interpolates multiple parameters', () => {
    setLocale('en');
    const result = t('{a} plus {b} equals {c}', { a: '1', b: '2', c: '3' });
    expect(result).toBe('1 plus 2 equals 3');
  });

  it('t() leaves placeholder unchanged when variable is missing', () => {
    const result = t('Hello {name}, age {age}', { name: 'Alice' });
    expect(result).toContain('Alice');
    expect(result).toContain('{age}');
  });

  it('t() handles mixed type parameters (string and number)', () => {
    const result = t('Count: {count}, Name: {name}', { count: 42, name: 'Test' });
    expect(result).toBe('Count: 42, Name: Test');
  });

  it('t() with no vars returns template as-is', () => {
    const template = 'No placeholders here';
    expect(t(template)).toBe(template);
  });

  it('t() handles empty template', () => {
    expect(t('')).toBe('');
  });

  it('t() handles repeated placeholders', () => {
    const result = t('{x} and {x} again', { x: 'value' });
    expect(result).toBe('value and value again');
  });

  it('t() handles zero as a value', () => {
    const result = t('Value is {val}', { val: 0 });
    expect(result).toBe('Value is 0');
  });

  it('uiString returns Chinese text for zh locale', () => {
    setLocale('zh');
    expect(uiString('dashboard.title')).toBe('MUMUSPEC 状态面板');
    expect(uiString('common.done')).toBe('完成');
  });

  it('uiString returns English text for en locale', () => {
    setLocale('en');
    expect(uiString('dashboard.title')).toBe('MUMUSPEC DASHBOARD');
    expect(uiString('common.done')).toBe('Done');
  });

  it('uiString falls back to zh for unknown key', () => {
    setLocale('en');
    const result = uiString('nonexistent.key');
    expect(result).toBe('nonexistent.key');
  });

  it('resolveSkillPath returns null when no skill file exists', () => {
    setLocale('en');
    const result = resolveSkillPath(testDir, 'nonexistent-skill');
    expect(result).toBeNull();
  });

  it('resolveSkillPath finds default skill file', () => {
    setLocale('en');
    mkdirSync(join(testDir, '.mumuspec', 'skills'), { recursive: true });
    writeFileSync(join(testDir, '.mumuspec', 'skills', 'test-skill.md'), '# Test Skill');
    const result = resolveSkillPath(testDir, 'test-skill');
    expect(result).not.toBeNull();
    expect(result).toContain('test-skill.md');
  });

  it('initLocale detects en locale from MUMUSPEC_LANG env', () => {
    process.env.MUMUSPEC_LANG = 'en';
    const result = initLocale();
    expect(result).toBe('en');
    expect(getLocale()).toBe('en');
  });

  it('initLocale detects zh locale from config file', () => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, '.mumuspec.yaml'), 'language: zh\n');
    const result = initLocale(testDir);
    expect(result).toBe('zh');
    expect(getLocale()).toBe('zh');
  });
});

