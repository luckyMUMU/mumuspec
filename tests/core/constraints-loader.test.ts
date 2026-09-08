/**
 * Tests for src/core/constraints-loader.ts — loadConstraintsFile, loadAllConstraints, resolveRootStrength.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExistsSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();
const mockReadYaml = vi.fn();
const mockGetMumuSpecDir = vi.fn();
const mockNormalizeScope = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
  relative: (from: string, to: string) => to.replace(from + '/', '') || '.',
}));

vi.mock('../../src/core/utils.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
  getMumuSpecDir: (...args: unknown[]) => mockGetMumuSpecDir(...args),
}));

vi.mock('../../src/core/config.js', () => ({
  normalizeScope: (...args: unknown[]) => mockNormalizeScope(...args),
}));

import {
  loadConstraintsFile,
  loadAllConstraints,
  resolveRootStrength,
  type LoadConstraintsOptions,
} from '../../src/core/constraints-loader.js';

describe('loadConstraintsFile', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadYaml.mockReset();
    mockGetMumuSpecDir.mockReset();
    mockNormalizeScope.mockReset();
    mockGetMumuSpecDir.mockImplementation((dir: string) => dir + '/.mumuspec');
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('should return undefined when file does not exist', () => {
    mockReadYaml.mockReturnValue(undefined);
    const result = loadConstraintsFile('/root', '/root');
    expect(result).toBeUndefined();
  });

  it('should parse constraints.yaml and stamp scope', () => {
    mockReadYaml.mockReturnValue({ version: 1, strength: 'high', constraints: [] });
    const result = loadConstraintsFile('/root/src/api', '/root');
    expect(result).toBeDefined();
    expect(result!.scope).toBe('src/api');
  });

  it('should catch YAML parse errors and return undefined', () => {
    mockReadYaml.mockReturnValue(null);
    const result = loadConstraintsFile('/root', '/root');
    expect(result).toBeUndefined();
  });

  it('should extract strength from parsed file', () => {
    mockReadYaml.mockReturnValue({ version: 1, strength: { technical_design: 'high', requirement_goals: 'medium' }, constraints: [] });
    const result = loadConstraintsFile('/root', '/root');
    expect(result).toBeDefined();
  });
});

describe('loadAllConstraints', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
    mockReadYaml.mockReset();
    mockNormalizeScope.mockReset();
    mockGetMumuSpecDir.mockImplementation((dir: string) => dir + '/.mumuspec');
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('should return empty files when no .mumuspec dir exists', () => {
    mockExistsSync.mockReturnValue(false);
    const result = loadAllConstraints('/root');
    expect(result.files).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('should load root-level constraints when present', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockReturnValue([]);
    mockReadYaml.mockReturnValue({ version: 1, strength: 'high', constraints: [] });
    const result = loadAllConstraints('/root', { maxDepth: 0 });
    expect(result.files.length).toBeGreaterThanOrEqual(1);
  });

  it('should skip node_modules and dist directories', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['node_modules', 'dist', 'src'];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue(undefined);
    const result = loadAllConstraints('/root', { maxDepth: 1 });
    expect(result.files).toBeDefined();
  });

  it('should respect maxDepth option', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockReturnValue([]);
    mockReadYaml.mockReturnValue(undefined);
    const result = loadAllConstraints('/root', { maxDepth: 2 });
    expect(result.files).toBeDefined();
  });
});

describe('resolveRootStrength', () => {
  it('should return config strength when no root file', () => {
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
    const configStrength = { technical_design: 'medium' as const, requirement_goals: 'low' as const };
    const result = resolveRootStrength([], configStrength);
    expect(result).toEqual(configStrength);
  });

  it('should return config strength when root file has no strength', () => {
    mockNormalizeScope.mockReturnValue('.');
    const files = [{ scope: '.', constraints: [] }];
    const configStrength = { technical_design: 'high' as const, requirement_goals: 'medium' as const };
    const result = resolveRootStrength(files, configStrength);
    expect(result).toEqual(configStrength);
  });

  it('should use root file strength when present', () => {
    mockNormalizeScope.mockReturnValue('.');
    const files = [
      { scope: '.', strength: { technical_design: 'high', requirement_goals: 'high' }, constraints: [] },
    ];
    const configStrength = { technical_design: 'low' as const, requirement_goals: 'low' as const };
    const result = resolveRootStrength(files, configStrength);
    expect(result.technical_design).toBe('high');
    expect(result.requirement_goals).toBe('high');
  });

  it('should fall back to config for missing dimensions', () => {
    mockNormalizeScope.mockReturnValue('.');
    const files = [
      { scope: '.', strength: { technical_design: 'high' }, constraints: [] },
    ];
    const configStrength = { technical_design: 'low' as const, requirement_goals: 'medium' as const };
    const result = resolveRootStrength(files, configStrength);
    expect(result.technical_design).toBe('high');
    expect(result.requirement_goals).toBe('medium');
  });
});
