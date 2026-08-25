/**
 * TDD Red Phase: ast-analyzer tests
 * Tests for AST-based export and import detection.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  analyzeExports,
  analyzeImports,
  type ExportInfo,
} from '../../src/contract/ast-analyzer.js';
import type { BoundaryExport } from '../../src/core/types-contract.js';

// ─── Temp Dir Fixtures ──────────────────────────────────────────────────

const TEST_DIR = join(tmpdir(), `mumuspec-ast-analyzer-${Date.now()}`);

function writeFile(name: string, content: string): void {
  writeFileSync(join(TEST_DIR, name), content, 'utf-8');
}

beforeAll(() => {
  mkdirSync(TEST_DIR, { recursive: true });

  // File with various export forms
  writeFile('exports-full.ts', `
export function foo() {}
export class Bar {}
export const baz = 42;
export interface IBaz { x: number }
export type MyType = string | number;
export default class DefaultClass {}
export * from './side';
export { foo as fooAlias, bar as barAlias } from './re';
`);

  // File with various import forms
  writeFile('imports-full.ts', `
import { a, b } from 'module-a';
import Default from 'module-b';
import * as ns from 'module-c';
import 'side-effect-module';
const lazy = await import('dynamic-module');
const req = require('commonjs-module');
export { x } from './re-export-source';
export * from './star-source';
`);

  // Empty TS file
  writeFile('empty.ts', `export {};`);

  // TypeScript-only file (no exports or imports)
  writeFile('internal.ts', `
const x = 42;
function internalFn() { return x; }
console.log(internalFn());
`);
});

afterAll(() => {
  try {
    rmSync(TEST_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ─── Test Suite: analyzeExports ─────────────────────────────────────────

describe('analyzeExports', () => {
  it('AA-01: detects export function', () => {
    const exports = analyzeExports(TEST_DIR);
    const foo = exports.find(e => e.name === 'foo');
    expect(foo).toBeDefined();
    expect(foo?.kind).toBe('function');
  });

  it('AA-02: detects export default class', () => {
    const exports = analyzeExports(TEST_DIR);
    const defaultClass = exports.find(e => e.name === 'DefaultClass');
    expect(defaultClass).toBeDefined();
  });

  it('AA-03: detects export * from (re-export)', () => {
    const exports = analyzeExports(TEST_DIR);
    // "export * from './side'" doesn't add a named export but shouldn't crash
    // The function should handle this gracefully
    expect(Array.isArray(exports)).toBe(true);
  });

  it('AA-04: detects export { x as y } named re-export', () => {
    const exports = analyzeExports(TEST_DIR);
    const fooAlias = exports.find(e => e.name === 'fooAlias');
    const barAlias = exports.find(e => e.name === 'barAlias');
    expect(fooAlias).toBeDefined();
    expect(barAlias).toBeDefined();
  });

  it('AA-05: detects export const', () => {
    const exports = analyzeExports(TEST_DIR);
    const baz = exports.find(e => e.name === 'baz');
    expect(baz).toBeDefined();
    expect(baz?.kind).toBe('const');
  });

  it('AA-05b: export interface and type', () => {
    const exports = analyzeExports(TEST_DIR);
    const iBaz = exports.find(e => e.name === 'IBaz');
    const myType = exports.find(e => e.name === 'MyType');
    expect(iBaz).toBeDefined();
    expect(myType).toBeDefined();
  });

  it('AA-06: deduplicates same name across files', () => {
    // Write a file that duplicates an existing export name
    const dupDir = join(TEST_DIR, 'dup-test');
    mkdirSync(dupDir, { recursive: true });
    writeFileSync(join(dupDir, 'first.ts'), `export const dupName = 1;`, 'utf-8');
    writeFileSync(join(dupDir, 'second.ts'), `export const dupName = 2;`, 'utf-8');

    const exports = analyzeExports(dupDir);
    const dupNames = exports.filter(e => e.name === 'dupName');
    expect(dupNames.length).toBe(1);
  });
});

// ─── Test Suite: analyzeImports ─────────────────────────────────────────

describe('analyzeImports', () => {
  it('AA-07: detects import { x } from "y"', () => {
    const imports = analyzeImports(TEST_DIR);
    expect(imports.has('module-a')).toBe(true);
    expect(imports.has('module-b')).toBe(true);
    expect(imports.has('module-c')).toBe(true);
    expect(imports.has('side-effect-module')).toBe(true);
  });

  it('AA-08: detects dynamic import() and require()', () => {
    const imports = analyzeImports(TEST_DIR);
    expect(imports.has('dynamic-module')).toBe(true);
    expect(imports.has('commonjs-module')).toBe(true);
  });

  it('AA-08b: detects re-export sources', () => {
    const imports = analyzeImports(TEST_DIR);
    expect(imports.has('./re-export-source')).toBe(true);
    expect(imports.has('./star-source')).toBe(true);
  });
});
