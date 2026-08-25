/**
 * TDD Red Phase: ast-checker tests (hardening)
 * Tests for AST-based JSX detection, htm library detection, and AST-only constraints.
 *
 * AC-01 to AC-08: Core JSX/htm detection (from original suite)
 * AC-09 to AC-12: AST constraint detection (NEW, replacing regex tests)
 * AC-13 to AC-18: Additional edge cases and line detection
 */

import { describe, it, expect } from 'vitest';
import {
  detectJsxUsage,
  usesHtmLibrary,
  type JsxDetectionResult,
} from '../../src/guard/ast-checker.js';

// ─── Fixtures ───────────────────────────────────────────────────────────

const SIMPLE_JSX = `
export function App() {
  return <div className="app">Hello</div>;
}
`;

const SELF_CLOSING_JSX = `
import React from 'react';
export const Button = () => <input type="text" />;
`;

const TSX_WITH_GENERIC_ONLY = `
export function identity<T>(value: T): T {
  return value;
}

export class Container<T extends object> {
  items: T[] = [];
  add(item: T): void {
    this.items.push(item);
  }
}

export const map = <T, U>(arr: T[], fn: (x: T) => U): U[] => arr.map(fn);
`;

const STRING_HTML_NOT_JSX = `
export function getTemplate(): string {
  return '<div class="container"><span>text</span></div>';
}

export const html = "<p>Hello <strong>world</strong></p>";
`;

const HTM_TEMPLATE_USAGE = `
import htm from 'htm';
import { h } from 'preact';

const html = htm.bind(h);
export const Button = (props) => html\`<button>\${props.label}</button>\`;
`;

const HTM_VARIABLE_NOT_LIBRARY = `
const htm = "just a string variable";
export const useIt = () => htm + "concat";
`;

const MALFORMED_TS = `
export function broken(
  {{ {{{ invalid syntax and unmatched brackets [[[
  >>>>>>> not even close to TS
`;

const MIXED_GENERIC_AND_JSX = `
import React from 'react';

export function withGenerics<T>(Component: React.FC<T>): React.FC<T> {
  return (props: T) => <Component {...props} />;
}
`;

const EXPORT_CONST_WITH_GENERIC = `
export const createStore = <S>(initial: S) => {
  let state = initial;
  return { get: () => state, set: (s: S) => { state = s }; };
};

export function render() {
  return <div>Hello</div>;
}
`;

const DIRECT_EVAL_CODE = `eval('console.log("hello")');`;

const ALIAS_EVAL_CODE = `
const e = eval;
e('console.log("hello")');
`;

const GLOBAL_THIS_EVAL_CODE = `globalThis.eval('console.log("hello")');`;

const INDIRECT_EVAL_CODE = `
const x = 0;
(x, eval)('console.log("hello")');
`;

const NEW_FUNCTION_CODE = `const fn = new Function('return 42');`;

const ALIAS_FUNCTION_CODE = `
const F = Function;
const fn = new F('return 42');
`;

const NESTED_JSX_AT_LINE_5 = `
// line 1
// line 2
import React from 'react';

export function App() {
  return (
    <div>
      <span>Hello</span>
    </div>
  );
}
`;

// ─── Test Suite: detectJsxUsage ─────────────────────────────────────────

