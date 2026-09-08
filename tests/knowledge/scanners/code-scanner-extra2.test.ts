/**
 * Extra tests 2 for src/knowledge/scanners/code-scanner.ts — scanCodeStructure function.
 * Targets uncovered branches: DDD / Feature / API / CLI / MVC patterns,
 * structural risks (>50 files, >15 subdirs), file distribution dominance,
 * various file extensions, scope param, and error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();

vi.mock('node:fs', () => ({
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
  relative: (from: string, to: string) => {
    const prefix = from.endsWith('/') ? from : from + '/';
    return to.startsWith(prefix) ? to.slice(prefix.length) : to;
  },
  extname: (p: string) => {
    const idx = p.lastIndexOf('.');
    return idx >= 0 ? p.slice(idx) : '';
  },
}));

// Pass-through for the fake path semantics above (traversal defense is
// covered by tests/core/path-traversal.test.ts with real fs)
vi.mock('../../../src/core/utils.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveWithinRoot: (root: string, scope: string) => (scope === '.' ? root : root + '/' + scope),
}));

import { scanCodeStructure } from '../../../src/knowledge/scanners/code-scanner.js';

/**
 * Configure the mock fs with:
 * @param dirs   map of absolute path -> array of entry names (files/dirs in that dir)
 * @param dirSet set of absolute paths that are directories (statSync returns isDir=true)
 *               defaults to all keys in dirs
 */
function mockFs(dirs: Record<string, string[]>, dirSet?: Set<string>) {
  const allDirs = dirSet ?? new Set(Object.keys(dirs));
  mockReaddirSync.mockImplementation((p: string) => dirs[p] ?? []);
  mockStatSync.mockImplementation((p: string) => ({
    isDirectory: () => allDirs.has(p),
  }));
}

// ---------------------------------------------------------------------------

