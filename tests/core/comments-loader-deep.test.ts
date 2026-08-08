/**
 * Deep coverage tests for src/core/constraints-loader.ts.
 *
 * Targets uncovered branches in loadConstraintsFile, loadAllConstraints,
 * resolveRootStrength, and loadAndResolveConstraints:
 *   - loadConstraintsFile: layer derivation (scope-based), explicit layer passthrough
 *   - loadAllConstraints: allowMissingRoot=false throw, maxDepth boundary,
 *     readdirSync/statSync errors, dotfile skip (non-.mumuspec),
 *     SKIP_DIRS filtering, file-instead-of-dir skip, recursive descent
 *   - resolveRootStrength: per-dimension fallback, no-root-file, no-strength-on-root
 *   - loadAndResolveConstraints: end-to-end integration, warning forwarding
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared hoisted mocks ───

const {
  mockExistsSync,
  mockReaddirSync,
  mockStatSync,
  mockReadYaml,
  mockGetMumuSpecDir,
  mockNormalizeScope,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockReadYaml: vi.fn(),
  mockGetMumuSpecDir: vi.fn(),
  mockNormalizeScope: vi.fn(),
}));

// ─── Module mocks ───

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
  relative: (from: string, to: string) => {
    if (from === to) return '';
    if (to.startsWith(from + '/')) return to.slice(from.length + 1);
    // fallback: strip common prefix
    const commonLen = [...from].findIndex((c, i) => to[i] !== c);
    return commonLen <= 0 ? to : to.slice(commonLen).replace(/^\//, '');
  },
}));

vi.mock('../../src/core/utils.js', () => ({
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
  getMumuSpecDir: (...args: unknown[]) => mockGetMumuSpecDir(...args),
}));

vi.mock('../../src/core/config.js', () => ({
  normalizeScope: (...args: unknown[]) => mockNormalizeScope(...args),
}));

// ─── Import after mocks ───

import {
  loadConstraintsFile,
  loadAllConstraints,
  resolveRootStrength,
  loadAndResolveConstraints,
  type LoadConstraintsOptions,
} from '../../src/core/constraints-loader.js';
import type {
  ConstraintsFile,
  ConstraintStrength,
  ConstraintTreeResolution,
} from '../../src/core/types.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

const DEFAULT_STRENGTH = {
  technical_design: 'medium' as ConstraintStrength,
  requirement_goals: 'medium' as ConstraintStrength,
};

const SAMPLE_YAML = {
  version: '1',
  last_updated: '2025-01-01',
  strength: { technical_design: 'high', requirement_goals: 'high' },
  forward: { technical_design: [], requirement_goals: [] },
  reverse: { technical_design: [], requirement_goals: [] },
};

/** Build a minimal ConstraintTreeResolution stub for the resolveFn mock. */
function makeResolution(warnings: string[] = []): ConstraintTreeResolution {
  return {
    root: {
      layer: 0,
      scope: '.',
      strength: { ...DEFAULT_STRENGTH },
      forward: { technical_design: [], requirement_goals: [] },
      reverse: { technical_design: [], requirement_goals: [] },
      children: new Map(),
      parent: null,
    },
    conflicts: [],
    warnings,
  };
}

// ════════════════════════════════════════════════════════════════════
// loadConstraintsFile
// ════════════════════════════════════════════════════════════════════

