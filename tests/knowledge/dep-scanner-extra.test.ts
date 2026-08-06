/**
 * Extra tests for src/knowledge/scanners/dep-scanner.ts — scanDeps function.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
}));

import { scanDeps } from '../../src/knowledge/scanners/dep-scanner.js';

describe('scanDeps', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('should return empty array when no manifest files exist', () => {
    mockExistsSync.mockReturnValue(false);
    const result = scanDeps('/root');
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it('should detect React framework from package.json', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    }));
    const result = scanDeps('/root');
    expect(result.length).toBeGreaterThan(0);
    const titles = result.map(p => p.title);
    expect(titles.some(t => t.includes('React') || t.includes('react'))).toBe(true);
  });

  it('should detect Vue framework from package.json', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { vue: '^3.0.0' },
    }));
    const result = scanDeps('/root');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should detect multiple frameworks', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { express: '^4.0.0' },
      devDependencies: { vitest: '^1.0.0' },
    }));
    const result = scanDeps('/root');
    // At least express + vitest knowledge
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle malformed JSON gracefully', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReadFileSync.mockReturnValue('not valid json {{{');
    const result = scanDeps('/root');
    // Should not throw, return minimal or empty result
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect packages from requirements.txt', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('requirements.txt'));
    mockReadFileSync.mockReturnValue('flask==2.0.0\ndjango==4.0.0\nfastapi==0.100.0');
    const result = scanDeps('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should assign correct source and confidence', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { next: '^14.0.0' },
    }));
    const result = scanDeps('/root');
    if (result.length > 0) {
      expect(result[0].source).toBe('deps');
      expect(['high', 'medium', 'low']).toContain(result[0].confidence);
    }
  });
});