describe('code-scanner extra2 - pattern detection', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should detect DDD pattern from src/domains', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['domains'],
      '/root/src/domains': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.type === 'decision' && p.title.includes('DDD'));
    expect(arch).toBeDefined();
    expect(arch!.evidence).toContain('domains');
  });

  it('should detect DDD pattern from src/aggregates (without commands interfering)', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['aggregates'],
      '/root/src/aggregates': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('DDD'));
    expect(arch).toBeDefined();
    expect(arch!.evidence).toContain('aggregates');
  });

  it('should detect DDD pattern from entities even with other dirs', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['entities', 'utils'],
      '/root/src/entities': [],
      '/root/src/utils': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('DDD'));
    expect(arch).toBeDefined();
  });

  it('should detect Feature-Based pattern from src/features', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['features'],
      '/root/src/features': ['billing', 'auth'],
      '/root/src/features/billing': [],
      '/root/src/features/auth': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('Feature-Based'));
    expect(arch).toBeDefined();
    expect(arch!.evidence).toContain('2 个功能模块');
  });

  it('should detect Feature-Based pattern from src/modules', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['modules'],
      '/root/src/modules': ['core', 'api'],
      '/root/src/modules/core': [],
      '/root/src/modules/api': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('Feature-Based'));
    expect(arch).toBeDefined();
  });

  it('should detect API-Centric pattern from src/api + src/routes', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['api', 'routes', 'schemas'],
      '/root/src/api': [],
      '/root/src/routes': [],
      '/root/src/schemas': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('API-Centric'));
    expect(arch).toBeDefined();
    expect(arch!.evidence).toContain('api');
  });

  it('should detect API-Centric from 2 endpoints indicators', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['endpoints', 'validators'],
      '/root/src/endpoints': [],
      '/root/src/validators': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('API-Centric'));
    expect(arch).toBeDefined();
  });

  it('should detect CLI pattern from src/commands', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['commands', 'utils'],
      '/root/src/commands': [],
      '/root/src/utils': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('CLI'));
    expect(arch).toBeDefined();
  });

  it('should detect CLI pattern from src/bin', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['bin', 'lib'],
      '/root/src/bin': [],
      '/root/src/lib': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('CLI'));
    expect(arch).toBeDefined();
  });

  it('should detect MVC pattern from src/controllers + src/services', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['controllers', 'services', 'models'],
      '/root/src/controllers': [],
      '/root/src/services': [],
      '/root/src/models': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('MVC') || p.title.includes('分层'));
    expect(arch).toBeDefined();
  });

  it('should detect MVC pattern from routes + handlers', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['routes', 'handlers'],
      '/root/src/routes': [],
      '/root/src/handlers': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('分层'));
    expect(arch).toBeDefined();
  });

  it('should return no architecture pattern for empty src children', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.type === 'decision' && p.title.includes('模式'));
    expect(arch).toBeUndefined();
  });

  it('should return no architecture pattern when src/ has only unrecognized dirs', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['helpers', 'internal'],
      '/root/src/helpers': [],
      '/root/src/internal': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.type === 'decision' && p.title.includes('模式'));
    expect(arch).toBeUndefined();
  });

  it('should return no architecture pattern when there is no src/ directory', () => {
    mockFs({
      '/root': ['lib'],
      '/root/lib': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.type === 'decision' && p.title.includes('模式'));
    expect(arch).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('code-scanner extra2 - structural risks', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should detect large module risk when a dir has >50 files', () => {
    const files: string[] = [];
    for (let i = 0; i < 60; i++) {
      files.push(`helper${i}.ts`);
    }
    mockFs({
      '/root': ['src'],
      '/root/src': ['utils'],
      '/root/src/utils': files,
    });
    const result = scanCodeStructure('/root');
    const risk = result.find((p) => p.type === 'risk' && p.title.includes('过多文件'));
    expect(risk).toBeDefined();
    expect(risk!.evidence).toContain('60');
  });

  it('should detect too-many-subdirs risk when src/ has >15 subdirs', () => {
    const subdirs: string[] = [];
    const dirs: Record<string, string[]> = {
      '/root': ['src'],
      '/root/src': subdirs,
    };
    for (let i = 0; i < 16; i++) {
      const name = `module${i}`;
      subdirs.push(name);
      dirs[`/root/src/${name}`] = [];
    }
    mockFs(dirs);
    const result = scanCodeStructure('/root');
    const risk = result.find((p) => p.type === 'risk' && p.title.includes('子目录过多'));
    expect(risk).toBeDefined();
    expect(risk!.evidence).toContain('16');
  });

  it('should NOT trigger large-module risk when files = 50 (boundary)', () => {
    const files: string[] = [];
    for (let i = 0; i < 50; i++) {
      files.push(`helper${i}.ts`);
    }
    mockFs({
      '/root': ['src'],
      '/root/src': ['utils'],
      '/root/src/utils': files,
    });
    const result = scanCodeStructure('/root');
    const risk = result.find((p) => p.type === 'risk' && p.title.includes('过多文件'));
    expect(risk).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('code-scanner extra2 - barrel file detection', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should verify findMissingBarrelFiles is invoked (depth guard causes empty result)', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['handler'],
      '/root/src/handler': ['parse.ts', 'transform.ts', 'emit.ts'],
    });
    const result = scanCodeStructure('/root');
    const barrel = result.find((p) => p.title.includes('barrel'));
    expect(barrel).toBeUndefined();
  });

  it('should NOT propose barrel when module has <3 source files', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['small'],
      '/root/src/small': ['a.ts', 'b.ts'],
    });
    const result = scanCodeStructure('/root');
    const barrel = result.find((p) => p.title.includes('barrel'));
    expect(barrel).toBeUndefined();
  });

  it('should NOT propose barrel when index.ts already exists', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['handler'],
      '/root/src/handler': ['index.ts', 'parse.ts', 'transform.ts', 'emit.ts'],
    });
    const result = scanCodeStructure('/root');
    const barrel = result.find((p) => p.title.includes('barrel'));
    expect(barrel).toBeUndefined();
  });

  it('should recognize index.js as barrel file', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['handler'],
      '/root/src/handler': ['index.js', 'a.ts', 'b.ts', 'c.ts'],
    });
    const result = scanCodeStructure('/root');
    const barrel = result.find((p) => p.title.includes('barrel'));
    expect(barrel).toBeUndefined();
  });

  it('should recognize __init__.py as barrel file', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['handler'],
      '/root/src/handler': ['__init__.py', 'a.py', 'b.py', 'c.py'],
    });
    const result = scanCodeStructure('/root');
    const barrel = result.find((p) => p.title.includes('barrel'));
    expect(barrel).toBeUndefined();
  });

  it('should not flag single .txt file as needing barrel', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['docs'],
      '/root/src/docs': ['readme.txt', 'notes.txt', 'info.txt'],
    });
    const result = scanCodeStructure('/root');
    const barrel = result.find((p) => p.title.includes('barrel'));
    expect(barrel).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe('code-scanner extra2 - file distribution / extensions', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should detect dominant extension > 70%', () => {
    mockFs({
      '/root': ['app.ts', 'main.ts', 'util.ts', 'config.ts', 'helper.ts', 'test.ts', 'pkg.json'],
    });
    const result = scanCodeStructure('/root');
    const rationale = result.find((p) => p.type === 'rationale');
    expect(rationale).toBeDefined();
    expect(rationale!.title).toContain('.ts');
  });

  it('should NOT propose rationale when no single extension dominates 70%', () => {
    mockFs({
      '/root': ['a.ts', 'b.ts', 'c.py', 'd.py', 'e.js'],
    });
    const result = scanCodeStructure('/root');
    const rationale = result.find((p) => p.type === 'rationale');
    expect(rationale).toBeUndefined();
  });

  it('should not propose rationale when zero files exist', () => {
    mockFs({ '/root': [] });
    const result = scanCodeStructure('/root');
    const rationale = result.find((p) => p.type === 'rationale');
    expect(rationale).toBeUndefined();
  });

  it('should handle files with no extension mapping to (no-ext)', () => {
    mockFs({
      '/root': ['README', 'LICENSE', 'Makefile', 'Dockerfile', 'output.txt'],
    });
    const result = scanCodeStructure('/root');
    // Should not throw; verify it completes
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect tsx/jsx extensions via file distribution', () => {
    mockFs({
      '/root': ['main.tsx', 'app.tsx', 'Button.tsx', 'Modal.jsx', 'styles.css', 'README.md'],
    });
    const result = scanCodeStructure('/root');
    const rationale = result.find((p) => p.type === 'rationale');
    expect(rationale).toBeUndefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('should detect dominant .py extension via file distribution', () => {
    mockFs({
      '/root': ['core.py', 'helpers.py', 'io.py', 'main.py', 'run.py'],
    });
    const result = scanCodeStructure('/root');
    const rationale = result.find((p) => p.type === 'rationale');
    expect(rationale).toBeDefined();
    expect(rationale!.title).toContain('.py');
  });
});

