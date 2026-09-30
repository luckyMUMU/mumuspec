/**
 * AST-based code checker — hardened version.
 *
 * Uses TypeScript Compiler API for semantic analysis:
 * - JSX detection (distinguishes from TypeScript generics)
 * - htm library detection (approved JSX alternative)
 * - Pure AST constraint checking (no regex fallback)
 *
 * ponytail: ts.createSourceFile is sufficient (no need for full Program/LanguageService)
 */

import ts from 'typescript';

// ─── Types ──────────────────────────────────────────────────────────────

/** Result of JSX detection analysis */
export interface JsxDetectionResult {
  /** Whether the file contains actual JSX syntax */
  hasJsx: boolean;
  /** Reason for the determination */
  reason: 'jsx-node' | 'generic-only' | 'htm-template' | 'parse-error';
  /** Optional details about the detection */
  details?: string;
  /** 1-based line number of first JSX node (only when hasJsx is true) */
  line?: number;
}


// ─── Public API ─────────────────────────────────────────────────────────

/**
 * Detect whether a TypeScript/JavaScript file uses JSX syntax.
 * Correctly distinguishes JSX from TypeScript generics and string literals.
 *
 * Performs a single AST parse to detect both htm library usage and JSX nodes.
 *
 * @param content - Source code content
 * @param filename - File name (used for diagnostics)
 * @returns Detection result with reason and line number
 */
export function detectJsxUsage(content: string, filename: string): JsxDetectionResult {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filename,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  } catch {
    return { hasJsx: false, reason: 'parse-error', details: 'Failed to parse source' };
  }

  const result = walkForHtmAndJsx(sourceFile);

  // htm detected → file uses approved template library
  if (result.hasHtm) {
    return { hasJsx: false, reason: 'htm-template' };
  }

  // JSX detected → violation
  if (result.hasJsx) {
    return {
      hasJsx: true,
      reason: 'jsx-node',
      line: result.jsxLine,
    };
  }

  return { hasJsx: false, reason: 'generic-only' };
}

/**
 * Check if the source code uses htm tagged template library.
 * Files using htm are compliant with "no JSX" prohibitions.
 *
 * Detection patterns:
 * 1. `import htm from 'htm'` + tagged template or `.bind()`
 * 2. `htm\`...\`` tagged template expression
 * 3. `const html = htm.bind(...)` — classic htm aliasing
 * 4. `import { h } from 'htm/preact'` — htm variants
 *
 * @param content - Source code content
 * @returns true if htm library is imported and used
 */
export function usesHtmLibrary(content: string): boolean {
  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      'temp.tsx',
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  } catch {
    return false;
  }

  return walkForHtm(sourceFile);
}

// ─── Internal: Single-Pass Walk (htm + JSX) ────────────────────────────

/** Combined walk result for htm and JSX detection */
interface HtmJsxWalkResult {
  hasHtm: boolean;
  hasJsx: boolean;
  jsxLine?: number;
}

/**
 * Perform a single AST walk to detect both htm library usage and JSX nodes.
 * More efficient than separate walks.
 */
function walkForHtmAndJsx(sourceFile: ts.SourceFile): HtmJsxWalkResult {
  const result: HtmJsxWalkResult = {
    hasHtm: false,
    hasJsx: false,
  };

  // Collect local variable declarations to detect aliases
  const localAliases = collectLocalAliases(sourceFile);

  function visit(node: ts.Node): void {
    if (result.hasHtm || (result.hasJsx && result.jsxLine !== undefined)) {
      return; // Short-circuit when definitive findings for both
    }

    // JSX node detection
    if (
      ts.isJsxElement(node) ||
      ts.isJsxFragment(node) ||
      ts.isJsxSelfClosingElement(node)
    ) {
      result.hasJsx = true;
      const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      result.jsxLine = line + 1;
      return;
    }

    // htm: import from 'htm'/'htm/preact'
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const spec = moduleSpecifier.text;
        if (spec === 'htm' || spec.startsWith('htm/') || spec.includes('/htm') || spec.includes('/htm/')) {
          // htm import found; check if also used
          if (hasHtmUsage(sourceFile)) {
            result.hasHtm = true;
            return;
          }
        }
      }
    }

    // htm: tagged template with htm/html identifier
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag;
      if (ts.isIdentifier(tag) && (tag.text === 'htm' || tag.text === 'html')) {
        // Check if this identifier refers to the library (not a local var)
        if (!localAliases.has(tag.text) || hasHtmImport(sourceFile)) {
          result.hasHtm = true;
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return result;
}

/** Walk specifically for htm detection (for standalone `usesHtmLibrary`) */
function walkForHtm(sourceFile: ts.SourceFile): boolean {
  const localAliases = collectLocalAliases(sourceFile);
  let hasHtmImport = false;
  let hasHtmUsage = false;

  function visit(node: ts.Node): void {
    if (hasHtmUsage) return;

    // Check: import declaration
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const spec = moduleSpecifier.text;
        if (spec === 'htm' || spec.startsWith('htm/') || spec.includes('/htm')) {
          hasHtmImport = true;
        }
      }
      return;
    }

    // Check: htm.bind(...) or htm/preact.bind(...)
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        const propName = expression.name;
        const objExpr = expression.expression;
        if (ts.isIdentifier(propName) && propName.text === 'bind') {
          if (ts.isIdentifier(objExpr) && (objExpr.text === 'htm' || objExpr.text === 'html')) {
            if (!localAliases.has(objExpr.text) || hasHtmImport) {
              hasHtmUsage = true;
              return;
            }
          }
        }
      }
    }

    // Check: tagged template htm`...`
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag;
      if (ts.isIdentifier(tag) && (tag.text === 'htm' || tag.text === 'html')) {
        if (!localAliases.has(tag.text) || hasHtmImport) {
          hasHtmUsage = true;
          return;
        }
      }
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return hasHtmUsage;
}

/** Check if source has an import from htm */
function hasHtmImport(sourceFile: ts.SourceFile): boolean {
  let found = false;
  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = node.moduleSpecifier;
      if (ts.isStringLiteral(moduleSpecifier)) {
        const spec = moduleSpecifier.text;
        if (spec === 'htm' || spec.startsWith('htm/') || spec.includes('/htm')) {
          found = true;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

/** Check if source uses htm (tagged template or .bind()) */
function hasHtmUsage(sourceFile: ts.SourceFile): boolean {
  let found = false;
  function visit(node: ts.Node): void {
    if (found) return;
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag;
      if (ts.isIdentifier(tag) && (tag.text === 'htm' || tag.text === 'html')) {
        found = true;
        return;
      }
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression)) {
        const propName = expression.name;
        const objExpr = expression.expression;
        if (ts.isIdentifier(propName) && propName.text === 'bind') {
          if (ts.isIdentifier(objExpr) && (objExpr.text === 'htm' || objExpr.text === 'html')) {
            found = true;
            return;
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return found;
}

/** Collect locally declared variable names to avoid false positives on aliases */
function collectLocalAliases(sourceFile: ts.SourceFile): Set<string> {
  const aliases = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      aliases.add(node.name.text);
    }
    if (ts.isFunctionDeclaration(node) && node.name) {
      aliases.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return aliases;
}
