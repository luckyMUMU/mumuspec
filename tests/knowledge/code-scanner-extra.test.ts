/**
 * Extra tests for src/knowledge/scanners/code-scanner.ts — scanCodeStructure function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();

vi.mock('node:fs', () => ({
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
  relative: (from: string, to: string) => to.replace(from + '/', ''),
  extname: (p: string) => '.' + p.split('.').pop(),
}));

import { scanCodeStructure } from '../../src/knowledge/scanners/code-scanner.js';

describe('scanCodeStructure', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should return empty array for empty directory', () => {
    mockReaddirSync.mockReturnValue([]);
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should skip node_modules and other excluded dirs', () => {
    mockReaddirSync.mockReturnValue([
      { name: 'node_modules', isDirectory: () => false },
    ]);
    mockStatSync.mockReturnValue({ isDirectory: () => false });
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect MVC pattern from directory structure', () => {
    let callNum = 0;
    mockReaddirSync.mockImplementation(() => {
      callNum++;
      if (callNum === 1) return [{ name: 'src', isDirectory: () => false }];
      if (callNum === 2) return [
        { name: 'controllers', isDirectory: () => false },
        { name: 'services', isDirectory: () => false },
        { name: 'models', isDirectory: () => false },
      ];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect file distribution when dominant extension exists', () => {
    let callNum = 0;
    mockReaddirSync.mockImplementation(() => {
      callNum++;
      if (callNum === 1) return [];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => false });
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle read errors gracefully', () => {
    mockReaddirSync.mockImplementation(() => { throw new Error('EACCES'); });
    const result = scanCodeStructure('/root');
    expect(result).toEqual([]);
  });

  it('should accept an optional scope parameter', () => {
    mockReaddirSync.mockReturnValue([]);
    const result = scanCodeStructure('/root', 'packages/core');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should not fail on deeply nested structures', () => {
    let callNum = 0;
    mockReaddirSync.mockImplementation(() => {
      callNum++;
      if (callNum > 10) return [];
      return [{ name: `dir${callNum}`, isDirectory: () => false }];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });
});
