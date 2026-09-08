/**
 * Unit Tests — Language Provider Registry (R-0003)
 *
 * Covers:
 * TC-06: registerLanguageProvider() 注册
 * TC-07: getLanguageProvider('.ts')
 * TC-08: getLanguageProvider('.unknown') null
 * TC-09: unregisterLanguageProvider() 移除
 * TC-10: getAvailableProviders() 返回列表
 * TC-11: registerBuiltInProviders() 内置注册
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerLanguageProvider,
  unregisterLanguageProvider,
  getLanguageProvider,
  getAvailableProviders,
  registerBuiltInProviders,
  hasLanguageProvider,
  getRegisteredLanguages,
  getProviderCount,
  listSupportedExtensions,
  clearProviderRegistry,
} from '../../src/guard/language-provider-registry.js';
import { typescriptProvider } from '../../src/guard/providers/typescript-provider.js';
import { javascriptProvider } from '../../src/guard/providers/javascript-provider.js';
import type { ILanguageProvider, ASTResult } from '../../../src/guard/types-constraint-ast.js';

/** Minimal mock provider for testing registry behavior */
function createMockProvider(language: string, extensions: string[]): ILanguageProvider {
  return {
    language,
    extensions,
    parse(source: string, filename: string): ASTResult {
      return {
        root: { kind: 'SourceFile', text: source, range: { start: 0, end: source.length }, children: [] },
        sourceFile: filename,
        language,
        diagnostics: [],
      };
    },
    checkConstraint(): [] {
      return [];
    },
  };
}

describe('R-0003 — Language Provider Registry', () => {
  beforeEach(() => {
    clearProviderRegistry();
  });

  // ─── TC-06: registerLanguageProvider() ───
  describe('TC-06: registerLanguageProvider()', () => {
    it('should register a provider successfully', () => {
      const mock = createMockProvider('python', ['.py']);
      registerLanguageProvider(mock);

      expect(hasLanguageProvider('python')).toBe(true);
      expect(getProviderCount()).toBe(1);
    });

    it('should register extensions mapping', () => {
      const mock = createMockProvider('rust', ['.rs', '.rlib']);
      registerLanguageProvider(mock);

      expect(getLanguageProvider('.rs')).not.toBeNull();
      expect(getLanguageProvider('.rlib')).not.toBeNull();
      expect(listSupportedExtensions()).toContain('.rs');
      expect(listSupportedExtensions()).toContain('.rlib');
    });

    it('should overwrite existing provider with same language', () => {
      const mock1 = createMockProvider('go', ['.go']);
      const mock2 = createMockProvider('go', ['.go', '.mod']);

      registerLanguageProvider(mock1);
      registerLanguageProvider(mock2);

      expect(getProviderCount()).toBe(1);
      expect(getLanguageProvider('.mod')).not.toBeNull();
    });
  });

  // ─── TC-07: getLanguageProvider('.ts') ───
  describe('TC-07: getLanguageProvider(".ts")', () => {
    it('should return TS provider for .ts extension', () => {
      registerLanguageProvider(typescriptProvider);

      const provider = getLanguageProvider('.ts');
      expect(provider).not.toBeNull();
      expect(provider!.language).toBe('typescript');
    });

    it('should return TS provider for .tsx extension', () => {
      registerLanguageProvider(typescriptProvider);

      const provider = getLanguageProvider('.tsx');
      expect(provider).not.toBeNull();
      expect(provider!.language).toBe('typescript');
    });

    it('should be case-insensitive for extensions', () => {
      registerLanguageProvider(typescriptProvider);

      const provider = getLanguageProvider('.TS');
      expect(provider).not.toBeNull();
    });
  });

  // ─── TC-08: getLanguageProvider('.unknown') null ───
  describe('TC-08: getLanguageProvider(".unknown")', () => {
    it('should return null for unregistered extension', () => {
      registerLanguageProvider(typescriptProvider);

      const provider = getLanguageProvider('.unknown');
      expect(provider).toBeNull();
    });

    it('should return null when registry is empty', () => {
      const provider = getLanguageProvider('.ts');
      expect(provider).toBeNull();
    });

    it('should return null for extension without dot prefix', () => {
      registerLanguageProvider(typescriptProvider);

      const provider = getLanguageProvider('ts');
      expect(provider).toBeNull();
    });
  });

  // ─── TC-09: unregisterLanguageProvider() ───
  describe('TC-09: unregisterLanguageProvider()', () => {
    it('should remove provider and its extensions', () => {
      registerLanguageProvider(typescriptProvider);
      expect(getLanguageProvider('.ts')).not.toBeNull();

      const result = unregisterLanguageProvider('typescript');
      expect(result).toBe(true);
      expect(getLanguageProvider('.ts')).toBeNull();
      expect(hasLanguageProvider('typescript')).toBe(false);
    });

    it('should return false for non-existent language', () => {
      const result = unregisterLanguageProvider('nonexistent');
      expect(result).toBe(false);
    });

    it('should clean up all extension mappings on unregister', () => {
      registerLanguageProvider(typescriptProvider);
      expect(listSupportedExtensions()).toContain('.ts');
      expect(listSupportedExtensions()).toContain('.tsx');

      unregisterLanguageProvider('typescript');
      expect(listSupportedExtensions()).toHaveLength(0);
    });
  });

  // ─── TC-10: getAvailableProviders() ───
  describe('TC-10: getAvailableProviders()', () => {
    it('should return empty array when no providers', () => {
      const providers = getAvailableProviders();
      expect(providers).toEqual([]);
    });

    it('should return provider metadata', () => {
      registerLanguageProvider(typescriptProvider);
      registerLanguageProvider(javascriptProvider);

      const providers = getAvailableProviders();
      expect(providers).toHaveLength(2);

      const languages = providers.map((p) => p.language);
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
    });

    it('should include extensions in provider info', () => {
      registerLanguageProvider(typescriptProvider);

      const providers = getAvailableProviders();
      const tsProvider = providers.find((p) => p.language === 'typescript');
      expect(tsProvider).toBeDefined();
      expect(tsProvider!.extensions).toContain('.ts');
      expect(tsProvider!.extensions).toContain('.tsx');
    });

    it('getRegisteredLanguages should return language list', () => {
      registerLanguageProvider(typescriptProvider);
      registerLanguageProvider(javascriptProvider);

      const languages = getRegisteredLanguages();
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toHaveLength(2);
    });
  });

  // ─── TC-11: registerBuiltInProviders() ───
  describe('TC-11: registerBuiltInProviders()', () => {
    it('should register built-in providers when called', () => {
      expect(getProviderCount()).toBe(0);
      registerBuiltInProviders();

      // At least TypeScript and JavaScript providers should be registered
      expect(getProviderCount()).toBeGreaterThanOrEqual(2);
      expect(hasLanguageProvider('typescript')).toBe(true);
      expect(hasLanguageProvider('javascript')).toBe(true);
    });

    it('should make .ts retrievable after built-in registration', () => {
      clearProviderRegistry();
      registerBuiltInProviders();

      const provider = getLanguageProvider('.ts');
      expect(provider).not.toBeNull();
      expect(provider!.language).toBe('typescript');
    });

    it('should make .js retrievable after built-in registration', () => {
      clearProviderRegistry();
      registerBuiltInProviders();

      const provider = getLanguageProvider('.js');
      expect(provider).not.toBeNull();
      expect(provider!.language).toBe('javascript');
    });
  });
});
