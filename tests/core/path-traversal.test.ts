/**
 * Path traversal defense tests (Phase 2.2).
 *
 * resolveWithinRoot must reject three escape vectors:
 *   1. `..` traversal
 *   2. Absolute paths outside the project root
 *   3. Symlink/junction escapes
 * And the change-domain scope choke points (getChangesDir / getChangeDir /
 * scopeToPath) must enforce the same guarantee.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveWithinRoot } from '../../src/core/utils.js';
import { getChangesDir, getChangeDir, scopeToPath } from '../../src/change/paths.js';
import { MumuSpecError } from '../../src/core/errors.js';

let root: string;
let outside: string;

beforeAll(() => {
  const base = mkdtempSync(join(tmpdir(), 'mumu-pathtrav-'));
  root = join(base, 'project');
  outside = join(base, 'outside');
  mkdirSync(root, { recursive: true });
  mkdirSync(outside, { recursive: true });
  mkdirSync(join(root, 'sub', 'nested'), { recursive: true });
});

afterAll(() => {
  // Clean only our temp tree
  try {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
});

describe('resolveWithinRoot', () => {
  it('resolves normal relative scopes within root', () => {
    expect(resolveWithinRoot(root, 'sub')).toBe(join(root, 'sub'));
    expect(resolveWithinRoot(root, './sub/nested')).toBe(join(root, 'sub', 'nested'));
  });

  it('normalizes internal .. that stays within root', () => {
    expect(resolveWithinRoot(root, 'sub/../sub')).toBe(join(root, 'sub'));
  });

  it('returns root itself for "."', () => {
    expect(resolveWithinRoot(root, '.')).toBe(root);
  });

  it('rejects .. traversal above root', () => {
    expect(() => resolveWithinRoot(root, '../outside')).toThrow(MumuSpecError);
    expect(() => resolveWithinRoot(root, '..')).toThrow(MumuSpecError);
    expect(() => resolveWithinRoot(root, 'sub/../../escape')).toThrow(MumuSpecError);
  });

  it('rejects absolute paths outside root', () => {
    expect(() => resolveWithinRoot(root, outside)).toThrow(MumuSpecError);
  });

  it('accepts absolute paths inside root', () => {
    expect(resolveWithinRoot(root, join(root, 'sub'))).toBe(join(root, 'sub'));
  });

  it('rejects empty/blank paths', () => {
    expect(() => resolveWithinRoot(root, '')).toThrow(MumuSpecError);
    expect(() => resolveWithinRoot(root, '   ')).toThrow(MumuSpecError);
  });

  it('rejects symlink escapes to outside root', () => {
    // junction works without admin privileges on Windows; plain symlink elsewhere
    const link = join(root, 'sub', 'link');
    try {
      symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch {
      return; // environment lacks symlink capability — skip
    }
    try {
      expect(() => resolveWithinRoot(root, 'sub/link')).toThrow(MumuSpecError);
    } finally {
      rmSync(link);
    }
  });

  it('rejects symlink escape on the nearest existing ancestor', () => {
    const link = join(root, 'sub', 'link');
    try {
      symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch {
      return;
    }
    try {
      // not-yet-created path beneath a symlinked ancestor
      expect(() => resolveWithinRoot(root, 'sub/link/newdir/file.md')).toThrow(MumuSpecError);
    } finally {
      rmSync(link);
    }
  });

  it('error carries E-SECURITY-001 code', () => {
    try {
      resolveWithinRoot(root, '../escape');
      expect.unreachable();
    } catch (e) {
      expect((e as MumuSpecError).code).toBe('E-SECURITY-001');
    }
  });
});

describe('scope choke points enforce containment', () => {
  it('getChangesDir rejects escaping scope', () => {
    expect(() => getChangesDir(root, '../outside')).toThrow(MumuSpecError);
  });

  it('getChangeDir rejects escaping scope', () => {
    expect(() => getChangeDir(root, 'valid-name', '../outside')).toThrow(MumuSpecError);
  });

  it('scopeToPath rejects escaping scope', () => {
    expect(() => scopeToPath(root, '../outside')).toThrow(MumuSpecError);
  });

  it('legitimate scopes still resolve', () => {
    expect(scopeToPath(root, '.')).toBe(root);
    expect(getChangesDir(root, 'sub')).toBe(join(root, 'sub', '.mumuspec', 'changes'));
    expect(getChangesDir(root)).toBe(join(root, '.mumuspec', 'changes'));
  });
});