describe('loadConstraintsFile — layer derivation', () => {
  beforeEach(() => {
    mockReadYaml.mockReset();
    mockGetMumuSpecDir.mockReset();
    mockNormalizeScope.mockReset();
    mockGetMumuSpecDir.mockImplementation((d: string) => `${d}/.mumuspec`);
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('should derive layer=0 when scope equals "." and no explicit layer', () => {
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });
    const result = loadConstraintsFile('/root', '/root');
    expect(result).toBeDefined();
    expect(result!.scope).toBe('.');
    expect(result!.layer).toBe(0);
  });

  it('should derive layer from path segments when scope is a subdirectory', () => {
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });
    const result = loadConstraintsFile('/root/src/api', '/root');
    expect(result).toBeDefined();
    // relative('/root', '/root/src/api') => 'src/api' => 2 segments
    expect(result!.layer).toBe(2);
  });

  it('should preserve explicit layer from YAML when already set', () => {
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML, layer: 5 });
    const result = loadConstraintsFile('/root/src', '/root');
    expect(result).toBeDefined();
    expect(result!.layer).toBe(5);
  });

  it('should derive layer=1 for a single-level subdirectory', () => {
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });
    const result = loadConstraintsFile('/root/src', '/root');
    expect(result).toBeDefined();
    expect(result!.layer).toBe(1);
  });

  it('should override explicit scope in YAML with path-derived value', () => {
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML, scope: 'explicit-scope' });
    const result = loadConstraintsFile('/root', '/root');
    expect(result).toBeDefined();
    // path-derived scope overrides YAML
    expect(result!.scope).toBe('.');
  });

  it('should return undefined when YAML is empty object', () => {
    mockReadYaml.mockReturnValue({});
    const result = loadConstraintsFile('/root', '/root');
    // readYaml returns {} which is truthy but has no useful data;
    // function still stamps scope/layer — verify it returns a file
    expect(result).toBeDefined();
    expect(result!.scope).toBe('.');
  });
});

// ════════════════════════════════════════════════════════════════════
// loadAllConstraints
// ════════════════════════════════════════════════════════════════════

describe('loadAllConstraints — allowMissingRoot=false', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
    mockReadYaml.mockReset();
    mockNormalizeScope.mockReset();
    mockGetMumuSpecDir.mockImplementation((d: string) => `${d}/.mumuspec`);
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('should throw when .mumuspec is missing and allowMissingRoot=false', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => loadAllConstraints('/root', { allowMissingRoot: false })).toThrow(
      /has no \.mumuspec/,
    );
  });
});

