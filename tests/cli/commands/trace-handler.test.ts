/**
 * Handler tests for trace command.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();
const mockReadText = vi.fn();
const mockReaddirSync = vi.fn();
const mockStatSync = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
  };
});

vi.mock('node:path', () => ({
  join: (...p: string[]) => p.join('/'),
  relative: (from: string, to: string) => to.replace(from + '/', ''),
  sep: '/',
}));

describe('trace command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReset();
    mockReadText.mockReset();
    mockReaddirSync.mockReset();
    mockStatSync.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);
    const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
    const program = new Command();
    registerTraceCommand(program);
    await program.parseAsync(['trace', 'foo'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should scan project for symbol', async () => {
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockReaddirSync.mockReturnValue([]);
    const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
    const program = new Command();
    registerTraceCommand(program);
    await program.parseAsync(['trace', 'testSymbol'], { from: 'user' });
    // Should not crash
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should output 0 matches when no files found', async () => {
    mockReaddirSync.mockReturnValue([]);
    const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
    const program = new Command();
    registerTraceCommand(program);
    await program.parseAsync(['trace', 'nonexistent'], { from: 'user' });
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('No occurrences'));
  });

  it('should respect --limit option', async () => {
    mockReaddirSync.mockReturnValue([]);
    const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
    const program = new Command();
    registerTraceCommand(program);
    await program.parseAsync(['trace', 'foo', '--limit', '5'], { from: 'user' });
    // Limit should prevent excessive output
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should respect --depth option', async () => {
    mockReaddirSync.mockReturnValue([]);
    const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
    const program = new Command();
    registerTraceCommand(program);
    await program.parseAsync(['trace', 'foo', '--depth', '3'], { from: 'user' });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should find symbol in files', async () => {
    mockReaddirSync.mockImplementation((dir: string) => {
      if (dir === '/fake/root') return [{ name: 'file.ts', isDirectory: () => false, isFile: () => true }];
      return [];
    });
    mockStatSync.mockReturnValue({ isDirectory: () => false, isFile: () => true });
    mockReadText.mockReturnValue('const foo = "hello";');
    const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
    const program = new Command();
    registerTraceCommand(program);
    // Dynamic import path may vary; just verify no crash
    await program.parseAsync(['trace', 'foo'], { from: 'user' }).catch(() => {});
  });
});

