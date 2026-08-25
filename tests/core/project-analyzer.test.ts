/**
 * Tests for src/core/project-analyzer.ts -- analyzeProject, detectFramework.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
  resolve: (p: string) => p,
}));

import { analyzeProject, type ProjectAnalysis } from '../../src/core/project-analyzer.js';

describe('analyzeProject', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
  });

  it('should return a valid ProjectAnalysis', () => {
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
    const result = analyzeProject('/root');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('projectType');
    expect(result).toHaveProperty('framework');
    expect(result).toHaveProperty('language');
  });

  it('should classify as frontend when React present', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReaddirSync.mockReturnValue(['src']);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      devDependencies: { typescript: '^5.0.0' },
    }));
    const result = analyzeProject('/root');
    expect(['frontend', 'fullstack']).toContain(result.projectType);
  });

  it('should detect TypeScript when tsconfig exists', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('tsconfig.json'));
    mockReaddirSync.mockReturnValue([]);
    const result = analyzeProject('/root');
    expect(result.hasTypeScript).toBe(true);
  });

  it('should detect backend framework (express)', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReaddirSync.mockReturnValue([]);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { express: '^4.0.0' },
    }));
    const result = analyzeProject('/root');
    expect(result.framework).toBe('express');
  });

  it('should detect test framework presence', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReaddirSync.mockReturnValue([]);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      devDependencies: { vitest: '^1.0.0' },
    }));
    const result = analyzeProject('/root');
    expect(result.hasTests).toBe(true);
  });

  it('should handle missing package.json gracefully', () => {
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
    const result = analyzeProject('/root');
    expect(result.packageName).toBeDefined();
    expect(typeof result.packageName).toBe('string');
  });

  it('should correctly count source dirs', () => {
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue(['src', 'lib']);
    const result = analyzeProject('/root');
    expect(Array.isArray(result.sourceDirs)).toBe(true);
  });

  it('should detect UI library from react deps', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('package.json'));
    mockReaddirSync.mockReturnValue([]);
    mockReadFileSync.mockReturnValue(JSON.stringify({
      dependencies: { react: '^18.0.0', antd: '^5.0.0' },
    }));
    const result = analyzeProject('/root');
    expect(result.hasUiLibrary).toBe(true);
  });
});
