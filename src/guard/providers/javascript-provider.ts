/**
 * JavaScript Language Provider — delegates to TypeScriptProvider.
 *
 * JavaScript files are a subset of TypeScript, so we reuse the TS provider
 * and simply register it for .js/.jsx extensions.
 */
import type { ILanguageProvider } from '../../core/types-constraint-ast.js';
import { typescriptProvider } from './typescript-provider.js';

/** JavaScript provider — wraps TypeScript provider with JS-specific extensions. */
export const javascriptProvider: ILanguageProvider = {
  ...typescriptProvider,
  language: 'javascript',
  extensions: ['.js', '.jsx'],
};
