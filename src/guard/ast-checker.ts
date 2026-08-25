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

/** A code violation found in source via AST analysis */
export interface CodeViolation {
  /** Line number (1-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
  /** The matched text or violation description */
  matched: string;
  /** Constraint source identifier (e.g., 'ast:no-eval') */
  source: string;
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

/**
 * Check AST-based constraint violations.
 * Pure AST analysis — no regex fallback.
 *
 * @param content - Source code content
 * @param filePath - File path for diagnostics
 * @param constraintIds - List of AST constraint IDs ('no-eval', 'no-new-function', etc.)
 * @returns Array of violations found (empty if none)
 */
export function checkAstConstraints(
  content: string,
  filePath: string,
  constraintIds: string[],
): CodeViolation[] {
  if (constraintIds.length === 0) return [];

  let sourceFile: ts.SourceFile;
  try {
    sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
  } catch {
    return []; // Parse failure — skip file
  }

  const violations: CodeViolation[] = [];

  for (const id of constraintIds) {
    switch (id) {
      case 'no-eval':
        findEvalUsage(sourceFile, violations);
        break;
      case 'no-new-function':
        findNewFunction(sourceFile, violations);
        break;
      // Add more AST constraints as needed
      default:
        // Unknown constraint — skip
        break;
    }
  }

  return violations;
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

// ─── Internal: Eval / Function Detection ───────────────────────────────

/** Find eval() calls in AST, including aliases and indirect calls */
function findEvalUsage(
  sourceFile: ts.SourceFile,
  violations: CodeViolation[],
): void {
  const localAliases = collectLocalEvalAliases(sourceFile);

  function visit(node: ts.Node): void {
    if (!ts.isCallExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const expression = node.expression;
    let isEvalCall = false;

    // Resolve comma expressions: (0, eval) → eval
    const resolvedExpr = resolveCommaExpression(expression);

    // Direct: eval('...')
    if (ts.isIdentifier(resolvedExpr) && resolvedExpr.text === 'eval') {
      isEvalCall = true;
    }
    // Member: globalThis.eval('...'), window.eval('...')
    else if (ts.isPropertyAccessExpression(resolvedExpr)) {
      const propName = resolvedExpr.name;
      const objExpr = resolvedExpr.expression;
      if (ts.isIdentifier(propName) && propName.text === 'eval') {
        if (ts.isIdentifier(objExpr) && (objExpr.text === 'globalThis' || objExpr.text === 'window' || objExpr.text === 'global')) {
          isEvalCall = true;
        }
      }
    }
    // Aliased: const e = eval; e('...')
    else if (ts.isIdentifier(resolvedExpr) && localAliases.has(resolvedExpr.text)) {
      isEvalCall = true;
    }

    if (isEvalCall) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({
        line: line + 1,
        column: character,
        matched: 'eval',
        source: 'ast:no-eval',
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/** Find `new Function()` calls, including aliases */
function findNewFunction(
  sourceFile: ts.SourceFile,
  violations: CodeViolation[],
): void {
  const localAliases = collectFunctionAliases(sourceFile);

  function visit(node: ts.Node): void {
    if (!ts.isNewExpression(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const expression = node.expression;
    let isFunctionCall = false;

    // Direct: new Function('...')
    if (ts.isIdentifier(expression) && expression.text === 'Function') {
      isFunctionCall = true;
    }
    // Aliased: const F = Function; new F('...')
    else if (ts.isIdentifier(expression) && localAliases.has(expression.text)) {
      isFunctionCall = true;
    }

    if (isFunctionCall) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      violations.push({
        line: line + 1,
        column: character,
        matched: 'new Function',
        source: 'ast:no-new-function',
      });
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

/** Collect local aliases for eval (variables assigned `eval`) */
function collectLocalEvalAliases(sourceFile: ts.SourceFile): Set<string> {
  const aliases = new Set<string>();

  function visit(node: ts.Node): void {
    // const e = eval; or let e = eval;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const init = node.initializer;
      if (init && ts.isIdentifier(init) && init.text === 'eval') {
        aliases.add(node.name.text);
      }
      // Also handle: const e = globalThis.eval;
      if (init && ts.isPropertyAccessExpression(init)) {
        if (ts.isIdentifier(init.name) && init.name.text === 'eval') {
          aliases.add(node.name.text);
        }
      }
    }
    // Indirect: (0, eval) patterns are handled at call site

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return aliases;
}

/** Collect local aliases for Function constructor */
function collectFunctionAliases(sourceFile: ts.SourceFile): Set<string> {
  const aliases = new Set<string>();

  function visit(node: ts.Node): void {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const init = node.initializer;
      if (init && ts.isIdentifier(init) && init.text === 'Function') {
        aliases.add(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return aliases;
}

// ─── Utility ────────────────────────────────────────────────────────────

/**
 * Resolve parentheses and comma expressions to the final operand.
 * (0, eval) → eval, ((x)) → x — indirect eval pattern
 */
function resolveCommaExpression(node: ts.Node): ts.Node {
  // Strip parentheses first
  if (ts.isParenthesizedExpression(node)) {
    return resolveCommaExpression(node.expression);
  }
  // Resolve comma: (a, b, c) → c
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
    return resolveCommaExpression(node.right);
  }
  return node;
}