describe('detectJsxUsage', () => {
  it('AC-01: detects JSX in simple function component', () => {
    const result = detectJsxUsage(SIMPLE_JSX, 'App.tsx');
    expect(result.hasJsx).toBe(true);
    expect(result.reason).toBe('jsx-node');
  });

  it('AC-02: returns false for TypeScript with only generics', () => {
    const result = detectJsxUsage(TSX_WITH_GENERIC_ONLY, 'utils.ts');
    expect(result.hasJsx).toBe(false);
    expect(result.reason).toBe('generic-only');
  });

  it('AC-03: .tsx file with no JSX but with generics', () => {
    const result = detectJsxUsage(TSX_WITH_GENERIC_ONLY, 'utils.tsx');
    // Even with .tsx extension, if no JSX nodes detected and only generics
    expect(result.hasJsx).toBe(false);
    expect(result.reason).toBe('generic-only');
  });

  it('AC-04: detects htm tagged template → htm-template reason', () => {
    const result = detectJsxUsage(HTM_TEMPLATE_USAGE, 'Button.tsx');
    expect(result.hasJsx).toBe(false);
    expect(result.reason).toBe('htm-template');
  });

  it('AC-05: does not flag string literals as JSX', () => {
    const result = detectJsxUsage(STRING_HTML_NOT_JSX, 'templates.ts');
    expect(result.hasJsx).toBe(false);
    expect(result.reason).toBe('generic-only');
  });

  it('AC-05b: self-closing JSX elements detected', () => {
    const result = detectJsxUsage(SELF_CLOSING_JSX, 'Button.tsx');
    expect(result.hasJsx).toBe(true);
    expect(result.reason).toBe('jsx-node');
  });

  it('mixed generics + JSX: detects JSX when present', () => {
    const result = detectJsxUsage(MIXED_GENERIC_AND_JSX, 'hoc.tsx');
    expect(result.hasJsx).toBe(true);
    expect(result.reason).toBe('jsx-node');
  });

  it('export const with generic + JSX render: detects JSX', () => {
    const result = detectJsxUsage(EXPORT_CONST_WITH_GENERIC, 'store.tsx');
    expect(result.hasJsx).toBe(true);
    expect(result.reason).toBe('jsx-node');
  });

  it('AC-16: detectJsxUsage returns line for simple JSX', () => {
    const result = detectJsxUsage(SIMPLE_JSX, 'App.tsx');
    expect(result.hasJsx).toBe(true);
    expect(result.line).toBeDefined();
    expect(result.line).toBeGreaterThanOrEqual(3);
  });

  it('AC-17: detectJsxUsage returns correct line for nested JSX', () => {
    const result = detectJsxUsage(NESTED_JSX_AT_LINE_5, 'nested.tsx');
    expect(result.hasJsx).toBe(true);
    expect(result.line).toBeDefined();
    // First JSX element (div) starts around line 7
    expect(result.line).toBeGreaterThanOrEqual(6);
    expect(result.line).toBeLessThanOrEqual(8);
  });

  it('returns generic-only for parse error without line', () => {
    const result = detectJsxUsage(MALFORMED_TS, 'broken.ts');
    expect(result.hasJsx).toBe(false);
    expect(result.line).toBeUndefined();
  });
});

// ─── Test Suite: usesHtmLibrary ─────────────────────────────────────────

describe('usesHtmLibrary', () => {
  it('AC-06: detects `import htm from "htm"`', () => {
    const code = `import htm from 'htm';\nconst html = htm.bind(createElement);`;
    expect(usesHtmLibrary(code)).toBe(true);
  });

  it('AC-07: detects htm`` tagged template usage', () => {
    const code = `const tmpl = htm\`<div>hello</div>\`;`;
    expect(usesHtmLibrary(code)).toBe(true);
  });

  it('AC-08: variable named "htm" does not false-positive', () => {
    const code = HTM_VARIABLE_NOT_LIBRARY;
    expect(usesHtmLibrary(code)).toBe(false);
  });

  it('AC-08b: no htm reference at all', () => {
    const code = `export const x = 42;\nconsole.log(x);`;
    expect(usesHtmLibrary(code)).toBe(false);
  });
});

// ─── Test Suite: AST-Only Constraint Detection ──────────────────────────

describe('ast constraints via checkAstConstraints', () => {
  // Import lazily so test file can compile even before function exists
  it('AC-09: detects eval() call in code', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints(DIRECT_EVAL_CODE, 'test.ts', ['no-eval']);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].matched).toBe('eval');
    expect(violations[0].line).toBe(1);
  });

  it('AC-10: detects new Function() call in code', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints(NEW_FUNCTION_CODE, 'test.ts', ['no-new-function']);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0].matched).toBe('new Function');
  });

  it('AC-13: detects indirect eval via alias', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints(ALIAS_EVAL_CODE, 'test.ts', ['no-eval']);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('AC-14: detects globalThis.eval()', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints(GLOBAL_THIS_EVAL_CODE, 'test.ts', ['no-eval']);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('AC-15: detects (0, eval)() indirect eval', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints(INDIRECT_EVAL_CODE, 'test.ts', ['no-eval']);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('AC-16: detects new Function() via alias', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints(ALIAS_FUNCTION_CODE, 'test.ts', ['no-new-function']);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('returns empty array for empty constraints list', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints(DIRECT_EVAL_CODE, 'test.ts', []);
    expect(violations).toEqual([]);
  });

  it('returns empty array for non-violating code', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    const violations = checkAstConstraints('const x = 42;', 'test.ts', ['no-eval']);
    expect(violations).toEqual([]);
  });

  it('returns empty array for malformed TS (no throw)', async () => {
    const { checkAstConstraints } = await import('../../src/guard/ast-checker.js');
    expect(() => checkAstConstraints(MALFORMED_TS, 'broken.ts', ['no-eval'])).not.toThrow();
  });
});
