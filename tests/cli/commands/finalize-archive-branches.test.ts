/**
 * Branch coverage tests for src/cli/commands/finalize-archive.ts — uncovered branches:
 * - Line 96:63 — archiveStatePath existence check (else branch)
 * - Line 112:6 — updateProhibitions catch (warning.push)
 * - Line 120:6 — rebuildIndexYaml catch (warning.push)
 * - Line 128:6 — updateCodeGraphSnapshot catch (non-fatal warning)
 * - Line 137:8 — extractKnowledgeToGlobal catch (non-fatal warning)
 * - Line 146:6 — cleanupWorktree catch (warning)
 * - Line 156:6 — cleanStaleCache catch (silent)
 * - Line 191:10 — unlinkSync catch in --delete-old
 * - Line 244:81 — existingContent empty string branch
 * - Line 271:30 — existsSync(prdPath) || existsSync(techPath) true branch
 * - Line 272:51 — relative(projectRoot, dir) || '.' branch
 * - Line 273:70 — extractFirstHeading when prdPath exists
 * - Line 277:41 — dir.split(/[\\/]/).pop() || relPath
 * - Line 316:2 — extractFirstHeading catch
 * - Line 362:2 — cleanStaleCache outer catch
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ════════════════════════════════════════════════════════════════════
// Hoisted mocks
// ════════════════════════════════════════════════════════════════════

const {
  mockFindProjectRoot,
  mockExistsSync,
  mockReaddirSync,
  mockUnlinkSync,
  mockStatSync,
  mockLoadConfig,
  mockLoadChangeState,
  mockReadText,
  mockReadYaml,
  mockWriteText,
  mockWriteYaml,
  mockMergeDeltaSpecsToMain,
  mockExtractKnowledgeToGlobal,
  mockGetArchivedChangeDir,
  mockAppendAuditLog,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockReadText: vi.fn(),
  mockReadYaml: vi.fn(),
  mockWriteText: vi.fn(),
  mockWriteYaml: vi.fn(),
  mockMergeDeltaSpecsToMain: vi.fn(),
  mockExtractKnowledgeToGlobal: vi.fn(),
  mockGetArchivedChangeDir: vi.fn(),
  mockAppendAuditLog: vi.fn(),
}));

// Path simulation
const existenceMap = new Map<string, boolean>();
const dirContentMap = new Map<string, any[]>();

// ════════════════════════════════════════════════════════════════════
// Module mocks
// ════════════════════════════════════════════════════════════════════

vi.mock('node:fs', () => ({
  existsSync: (p: string) => mockExistsSync(p),
  readdirSync: (p: string, opts?: any) => mockReaddirSync(p, opts),
  unlinkSync: (p: string) => mockUnlinkSync(p),
  statSync: (p: string) => mockStatSync(p),
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
  dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
  relative: (from: string, to: string) => to.replace(from + '/', '') || '.',
  sep: '/',
}));

vi.mock('../../../src/core/utils.js', () => ({
  findProjectRoot: (() => mockFindProjectRoot()) as () => string | undefined,
  getMumuSpecDir: vi.fn(() => '/fake/root/.mumuspec'),
  readText: (p: string) => mockReadText(p),
  writeText: (p: string, content: string) => mockWriteText(p, content),
  writeYaml: (p: string, data: unknown) => mockWriteYaml(p, data),
  readYaml: (p: string) => mockReadYaml(p),
  appendAuditLog: (...args: unknown[]) => mockAppendAuditLog(...args),
  now: () => '2024-01-01T00:00:00',
}));

vi.mock('../../../src/core/config.js', () => ({
  loadConfig: () => mockLoadConfig(),
}));

vi.mock('../../../src/core/errors.js', () => ({
  MumuSpecError: class extends Error {
    constructor(public code: string) {
      super(code);
    }
  },
}));

vi.mock('../../../src/change/manager.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
  getArchivedChangeDir: (...args: unknown[]) => mockGetArchivedChangeDir(...args),
  mergeDeltaSpecsToMain: (...args: unknown[]) => mockMergeDeltaSpecsToMain(...args),
  extractKnowledgeToGlobal: (...args: unknown[]) => mockExtractKnowledgeToGlobal(...args),
}));

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function resetFileSystem(): void {
  existenceMap.clear();
  dirContentMap.clear();
  mockFindProjectRoot.mockReturnValue('/fake/root');
  mockExistsSync.mockImplementation((p: string) => existenceMap.get(p) ?? false);
  mockReaddirSync.mockImplementation((p: string) => dirContentMap.get(p) ?? []);
  mockUnlinkSync.mockImplementation(() => {});
  mockStatSync.mockImplementation(() => ({ mtimeMs: 0 }) as any);
  mockLoadConfig.mockReturnValue({ project: { name: 'test' } });
  mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
  mockReadText.mockReturnValue('');
  mockReadYaml.mockReturnValue(null);
  mockWriteText.mockImplementation(() => {});
  mockWriteYaml.mockImplementation(() => {});
  mockMergeDeltaSpecsToMain.mockImplementation(() => {});
  mockExtractKnowledgeToGlobal.mockImplementation(() => {});
  mockAppendAuditLog.mockImplementation(() => {});
}

function setFileExists(p: string): void {
  existenceMap.set(p, true);
}

function setDirContents(dir: string, entries: any[]): void {
  dirContentMap.set(dir, entries);
}

async function runCommand(args: string[]): Promise<void> {
  const { registerFinalizeArchiveCommand } = await import('../../../src/cli/commands/finalize-archive.js');
  const program = new Command();
  registerFinalizeArchiveCommand(program);
  await program.parseAsync(['finalize-archive', ...args], { from: 'user' }).catch(() => {});
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive — archiveStatePath branches (line 96)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should use readYaml fallback when state is found but .mumuspec.yaml missing in archive', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/my-change');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/my-change');
    // loadChangeState returns a state
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    // .mumuspec.yaml does NOT exist in archivedDir → else branch at line 96
    // (existenceMap returns false for archiveStatePath)

    await runCommand(['my-change', '--json']);
    // readYaml should NOT be called since archiveStatePath doesn't exist
    expect(mockReadYaml).not.toHaveBeenCalled();
  });
});

describe('finalize-archive — step catch blocks (lines 112, 120, 128, 137, 146, 156)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should push warning when updateProhibitions throws (line 112)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/prohib-err');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/prohib-err');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    // constraints dir exists
    setFileExists('/fake/root/.mumuspec/changes/archive/prohib-err/constraints');
    // new-shall-not.md exists so updateProhibitions attempts to read it
    setFileExists('/fake/root/.mumuspec/changes/archive/prohib-err/constraints/new-shall-not.md');
    // Make readText throw when reading shallNotPath
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('new-shall-not.md')) {
        throw new Error('Read error');
      }
      return '';
    });

    await runCommand(['prohib-err', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // Should have a warning about prohibitions
    expect(parsed.warnings.some((w: string) => w.includes('prohibitions'))).toBe(true);
  });

  it('should push warning when rebuildIndexYaml throws (line 120)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/index-err');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/index-err');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    // Make readdirSync throw for /fake/root to trigger scanDir error
    // But scanDir catches errors silently... need writeYaml to throw instead
    mockWriteYaml.mockImplementation(() => {
      throw new Error('Write failed');
    });

    await runCommand(['index-err', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // Should have warning about index rebuild
    expect(parsed.warnings.some((w: string) => w.includes('index rebuild'))).toBe(true);
  });

  it('should push warning when extractKnowledgeToGlobal throws (line 137)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/know-err');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/know-err');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    mockExtractKnowledgeToGlobal.mockImplementation(() => {
      throw new Error('Knowledge extraction failed');
    });

    await runCommand(['know-err', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.warnings.some((w: string) => w.includes('knowledge extraction'))).toBe(true);
  });
});

describe('finalize-archive — --delete-old unlinkSync catch (line 191)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should handle unlinkSync failure gracefully with --delete-old', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/del-err');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/del-err');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // Project has spec.md + prd.md (backward compat)
    setFileExists('/fake/root/src/feat/spec.md');
    setFileExists('/fake/root/src/feat/prd.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: 'feat', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src/feat', [
      { name: 'spec.md', isDirectory: () => false, isFile: () => true },
      { name: 'prd.md', isDirectory: () => false, isFile: () => true },
    ]);

    // unlinkSync throws for this file
    mockUnlinkSync.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    // Should not throw
    await runCommand(['del-err', '--delete-old']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Finalize Archive Complete'));
  });
});

describe('finalize-archive — rebuildIndexYaml branches (lines 271-277)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should scan subdirectories with .mumuspec/prd.md (line 271 true branch)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/scan-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/scan-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // src/ has .mumuspec with prd.md
    setFileExists('/fake/root/src/.mumuspec');
    setFileExists('/fake/root/src/.mumuspec/prd.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: '.mumuspec', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src/.mumuspec', [
      { name: 'prd.md', isDirectory: () => false, isFile: () => true },
    ]);
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('prd.md')) return '# Subsystem PRD\nContent';
      return '';
    });

    await runCommand(['scan-test']);

    // writeYaml should be called with children containing the prd_summary
    expect(mockWriteYaml).toHaveBeenCalledWith(
      '/fake/root/.mumuspec/index.yaml',
      expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            prd_summary: 'Subsystem PRD',
          }),
        ]),
      })
    );
  });

  it('should use fallback name when dir has no path separators (line 277)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/name-fallback');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/name-fallback');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // Root itself has .mumuspec with tech.md → relative returns '.'
    setFileExists('/fake/root/.mumuspec');
    setFileExists('/fake/root/.mumuspec/tech.md');
    setDirContents('/fake/root', [
      { name: '.mumuspec', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/.mumuspec', [
      { name: 'tech.md', isDirectory: () => false, isFile: () => true },
    ]);
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('tech.md')) return '# Root Tech\nContent';
      return '';
    });

    await runCommand(['name-fallback']);

    expect(mockWriteYaml).toHaveBeenCalledWith(
      '/fake/root/.mumuspec/index.yaml',
      expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            tech_summary: 'Root Tech',
          }),
        ]),
      })
    );
  });
});

describe('finalize-archive — extractFirstHeading branches (lines 273, 316)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should return empty string when readText throws (line 316)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/heading-err');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/heading-err');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    setFileExists('/fake/root/src/.mumuspec');
    setFileExists('/fake/root/src/.mumuspec/prd.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: '.mumuspec', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src/.mumuspec', [
      { name: 'prd.md', isDirectory: () => false, isFile: () => true },
    ]);
    // readText throws for prd.md
    mockReadText.mockImplementation(() => {
      throw new Error('Read error');
    });

    await runCommand(['heading-err']);

    expect(mockWriteYaml).toHaveBeenCalledWith(
      '/fake/root/.mumuspec/index.yaml',
      expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            prd_summary: '',
          }),
        ]),
      })
    );
  });
});

describe('finalize-archive — cleanStaleCache outer catch (line 362)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should silently handle readdirSync error in cleanStaleCache', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/cache-err');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/cache-err');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // changes dir exists
    setFileExists('/fake/root/.mumuspec/changes');
    // archive dir exists
    setFileExists('/fake/root/.mumuspec/changes/archive');
    // readdirSync throws for archiveDir (inner catch handles it, but outer is for the whole try)
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/fake/root/.mumuspec/changes/archive') {
        throw new Error('Permission denied');
      }
      return [];
    });

    // Should not throw
    await runCommand(['cache-err']);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Finalize Archive Complete'));
  });
});

describe('finalize-archive — updateProhibitions empty content (line 244)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should start with empty existingContent when prohibitions.md does not exist', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/empty-prohib');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/empty-prohib');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // constraints dir exists
    setFileExists('/fake/root/.mumuspec/changes/archive/empty-prohib/constraints');
    // new-shall-not.md exists
    setFileExists('/fake/root/.mumuspec/changes/archive/empty-prohib/constraints/new-shall-not.md');
    // prohibitions.md does NOT exist → existingContent = ''

    mockReadText.mockImplementation((p: string) => {
      if (p.includes('new-shall-not.md')) return '- SHALL NOT leak memory';
      return '';
    });

    await runCommand(['empty-prohib']);

    // writeText should be called with the shall-not content
    expect(mockWriteText).toHaveBeenCalledWith(
      '/fake/root/.mumuspec/prohibitions.md',
      expect.stringContaining('SHALL NOT')
    );
  });
});
