/**
 * Deep coverage tests for two core modules:
 *
 *   1. src/core/config-tree.ts  (resolveConstraintTree: invalid skip,
 *      local-duplicate conflict)
 *   2. src/core/doc-importer.ts   (read-file error catch, .openspec dir scan,
 *      collectMarkdownFiles readdirSync-failure catch)
 *
 * Uncovered-line targets:
 *   config-tree.ts : 308-312, 320-332
 *   doc-importer.ts : 144, 151-171, 452
 *
 * Strategy:
 *   - config-tree.ts: pure function — call directly with hand-built inputs
 *   - doc-importer.ts: use real temp directories. To exercise catch blocks:
 *       * line 144  — make a DIRECTORY named "openspec.yaml" so existsSync=true
 *                    but readFileSync throws EISDIR, exercising the catch.
 *       * lines 151-171 — create a real `.openspec/` dir with a `.yaml` file.
 *       * line 452  — create a FILE named "docs" (not a directory) so existsSync=true
 *                    but collectMarkdownFiles.readdirSync(path) throws ENOTDIR,
 *                    exercising the inner try-catch.
 *
 * No mocking required — everything is real filesystem operations.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  resolveConstraintTree,
  isValidStrength,
  strengthRank,
  safeStrengthRank,
  isTightening,
  normalizeScope,
} from '../../src/core/config-tree.js';
import {
  detectExistingDocuments,
  detectThirdPartySpecs,
} from '../../src/core/doc-importer.js';
import type { ConstraintEntry, ConstraintsFile } from '../../src/core/types-constraint.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function makeEntry(overrides: Partial<ConstraintEntry> = {}): ConstraintEntry {
  return {
    id: 'TD-SHALL-001',
    content: 'design.md must cover all affected layers',
    min_strength: 'high',
    enforcement: 'phase_guard: design_to_build',
    ...overrides,
  };
}

function makeFile(overrides: Partial<ConstraintsFile> = {}): ConstraintsFile {
  return {
    version: '0.2.0',
    last_updated: '2026-07-28',
    scope: '.',
    layer: 0,
    strength: { technical_design: 'high', requirement_goals: 'high' },
    ...overrides,
  };
}

const ROOT_STRENGTH = { technical_design: 'high' as const, requirement_goals: 'high' as const };

/** Unique temp dir path for each test run */
function makeTempDir(): string {
  return join(tmpdir(), `mumuspec-cored-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/**
 * Recursively make everything writable before rmSync in cleanup,
 * since some tests may create read-only or unusual structures.
 */
function safeRemove(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Fallback: retry once after a brief delay to handle Windows locks.
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

// ════════════════════════════════════════════════════════════════════
// PART 1 — config-tree.ts
// ════════════════════════════════════════════════════════════════════

describe('config-tree.ts — resolveConstraintTree uncovered branches', () => {
  // ── target: lines 308-312 (skip entry with invalid min_strength) ──

  it('skips a local entry whose min_strength is invalid (covers lines 308-312)', () => {
    // Force an invalid value at runtime using "as any" to bypass the type system.
    const badEntry = { ...makeEntry(), min_strength: 'INVALID' as unknown as 'high' };
    const file = makeFile({ scope: '.', layer: 0, forward: { technical_design: [badEntry] } });

    const res = resolveConstraintTree([file], ROOT_STRENGTH);

    expect(res.root.forward.technical_design).toHaveLength(0);
    expect(res.warnings.some((w) => w.includes('invalid min_strength'))).toBe(true);
  });

  it('skips only invalid entries, keeping valid ones in the same list', () => {
    const bad = { id: 'BAD-001', content: 'x', min_strength: 'invalid' as unknown as 'high', enforcement: 'e' };
    const good = makeEntry({ id: 'GOOD-001' });
    const file = makeFile({ scope: '.', layer: 0, forward: { technical_design: [bad, good] } });

    const res = resolveConstraintTree([file], ROOT_STRENGTH);

    expect(res.root.forward.technical_design).toHaveLength(1);
    expect(res.root.forward.technical_design[0].id).toBe('GOOD-001');
  });

  it('skips invalid entry in the requirement_goals forward dimension', () => {
    const bad = { id: 'RG-BAD', content: 'x', min_strength: 'invalid' as unknown as 'high', enforcement: 'e' };
    const file = makeFile({ scope: '.', layer: 0, forward: { requirement_goals: [bad] } });

    const res = resolveConstraintTree([file], ROOT_STRENGTH);

    expect(res.root.forward.requirement_goals).toHaveLength(0);
  });

  it('skips invalid entry in the reverse dimension', () => {
    const bad = { id: 'REV-BAD', content: 'x', min_strength: 'invalid' as unknown as 'high', enforcement: 'e' };
    const file = makeFile({ scope: '.', layer: 0, reverse: { technical_design: [bad] } });

    const res = resolveConstraintTree([file], ROOT_STRENGTH);

    expect(res.root.reverse.technical_design).toHaveLength(0);
  });

  // ── target: lines 320-332 (local duplicate: same ID appears twice in same file) ──

  it('records conflict when the same ID appears twice in same file scope (covers lines 320-332)', () => {
    const entryA = makeEntry({ id: 'TD-SHALL-001' });
    const entryB = makeEntry({ id: 'TD-SHALL-001' });
    const file = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [entryA, entryB] },
    });

    const res = resolveConstraintTree([file], ROOT_STRENGTH);

    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].id).toBe('TD-SHALL-001');
    expect(res.conflicts[0].resolution).toBe('highest_layer_wins');
    expect(res.root.forward.technical_design).toHaveLength(1);
    expect(res.warnings.some((w) => w.includes('duplicate declaration'))).toBe(true);
  });

  it('records conflict for duplicate IDs in reverse direction', () => {
    const entryA = makeEntry({ id: 'REV-DUP' });
    const entryB = makeEntry({ id: 'REV-DUP' });
    const file = makeFile({
      scope: '.',
      layer: 0,
      reverse: { requirement_goals: [entryA, entryB] },
    });

    const res = resolveConstraintTree([file], ROOT_STRENGTH);

    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].direction).toBe('reverse');
  });

  it('records multiple conflicts across dimensions in a single file', () => {
    const tdA = makeEntry({ id: 'TD-DUP' });
    const tdB = makeEntry({ id: 'TD-DUP' });
    const rgA = makeEntry({ id: 'RG-DUP' });
    const rgB = makeEntry({ id: 'RG-DUP' });
    const file = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [tdA, tdB], requirement_goals: [rgA, rgB] },
    });

    const res = resolveConstraintTree([file], ROOT_STRENGTH);

    expect(res.conflicts).toHaveLength(2);
    const dims = res.conflicts.map((c) => c.dimension).sort();
    expect(dims).toEqual(['requirement_goals', 'technical_design']);
  });

  // ── additional complementary branches (no I/O) ──

  it('allows child to tighten inherited entry (inherited=true → isTightening path)', () => {
    const parentEntry = makeEntry({ id: 'TD-SHALL-001', min_strength: 'low' });
    const parent = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [parentEntry] },
    });
    const childEntry = makeEntry({ id: 'TD-SHALL-001', min_strength: 'high' });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      forward: { technical_design: [childEntry] },
    });

    const res = resolveConstraintTree([parent, child], ROOT_STRENGTH);

    expect(res.conflicts).toHaveLength(0);
    const childNode = res.root.children.get('src');
    expect(childNode).toBeDefined();
    expect(childNode!.forward.technical_design[0].min_strength).toBe('high');
    expect(childNode!.forward.technical_design[0].tightens).toEqual({
      layer: 0,
      scope: '.',
      id: 'TD-SHALL-001',
    });
  });

  it('produces manual_review conflict when child tries to relax inherited entry', () => {
    const parentEntry = makeEntry({ id: 'TD-RELAX', min_strength: 'high' });
    const parent = makeFile({
      scope: '.',
      layer: 0,
      forward: { technical_design: [parentEntry] },
    });
    const childEntry = makeEntry({ id: 'TD-RELAX', min_strength: 'low' });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      forward: { technical_design: [childEntry] },
    });

    const res = resolveConstraintTree([parent, child], ROOT_STRENGTH);

    expect(res.conflicts).toHaveLength(1);
    expect(res.conflicts[0].resolution).toBe('manual_review');
    const childNode = res.root.children.get('src');
    expect(childNode!.forward.technical_design[0].min_strength).toBe('high');
  });

  it('falls back to parent strength when child reports an invalid strength value', () => {
    const parent = makeFile({
      scope: '.',
      layer: 0,
      strength: { technical_design: 'high', requirement_goals: 'high' },
    });
    const child = makeFile({
      scope: 'src',
      layer: 1,
      strength: { technical_design: 'EXTREME' as unknown as 'high', requirement_goals: 'high' as const },
    });

    const res = resolveConstraintTree([parent, child], ROOT_STRENGTH);

    expect(res.warnings.some((w) => w.includes('invalid'))).toBe(true);
    const childNode = res.root.children.get('src');
    expect(childNode!.strength.technical_design).toBe('high');
  });
});

describe('config-tree.ts — pure utility functions', () => {
  it('isValidStrength accepts only high/medium/low', () => {
    expect(isValidStrength('high')).toBe(true);
    expect(isValidStrength('medium')).toBe(true);
    expect(isValidStrength('low')).toBe(true);
    expect(isValidStrength('HIGH')).toBe(false);
    expect(isValidStrength('')).toBe(false);
    expect(isValidStrength(undefined)).toBe(false);
    expect(isValidStrength(null)).toBe(false);
    expect(isValidStrength(42)).toBe(false);
  });

  it('strengthRank returns 3/2/1 for high/medium/low and throws on invalid', () => {
    expect(strengthRank('high')).toBe(3);
    expect(strengthRank('medium')).toBe(2);
    expect(strengthRank('low')).toBe(1);
    expect(() => strengthRank('bad' as 'high')).toThrow();
  });

  it('safeStrengthRank returns fallback for invalid values', () => {
    expect(safeStrengthRank('invalid', 2)).toEqual({ rank: 2, valid: false });
    expect(safeStrengthRank('high')).toEqual({ rank: 3, valid: true });
    expect(safeStrengthRank(null)).toEqual({ rank: 1, valid: false });
  });

  it('normalizeScope handles edge cases correctly', () => {
    expect(normalizeScope(undefined)).toBe('.');
    expect(normalizeScope('')).toBe('.');
    expect(normalizeScope('.')).toBe('.');
    expect(normalizeScope('./')).toBe('.');
    expect(normalizeScope('./src')).toBe('src');
    expect(normalizeScope('src/')).toBe('src');
    expect(normalizeScope('a\\\\b\\\\c')).toBe('a/b/c');
    expect(normalizeScope('./a//b//')).toBe('a/b');
    expect(normalizeScope('/leading')).toBe('leading');
  });

  it('isTightening detects id mismatch', () => {
    const result = isTightening(makeEntry({ id: 'A' }), makeEntry({ id: 'B' }));
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('id mismatch');
  });

  it('isTightening allows tightening (higher strength, same enforcement)', () => {
    const parent = makeEntry({ id: 'X', min_strength: 'low', enforcement: 'pg' });
    const child = makeEntry({ id: 'X', min_strength: 'high', enforcement: 'pg' });
    expect(isTightening(parent, child).valid).toBe(true);
  });

  it('isTightening rejects relaxation', () => {
    const parent = makeEntry({ id: 'X', min_strength: 'high', enforcement: 'pg' });
    const child = makeEntry({ id: 'X', min_strength: 'low', enforcement: 'pg' });
    const result = isTightening(parent, child);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('relaxation');
  });

  it('isTightening reports enforcement mismatch', () => {
    const parent = makeEntry({ id: 'X', min_strength: 'high', enforcement: 'pg1' });
    const child = makeEntry({ id: 'X', min_strength: 'high', enforcement: 'pg2' });
    const result = isTightening(parent, child);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('enforcement differs');
  });
});

// ════════════════════════════════════════════════════════════════════
// PART 2 — doc-importer.ts
// ════════════════════════════════════════════════════════════════════

describe('doc-importer.ts — detectThirdPartySpecs uncovered branches', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = makeTempDir();
    mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    safeRemove(projectDir);
  });

  // ── target: line 144 (catch on readFileSync failure for openspec file) ──

  it('catches readFileSync error when openspec.yaml is actually a directory (covers line 144)', () => {
    // existsSync(openspec.yaml) returns true, but readFileSync will throw EISDIR.
    mkdirSync(join(projectDir, 'openspec.yaml'), { recursive: true });

    const result = detectThirdPartySpecs(projectDir);

    // No spec is added; the error was silently caught.
    expect(result.filter((s) => s.format === 'openspec')).toHaveLength(0);
  });

  it('still detects other specs when one spec file triggers a read error', () => {
    // openspec.yaml is a DIRECTORY (read error caught at line 142-144).
    // asyncapi.yaml is a real file — should still be detected.
    mkdirSync(join(projectDir, 'openspec.yaml'), { recursive: true });
    writeFileSync(join(projectDir, 'asyncapi.yaml'), 'asyncapi: 2.6.0\n');

    const result = detectThirdPartySpecs(projectDir);

    expect(result.some((s) => s.format === 'asyncapi')).toBe(true);
    expect(result.filter((s) => s.format === 'openspec')).toHaveLength(0);
  });

  // ── target: lines 151-171 (.openspec/ directory with file entries) ──

  it('detects a YAML file inside .openspec/ directory (covers lines 151-171)', () => {
    const openspecDir = join(projectDir, '.openspec');
    mkdirSync(openspecDir, { recursive: true });
    writeFileSync(join(openspecDir, 'spec.yaml'), 'name: demo-change\nschema: proposal\n');

    const result = detectThirdPartySpecs(projectDir);

    const openspecSpecs = result.filter((s) => s.format === 'openspec');
    expect(openspecSpecs).toHaveLength(1);
    expect(openspecSpecs[0].path).toContain('.openspec/spec.yaml');
    expect(openspecSpecs[0].rawContent).toContain('demo-change');
  });

  it('detects a .yml file inside .openspec/', () => {
    const openspecDir = join(projectDir, '.openspec');
    mkdirSync(openspecDir, { recursive: true });
    writeFileSync(join(openspecDir, 'change.yml'), 'name: yml-change\n');

    const result = detectThirdPartySpecs(projectDir);

    expect(result.some((s) => s.format === 'openspec' && s.path.includes('.openspec/change.yml'))).toBe(true);
  });

  it('detects a .md file inside .openspec/', () => {
    const openspecDir = join(projectDir, '.openspec');
    mkdirSync(openspecDir, { recursive: true });
    writeFileSync(join(openspecDir, 'notes.md'), '# Notes\nSome markdown.\n');

    const result = detectThirdPartySpecs(projectDir);

    const mdSpecs = result.filter((s) => s.format === 'openspec' && s.path.includes('notes.md'));
    expect(mdSpecs).toHaveLength(1);
  });

  it('skips non-spec file extensions inside .openspec/', () => {
    const openspecDir = join(projectDir, '.openspec');
    mkdirSync(openspecDir, { recursive: true });
    writeFileSync(join(openspecDir, 'image.png'), 'fake-bytes');
    writeFileSync(join(openspecDir, 'readme.txt'), 'Some text');

    const result = detectThirdPartySpecs(projectDir);

    expect(result.filter((s) => s.path.includes('.openspec/'))).toHaveLength(0);
  });

  it('guard prevents a second .openspec/ entry when a prior .openspec path exists (line 157)', () => {
    // The .openspec loop is allowed to run even when topspec.yml is absent.
    // Create TWO files inside .openspec/ to exercise the line-157 guard:
    // file-1 → passes guard (first .openspec/ entry) → pushed
    // file-2 → guard finds existing .openspec/ entry → skipped
    const openspecDir = join(projectDir, '.openspec');
    mkdirSync(openspecDir, { recursive: true });
    writeFileSync(join(openspecDir, 'alpha.yaml'), 'name: alpha\n');
    writeFileSync(join(openspecDir, 'bravo.yaml'), 'name: bravo\n');

    const result = detectThirdPartySpecs(projectDir);

    const openspecSpecs = result.filter((s) => s.format === 'openspec');
    // Only one of the two .openspec/ files should be added (line 157 guard).
    expect(openspecSpecs).toHaveLength(1);
    expect(openspecSpecs[0].path).toContain('.openspec/');
  });

  it('catches error when .openspec is a FILE not a directory (covers catch at line 168-170)', () => {
    // existsSync(.openspec) returns true for a file, but readdirSync(path) throws ENOTDIR
    writeFileSync(join(projectDir, '.openspec'), 'this is a file, not a directory');

    const result = detectThirdPartySpecs(projectDir);

    // .openspec path is NOT a directory so readdirSync throws → caught silently.
    expect(result.filter((s) => s.path.includes('.openspec/'))).toHaveLength(0);
  });

  it('still finds three spec types simultaneously', () => {
    writeFileSync(join(projectDir, 'asyncapi.yaml'), 'asyncapi: 2.6.0\n');
    writeFileSync(join(projectDir, 'openapi.yaml'), 'openapi: 3.0.0\n');
    writeFileSync(join(projectDir, 'model.dsl'), 'workspace { model {} }');

    const result = detectThirdPartySpecs(projectDir);

    const formats = result.map((s) => s.format).sort();
    expect(formats).toContain('asyncapi');
    expect(formats).toContain('openapi');
    expect(formats).toContain('c4-model');
  });
});

describe('doc-importer.ts — detectExistingDocuments uncovered branches', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = makeTempDir();
    mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    safeRemove(projectDir);
  });

  // ── target: line 452 (catch block when readdirSync fails in collectMarkdownFiles) ──

  it('catches readdirSync error when docs path is a file (covers line 452)', () => {
    // Create a FILE named "docs" — existsSync returns true but readdirSync(path)
    // fails with ENOTDIR inside collectMarkdownFiles, which is caught.
    writeFileSync(join(projectDir, 'docs'), 'I am a file, not a directory');

    const result = detectExistingDocuments(projectDir);

    // Returns no docs — the error was caught silently.
    expect(result.filter((d) => d.type === 'docs')).toHaveLength(0);
  });

  it('also catches error when doc/ path is a file', () => {
    writeFileSync(join(projectDir, 'doc'), 'file, not dir');

    const result = detectExistingDocuments(projectDir);

    expect(result.filter((d) => d.type === 'docs')).toHaveLength(0);
  });

  it('returns empty array for empty project', () => {
    const result = detectExistingDocuments(projectDir);
    expect(result).toEqual([]);
  });

  it('detects all standard top-level files when present', () => {
    writeFileSync(join(projectDir, 'README.md'), '# My Project\n\nA summary.\n');
    writeFileSync(join(projectDir, 'CONTRIBUTING.md'), '# Contributing\n\nPlease read.\n');
    writeFileSync(join(projectDir, 'CHANGELOG.md'), '# Changelog\n\n- v1.0.0\n');
    writeFileSync(join(projectDir, 'LICENSE'), 'MIT License\n');

    const result = detectExistingDocuments(projectDir);

    expect(result.some((d) => d.type === 'readme')).toBe(true);
    expect(result.some((d) => d.type === 'contributing')).toBe(true);
    expect(result.some((d) => d.type === 'changelog')).toBe(true);
    expect(result.some((d) => d.type === 'license')).toBe(true);
  });

  it('extracts markdown title and first paragraph summary', () => {
    writeFileSync(join(projectDir, 'README.md'), '# Hello World\n\nThis is the first paragraph.\n\n## More\n');

    const result = detectExistingDocuments(projectDir);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Hello World');
    expect(result[0].summary).toContain('first paragraph');
  });

  it('falls back to filename when no markdown title present', () => {
    writeFileSync(join(projectDir, 'README.md'), 'Plain text without any heading.\n');

    const result = detectExistingDocuments(projectDir);

    expect(result[0].title).toBe('README.md');
    expect(result[0].summary).toBe('');
  });

  it('recursively scans nested docs/ files', () => {
    const nestedDir = join(projectDir, 'docs', 'api', 'v2');
    mkdirSync(nestedDir, { recursive: true });
    writeFileSync(join(nestedDir, 'endpoints.md'), '# Endpoints\n\nAPI reference.\n');

    const result = detectExistingDocuments(projectDir);

    const docsPaths = result.filter((d) => d.type === 'docs').map((d) => d.path.replace(/\\/g, '/'));
    expect(docsPaths).toContain('docs/api/v2/endpoints.md');
  });

  it('also scans doc/ alternative directory', () => {
    const altDir = join(projectDir, 'doc');
    mkdirSync(altDir, { recursive: true });
    writeFileSync(join(altDir, 'guide.md'), '# Guide\n\nUser guide.\n');

    const result = detectExistingDocuments(projectDir);

    const docsPaths = result.filter((d) => d.type === 'docs').map((d) => d.path.replace(/\\/g, '/'));
    expect(docsPaths).toContain('doc/guide.md');
  });
});
