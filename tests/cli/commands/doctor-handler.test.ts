/**
 * Handler-level tests for doctor command.
 *
 * Strategy: mock lower-level modules (core/utils, core/config, change/manager),
 * register the doctor command on a fresh Commander program, then invoke its
 * action handler via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockGetMumuSpecDir,
  mockLoadConfig,
  mockGetActiveChange,
  mockExistsSync,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockGetMumuSpecDir: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockExistsSync: vi.fn(),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: mockExistsSync,
  };
});

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    getMumuSpecDir: mockGetMumuSpecDir,
  };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    getActiveChange: mockGetActiveChange,
  };
});

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('doctor command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFindProjectRoot.mockReset();
    mockGetMumuSpecDir.mockReset();
    mockLoadConfig.mockReset();
    mockGetActiveChange.mockReset();
    mockExistsSync.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockGetMumuSpecDir.mockReturnValue('/fake/root/.mumuspec');
    mockLoadConfig.mockReturnValue({ ai: { rules_files: ['AGENTS.md', 'CLAUDE.md'] } });
    mockGetActiveChange.mockReturnValue('test-change');
    mockExistsSync.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path: full project ──

  it('should display all checks when project is fully initialized', async () => {
    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MumuSpec Doctor'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Node.js:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Project root: /fake/root ✓'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Active change: test-change'));
  });

  // ── No project root ──

  it('should show error and return early when no project root', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Project root: Not found'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('run `mumuspec init`'),
    );
  });

  // ── Node.js version check ──

  it('should display Node.js version with check icon', async () => {
    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    // process.version is available in test environment
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Node.js: ${process.version}`),
    );
  });

  // ── Missing files shown as unchecked ──

  it('should show unchecked icon for missing files', async () => {
    mockExistsSync.mockReturnValue(false);

    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    // Config, spec, design, etc. should all show ✗
    expect(logSpy).toHaveBeenCalledWith('Config: ✗');
    expect(logSpy).toHaveBeenCalledWith('Root spec: ✗');
    expect(logSpy).toHaveBeenCalledWith('Root design: ✗');
    expect(logSpy).toHaveBeenCalledWith('Prohibitions: ✗');
    expect(logSpy).toHaveBeenCalledWith('Index: ✗');
  });

  // ── Active change present ──

  it('should display active change name when present', async () => {
    mockGetActiveChange.mockReturnValue('my-feature');

    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('Active change: my-feature');
  });

  // ── No active change ──

  it('should display "none" when no active change', async () => {
    mockGetActiveChange.mockReturnValue(undefined);

    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('Active change: none');
  });

  // ── Audit log present ──

    it('should show check icon when audit log exists', async () => {
    mockExistsSync.mockReturnValue(true);
    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Audit log:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓'));
  });

  // ── No audit log ──

  it('should show "(empty)" when audit log does not exist', async () => {
    mockExistsSync.mockImplementation((filePath: string) => {
      return !filePath.includes('audit.log');
    });

    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('Audit log: (empty)');
  });

  // ── Rules files section ──

  it('should display rules files from config', async () => {
    mockLoadConfig.mockReturnValue({
      ai: { rules_files: ['AGENTS.md', 'CLAUDE.md', 'RULES.md'] },
    });

    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rules (AGENTS.md)'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rules (CLAUDE.md)'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Rules (RULES.md)'));
  });

  // ── Multiple calls don't accumulate ──

  it('should produce consistent output on multiple calls', async () => {
    const { registerDoctorCommand } = await import('../../../src/cli/commands/doctor.js');
    const program = new Command();
    registerDoctorCommand(program);

    await program.parseAsync(['doctor'], { from: 'user' });
    const firstCallCount = logSpy.mock.calls.length;

    logSpy.mockClear();
    await program.parseAsync(['doctor'], { from: 'user' });
    const secondCallCount = logSpy.mock.calls.length;

    expect(firstCallCount).toBe(secondCallCount);
  });
});
