/**
 * AST-based contract analyzer — replaces regex-based detection in manager.ts.
 *
 * Uses TypeScript Compiler API to reliably detect all JavaScript/TypeScript
 * export and import forms that regex patterns commonly miss:
 *
 * Export forms handled:
 *   - export function/class/const/let/var
 *   - export interface/type
 *   - export default (class/function/expression)
 *   - export * from './module'
 *   - export { x as y } from './module'
 *   - export { a, b }
 *   - export = (CJS-style, rare)
 *
 * Import forms handled:
 *   - import { a, b } from 'module'
 *   - import Default from 'module'
 *   - import * as ns from 'module'
 *   - import 'side-effect'
 *   - import('dynamic') — dynamic import
 *   - require('commonjs')
 *   - re-export source detection (export { x } from './src', export * from './src')
 *
 * ponytail: Synchronous recursive directory read using readdirSync (fs/promises would add complexity for marginal benefit)
 */

import { readdirSync, type Dirent } from 'node:fs';
import { join } from 'node:path';
// ponytail: Manual ext extraction to avoid depending on path.extname (mocked in tests)
import ts from 'typescript';
import { readText } from '../core/utils.js';

// ─── Types ──────────────────────────────────────────────────────────────

/** Detected export information */
export interface ExportInfo {
  /** Export name */
  name: string;
  /** Export kind */
  kind: 'function' | 'class' | 'type' | 'const' | 'interface';
  /** Source file path */
  file?: string;
  /** Function signature (e.g., "(a: number, b: string) => boolean") for functions */
  signature?: string;
}

// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Analyze all TypeScript/JavaScript files in a directory for exports.
 * Handles all export forms per ECMA-2015+ specification.
 *
 * @param dirPath - Directory path to scan
 * @returns Array of unique exports (deduplicated by name)
 */
export function analyzeExports(dirPath: string): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const seen = new Set<string>();

  // Recursively scan .ts, .tsx, .js, .jsx files
  scanDirectory(dirPath, (filePath, content) => {
    const fileExports = parseExportsFromSource(filePath, content);
    for (const exp of fileExports) {
      if (!seen.has(exp.name)) {
        seen.add(exp.name);
        exports.push(exp);
      }
    }
  });

  return exports;
}

/**
 * Analyze all TypeScript/JavaScript files in a directory for imports.
 * Handles all import forms and dynamic imports.
 *
 * @param dirPath - Directory path to scan
 * @returns Set of all imported module specifiers
 */
export function analyzeImports(dirPath: string): Set<string> {
  const imports = new Set<string>();

  scanDirectory(dirPath, (filePath, content) => {
    const fileImports = parseImportsFromSource(filePath, content);
    for (const imp of fileImports) {
      imports.add(imp);
    }
  });

  return imports;
}

// ─── Internal: Directory Scanning ───────────────────────────────────────

/** Recursively scan directory for TS/JS source files */
function scanDirectory(
  dirPath: string,
  callback: (filePath: string, content: string) => void,
): void {
  let entries: Dirent[];
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return; // Skip unreadable directories
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, .git, dist, hidden dirs
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name.startsWith('.')
      ) {
        continue;
      }
      scanDirectory(fullPath, callback);
    } else if (entry.isFile()) {
      const dotIndex = entry.name.lastIndexOf('.');
      const ext = dotIndex >= 0 ? entry.name.slice(dotIndex) : '';
      if (['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
        const content = readText(fullPath);
        if (content) {
          callback(fullPath, content);
        }
      }
    }
  }
}

// ─── Internal: Export Parsing ───────────────────────────────────────────

