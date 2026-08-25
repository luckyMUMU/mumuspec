/**
 * Language Provider Registry — runtime registration of AST providers.
 *
 * Provides a central registry for language-specific AST providers.
 * Third-party code or MumuSpec itself can register new language support
 * via registerLanguageProvider().
 */
import type { ILanguageProvider, ProviderInfo } from '../core/types-constraint-ast.js';
import { typescriptProvider } from './providers/typescript-provider.js';
import { javascriptProvider } from './providers/javascript-provider.js';

/** Registry of language providers keyed by language identifier. */
const providers = new Map<string, ILanguageProvider>();
/** Reverse lookup: extension → language */
const extensionMap = new Map<string, string>();

/** Register a language provider. Overwrites if same language already registered. */
export function registerLanguageProvider(provider: ILanguageProvider): void {
  providers.set(provider.language, provider);
  for (const ext of provider.extensions) {
    extensionMap.set(ext.toLowerCase(), provider.language);
  }
}

/** Unregister a language provider by language identifier. */
export function unregisterLanguageProvider(language: string): boolean {
  const provider = providers.get(language);
  if (!provider) return false;
  providers.delete(language);
  // Clean up extension mappings
  for (const ext of provider.extensions) {
    if (extensionMap.get(ext.toLowerCase()) === language) {
      extensionMap.delete(ext.toLowerCase());
    }
  }
  return true;
}

/** Look up a provider by file extension (e.g., '.ts'). Returns null if not found. */
export function getLanguageProvider(ext: string): ILanguageProvider | null {
  const lang = extensionMap.get(ext.toLowerCase());
  if (!lang) return null;
  return providers.get(lang) ?? null;
}

/** Register a provider by extension directly (alternative API). */
export function registerProviderByExtension(ext: string, provider: ILanguageProvider): void {
  extensionMap.set(ext.toLowerCase(), provider.language);
  providers.set(provider.language, provider);
}

/** List all registered providers' metadata. */
export function getAvailableProviders(): ProviderInfo[] {
  const result: ProviderInfo[] = [];
  for (const [language, provider] of providers) {
    result.push({
      language,
      extensions: [...provider.extensions],
      registeredAt: new Date().toISOString(),
    });
  }
  return result;
}

/** List all supported file extensions. */
export function listSupportedExtensions(): string[] {
  return [...extensionMap.keys()];
}

/** Check if a language is registered. */
export function hasLanguageProvider(language: string): boolean {
  return providers.has(language);
}

/** Get all registered languages. */
export function getRegisteredLanguages(): string[] {
  return [...providers.keys()];
}

/** Clear all providers — primarily for testing. */
export function clearProviderRegistry(): void {
  providers.clear();
  extensionMap.clear();
}

/** Register built-in language providers (TypeScript, JavaScript). */
export function registerBuiltInProviders(): void {
  // Providers are imported statically at module top — no circular dependency
  // since providers only depend on types from core/types-constraint-ast.ts
  registerLanguageProvider(typescriptProvider);
  registerLanguageProvider(javascriptProvider);
}

/** Get the Provider Registry size (for diagnostics). */
export function getProviderCount(): number {
  return providers.size;
}
