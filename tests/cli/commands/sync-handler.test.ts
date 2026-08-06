/**
 * Handler-level tests for sync command.
 *
 * Strategy: mock node:fs module and core/utils, then call executeSync directly
 * to test branch logic. Uses path-includes checks for Windows compatibility.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockExistsSync,
  mockReaddirSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockEnsureDir,
  mockNow,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockEnsureDir: vi.fn(),
  mockNow: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    ensureDir: mockEnsureDir,
    now: mockNow,
  };
});

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createDirent(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir, isFile: () => !isDir };
}

/** Normalize path separators to forward slashes for matching */
function norm(p: unknown): string {
  return String(p).replace(/\\/g, '/');
}

/** Mock src/ directory structure */
function mockSrcStructure(modules: { name: string; files: string[]; hasBoundary?: boolean; hasIndex?: boolean }[]): void {
  mockExistsSync.mockImplementation((filePath: string) => {
    const p = norm(filePath);
    // src/ directory itself
    if (p.endsWith('/src')) return true;
    if (p.endsWith('/.mumuspec/contracts/schemas')) return true;
    for (const mod of modules) {
      // Module directory
      if (p.endsWith(`/src/${mod.name}`)) return true;
      // Files within module
      if (mod.hasBoundary && p.endsWith(`/src/${mod.name}/BOUNDARY.md`)) return true;
      if (mod.hasIndex && p.endsWith(`/src/${mod.name}/index.ts`)) return true;
    }
    return false;
  });

  mockReaddirSync.mockImplementation((_path: string, options?: { withFileTypes?: boolean }) => {
    const p = norm(_path);
    if (p.endsWith('/src')) {
      if (options?.withFileTypes) {
        return modules.map((m) => createDirent(m.name, true));
      }
      return modules.map((m) => m.name);
    }
    for (const mod of modules) {
      if (p.endsWith(`/src/${mod.name}`)) {
        if (options?.withFileTypes) {
          return mod.files.map((f) => createDirent(f, false));
        }
        return mod.files;
      }
    }
    return [];
  });
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('sync command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockExistsSync.mockReset();
    mockReaddirSync.mockReset();
    mockReadFileSync.mockReset();
    mockWriteFileSync.mockReset();
    mockEnsureDir.mockReset();
    mockNow.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockNow.mockReturnValue('2026-01-15T10:30:00.000Z');
    // Default: no directories exist, readdirSync returns empty
    mockExistsSync.mockReturnValue(false);
    mockReaddirSync.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── src/ not found ──

  it('should report error when src/ directory not found', async () => {
    // existsSync already returns false by default

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', {});

    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'error', message: 'src/ directory not found' })
    );
  });

  // ── module filter ──

  it('should sync only the specified module with --module', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: true, hasIndex: true },
      { name: 'change', files: ['manager.ts'], hasBoundary: true, hasIndex: true },
    ]);

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', { module: 'core' });

    expect(result.modulesScanned).toBe(1);
  });

  // ── boundary creation ──

  it('should create BOUNDARY.md when module does not have one', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: false, hasIndex: true },
    ]);

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', {});

    expect(result.boundaryUpdated).toBe(1);
    expect(mockWriteFileSync).toHaveBeenCalledWith(
      expect.stringContaining('BOUNDARY.md'),
      expect.stringContaining('# BOUNDARY: core/'),
    );
  });

  it('should not create BOUNDARY.md in dry-run mode when missing', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: false, hasIndex: true },
    ]);

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', { check: true });

    // boundaryUpdated should be 0 in check mode (no writes)
    expect(result.boundaryUpdated).toBe(0);
  });

  // ── boundary validation with exports ──

  it('should report missing exports when BOUNDARY.md exists but incomplete', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: true, hasIndex: true },
    ]);
    mockReadFileSync.mockImplementation((filePath: string) => {
      const p = norm(filePath);
      if (p.endsWith('/BOUNDARY.md')) {
        return '# BOUNDARY: core/\n\n## 对外接口\n\n(empty)';
      }
      if (p.endsWith('.ts')) {
        return 'export function myFunc() {}\nexport class MyClass {}';
      }
      return '';
    });

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', {});

    const exportWarning = result.issues.find(
      (i) => i.message.includes('missing exports'),
    );
    expect(exportWarning).toBeDefined();
    expect(exportWarning!.module).toBe('core');
  });

  // ── index.yaml validation ──

  it('should report error when .mumuspec/index.yaml not found', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: true, hasIndex: true },
    ]);
    // Override: index.yaml does NOT exist
    mockExistsSync.mockImplementation((filePath: string) => {
      const p = norm(filePath);
      if (p.endsWith('/.mumuspec/index.yaml')) return false;
      if (p.endsWith('/src/core/BOUNDARY.md')) return true;
      if (p.endsWith('/src/core/index.ts')) return true;
      if (p.endsWith('/src/core')) return true;
      if (p.endsWith('/src')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('');

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', {});

    const indexError = result.issues.find(
      (i) => i.message === 'index.yaml not found',
    );
    expect(indexError).toBeDefined();
    expect(indexError!.severity).toBe('error');
  });

  // ── migration mode ──

  it('should detect old-format files in --migrate mode', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: true, hasIndex: true },
    ]);
    // Override: spec.yaml exists (old format)
    mockExistsSync.mockImplementation((filePath: string) => {
      const p = norm(filePath);
      if (p.endsWith('/.mumuspec/spec.yaml')) return true;
      if (p.endsWith('/.mumuspec/design.md')) return true;
      if (p.endsWith('/.mumuspec/prohibitions.md')) return true;
      if (p.endsWith('/.mumuspec/contracts/schemas')) return true;
      if (p.endsWith('/src/core/BOUNDARY.md')) return true;
      if (p.endsWith('/src/core/index.ts')) return true;
      if (p.endsWith('/src/core')) return true;
      if (p.endsWith('/src')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('# BOUNDARY: core/\n\n(contains exports)');

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', { migrate: true });

    const oldFormatIssue = result.issues.find(
      (i) => i.message.includes('Old-format file detected: spec.yaml'),
    );
    expect(oldFormatIssue).toBeDefined();
  });

  it('should report missing mandatory files in --migrate mode', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: true, hasIndex: true },
    ]);
    // Override: mandatory files don't exist
    mockExistsSync.mockImplementation((filePath: string) => {
      const p = norm(filePath);
      if (p.endsWith('/.mumuspec/design.md')) return false;
      if (p.endsWith('/.mumuspec/spec.md')) return false;
      if (p.endsWith('/.mumuspec/prohibitions.md')) return false;
      if (p.endsWith('/.mumuspec/contracts/schemas')) return true;
      if (p.endsWith('/src/core/BOUNDARY.md')) return true;
      if (p.endsWith('/src/core/index.ts')) return true;
      if (p.endsWith('/src/core')) return true;
      if (p.endsWith('/src')) return true;
      return false;
    });
    mockReadFileSync.mockReturnValue('# BOUNDARY: core/\n\n(contains exports)');

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    const result = executeSync('/fake/root', { migrate: true });

    const missingIssues = result.issues.filter(
      (i) => i.message.includes('Missing mandatory file'),
    );
    expect(missingIssues.length).toBeGreaterThanOrEqual(1);
  });

  // ── contract snapshots skipped in migrate mode ──

  it('should skip contract snapshots in --migrate mode', async () => {
    mockSrcStructure([
      { name: 'core', files: ['utils.ts'], hasBoundary: true, hasIndex: true },
    ]);

    mockWriteFileSync.mockClear();

    const { executeSync } = await import('../../../src/cli/commands/sync.js');
    executeSync('/fake/root', { migrate: true });

    // In migrate mode, recordContractSnapshots should NOT be called
    const hasSnapshotWrite = mockWriteFileSync.mock.calls.some(
      (call) => String(call[0]).includes('sync-snapshot'),
    );
    expect(hasSnapshotWrite).toBe(false);
  });

  // ── command handler registration ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerSyncCommand } = await import('../../../src/cli/commands/sync.js');
    const program = new Command();
    registerSyncCommand(program);

    await program.parseAsync(['sync'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Not in a MumuSpec project. Run `mumuspec init` first.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
