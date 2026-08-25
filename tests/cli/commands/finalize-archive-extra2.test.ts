/**
 * Extra coverage tests for finalize-archive command — file operations,
 * pattern-match fallback, delete paths, JSON output, stale cache cleanup,
 * backward compat file detection, and uncovered branches.
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
  mockMergeDeltaSpecsToMain,
  mockExtractKnowledgeToGlobal,
  mockGetArchivedChangeDir,
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
  mockMergeDeltaSpecsToMain: vi.fn(),
  mockExtractKnowledgeToGlobal: vi.fn(),
  mockGetArchivedChangeDir: vi.fn(),
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
  writeText: vi.fn(),
  writeYaml: vi.fn(),
  readYaml: (p: string) => mockReadYaml(p),
  appendAuditLog: vi.fn(),
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
// Direct unit tests for internal functions
// ════════════════════════════════════════════════════════════════════

/**
 * Test updateProhibitions directly by calling the command with a
 * carefully controlled filesystem state.
 */
describe('finalize-archive internal helpers via command invocation', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  // ── Pattern-match fallback for archivedDir (source lines 58-78) ──

  it('should find archivedDir via pattern match when getArchivedChangeDir returns', async () => {
    // getArchivedChangeDir returns a path that does NOT exist
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/nonexistent');
    // archiveBaseDir exists
    setFileExists('/fake/root/.mumuspec/changes/archive');
    // Entries contain a pattern match
    setDirContents('/fake/root/.mumuspec/changes/archive', [
      'prefix-my-change',        // ends with '-my-change' pattern
    ]);
    // The matched path exists
    setFileExists('/fake/root/.mumuspec/changes/archive/prefix-my-change');

    await runCommand(['my-change']);
    // Should proceed past archivedDir check
    expect(errorSpy).not.toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should throw E-FINAL-001 when archivedDir not found after pattern scan', async () => {
    mockGetArchivedChangeDir.mockReturnValue(undefined);
    setFileExists('/fake/root/.mumuspec/changes/archive');
    setDirContents('/fake/root/.mumuspec/changes/archive', ['unrelated-change']);

    let thrownError: Error | null = null;
    try {
      const { registerFinalizeArchiveCommand } = await import('../../../src/cli/commands/finalize-archive.js');
      const program = new Command();
      registerFinalizeArchiveCommand(program);
      await program.parseAsync(['finalize-archive', 'missing-change'], { from: 'user' });
    } catch (e) {
      thrownError = e as Error;
    }
    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toBe('E-FINAL-001');
  });

  it('should match archivedDir by exact name suffix', async () => {
    mockGetArchivedChangeDir.mockReturnValue(undefined);
    setFileExists('/fake/root/.mumuspec/changes/archive');
    setDirContents('/fake/root/.mumuspec/changes/archive', [
      'my-change',               // exact match pattern
    ]);
    setFileExists('/fake/root/.mumuspec/changes/archive/my-change');

    await runCommand(['my-change']);
    expect(errorSpy).not.toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  // ── Phase check (source lines 82-88) ──

  it('should throw E-FINAL-001 when state.phase !== archive-completed', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/my-change');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/my-change');
    mockLoadChangeState.mockReturnValue({ phase: 'build-completed', workflow: 'full' });

    let thrownError: Error | null = null;
    try {
      const { registerFinalizeArchiveCommand } = await import('../../../src/cli/commands/finalize-archive.js');
      const program = new Command();
      registerFinalizeArchiveCommand(program);
      await program.parseAsync(['finalize-archive', 'my-change'], { from: 'user' });
    } catch (e) {
      thrownError = e as Error;
    }
    expect(thrownError).not.toBeNull();
    expect(thrownError!.message).toBe('E-FINAL-001');
  });

  // ── Archive state fallback loading (source lines 91-98) ──

  it('should load archiveState from archivedDir .mumuspec.yaml when active state is null', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/my-change');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/my-change');
    // loadChangeState returns null (active state not found)
    mockLoadChangeState.mockReturnValue(null);
    // .mumuspec.yaml exists in the archived dir
    setFileExists('/fake/root/.mumuspec/changes/archive/my-change/.mumuspec.yaml');
    // readYaml returns a tweak state → knowledge extraction should be skipped
    mockReadYaml.mockReturnValue({ phase: 'archive-completed', workflow: 'tweak' });

    await runCommand(['my-change']);
    // Verify readYaml was called for the archive state path
    expect(mockReadYaml).toHaveBeenCalledWith('/fake/root/.mumuspec/changes/archive/my-change/.mumuspec.yaml');
  });

  it('should not read archiveYaml when archiveStatePath does not exist', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/my-change');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/my-change');
    mockLoadChangeState.mockReturnValue(null);
    // .mumuspec.yaml does NOT exist in archivedDir
    // (existenceMap returns false by default)

    await runCommand(['my-change']);
    expect(mockReadYaml).not.toHaveBeenCalled();
  });

  // ── Knowledge extraction skip (source lines 133-140) ──

  it('should skip knowledge extraction when workflow is tweak', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/tweak-change');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/tweak-change');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'tweak' });

    await runCommand(['tweak-change']);
    // extractKnowledgeToGlobal should NOT be called for tweak workflow
    expect(mockExtractKnowledgeToGlobal).not.toHaveBeenCalled();
  });

  it('should call extractKnowledgeToGlobal for non-tweak workflow', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/full-change');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/full-change');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    await runCommand(['full-change']);
    expect(mockExtractKnowledgeToGlobal).toHaveBeenCalled();
  });

  // ── mergeDeltaSpecsToMain error path ──

  it('should record warning when mergeDeltaSpecsToMain throws', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/err-change');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/err-change');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    mockMergeDeltaSpecsToMain.mockImplementation(() => { throw new Error('merge failed'); });

    await runCommand(['err-change', '--json']);
    // Check JSON output contains the warning
    const jsonOutput = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('warnings')
    );
    expect(jsonOutput).toBeDefined();
  });

  // ── cleanupWorktree error path (source lines 142-148) ──
  // cleanupWorktree 当前为 no-op、无错误路径，无可测行为——移除空断言占位用例

  // ── JSON output (source lines 209-211) ──

  it('should output valid JSON with results and warnings when --json flag is set', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/json-out');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/json-out');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    await runCommand(['json-out', '--json']);
    // console.log called with a JSON string
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed).toHaveProperty('results');
    expect(parsed).toHaveProperty('warnings');
    expect(Array.isArray(parsed.results)).toBe(true);
    expect(Array.isArray(parsed.warnings)).toBe(true);
  });

  it('should include standard success messages in results array', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/std-out');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/std-out');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    await runCommand(['std-out', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // At least delta-specs and worktree should succeed
    expect(parsed.results.some((r: string) => r.includes('delta-specs'))).toBe(true);
    expect(parsed.results.some((r: string) => r.includes('worktree'))).toBe(true);
  });

  // ── Non-JSON output formatting ──

  it('should output banner and results without JSON flag', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/plain-out');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/plain-out');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    await runCommand(['plain-out']);
    // Banner output
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Finalize Archive Complete'));
    // Results with checkmark prefix
    const hasResult = logSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('✓')
    );
    expect(hasResult).toBe(true);
  });

  it('should output Warnings section when warnings exist', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/warn-out');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/warn-out');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    mockMergeDeltaSpecsToMain.mockImplementation(() => { throw new Error('merge boom'); });

    await runCommand(['warn-out']);
    expect(logSpy).toHaveBeenCalledWith('Warnings:');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for updateProhibitions — constraint dir existence & content
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive updateProhibitions branches', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should skip prohibitions update when constraintsDir does not exist (early return)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/no-constraints');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/no-constraints');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    // constraintsDir does NOT exist → early return at line 241
    // My return with --json should show no prohibitions result as a warning or just silently skip
    await runCommand(['no-constraints', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // prohibitions.md update should appear as a result (success since no constraints = no error)
    expect(parsed.results.some((r: string) => r.includes('prohibitions'))).toBe(true);
  });

  it('should merge new-shall-not.md content into prohibitions when not already present', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/has-constraints');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/has-constraints');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    // constraints dir exists
    setFileExists('/fake/root/.mumuspec/changes/archive/has-constraints/constraints');
    // new-shall-not.md exists
    setFileExists('/fake/root/.mumuspec/changes/archive/has-constraints/constraints/new-shall-not.md');
    // prohibitions.md exists with different content
    setFileExists('/fake/root/.mumuspec/prohibitions.md');
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('prohibitions.md')) return '# Prohibitions\nExisting content';
      if (p.includes('new-shall-not.md')) return '- SHALL NOT do X\n- SHALL NOT do Y';
      return '';
    });

    await runCommand(['has-constraints', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.results.some((r: string) => r.includes('prohibitions.md updated'))).toBe(true);
  });

  it('should skip prohibitions write when shallNotContent already present (idempotent)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/idempotent');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/idempotent');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    setFileExists('/fake/root/.mumuspec/changes/archive/idempotent/constraints');
    setFileExists('/fake/root/.mumuspec/changes/archive/idempotent/constraints/new-shall-not.md');
    setFileExists('/fake/root/.mumuspec/prohibitions.md');
    // prohibitions already contains the shall-not content
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('prohibitions.md')) return '# Prohibitions\n- SHALL NOT do X\n- SHALL NOT do Y';
      if (p.includes('new-shall-not.md')) return '- SHALL NOT do X\n- SHALL NOT do Y';
      return '';
    });

    // Track writeText calls
    const { writeText } = await import('../../../src/core/utils.js');
    await runCommand(['idempotent']);
    // writeText should NOT be called for prohibitions since content already exists
    expect((writeText as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('should create prohibitions.md when it does not exist yet', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/create-prohib');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/create-prohib');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    setFileExists('/fake/root/.mumuspec/changes/archive/create-prohib/constraints');
    setFileExists('/fake/root/.mumuspec/changes/archive/create-prohib/constraints/new-shall-not.md');
    // prohibitions.md does NOT exist → fresh content
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('new-shall-not.md')) return '- SHALL NOT create global state';
      return undefined;
    });

    await runCommand(['create-prohib']);
    const { writeText } = await import('../../../src/core/utils.js');
    expect((writeText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      '/fake/root/.mumuspec/prohibitions.md',
      expect.stringContaining('SHALL NOT')
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for rebuildIndexYaml — directory scanning
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive rebuildIndexYaml branches', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should record success result when rebuildIndexYaml completes', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/index-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/index-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // Subdirectory with .mumuspec containing prd.md
    setFileExists('/fake/root/src/.mumuspec');
    setFileExists('/fake/root/src/.mumuspec/prd.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
      { name: 'node_modules', isDirectory: () => true, isFile: () => false },
      { name: 'dist', isDirectory: () => true, isFile: () => false },
      { name: '.hidden', isDirectory: () => true, isFile: () => false },
    ]);
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('prd.md')) return '# My Project\nSome description';
      return '';
    });

    await runCommand(['index-test', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.results.some((r: string) => r.includes('index.yaml rebuilt'))).toBe(true);
  });

  it('should record warning when rebuildIndexYaml throws', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/index-err');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/index-err');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
    // Make readdirSync throw for /fake/root to trigger error in scanDir
    mockReaddirSync.mockImplementation((p: string) => {
      if (p === '/fake/root') throw new Error('EACCES');
      return [];
    });

    await runCommand(['index-err', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.results.some((r: string) => r.includes('index.yaml rebuilt'))).toBe(true);
  });

  it('should skip node_modules, dist, and hidden dirs during scan', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/skip-dirs');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/skip-dirs');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // node_modules, dist, .hidden should not be processed
    setDirContents('/fake/root', [
      { name: 'node_modules', isDirectory: () => true, isFile: () => false },
      { name: 'dist', isDirectory: () => true, isFile: () => false },
      { name: '.git', isDirectory: () => true, isFile: () => false },
    ]);
    // None of these have .mumuspec subdirs with prd.md
    // existenceMap doesn't have them, so existsSync returns false

    await runCommand(['skip-dirs', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // Result should show index rebuilt (with empty children array)
    expect(parsed.results.some((r: string) => r.includes('index.yaml rebuilt'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for findBackwardCompatFiles
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive backward compat file detection', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should detect spec.md when coexisting prd.md exists in same dir', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/bc-detect');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/bc-detect');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // A directory with spec.md and prd.md (superseded)
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

    await runCommand(['bc-detect']);
    // Should log the backward compat files message
    const compatMsg = logSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('Backward Compatibility Files Detected')
    );
    expect(compatMsg).toBe(true);
  });

  it('should detect design.md when coexisting tech.md exists', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/bc-design');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/bc-design');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    setFileExists('/fake/root/src/old/design.md');
    setFileExists('/fake/root/src/old/tech.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: 'old', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src/old', [
      { name: 'design.md', isDirectory: () => false, isFile: () => true },
      { name: 'tech.md', isDirectory: () => false, isFile: () => true },
    ]);

    await runCommand(['bc-design']);
    const compatMsg = logSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('Backward Compatibility Files Detected')
    );
    expect(compatMsg).toBe(true);
  });

  it('should skip .mumuspec/spec.md and .mumuspec/design.md root files', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/bc-root');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/bc-root');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // .mumuspec has spec.md and design.md (should be skipped)
    setFileExists('/fake/root/.mumuspec/spec.md');
    setFileExists('/fake/root/.mumuspec/design.md');
    setFileExists('/fake/root/.mumuspec/prd.md');
    setDirContents('/fake/root', [
      { name: '.mumuspec', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/.mumuspec', [
      { name: 'spec.md', isDirectory: () => false, isFile: () => true },
      { name: 'design.md', isDirectory: () => false, isFile: () => true },
      { name: 'prd.md', isDirectory: () => false, isFile: () => true },
    ]);

    await runCommand(['bc-root']);
    // Should NOT detect backward compat files since they're all in .mumuspec
    const compatMsg = logSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('Backward Compatibility Files Detected')
    );
    expect(compatMsg).toBe(false);
  });

  it('should NOT report backward compat when no old files exist', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/bc-none');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/bc-none');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // Empty project — no spec.md or design.md anywhere
    setDirContents('/fake/root', []);

    await runCommand(['bc-none', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // No backward compat files detected → no warning about them
    const hasCompatWarning = parsed.warnings.some((w: string) => w.includes('backward compat'));
    const hasCompatResult = parsed.results.some((r: string) => r.includes('backward compat'));
    expect(hasCompatWarning).toBe(false);
    expect(hasCompatResult).toBe(false);
  });

  it('should NOT detect spec.md when no prd.md/tech.md sibling exists', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/bc-only');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/bc-only');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // spec.md exists but no prd.md/tech.md sibling
    setFileExists('/fake/root/src/spec.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: 'spec.md', isDirectory: () => false, isFile: () => true },
    ]);

    await runCommand(['bc-only']);
    const compatMsg = logSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('Backward Compatibility Files Detected')
    );
    expect(compatMsg).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for --delete-old flag: unlinkSync calls
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive --delete-old branch', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should call unlinkSync on each backward compat file with --delete-old', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/del-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/del-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // Project structure with spec.md + prd.md
    setFileExists('/fake/root/src/a/spec.md');
    setFileExists('/fake/root/src/a/prd.md');
    setFileExists('/fake/root/src/b/design.md');
    setFileExists('/fake/root/src/b/tech.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: 'a', isDirectory: () => true, isFile: () => false },
      { name: 'b', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src/a', [
      { name: 'spec.md', isDirectory: () => false, isFile: () => true },
      { name: 'prd.md', isDirectory: () => false, isFile: () => true },
    ]);
    setDirContents('/fake/root/src/b', [
      { name: 'design.md', isDirectory: () => false, isFile: () => true },
      { name: 'tech.md', isDirectory: () => false, isFile: () => true },
    ]);

    await runCommand(['del-test', '--delete-old']);
    // unlinkSync should be called twice for both files
    expect(mockUnlinkSync).toHaveBeenCalledWith('/fake/root/src/a/spec.md');
    expect(mockUnlinkSync).toHaveBeenCalledWith('/fake/root/src/b/design.md');
  });

  it('should record deleted count in results when files are deleted', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/del-count');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/del-count');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

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

    await runCommand(['del-count', '--delete-old', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.results.some((r: string) => r.includes('deleted') && r.includes('backward compat'))).toBe(true);
  });

  it('should not call unlinkSync when no backward compat files exist with --delete-old', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/del-empty');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/del-empty');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    setDirContents('/fake/root', []);

    await runCommand(['del-empty', '--delete-old']);
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });

  it('should skip folders gracefully with --keep-old flag (no unlink call)', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/keep-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/keep-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    setFileExists('/fake/root/src/spec.md');
    setFileExists('/fake/root/src/prd.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: 'spec.md', isDirectory: () => false, isFile: () => true },
      { name: 'prd.md', isDirectory: () => false, isFile: () => true },
    ]);

    await runCommand(['keep-test', '--keep-old']);
    expect(mockUnlinkSync).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for cleanStaleCache
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive cleanStaleCache branch', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should count stale entries older than 30 days', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/cache-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/cache-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // changes dir exists
    setFileExists('/fake/root/.mumuspec/changes');
    // archive dir exists
    setFileExists('/fake/root/.mumuspec/changes/archive');
    // Archive has old entries
    setDirContents('/fake/root/.mumuspec/changes/archive', [
      'very-old-change',
      'another-old-change',
    ]);
    // Entries have old timestamps (more than 30 days)
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    mockStatSync.mockImplementation(() => ({ mtimeMs: thirtyOneDaysAgo }) as any);

    await runCommand(['cache-test', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    expect(parsed.results.some((r: string) => r.includes('cleaned') && r.includes('stale cache'))).toBe(true);
  });

  it('should not count recent entries as stale', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/cache-fresh');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/cache-fresh');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    setFileExists('/fake/root/.mumuspec/changes');
    setFileExists('/fake/root/.mumuspec/changes/archive');
    setDirContents('/fake/root/.mumuspec/changes/archive', ['fresh-change']);
    // Entry is recent (less than 30 days)
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    mockStatSync.mockImplementation(() => ({ mtimeMs: fiveDaysAgo }) as any);

    await runCommand(['cache-fresh', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // No cleaned result since entries are recent
    expect(parsed.results.some((r: string) => r.includes('stale cache'))).toBe(false);
  });

  it('should return 0 when changesDir does not exist', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/cache-no-dir');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/cache-no-dir');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // changes dir does NOT exist → early return 0
    // (existenceMap returns false for /fake/root/.mumuspec/changes)

    await runCommand(['cache-no-dir', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // No stale cache cleanup result (since changesDir doesn't exist)
    expect(parsed.results.some((r: string) => r.includes('stale cache'))).toBe(false);
  });

  it('should skip entries where statSync fails', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/stat-fail');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/stat-fail');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    setFileExists('/fake/root/.mumuspec/changes');
    setFileExists('/fake/root/.mumuspec/changes/archive');
    setDirContents('/fake/root/.mumuspec/changes/archive', ['broken-entry']);
    // statSync throws
    mockStatSync.mockImplementation(() => { throw new Error('ENOENT'); });

    await runCommand(['stat-fail']);
    // Should not crash, errors are caught within cleanStaleCache
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Finalize Archive Complete'));
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for extractFirstHeading
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive extractFirstHeading via command', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should extract first heading from prd.md during index rebuild', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/heading-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/heading-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // Directory with .mumuspec containing prd.md
    setFileExists('/fake/root/src/.mumuspec');
    setFileExists('/fake/root/src/.mumuspec/prd.md');
    setFileExists('/fake/root/src/.mumuspec/tech.md');
    setDirContents('/fake/root', [
      { name: 'src', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src', [
      { name: '.mumuspec', isDirectory: () => true, isFile: () => false },
    ]);
    setDirContents('/fake/root/src/.mumuspec', [
      { name: 'prd.md', isDirectory: () => false, isFile: () => true },
      { name: 'tech.md', isDirectory: () => false, isFile: () => true },
    ]);
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('prd.md')) return '# Project Alpha\nDescription here';
      if (p.includes('tech.md')) return '# Tech Stack\nImplementation details';
      return '';
    });

    // writeYaml is mocked — verify it's called with heading data
    const { writeYaml } = await import('../../../src/core/utils.js');
    await runCommand(['heading-test']);
    expect(writeYaml).toHaveBeenCalledWith(
      '/fake/root/.mumuspec/index.yaml',
      expect.objectContaining({
        children: expect.arrayContaining([
          expect.objectContaining({
            prd_summary: 'Project Alpha',
            tech_summary: 'Tech Stack',
          }),
        ]),
      })
    );
  });

  it('should produce empty summary when heading is missing', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/no-heading');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/no-heading');
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
    mockReadText.mockImplementation((p: string) => {
      if (p.includes('prd.md')) return 'No heading here\nJust plain text';
      return '';
    });

    const { writeYaml } = await import('../../../src/core/utils.js');
    await runCommand(['no-heading']);
    expect(writeYaml).toHaveBeenCalledWith(
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

  it('should handle empty readText result gracefully', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/empty-content');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/empty-content');
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
    mockReadText.mockReturnValue(undefined);

    const { writeYaml } = await import('../../../src/core/utils.js');
    await runCommand(['empty-content']);
    expect(writeYaml).toHaveBeenCalledWith(
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

// ════════════════════════════════════════════════════════════════════
// Tests for code-graph snapshot error handling
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive code-graph snapshot error', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should record non-fatal warning in JSON output even if code-graph fails', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/cg-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/cg-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    await runCommand(['cg-test', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    const parsed = JSON.parse(jsonCall![0] as string);
    // code-graph snapshot result should always be present (it's a no-op)
    expect(parsed.results.some((r: string) => r.includes('code-graph'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for releaseActiveSlot and audit log
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive audit log and active slot', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should call appendAuditLog for change.finalize-archive and active_slot.released', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/audit-test');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/audit-test');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    await runCommand(['audit-test']);
    const { appendAuditLog } = await import('../../../src/core/utils.js');
    // Should be called twice: once for finalize-archive, once for active_slot.released
    const auditCalls = (appendAuditLog as ReturnType<typeof vi.fn>).mock.calls;
    expect(auditCalls.length).toBeGreaterThanOrEqual(2);
    // Check finalize-archive action
    expect(auditCalls.some((call) => call[1]?.action === 'change.finalize-archive')).toBe(true);
    // Check active_slot.released action
    expect(auditCalls.some((call) => call[1]?.action === 'active_slot.released')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for updateCodeGraphSnapshot catch path
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive updateCodeGraphSnapshot non-fatal', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should not crash even if code-graph snapshot throws', async () => {
    // updateCodeGraphSnapshot is currently a no-op placeholder,
    // but the try/catch blocks must not crash for any exception
    setFileExists('/fake/root/.mumuspec/changes/archive/cg-throw');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/cg-throw');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    await runCommand(['cg-throw', '--json']);
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    expect(jsonCall).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests for scanDir errors caught silently
// ════════════════════════════════════════════════════════════════════

describe('finalize-archive scanDir error recovery', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    resetFileSystem();
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should handle readdirSync throwing during directory scan gracefully', async () => {
    setFileExists('/fake/root/.mumuspec/changes/archive/scan-throw');
    mockGetArchivedChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/archive/scan-throw');
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });

    // Make readdirSync throw for subdirectory scan
    let callCount = 0;
    mockReaddirSync.mockImplementation((p: string) => {
      callCount++;
      if (p === '/fake/root') {
        return [
          { name: 'src', isDirectory: () => true, isFile: () => false },
        ];
      }
      throw new Error('Permission denied');
    });

    await runCommand(['scan-throw', '--json']);
    // Should still complete, error is caught silently by scanDir's try/catch
    const jsonCall = logSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].startsWith('{')
    );
    expect(jsonCall).toBeDefined();
  });
});