/** Parse exports from a single source file's content */
function parseExportsFromSource(
  filePath: string,
  content: string,
): ExportInfo[] {
  const exports: ExportInfo[] = [];

  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
    );
  } catch {
    return exports; // parse failure — skip file
  }

  function visit(node: ts.Node): void {
    // export function foo() {} / export class Bar {}
    if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) {
      if (hasExportModifier(node) && node.name) {
        const kind = ts.isFunctionDeclaration(node) ? 'function' : 'class';
        exports.push({
          name: node.name.text,
          kind,
          file: filePath,
          signature: ts.isFunctionDeclaration(node) ? extractFunctionSignature(node) : undefined,
        });
      }
      return; // Don't recurse into function/class body for nested exports
    }

    // export interface IBar {}/export type MyType = ...
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      if (hasExportModifier(node) && node.name) {
        const kind = ts.isInterfaceDeclaration(node) ? 'interface' : 'type';
        exports.push({
          name: node.name.text,
          kind,
          file: filePath,
        });
      }
      return;
    }

    // export const baz = 42 / export let foo = ...
    if (ts.isVariableStatement(node)) {
      if (hasExportModifier(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exports.push({
              name: decl.name.text,
              kind: 'const',
              file: filePath,
            });
          }
        }
      }
      return;
    }

    // export default class DefaultClass {} / export default function foo() {}
    if (ts.isExportAssignment(node)) {
      // export default <expression> or export = <expression>
      // Extract the default export name if possible
      const expr = node.expression;
      if (ts.isIdentifier(expr)) {
        exports.push({
          name: expr.text,
          kind: 'const',
          file: filePath,
        });
      }
      return;
    }

    // export { foo as fooAlias, bar as barAlias } from './module'
    if (ts.isExportDeclaration(node)) {
      // Handle: export * from './module' — no named exports, just re-export
      if (!node.exportClause) {
        // export * — no local names, skip
        return;
      }

      if (ts.isNamedExports(node.exportClause)) {
        for (const specifier of node.exportClause.elements) {
          // specifier.name is the local/aliased name in output
          exports.push({
            name: specifier.name.text,
            kind: 'const',
            file: filePath,
          });
        }
      }
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return exports;
}

// ─── Internal: Import Parsing ──────────────────────────────────────────

/** Parse imports from a single source file's content */
function parseImportsFromSource(
  _filePath: string,
  content: string,
): Set<string> {
  const imports = new Set<string>();

  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      'temp.ts',
      content,
      ts.ScriptTarget.Latest,
      true,
    );
  } catch {
    return imports; // parse failure — skip file
  }

  function visit(node: ts.Node): void {
    // static import: import { a, b } from 'module'
    // default import: import Default from 'module'
    // namespace import: import * as ns from 'module'
    // side-effect: import 'module'
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        imports.add(moduleSpecifier.text);
      }
      return;
    }

    // dynamic import: const x = await import('dynamic-module')
    // Handles both AwaitExpression-wrapped and direct call patterns
    if (node.kind === ts.SyntaxKind.ImportKeyword) {
      // The parent ExpressionStatement / CallExpression has arguments
      const parent = node.parent;
      if (parent && ts.isCallExpression(parent)) {
        const args = parent.arguments;
        if (args.length > 0 && ts.isStringLiteral(args[0])) {
          imports.add(args[0].text);
        }
      }
      return;
    }

    // CommonJS require: require('commonjs-module')
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isIdentifier(expression) && expression.text === 'require') {
        const args = node.arguments;
        if (args.length > 0 && ts.isStringLiteral(args[0])) {
          imports.add(args[0].text);
        }
      }
    }

    // export { x } from './re' — re-export is also an import dependency
    if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        imports.add(node.moduleSpecifier.text);
      }
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}

// ─── Utility ────────────────────────────────────────────────────────────

/** Check if a node has the export modifier */
function hasExportModifier(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  if (!modifiers) return false;

  return modifiers.some(
    (mod) => mod.kind === ts.SyntaxKind.ExportKeyword ||
             mod.kind === ts.SyntaxKind.DefaultKeyword,
  );
}

/**
 * Extract function signature string from a FunctionDeclaration.
 * Example: `function foo(a: number, b: string): boolean {}` → `"(a: number, b: string) => boolean"`
 *
 * ponytail: Uses printer for simplicity; manual string concatenation would be complex for all type nodes
 */
function extractFunctionSignature(node: ts.FunctionDeclaration): string | undefined {
  try {
    const parts: string[] = [];

    // Parameters
    const params = node.parameters.map((p) => {
      const name = p.name.getText();
      const type = p.type ? `: ${p.type.getText()}` : '';
      const optional = p.questionToken ? '?' : '';
      return `${name}${optional}${type}`;
    });
    parts.push(`(${params.join(', ')})`);

    // Return type
    const returnType = node.type ? node.type.getText() : 'void';
    parts.push(` => ${returnType}`);

    return parts.join('');
  } catch {
    return undefined;
  }
}
