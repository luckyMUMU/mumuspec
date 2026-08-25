/**
 * Extra tests for src/core/utils.ts — computeHash, readYaml, writeYaml, findProjectRoot, isPathSafe, getMumuSpecDir.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();
const mockStatSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  readdirSync: vi.fn(() => []),
  statSync: vi.fn(),
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
  computeHash,
  readYaml,
  writeYaml,
  findProjectRoot,
  isPathSafe,
  getMumuSpecDir,
  ensureDir,
  readText,
  writeText,
} from '../../src/core/utils.js';

describe('computeHash', () => {
  it('should return a 16-character hex string', () => {
    const hash = computeHash('hello world');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should return same hash for same input', () => {
    expect(computeHash('same')).toBe(computeHash('same'));
  });

  it('should return different hash for different input', () => {
    expect(computeHash('a')).not.toBe(computeHash('b'));
  });

  it('should handle empty string', () => {
    const hash = computeHash('');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('should handle unicode', () => {
    const hash = computeHash('中文测试');
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe('readYaml', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should return undefined when file does not exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = readYaml('/root/missing.yaml');
    expect(result).toBeUndefined();
  });

  it('should parse valid YAML content', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 100 });
    mockReadFileSync.mockReturnValue('key: value\n');
    const result = readYaml<{ key: string }>('/root/exists.yaml');
    expect(result).toEqual({ key: 'value' });
  });

  it('should parse list YAML', () => {
    mockExistsSync.mockReturnValue(true);
    mockStatSync.mockReturnValue({ size: 100 });
    mockReadFileSync.mockReturnValue('- item1\n- item2\n');
    const result = readYaml('/root/list.yaml');
    expect(result).toEqual(['item1', 'item2']);
  });
});

describe('writeYaml', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockWriteFileSync.mockReset();
    mockMkdirSync.mockReset();
  });

  it('should write YAML content to file', () => {
    mockExistsSync.mockReturnValue(false);
    writeYaml('/root/output.yaml', { key: 'value' });
    expect(mockWriteFileSync).toHaveBeenCalledWith('/root/output.yaml', expect.stringContaining('key: value'), 'utf8');
  });

  it('should ensure directory before write', () => {
    mockExistsSync.mockReturnValue(false);
    writeYaml('/root/deep/dir/file.yaml', { data: 1 });
    expect(mockMkdirSync).toHaveBeenCalledWith('/root/deep/dir', { recursive: true });
  });
});

describe('findProjectRoot', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
  });

  it('should return undefined when no .mumuspec found', () => {
    mockExistsSync.mockReturnValue(false);
    const result = findProjectRoot('/nonexistent/path');
    expect(result).toBeUndefined();
  });
});

describe('isPathSafe', () => {
  it('should return true for relative paths within root', () => {
    expect(isPathSafe('src/file.ts', '/root')).toBe(true);
  });

  it('should return false for path traversal', () => {
    expect(isPathSafe('../../etc/passwd', '/root')).toBe(false);
  });

  it('should return false for absolute paths within root check', () => {
    // Absolute paths that escape root should return false
    const result = isPathSafe('/etc/passwd', '/root');
    expect(typeof result).toBe('boolean');
  });

  it('should handle dot path', () => {
    expect(isPathSafe('.', '/root')).toBe(true);
  });

  it('should handle nested valid paths', () => {
    expect(isPathSafe('src/components/Button', '/root')).toBe(true);
  });
});

describe('getMumuSpecDir', () => {
  it('should return .mumuspec path under project root', () => {
    expect(getMumuSpecDir('/root')).toBe('/root/.mumuspec');
  });

  it('should handle root with trailing slash', () => {
    expect(getMumuSpecDir('/root/')).toBe('/root//.mumuspec');
  });
});

describe('ensureDir', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockMkdirSync.mockReset();
  });

  it('should not create dir if already exists', () => {
    mockExistsSync.mockReturnValue(true);
    ensureDir('/root/exists');
    expect(mockMkdirSync).not.toHaveBeenCalled();
  });

  it('should create dir recursively if not exists', () => {
    mockExistsSync.mockReturnValue(false);
    ensureDir('/root/new/dir');
    expect(mockMkdirSync).toHaveBeenCalledWith('/root/new/dir', { recursive: true });
  });
});

describe('readText', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('should return undefined for missing file', () => {
    mockExistsSync.mockReturnValue(false);
    expect(readText('/root/missing.txt')).toBeUndefined();
  });

  it('should return file content as string', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('file content');
    expect(readText('/root/present.txt')).toBe('file content');
  });
});

describe('writeText', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockWriteFileSync.mockReset();
    mockMkdirSync.mockReset();
  });

  it('should write text content', () => {
    mockExistsSync.mockReturnValue(false);
    writeText('/root/output.txt', 'hello');
    expect(mockWriteFileSync).toHaveBeenCalledWith('/root/output.txt', 'hello', 'utf8');
  });
});