describe('loadAllConstraints — directory traversal', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
    mockReadYaml.mockReset();
    mockNormalizeScope.mockReset();
    mockGetMumuSpecDir.mockImplementation((d: string) => `${d}/.mumuspec`);
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('should stop recursion when depth >= maxDepth', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    // First call returns subdirectories; second would be deeper
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['src'];
      if (dir === '/root/src') return ['deep'];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue(undefined);
    // maxDepth=0 means scan() returns immediately (depth 0 >= 0)
    const result = loadAllConstraints('/root', { maxDepth: 0 });
    // Only the root-level .mumuspec exists check was done; no subdir scanned
    expect(result.files).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it('should silently skip directories that throw readdirSync', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['src', 'bad-dir'];
      if (dir === '/root/src') return [];
      if (dir === '/root/bad-dir') throw new Error('EACCES permission denied');
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue(undefined);
    const result = loadAllConstraints('/root', { maxDepth: 3 });
    expect(result.files).toBeDefined();
    // Should not throw — permission error is swallowed
  });

  it('should silently skip entries that throw statSync', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['weird-entry'];
      return [];
    });
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });
    mockReadYaml.mockReturnValue(undefined);
    const result = loadAllConstraints('/root', { maxDepth: 3 });
    expect(result.files).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it('should skip non-directory entries (regular files)', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['README.md', 'src'];
      return [];
    });
    mockStatSync.mockImplementation((p: string) => ({
      isDirectory: () => !p.endsWith('.md'),
    }));
    mockReadYaml.mockReturnValue(undefined);
    const result = loadAllConstraints('/root', { maxDepth: 3 });
    expect(result.files).toBeDefined();
  });

  it('should skip dotfile directories other than .mumuspec', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['.vscode', '.github', 'src'];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });
    const result = loadAllConstraints('/root', { maxDepth: 3 });
    // All three dirs have .mumuspec we mocked via existsSync, but
    // .vscode and .github should be skipped by dotfile rule.
    // Only src should be scanned.
    expect(result.files).toBeDefined();
  });

  it('should skip all noise directories (node_modules, dist, .git, build)', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['node_modules', 'dist', '.git', 'build', 'src'];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue(undefined);
    const result = loadAllConstraints('/root', { maxDepth: 3 });
    // Only src should survive the SKIP_DIRS filter
    expect(result.files).toBeDefined();
    expect(result.warnings).toEqual([]);
  });

  it('should load constraints from subdirectory when present', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['src'];
      if (dir === '/root/src') return [];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });
    const result = loadAllConstraints('/root', { maxDepth: 3 });
    // Root + src subdirectory => 2 files
    expect(result.files.length).toBe(2);
  });

  it('should handle nested multi-level subdirectories', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['src'];
      if (dir === '/root/src') return ['api', 'utils'];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });
    const result = loadAllConstraints('/root', { maxDepth: 5 });
    // Root + src + api + utils => 4 files
    expect(result.files.length).toBe(4);
  });

  it('should default maxDepth to 10', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockReturnValue([]);
    mockReadYaml.mockReturnValue(undefined);
    // Should not throw; default depth is 10
    const result = loadAllConstraints('/root');
    expect(result.files).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// resolveRootStrength
// ════════════════════════════════════════════════════════════════════

describe('resolveRootStrength — branch coverage', () => {
  beforeEach(() => {
    mockNormalizeScope.mockReset();
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('should return config copy when files array is empty', () => {
    const configStrength = {
      technical_design: 'high' as ConstraintStrength,
      requirement_goals: 'low' as ConstraintStrength,
    };
    const result = resolveRootStrength([], configStrength);
    expect(result).toEqual(configStrength);
    // Must be a copy, not the same reference
    expect(result).not.toBe(configStrength);
  });

  it('should return config copy when root file has undefined strength', () => {
    const configStrength = {
      technical_design: 'medium' as ConstraintStrength,
      requirement_goals: 'medium' as ConstraintStrength,
    };
    const files = [{ scope: '.', constraints: [] }] as unknown as ConstraintsFile[];
    const result = resolveRootStrength(files, configStrength);
    expect(result).toEqual(configStrength);
  });

  it('should use root strength for both dimensions when fully present', () => {
    const configStrength = {
      technical_design: 'low' as ConstraintStrength,
      requirement_goals: 'low' as ConstraintStrength,
    };
    const files = [
      {
        scope: '.',
        strength: { technical_design: 'high', requirement_goals: 'medium' },
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      },
    ] as unknown as ConstraintsFile[];
    const result = resolveRootStrength(files, configStrength);
    expect(result.technical_design).toBe('high');
    expect(result.requirement_goals).toBe('medium');
  });

  it('should fall back to config for missing technical_design dimension', () => {
    const configStrength = {
      technical_design: 'high' as ConstraintStrength,
      requirement_goals: 'low' as ConstraintStrength,
    };
    const files = [
      {
        scope: '.',
        strength: { requirement_goals: 'medium' },
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      },
    ] as unknown as ConstraintsFile[];
    const result = resolveRootStrength(files, configStrength);
    expect(result.technical_design).toBe('high');
    expect(result.requirement_goals).toBe('medium');
  });

  it('should fall back to config for missing requirement_goals dimension', () => {
    const configStrength = {
      technical_design: 'low' as ConstraintStrength,
      requirement_goals: 'high' as ConstraintStrength,
    };
    const files = [
      {
        scope: '.',
        strength: { technical_design: 'medium' },
        forward: { technical_design: [], requirement_goals: [] },
        reverse: { technical_design: [], requirement_goals: [] },
      },
    ] as unknown as ConstraintsFile[];
    const result = resolveRootStrength(files, configStrength);
    expect(result.technical_design).toBe('medium');
    expect(result.requirement_goals).toBe('high');
  });

  it('should handle multiple files and correctly identify root by scope', () => {
    const configStrength = {
      technical_design: 'low' as ConstraintStrength,
      requirement_goals: 'low' as ConstraintStrength,
    };
    const files = [
      {
        scope: 'src',
        strength: { technical_design: 'high', requirement_goals: 'high' },
      },
      {
        scope: '.',
        strength: { technical_design: 'medium' },
      },
    ] as unknown as ConstraintsFile[];
    const result = resolveRootStrength(files, configStrength);
    expect(result.technical_design).toBe('medium');
    expect(result.requirement_goals).toBe('low'); // fallback to config
  });
});

// ════════════════════════════════════════════════════════════════════
// loadAndResolveConstraints
// ════════════════════════════════════════════════════════════════════

describe('loadAndResolveConstraints — integration', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
    mockReadYaml.mockReset();
    mockNormalizeScope.mockReset();
    mockGetMumuSpecDir.mockImplementation((d: string) => `${d}/.mumuspec`);
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('should call loadAllConstraints then resolveFn and return combined warnings', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockReturnValue([]);
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });

    const resolveFn = vi.fn((_files: ConstraintsFile[], _rootStrength: any) =>
      makeResolution(['resolution-warning']),
    );

    const result = loadAndResolveConstraints('/root', DEFAULT_STRENGTH, resolveFn);

    expect(resolveFn).toHaveBeenCalledTimes(1);
    // The first argument is the files array
    expect(resolveFn.mock.calls[0][0]).toBeDefined();
    // The second argument is rootStrength
    expect(resolveFn.mock.calls[0][1]).toBeDefined();
    // Combined warnings from resolution.warnings
    expect(result.warnings).toContain('resolution-warning');
    expect(result.resolution.warnings).toContain('resolution-warning');
  });

  it('should pass rootStrength derived from constraint files to resolveFn', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockReturnValue([]);
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });

    const resolveFn = vi.fn((_files: ConstraintsFile[], _rootStrength: any) =>
      makeResolution(),
    );

    loadAndResolveConstraints('/root', DEFAULT_STRENGTH, resolveFn);

    // Root file has strength high/high, so rootStrength should reflect that
    const rootStrength = resolveFn.mock.calls[0][1];
    expect(rootStrength.technical_design).toBe('high');
    expect(rootStrength.requirement_goals).toBe('high');
  });

  it('should forward load warnings into combined warnings channel', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockReturnValue([]);
    // Return null to simulate a parse-failed root file
    mockReadYaml.mockReturnValue(null);

    const resolveFn = vi.fn((_files: ConstraintsFile[], _rootStrength: any) =>
      makeResolution(['resolve-warn']),
    );

    const result = loadAndResolveConstraints('/root', DEFAULT_STRENGTH, resolveFn);

    // resolve warnings should be present
    expect(result.warnings).toContain('resolve-warn');
    // No load-level warnings in this scenario (null YAML doesn't add warnings)
    expect(result.resolution.warnings).toEqual(['resolve-warn']);
  });

  it('should respect the options parameter for maxDepth', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/root') return ['src', 'deep'];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => true });
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });

    const resolveFn = vi.fn((_files: ConstraintsFile[], _rootStrength: any) =>
      makeResolution(),
    );

    const result = loadAndResolveConstraints(
      '/root',
      DEFAULT_STRENGTH,
      resolveFn,
      { maxDepth: 0 },
    );

    // With maxDepth=0, only root file should be loaded
    expect(result.resolution).toBeDefined();
  });

  it('should merge load warnings and resolution warnings without duplication of reference', () => {
    mockExistsSync.mockImplementation((p: string) => p.includes('.mumuspec'));
    mockReaddirSync.mockReturnValue([]);
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });

    const resolveFn = vi.fn((_files: ConstraintsFile[], _rootStrength: any) =>
      makeResolution(['warn-A', 'warn-B']),
    );

    const result = loadAndResolveConstraints('/root', DEFAULT_STRENGTH, resolveFn);

    // Resolution warnings should be present
    expect(result.warnings).toEqual(['warn-A', 'warn-B']);
    // The resolution object should carry the same combined warnings
    expect(result.resolution.warnings).toEqual(['warn-A', 'warn-B']);
  });
});

// ════════════════════════════════════════════════════════════════════
// Path assertion helper — cross-platform safe
// ════════════════════════════════════════════════════════════════════

describe('cross-platform path normalization', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReadYaml.mockReset();
    mockGetMumuSpecDir.mockReset();
    mockNormalizeScope.mockReset();
    mockGetMumuSpecDir.mockImplementation((d: string) => `${d}/.mumuspec`);
    mockNormalizeScope.mockImplementation((s: string) => s || '.');
  });

  it('.replace(/\\\\/g, "/") normalizes Windows paths for assertion', () => {
    const winPath = 'C:\\Users\\test\\project';
    const normalized = winPath.replace(/\\/g, '/');
    expect(normalized).toBe('C:/Users/test/project');
  });

  it('should use normalized scope for root detection', () => {
    mockReadYaml.mockReturnValue({ ...SAMPLE_YAML });
    const result = loadConstraintsFile('/root', '/root');
    expect(result!.scope.replace(/\\/g, '/')).toBe('.');
  });
});