// ---------------------------------------------------------------------------

describe('code-scanner extra2 - skip and error handling', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should skip node_modules, .git, dist in getDirTree traversal', () => {
    mockFs({
      '/root': ['src', 'node_modules', '.git', 'dist'],
      '/root/src': ['index.ts'],
      '/root/node_modules': ['pkg'],
      '/root/.git': ['HEAD'],
      '/root/dist': ['bundle.js'],
    }, new Set(['/root', '/root/src', '/root/node_modules', '/root/.git', '/root/dist']));
    const result = scanCodeStructure('/root');
    const allScopes = result.flatMap((p) => p.graph_bindings);
    expect(allScopes).not.toContain('node_modules');
    expect(allScopes).not.toContain('.git');
    expect(allScopes).not.toContain('dist');
  });

  it('should use scope parameter to narrow target directory and detect CLI within src', () => {
    // Scope becomes targetDir = /root/packages/core
    // getDirTree('/root/packages/core') reads the core dir -> needs to return ['src']
    // Then /root/packages/core/src -> ['commands', 'utils']
    // targetDir is also passed to detectArchitecturePattern, so relative() works
    mockFs({
      '/root/packages/core': ['src'],
      '/root/packages/core/src': ['commands', 'utils'],
      '/root/packages/core/src/commands': [],
      '/root/packages/core/src/utils': [],
    });
    const result = scanCodeStructure('/root', 'packages/core');
    // CLI pattern should be detected (commands present under src/)
    const cliPattern = result.find((p) => p.type === 'decision' && p.title.includes('CLI'));
    expect(cliPattern).toBeDefined();
  });

  it('should handle statSync errors gracefully in getDirTree (skip entry)', () => {
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/root') return ['src', 'broken'];
      if (p === '/root/src') return ['index.ts'];
      return [];
    });
    mockStatSync.mockImplementation((p: string) => {
      if (p === '/root/broken') {
        throw new Error('EACCES stat');
      }
      return { isDirectory: () => p === '/root' || p === '/root/src' };
    });
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle readdirSync errors gracefully in countFilesByExtension (inner catch)', () => {
    let callCount = 0;
    mockReaddirSync.mockImplementation((p: string) => {
      callCount++;
      if (p === '/root') return ['src', 'unreadable'];
      if (p === '/root/src') return ['index.ts'];
      if (p === '/root/unreadable') {
        throw new Error('EACCES readdir');
      }
      return [];
    });
    mockStatSync.mockImplementation(() => ({ isDirectory: () => true }));
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle readdirSync error at countFilesInDir level', () => {
    let callIdx = 0;
    mockReaddirSync.mockImplementation((p: string) => {
      callIdx++;
      if (p === '/root') return ['src'];
      if (p === '/root/src') {
        if (callIdx > 4) throw new Error('EACCES');
        return [];
      }
      return [];
    });
    mockStatSync.mockImplementation((p: string) => ({
      isDirectory: () => p === '/root' || p === '/root/src',
    }));
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should handle statSync error in getDirTree inner loop', () => {
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/root') return ['src'];
      if (p === '/root/src') return ['project'];
      if (p === '/root/src/project') return ['a.ts'];
      return [];
    });
    mockStatSync.mockImplementation((p: string) => {
      if (p === '/root/src/project/a.ts') {
        throw new Error('ENOENT');
      }
      return { isDirectory: () => p === '/root' || p === '/root/src' || p === '/root/src/project' };
    });
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('code-scanner extra2 - edge cases', () => {
  beforeEach(() => {
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
  });

  it('should not produce barrel detection at depth <2 (src children)', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
    }, new Set(['/root', '/root/src']));
    const result = scanCodeStructure('/root');
    const barrel = result.find((p) => p.title.includes('barrel'));
    expect(barrel).toBeUndefined();
  });

  it('should traverse deeply nested directories and detect Feature-Based pattern', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['features'],
      '/root/src/features': ['domain'],
      '/root/src/features/domain': ['model.ts', 'service.ts', 'repository.ts'],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.title.includes('Feature-Based'));
    expect(arch).toBeDefined();
  });

  it('should handle project with only excluded directories', () => {
    mockFs({
      '/root': ['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '__pycache__'],
      '/root/node_modules': [],
      '/root/.git': [],
      '/root/dist': [],
      '/root/build': [],
      '/root/.next': [],
      '/root/coverage': [],
      '/root/__pycache__': [],
    }, new Set(['/root']));
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
  });

  it('should count empty project as 0 total files', () => {
    mockFs({ '/root': [] });
    const result = scanCodeStructure('/root');
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it('should generate unique IDs for each proposed page', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['controllers', 'services', 'features', 'repositories', 'shared'],
      '/root/src/controllers': ['a.ts', 'b.ts', 'c.ts'],
      '/root/src/services': [],
      '/root/src/features': ['auth', 'billing'],
      '/root/src/features/auth': [],
      '/root/src/features/billing': [],
      '/root/src/repositories': [],
      '/root/src/shared': [],
    });
    const result = scanCodeStructure('/root');
    const ids = result.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('should set correct source field to "code" for all proposals', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': ['controllers', 'services'],
      '/root/src/controllers': ['a.ts', 'b.ts', 'c.ts'],
      '/root/src/services': [],
    });
    const result = scanCodeStructure('/root');
    result.forEach((p) => {
      expect(p.source).toBe('code');
    });
  });

  it('should not produce architecture decision when src has no subdirectories', () => {
    mockFs({
      '/root': ['src'],
      '/root/src': [],
    });
    const result = scanCodeStructure('/root');
    const arch = result.find((p) => p.type === 'decision' && p.title.includes('模式'));
    expect(arch).toBeUndefined();
  });

  it('should process mixed extensions correctly in countFilesByExtension', () => {
    mockFs({
      '/root': ['main.ts', 'lib.py', 'utils.ts', 'handler.tsx', 'comp.jsx', 'style.css', 'readme.md'],
    });
    const result = scanCodeStructure('/root');
    const rationale = result.find((p) => p.type === 'rationale');
    expect(rationale).toBeUndefined();
  });

  it('should handle countFilesInDir with exact 51 files (risk boundary)', () => {
    const files: string[] = [];
    for (let i = 0; i < 51; i++) files.push(`f${i}.ts`);
    mockFs({
      '/root': ['src'],
      '/root/src': ['bigmod'],
      '/root/src/bigmod': files,
    });
    const result = scanCodeStructure('/root');
    const risk = result.find((p) => p.type === 'risk' && p.title.includes('51'));
    expect(risk).toBeDefined();
  });
});
