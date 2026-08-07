/**
 * Final coverage push for src/core/utils.ts.
 * Targets branches not covered by utils-deep.test.ts and utils-extra.test.ts:
 *   - findProjectRoot: positive case (walks up and finds .mumuspec), final fallback
 *   - findSpecDirs: empty dir, dir with files only, dir with error
 *   - computeHash: additional edge cases (long string, special chars)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockReaddirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
  resolve: (base: string, rel?: string) => {
    if (rel === undefined) return base;
    if (rel.startsWith('/')) return rel;
    const b = base.endsWith('/') ? base : base + '/';
    return b + rel;
  },
  relative: (from: string, to: string) => {
    const prefix = from.endsWith('/') ? from : from + '/';
    return to.startsWith(prefix) ? to.slice(prefix.length) : to;
  },
  isAbsolute: (p: string) => p.startsWith('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
  sep: '/',
}));

import {
  findProjectRoot,
  findSpecDirs,
  computeHash,
  readYaml,
  writeYaml,
  readText,
  writeText,
} from '../../src/core/utils.js';

describe('findProjectRoot — positive cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
  });

  it('should find .mumuspec by walking up from a subdirectory', () => {
    // Start at /project/src/core — no .mumuspec here
    // /project/src — no .mumuspec
    // /project — yes .mumuspec exists
    // resolve('/project/src/core') => '/project/src/core'
    // dirname('/project/src/core') => '/project/src'
    // dirname('/project/src') => '/project'
    // dirname('/project') => '/'
    // The mock paths are checked in this order:
    // join('/project/src/core', '.mumuspec') — no
    // join('/project/src', '.mumuspec') — no
    // join('/project', '.mumuspec') — yes → return '/project'
    mockExistsSync
      .mockReturnValueOnce(false)  // /project/src/core/.mumuspec
      .mockReturnValueOnce(false)  // /project/src/.mumuspec
      .mockReturnValueOnce(true);  // /project/.mumuspec

    const result = findProjectRoot('/project/src/core');
    expect(result).toBe('/project');
  });

  it('should find .mumuspec at start path itself', () => {
    // resolve('/project') => '/project'
    // join('/project', '.mumuspec') — first check in loop
    mockExistsSync.mockReturnValueOnce(true);

    const result = findProjectRoot('/project');
    expect(result).toBe('/project');
  });

  it('should handle single-level path with no .mumuspec', () => {
    mockExistsSync.mockReturnValue(false);
    const result = findProjectRoot('/single');
    expect(result).toBeUndefined();
  });

  it('should handle path where .mumuspec exists at the start path', () => {
    // resolve('/deep/nested/path') => '/deep/nested/path'
    // join('/deep/nested/path', '.mumuspec') — first check in loop
    mockExistsSync.mockReturnValueOnce(true);
    const result = findProjectRoot('/deep/nested/path');
    expect(result).toBe('/deep/nested/path');
  });

  it('should walk up multiple levels before finding .mumuspec', () => {
    // path: /a/b/c/d
    // loop checks: /a/b/c/d/.mumuspec, /a/b/c/.mumuspec, /a/b/.mumuspec
    // then /a/.mumuspec — found!
    mockExistsSync
      .mockReturnValueOnce(false)  // /a/b/c/d/.mumuspec
      .mockReturnValueOnce(false)  // /a/b/c/.mumuspec
      .mockReturnValueOnce(false)  // /a/b/.mumuspec
      .mockReturnValueOnce(true);  // /a/.mumuspec

    const result = findProjectRoot('/a/b/c/d');
    // dirname('/a/b/c/d') => '/a/b/c', dirname('/a/b/c') => '/a/b', dirname('/a/b') => '/a'
    expect(result).toBe('/a');
  });
});

describe('findSpecDirs — edge cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
  });

  it('should return empty array for empty directory (no entries)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    const result = findSpecDirs('/empty');
    expect(result).toEqual([]);
  });

  it('should return empty array for directory with only files', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      { name: 'file1.txt', isDirectory: () => false },
      { name: 'file2.md', isDirectory: () => false },
    ] as any[]);
    const result = findSpecDirs('/files-only');
    expect(result).toEqual([]);
  });

  it('should handle permission error gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    const result = findSpecDirs('/no-permission');
    expect(result).toEqual([]);
  });

  it('should find nested spec dirs two levels deep', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync
      .mockReturnValueOnce([
        { name: 'workspace', isDirectory: () => true },
      ])
      .mockReturnValueOnce([
        { name: 'frontend', isDirectory: () => true },
        { name: 'backend', isDirectory: () => true },
        { name: 'docs', isDirectory: () => true },
      ])
      .mockReturnValueOnce([]) // frontend children
      .mockReturnValueOnce([]) // backend children
      .mockReturnValueOnce([]); // docs children

    const result = findSpecDirs('/monorepo');
    expect(result).toContain('/monorepo/workspace/frontend');
    expect(result).toContain('/monorepo/workspace/backend');
    expect(result).toContain('/monorepo/workspace/docs');
  });
});

describe('computeHash — additional edge cases', () => {
  it('should handle very long string input', () => {
    const longStr = 'a'.repeat(100_000);
    const hash = computeHash(longStr);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should handle special characters', () => {
    const hash = computeHash('!@#$%^&*()`~[]{}|;:\'",.<>?');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should handle null characters in string', () => {
    const hash = computeHash('before\0after');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should handle emoji', () => {
    const hash = computeHash('Hello 🌍🎉');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should handle whitespace-only string', () => {
    const hash = computeHash('   \n\t  ');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should produce consistent results for identical content', () => {
    const content = 'test consistency';
    expect(computeHash(content)).toBe(computeHash(content));
  });
});

describe('readYaml — additional edge cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('should handle deeply nested YAML', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('level1:\n  level2:\n    level3: value\n');
    const result = readYaml('/root/nested.yaml');
    expect(result).toEqual({ level1: { level2: { level3: 'value' } } });
  });

  it('should handle YAML with null value', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('key: null\n');
    const result = readYaml('/root/null.yaml');
    expect(result).toEqual({ key: null });
  });

  it('should handle YAML with boolean values', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('enabled: true\nverbose: false\n');
    const result = readYaml('/root/bool.yaml');
    expect(result).toEqual({ enabled: true, verbose: false });
  });
});

describe('writeYaml — additional edge cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
    mockWriteFileSync.mockReset();
    mockMkdirSync.mockReset();
  });

  it('should handle array data', () => {
    writeYaml('/root/list.yaml', ['a', 'b', 'c']);
    expect(mockWriteFileSync).toHaveBeenCalledWith('/root/list.yaml', expect.stringContaining('- a'), 'utf8');
  });

  it('should handle deeply nested object', () => {
    writeYaml('/root/nested.yaml', { a: { b: { c: 'deep' } } });
    expect(mockWriteFileSync).toHaveBeenCalledWith('/root/nested.yaml', expect.stringContaining('a:'), 'utf8');
  });
});

describe('readText — additional edge cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('should handle empty file content', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('');
    const result = readText('/root/empty.txt');
    expect(result).toBe('');
  });

  it('should handle multiline text', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('line1\nline2\nline3');
    const result = readText('/root/multiline.txt');
    expect(result).toBe('line1\nline2\nline3');
  });
});

describe('writeText — additional edge cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReturnValue(false);
    mockWriteFileSync.mockReset();
    mockMkdirSync.mockReset();
  });

  it('should handle empty string content', () => {
    writeText('/root/empty.txt', '');
    expect(mockWriteFileSync).toHaveBeenCalledWith('/root/empty.txt', '', 'utf8');
  });

  it('should handle multiline content', () => {
    const content = 'first\nsecond\nthird';
    writeText('/root/multiline.txt', content);
    expect(mockWriteFileSync).toHaveBeenCalledWith('/root/multiline.txt', content, 'utf8');
  });
});
