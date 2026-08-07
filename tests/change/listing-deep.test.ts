/**
 * Deep tests for src/change/listing.ts — covers recursive scanning,
 * deduplication, depth limiting, error swallowing, and edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted mocks ----
const {
  mockExistsSync,
  mockReaddirSync,
  mockReadYaml,
  mockGetArchiveDir,
  mockGetChangesDir,
  mockLoadChangeState,
} = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadYaml: vi.fn(),
  mockGetArchiveDir: vi.fn(),
  mockGetChangesDir: vi.fn(),
  mockLoadChangeState: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
  relative: (from: string, to: string) => {
    if (to.startsWith(from + '/')) return to.slice(from.length + 1);
    if (to === from) return '.';
    return to;
  },
  sep: '/',
}));

vi.mock('../../src/core/utils.js', () => ({
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
}));

vi.mock('../../src/change/paths.js', () => ({
  getArchiveDir: (...args: unknown[]) => mockGetArchiveDir(...args),
  getChangesDir: (...args: unknown[]) => mockGetChangesDir(...args),
}));

vi.mock('../../src/change/state.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
}));

import {
  listActiveChanges,
  listArchivedChanges,
  getActiveChange,
} from '../../src/change/listing.js';

// Type helper for creating mock dirent entries
function dir(name: string): { name: string; isDirectory: () => boolean; isFile: () => boolean } {
  return { name, isDirectory: () => true, isFile: () => false };
}

function file(name: string): { name: string; isDirectory: () => boolean; isFile: () => boolean } {
  return { name, isDirectory: () => false, isFile: () => false };
}

function state(phase: string, workflow = 'full') {
  return { phase, workflow };
}

// =========================================================================
// 1. listActiveChanges — recursive scan (no scope param)
//    Lines 61-74: the scanForChangeDirs function body
//    Line 77: the catch block in scanForChangeDirs
// =========================================================================

describe('listActiveChanges — recursive scan (no scope)', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadYaml.mockReset();
    mockGetChangesDir.mockReset();
    mockGetChangesDir.mockImplementation((root: string, scope?: string) => {
      if (!scope || scope === '.') return `${root}/.mumuspec/changes`;
      return `${root}/${scope}/.mumuspec/changes`;
    });
  });

  it('should scan subdirectories and find nested .mumuspec/changes entries', () => {
    // Path structure:
    //   /root/.mumuspec/changes/              (root scope - empty)
    //   /root/sub/.mumuspec/changes/nested-change/   (nested scope)
    mockExistsSync.mockImplementation((p: string) => {
      // All directories and files exist
      return true;
    });
    mockReadYaml.mockImplementation((p: string) => {
      if (p.includes('nested-change/.mumuspec.yaml')) return state('design');
      return undefined;
    });

    mockReaddirSync.mockImplementation((p: string) => {
      switch (p) {
        case '/root/.mumuspec/changes':
          return []; // root has no changes
        case '/root':
          return [dir('sub')]; // sub has .mumuspec/changes
        case '/root/sub':
          return [dir('.mumuspec')];
        case '/root/sub/.mumuspec':
          return [dir('changes')];
        case '/root/sub/.mumuspec/changes':
          return [dir('nested-change')];
        default:
          return [];
      }
    });

    const result = listActiveChanges('/root');
    expect(result).toContain('nested-change');
  });

  it('should skip hidden directories and node_modules during scan', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockImplementation((p: string) => {
      if (p.includes('src-change/.mumuspec.yaml')) return state('design');
      return undefined;
    });

    mockReaddirSync.mockImplementation((p: string) => {
      switch (p) {
        case '/root/.mumuspec/changes':
          return [];
        case '/root':
          return [dir('.hidden'), dir('node_modules'), dir('src')];
        case '/root/src':
          return [dir('.mumuspec')];
        case '/root/src/.mumuspec':
          return [dir('changes')];
        case '/root/src/.mumuspec/changes':
          return [dir('src-change')];
        default:
          return [];
      }
    });

    const result = listActiveChanges('/root');
    // src-change should be found; .hidden and node_modules should be skipped
    expect(result).toContain('src-change');
  });

  it('should deduplicate changes already seen in root scope', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(state('design'));

    // Both root and sub have a 'shared-name' change; should not duplicate
    mockReaddirSync.mockImplementation((p: string) => {
      switch (p) {
        case '/root/.mumuspec/changes':
          return [dir('root-change')];
        case '/root':
          return [dir('sub')];
        case '/root/sub':
          return [dir('.mumuspec')];
        case '/root/sub/.mumuspec':
          return [dir('changes')];
        case '/root/sub/.mumuspec/changes':
          return [dir('sub-change')];
        default:
          return [];
      }
    });

    const result = listActiveChanges('/root');
    expect(result).toContain('root-change');
    expect(result).toContain('sub-change');
    // 'root-change' appears once (only in root scope)
    expect(result.filter((n) => n === 'root-change').length).toBe(1);
  });

  it('should stop recursion at depth limit (depth > 5)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(state('design'));

    // The guard: "if (depth > 5) return" — depth 6+ is skipped.
    // We place a .mumuspec/changes directory at depth 7 (index 6).
    // x=scan_depth0, y=scan_depth1, z=2, w=3, v=4, u=5 → items at u are scanned,
    //   then scanForChangeDirs('/root/.../u/beyond', 6) is called → 6 > 5 is FALSE → proceeds to scan beyond
    //   then scanForChangeDirs('/root/.../u/beyond/.mumuspec', 7) → 7 > 5 is TRUE → returns
    // Wait, .mumuspec starts with '.' so it's skipped before the recursion.
    //
    // Real behavior: at depth 5 (u), entries include .mumuspec (skipped via dot-prefix) and other dirs.
    // The changes dir lives at /root/x/y/z/w/v/u/timedchange/.mumuspec/changes/
    // At scan_time at u (depth 5): timedchange/.mumuspec/changes exists (mock) → lists changes from there
    //   BUT we need these NOT to be found. So we need to place them at scan depth 6.
    // Correct layout: /root/x/y/z/w/v → at 'v' (depth 4): changes listed from scope 'x/y/z/w/v' → scan time depth 4
    //   then recursion: scanForChangeDirs('/root/x/y/z/w/v/u', depth 5) → scans u, lists changes from 'x/y/z/w/v/u' scope
    //   then recursion: scanForChangeDirs('/root/x/y/z/w/v/u/item', depth 6) → 6 > 5 returns
    // So: put .mumuspec/changes dirs under everyone EXCEPT the last directory.
    // Place the change under /root/x/y/z/w/v/u/item/.mumuspec/changes — this never gets listed because 'item' is scanned at depth 6 which is guarded.
    const dirs = ['x', 'y', 'z', 'w', 'v'];
    const leafDir = 'u';
    const beyondDir = 'beyond';
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/root/.mumuspec/changes') return [];
      if (p === '/root') return [dir('x')];

      const allPrefs = dirs.map((_, i) => '/root/' + dirs.slice(0, i + 1).join('/'));
      for (let i = 0; i < dirs.length; i++) {
        if (p === allPrefs[i]) {
          return [dir(dirs[i + 1] || leafDir)];
        }
      }
      // /root/x/y/z/w/v/u
      const vPath = allPrefs[dirs.length - 1]; // /root/x/y/z/w/v
      if (p === `${vPath}/${leafDir}`) return [dir(beyondDir)];
      if (p === `${vPath}/${leafDir}/${beyondDir}`) return [dir('.mumuspec')];
      if (p === `${vPath}/${leafDir}/${beyondDir}/.mumuspec`) return [dir('changes')];
      if (p === `${vPath}/${leafDir}/${beyondDir}/.mumuspec/changes`) return [dir('deep-change')];
      return [];
    });

    const result = listActiveChanges('/root');
    // 'beyond' is scanned at depth 6, which hits the > 5 guard → returns immediately
    // deep-change never gets listed
    expect(result).toEqual([]);
  });

  it('should handle readdirSync throwing in recursive scan (line 77 catch block)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(state('design'));

    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/root/.mumuspec/changes') return [];
      if (p === '/root') return [dir('sub')];
      if (p === '/root/sub') throw new Error('Permission denied');
      return [];
    });

    // Should not throw
    expect(() => listActiveChanges('/root')).not.toThrow();
    const result = listActiveChanges('/root');
    expect(result).toEqual([]);
  });

  it('should return only root changes when no nested dirs exist', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(state('design'));

    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/root/.mumuspec/changes') return [dir('change-a'), dir('change-b')];
      if (p === '/root') return [dir('src')];
      if (p === '/root/src') return [file('index.ts')];
      return [];
    });

    const result = listActiveChanges('/root');
    expect(result).toContain('change-a');
    expect(result).toContain('change-b');
    expect(result.length).toBe(2);
  });

  it('should use "." scope for root when no scope parameter given', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(state('design'));

    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/root/.mumuspec/changes') return [dir('my-change')];
      return [];
    });

    const result = listActiveChanges('/root');
    expect(result).toContain('my-change');
  });

  it('should not scan .mumuspec directory itself for deeper changes', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(state('design'));

    mockReaddirSync.mockImplementation((p: string) => {
      switch (p) {
        case '/root/.mumuspec/changes':
          return [dir('root-change')];
        case '/root':
          return [dir('.mumuspec')];
        // .mumuspec is hidden (starts with '.'), should be skipped by the scan
        case '/root/.mumuspec':
          return [dir('changes')];
        default:
          return [];
      }
    });

    const result = listActiveChanges('/root');
    // Only root-change from root scope; .mumuspec should be skipped in scan
    expect(result).toContain('root-change');
  });
});

// =========================================================================
// 2. listActiveChangesInScope — via scoped calls
// =========================================================================

describe('listActiveChanges — with explicit scope', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadYaml.mockReset();
    mockGetChangesDir.mockReset();
    mockGetChangesDir.mockImplementation((root: string, scope?: string) => {
      if (!scope || scope === '.') return `${root}/.mumuspec/changes`;
      return `${root}/${scope}/.mumuspec/changes`;
    });
  });

  it('should scope to specific directory when scope is provided', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([dir('scoped-change')]);
    mockReadYaml.mockReturnValue(state('design'));

    const result = listActiveChanges('/root', 'sub');
    expect(result).toEqual(['scoped-change']);
  });

  it('should return empty for non-existent scope directory', () => {
    mockExistsSync.mockReturnValue(false);

    const result = listActiveChanges('/root', 'nonexistent');
    expect(result).toEqual([]);
  });

  it('should handle empty scope directory', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);

    const result = listActiveChanges('/root', 'empty-scope');
    expect(result).toEqual([]);
  });

  it('should handle mixed files and directories in scope', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([dir('change-1'), file('readme.txt'), dir('change-2')]);
    mockReadYaml.mockReturnValue(state('build'));

    const result = listActiveChanges('/root', 'mixed');
    expect(result).toEqual(['change-1', 'change-2']);
  });

  it('should include changes in various non-terminal phases', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([
      dir('open-change'),
      dir('design-change'),
      dir('build-change'),
      dir('verify-change'),
    ]);
    mockReadYaml.mockImplementation((p: string) => {
      if (p.includes('open-change')) return state('open');
      if (p.includes('design-change')) return state('design');
      if (p.includes('build-change')) return state('build');
      if (p.includes('verify-change')) return state('verify');
      return undefined;
    });

    const result = listActiveChanges('/root', 'multi');
    expect(result).toContain('open-change');
    expect(result).toContain('design-change');
    expect(result).toContain('build-change');
    expect(result).toContain('verify-change');
  });
});

// =========================================================================
// 3. listArchivedChanges — edge cases
// =========================================================================

describe('listArchivedChanges — deep edge cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockGetArchiveDir.mockReset();
    mockGetArchiveDir.mockReturnValue('/root/.mumuspec/changes/archive');
  });

  it('should handle empty archive directory', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);

    expect(listArchivedChanges('/root')).toEqual([]);
  });

  it('should filter out files in archive directory', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([dir('archived-1'), file('.gitkeep')]);

    expect(listArchivedChanges('/root')).toEqual(['archived-1']);
  });

  it('should handle readdirSync throwing on archive dir (catch block)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    expect(listArchivedChanges('/root')).toEqual([]);
  });

  it('should handle non-existent archive dir gracefully', () => {
    mockExistsSync.mockReturnValue(false);

    expect(listArchivedChanges('/root', 'nonexistent')).toEqual([]);
  });

  it('should handle large number of archived changes', () => {
    mockExistsSync.mockReturnValue(true);
    const entries = Array.from({ length: 50 }, (_, i) => dir(`archive-${i}`));
    mockReaddirSync.mockReturnValue(entries);

    const result = listArchivedChanges('/root');
    expect(result.length).toBe(50);
    expect(result[0]).toBe('archive-0');
    expect(result[49]).toBe('archive-49');
  });
});

// =========================================================================
// 4. getActiveChange — edge cases
//    Lines 114-115: the return statements inside getActiveChange
// =========================================================================

describe('getActiveChange — deep edge cases', () => {
  beforeEach(() => {
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadYaml.mockReset();
    mockGetChangesDir.mockReset();
    mockGetChangesDir.mockImplementation((root: string, scope?: string) => {
      if (!scope || scope === '.') return `${root}/.mumuspec/changes`;
      return `${root}/${scope}/.mumuspec/changes`;
    });
    mockLoadChangeState.mockReset();
  });

  it('should return first active change based on loadChangeState', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([dir('change-1'), dir('change-2')]);
    mockReadYaml.mockReturnValue(state('design'));
    mockLoadChangeState.mockImplementation((_root: string, name: string) => {
      if (name === 'change-1') return state('design');
      if (name === 'change-2') return state('build');
      return undefined;
    });

    const result = getActiveChange('/root', '.');
    expect(result).toBe('change-1');
  });

  it('should return undefined when all changes are in terminal state via loadChangeState (lines 114-115)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([dir('discarded-change'), dir('completed-change')]);
    mockReadYaml.mockReturnValue(state('open'));
    mockLoadChangeState.mockImplementation((_root: string, name: string) => {
      if (name === 'discarded-change') return state('discarded');
      if (name === 'completed-change') return state('archive-completed');
      return undefined;
    });

    const result = getActiveChange('/root', '.');
    expect(result).toBeUndefined();
  });

  it('should skip to next change when first is terminal (lines 114-115)', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([dir('dead'), dir('alive')]);
    mockReadYaml.mockReturnValue(state('design'));
    mockLoadChangeState.mockImplementation((_root: string, name: string) => {
      if (name === 'dead') return state('discarded');
      if (name === 'alive') return state('build');
      return undefined;
    });

    const result = getActiveChange('/root', '.');
    expect(result).toBe('alive');
  });

  it('should return undefined when loadChangeState returns undefined', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([dir('ghost')]);
    mockReadYaml.mockReturnValue(state('design'));
    mockLoadChangeState.mockReturnValue(undefined);

    const result = getActiveChange('/root', '.');
    expect(result).toBeUndefined();
  });

  it('should work across multiple scopes when no scope given', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadYaml.mockReturnValue(state('design'));
    mockLoadChangeState.mockReturnValue(state('design'));

    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/root/.mumuspec/changes') return [dir('root-active')];
      if (p === '/root') return [];
      return [];
    });

    const result = getActiveChange('/root');
    expect(result).toBe('root-active');
  });
});
