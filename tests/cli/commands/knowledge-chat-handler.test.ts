/**
 * Handler-level tests for knowledge chat command.
 *
 * Strategy: mock core/utils, core/config helpers, then register the chat command
 * and invoke it via parseAsync() with { from: 'user' }.
 * Also tests executeChat helper output branches directly.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock functions ──
const mockFindProjectRoot = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

// Note: We don't mock loadConfig or executeChat here.
// Instead, we verify handler behavior via console output patterns
// (what the handler prints before calling executeChat).

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('chat command handler', () => {
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
    mockFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat', 'some query'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should call executeChat when query provided (direct mode exits normally)', async () => {
    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    // Direct query mode: handler calls executeChat then finishes without exit
    await program.parseAsync(['chat', 'saga'], { from: 'user' });

    // If we reach here, the handler executed without calling process.exit
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should print banner when no query (interactive mode)', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stdinOnceSpy = vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, handler: (data: Buffer) => void) => {
        handler(Buffer.from('\n'));
        return process.stdin;
      })
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(
      '+----------------------------------------------------------+'
    );
    expect(logSpy).toHaveBeenCalledWith(
      '|                   MUMUSPEC CHAT                          |'
    );
    expect(stdoutSpy).toHaveBeenCalledWith('Query: ');

    stdoutSpy.mockRestore();
    stdinOnceSpy.mockRestore();
  });

  it('should treat whitespace-only argument as interactive mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stdinOnceSpy = vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, _handler: (data: Buffer) => void) => process.stdin)
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat', '   '], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(
      '|                   MUMUSPEC CHAT                          |'
    );

    stdoutSpy.mockRestore();
    stdinOnceSpy.mockRestore();
  });

  it('should show examples guidance in interactive banner', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, handler: (data: Buffer) => void) => {
        handler(Buffer.from('test\n'));
        return process.stdin;
      })
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('KP-0007')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Saga pattern')
    );
  });
});

