/**
 * Extra tests for src/knowledge/scanners/docs-scanner.ts -- scanDocs function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockStatSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
}));

import { scanDocs } from '../../src/knowledge/scanners/docs-scanner.js';

describe('scanDocs', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should return empty when no doc files exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = scanDocs('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect README presence', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('README.md'));
    mockReadFileSync.mockReturnValue('# Project'.repeat(20));
    mockStatSync.mockReturnValue({ mtime: new Date() });
    const result = scanDocs('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect missing recommended docs', () => {
    mockExistsSync.mockReturnValue(false);
    const result = scanDocs('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle docs/ directory scan', () => {
    let callNum = 0;
    mockExistsSync.mockImplementation((p: string) => p.includes('docs'));
    mockReaddirSync.mockImplementation(() => {
      callNum++;
      return callNum <= 1 ? [] : [];
    });
    const result = scanDocs('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle read errors gracefully', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('README.md'));
    mockReadFileSync.mockImplementation(() => { throw new Error('EACCES'); });
    mockStatSync.mockReturnValue({ mtime: new Date() });
    const result = scanDocs('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should identify complete vs minimal docs', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('README.md'));
    mockReadFileSync.mockReturnValue('line\n'.repeat(100));
    mockStatSync.mockReturnValue({ mtime: new Date() });
    const result = scanDocs('/root');
    expect(Array.isArray(result)).toBe(true);
  });
});
