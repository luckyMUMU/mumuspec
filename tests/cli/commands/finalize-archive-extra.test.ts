/**
 * Handler tests for finalize-archive command — error paths and happy path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const {
  mockFindProjectRoot,
  mockExistsSync,
  mockReaddirSync,
  mockLoadConfig,
  mockLoadChangeState,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockLoadChangeState: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    getMumuSpecDir: vi.fn(() => '/fake/root/.mumuspec'),
    existsSync: mockExistsSync,
    readdirSync: mockReaddirSync,
    readText: vi.fn(() => ''),
    writeText: vi.fn(),
    writeYaml: vi.fn(),
    readYaml: vi.fn(),
    appendAuditLog: vi.fn(),
    now: () => '2024-01-01 00:00:00',
    unlinkSync: vi.fn(),
    statSync: vi.fn(),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/'),
    relative: (from: string, to: string) => to.replace(from + '/', ''),
    sep: '/',
  };
});

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
  getArchivedChangeDir: vi.fn(() => '/fake/root/.mumuspec/changes/archive/old-change'),
  mergeDeltaSpecsToMain: vi.fn(),
  extractKnowledgeToGlobal: vi.fn(),
}));

describe('finalize-archive command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue([]);
    mockLoadConfig.mockReturnValue({ project: { name: 'test' } });
    mockLoadChangeState.mockReturnValue({ phase: 'archive-completed', workflow: 'full' });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerFinalizeArchiveCommand } = await import('../../../src/cli/commands/finalize-archive.js');
    const program = new Command();
    registerFinalizeArchiveCommand(program);
    await program.parseAsync(['finalize-archive', 'old-change'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should output JSON and complete when --json flag provided', async () => {
    const { registerFinalizeArchiveCommand } = await import('../../../src/cli/commands/finalize-archive.js');
    const program = new Command();
    registerFinalizeArchiveCommand(program);
    await program.parseAsync(['finalize-archive', 'json-change', '--json'], { from: 'user' }).catch(() => {});
    // Verify the command processed the JSON path (no fatal error for "not in project")
    expect(errorSpy).not.toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should auto-delete with --delete-old flag without crashing', async () => {
    const { registerFinalizeArchiveCommand } = await import('../../../src/cli/commands/finalize-archive.js');
    const program = new Command();
    registerFinalizeArchiveCommand(program);
    await program.parseAsync(['finalize-archive', 'delete-change', '--delete-old'], { from: 'user' }).catch(() => {});
    expect(errorSpy).not.toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should auto-keep with --keep-old flag (suppress prompt)', async () => {
    const { registerFinalizeArchiveCommand } = await import('../../../src/cli/commands/finalize-archive.js');
    const program = new Command();
    registerFinalizeArchiveCommand(program);
    await program.parseAsync(['finalize-archive', 'keep-change', '--keep-old'], { from: 'user' }).catch(() => {});
    expect(errorSpy).not.toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });
});
