/**
 * Handler-level tests for audit-log command.
 *
 * Strategy: mock lower-level modules (core/utils), register audit-log command
 * on a fresh Commander program, then invoke handlers via parseAsync() with
 * { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockGetMumuSpecDir,
  mockExistsSync,
  mockReadText,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockGetMumuSpecDir: vi.fn(),
  mockExistsSync: vi.fn(),
  mockReadText: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    getMumuSpecDir: mockGetMumuSpecDir,
    existsSync: mockExistsSync,
    readText: mockReadText,
  };
});

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('audit-log command handler', () => {
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
    mockGetMumuSpecDir.mockReset();
    mockExistsSync.mockReset();
    mockReadText.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockGetMumuSpecDir.mockReturnValue('/fake/root/.mumuspec');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Not in project ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── No audit log file ──

  it('should print "No audit log found" when audit.log does not exist', async () => {
    mockExistsSync.mockReturnValue(false);

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('No audit log found. .mumuspec/audit.log does not exist yet.');
  });

  // ── Empty file ──

  it('should print "No audit log entries match" when file is empty', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue('');

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('No audit log entries match (0 total).');
  });

  // ── Display entries in text mode ──

  it('should display entries in text format', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue(
      JSON.stringify({ ts: '2026-01-15T10:00:00Z', actor: 'catpaw', action: 'guard', result: 'success' }) + '\n' +
      JSON.stringify({ ts: '2026-01-15T10:01:00Z', actor: 'user', action: 'transition', result: 'fail', error: 'missing file' }) + '\n',
    );

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Audit Log ('));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('catpaw'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('guard'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('missing file'));
  });

  // ── JSON output ──

  it('should output entries as JSON when --json flag is set', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue(
      JSON.stringify({ ts: '2026-01-15T10:00:00Z', actor: 'catpaw', action: 'guard', result: 'success' }) + '\n',
    );

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log', '--json'], { from: 'user' });

    const calls = logSpy.mock.calls.flat();
    const jsonOutput = calls.find((c) => typeof c === 'string' && c.includes('"total"'));
    expect(jsonOutput).toBeDefined();
    expect(JSON.parse(jsonOutput!)).toMatchObject({ total: 1 });
  });

  // ── Filter by actor ──

  it('should filter entries by --actor option', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue(
      JSON.stringify({ ts: '2026-01-15T10:00:00Z', actor: 'catpaw', action: 'guard', result: 'success' }) + '\n' +
      JSON.stringify({ ts: '2026-01-15T10:01:00Z', actor: 'user', action: 'transition', result: 'success' }) + '\n',
    );

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log', '--actor', 'catpaw'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('showing 1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('catpaw'));
  });

  // ── Filter by action ──

  it('should filter entries by --action option', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue(
      JSON.stringify({ ts: '2026-01-15T10:00:00Z', actor: 'catpaw', action: 'guard', result: 'success' }) + '\n' +
      JSON.stringify({ ts: '2026-01-15T10:01:00Z', actor: 'catpaw', action: 'transition', result: 'success' }) + '\n',
    );

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log', '--action', 'transition'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('showing 1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('transition'));
  });

  // ── Filter by result ──

  it('should filter entries by --result option', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue(
      JSON.stringify({ ts: '2026-01-15T10:00:00Z', actor: 'catpaw', action: 'guard', result: 'success' }) + '\n' +
      JSON.stringify({ ts: '2026-01-15T10:01:00Z', actor: 'user', action: 'transition', result: 'fail', error: 'oops' }) + '\n',
    );

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log', '--result', 'fail'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('showing 1'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✗'));
  });

  // ── Limit option ──

  it('should respect --limit option', async () => {
    mockExistsSync.mockReturnValue(true);
    const lines = Array.from({ length: 10 }, (_, i) =>
      JSON.stringify({ ts: `2026-01-15T10:0${i}:00Z`, actor: 'catpaw', action: `op${i}`, result: 'success' }),
    ).join('\n') + '\n';
    mockReadText.mockReturnValue(lines);

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log', '--limit', '3'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('showing 3'));
  });

  // ── Skip invalid JSON lines ──

  it('should skip lines with invalid JSON', async () => {
    mockExistsSync.mockReturnValue(true);
    mockReadText.mockReturnValue(
      '{ valid: json but wrong schema }\n' +
      JSON.stringify({ ts: '2026-01-15T10:00:00Z', actor: 'catpaw', action: 'guard', result: 'success' }) + '\n',
    );

    const { registerAuditLogCommand } = await import('../../../src/cli/commands/audit-log.js');
    const program = new Command();
    registerAuditLogCommand(program);

    await program.parseAsync(['audit-log'], { from: 'user' });

    // Should not crash, should show 1 valid entry
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('showing 1'));
  });
});
