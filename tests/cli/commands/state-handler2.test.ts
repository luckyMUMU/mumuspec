/**
 * Extra handler tests for state command — test-cases subcommands.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();
const mockLoadConfig = vi.fn();
const mockInitTestCases = vi.fn();
const mockLockTestCases = vi.fn();
const mockComputeTestCasesHash = vi.fn();
const mockVerifyTestCases = vi.fn();
const mockGetChangeDir = vi.fn();
const mockExistsSync = vi.fn();
const mockReadText = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    computeHash: vi.fn(() => 'abc123'),
  };
});

vi.mock('../../../src/core/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock('../../../src/change/manager.js', () => ({
  createChange: vi.fn(),
  loadChangeState: vi.fn(() => ({ phase: 'open', workflow: 'full', test_cases: { design_content_hash: 'hash123' }, build_layers: [] })),
  saveChangeState: vi.fn(),
  initTestCases: (...args: unknown[]) => mockInitTestCases(...args),
  lockTestCases: (...args: unknown[]) => mockLockTestCases(...args),
  verifyTestCases: (...args: unknown[]) => mockVerifyTestCases(...args),
  computeTestCasesHash: (...args: unknown[]) => mockComputeTestCasesHash(...args),
  getChangeDir: (...args: unknown[]) => mockGetChangeDir(...args),
}));

vi.mock('../../../src/change/state-machine.js', () => ({
  executeTransition: vi.fn(() => ({ success: true, state: { phase: 'design' } })),
  executeRollback: vi.fn(),
  getValidTransitions: vi.fn(() => ['design']),
  getNextPhase: vi.fn(() => ({ phase: 'design', description: 'desc' })),
  getWorkflowPhases: vi.fn(() => ['open', 'design']),
  isTerminal: vi.fn(() => false),
  requiresUserConfirmation: vi.fn(() => ({ required: false, bp: '', description: '' })),
  activateProjectWorkflow: vi.fn(),
}));

describe('state command handler — test-cases and state branches', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' }, specs: {} });
    mockExistsSync.mockReturnValue(false);
    mockReadText.mockReturnValue('');
    mockInitTestCases.mockReset();
    mockLockTestCases.mockReset();
    mockComputeTestCasesHash.mockReset();
    mockVerifyTestCases.mockReset();
    mockGetChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/my-change');
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('test-cases init: should call initTestCases with layers', async () => {
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['test-cases', 'init', 'my-change', '--layers', '0,1,2'], { from: 'user' });
    expect(mockInitTestCases).toHaveBeenCalledWith('/fake/root', 'my-change', [0, 1, 2]);
  });

  it('test-cases lock: should call lockTestCases', async () => {
    mockLockTestCases.mockReturnValue('hash123');
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['test-cases', 'lock', 'my-change'], { from: 'user' });
    expect(mockLockTestCases).toHaveBeenCalledWith('/fake/root', 'my-change');
  });

  it('test-cases verify: should report success on valid hash', async () => {
    mockVerifyTestCases.mockReturnValue({ valid: true, expectedHash: 'h1', actualHash: 'h1' });
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['test-cases', 'verify', 'my-change'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('verified'));
  });

  it('test-cases verify: should report failure on mismatch', async () => {
    mockVerifyTestCases.mockReturnValue({ valid: false, expectedHash: 'h1', actualHash: 'h2' });
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['test-cases', 'verify', 'my-change'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed'));
  });

  it('test-cases hash: should output hash and match message when equal', async () => {
    mockComputeTestCasesHash.mockReturnValue('hash123'); // matches locked
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['test-cases', 'hash', 'my-change'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith('hash123');
    expect(logSpy).toHaveBeenCalledWith('  ✓ matches locked hash');
  });

  it('test-cases hash: should output hash and call exit(1) when differs', async () => {
    mockComputeTestCasesHash.mockReturnValue('different');
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['test-cases', 'hash', 'my-change'], { from: 'user' }).catch(() => {});
    expect(logSpy).toHaveBeenCalledWith('different');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('locked: hash123'));
  });

  it('state next: should print next phase', async () => {
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['state', 'next', 'my-change'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Next'));
  });

  it('state scale: should compute and recommend verify mode', async () => {
    mockGetChangeDir.mockReturnValue('/fake/root/.mumuspec/changes/scale-test');
    mockExistsSync.mockReturnValue(false);
    const { registerStateCommands } = await import('../../../src/cli/commands/state.js');
    const program = new Command();
    registerStateCommands(program);
    await program.parseAsync(['state', 'scale', 'my-change'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Verify mode'));
  });
});

