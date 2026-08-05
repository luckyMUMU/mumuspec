/**
 * Tests for src/i18n/locales.ts — locale management and template strings
 */

import { describe, it, expect, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  getLocale,
  setLocale,
  t,
  uiString,
  listAvailableLocales,
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
