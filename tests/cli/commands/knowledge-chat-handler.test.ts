/**
 * Handler-level tests for knowledge chat command.
 *
 * Strategy: mock core/utils (findProjectRoot), core/config (loadConfig),
 * and cli/helpers (executeChat), then register the chat command and
 * invoke its action handler to exercise branch logic (query vs interactive, JSON mode).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock functions ──
const mockFindProjectRoot = vi.fn();
const mockLoadConfig = vi.fn();
const mockExecuteChat = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/core/config.js', () => ({
  loadConfig: mockLoadConfig,
}));

vi.mock('../../../src/cli/helpers.js', () => ({
  executeChat: mockExecuteChat,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('chat command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const fakeConfig = { lang: 'en' } as ReturnType<typeof mockLoadConfig>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    // Reset factory mocks (NOT reset by vi.restoreAllMocks)
    mockFindProjectRoot.mockReset();
    mockLoadConfig.mockReset();
    mockExecuteChat.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue(fakeConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── direct query mode ──

  it('should call executeChat with query when argument provided', async () => {
    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat', 'How does the saga pattern work?'], { from: 'user' });

    expect(mockExecuteChat).toHaveBeenCalledWith(
      '/fake/root',
      fakeConfig,
      'How does the saga pattern work?',
      undefined
    );
  });

  it('should pass jsonMode=true when --json flag provided', async () => {
    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat', 'KP-0007', '--json'], { from: 'user' });

    expect(mockExecuteChat).toHaveBeenCalledWith(
      '/fake/root',
      fakeConfig,
      'KP-0007',
      true
    );
  });

  it('should enter interactive mode and execute from stdin when no query', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stdinOnceSpy = vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, handler: (data: Buffer) => void) => {
        handler(Buffer.from('payment architecture\n'));
        return process.stdin;
      })
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat'], { from: 'user' }).catch(() => {});

    // Should have printed the banner
    expect(logSpy).toHaveBeenCalledWith(
      '+----------------------------------------------------------+'
    );
    expect(logSpy).toHaveBeenCalledWith(
      '|                   MUMUSPEC CHAT                          |'
    );

    // Should have prompted for input
    expect(stdoutSpy).toHaveBeenCalledWith('Query: ');

    // Should have called executeChat with stdin input
    expect(mockExecuteChat).toHaveBeenCalledWith(
      '/fake/root',
      fakeConfig,
      'payment architecture',
      undefined
    );

    stdoutSpy.mockRestore();
    stdinOnceSpy.mockRestore();
  });

  it('should not call executeChat when interactive input is empty', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, handler: (data: Buffer) => void) => {
        handler(Buffer.from('\n'));
        return process.stdin;
      })
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat'], { from: 'user' }).catch(() => {});

    expect(mockExecuteChat).not.toHaveBeenCalled();
  });

    it('should exit(1) when not in a project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat', 'some query'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockExecuteChat).not.toHaveBeenCalled();
  });

  it('should treat whitespace-only argument as interactive mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stdinOnceSpy = vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, handler: (data: Buffer) => void) => {
        handler(Buffer.from('fallback query\n'));
        return process.stdin;
      })
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
});

// ════════════════════════════════════════════════════════════════════
// executeChat helper tests (JSON mode vs panel output branches)
// Uses vi.resetModules() to bypass the vi.mock for helpers.js
// ════════════════════════════════════════════════════════════════════

describe('executeChat helper output branches', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should output JSON when jsonMode is true', async () => {
    vi.resetModules();
    vi.unmock('../../../src/cli/helpers.js');
    vi.unmock('../../../src/knowledge/manager.js');

    vi.mock('../../../src/knowledge/manager.js', () => ({
      answerQuery: () => ({
        query: 'test',
        answer: 'Test answer',
        confidence: 'high',
        references: [],
        generated_at: '2026-01-01T00:00:00Z',
      }),
    }));

    const { executeChat: realExecuteChat } = await import('../../../src/cli/helpers.js');
    realExecuteChat('/root', {} as never, 'test', true);

    const calls = logSpy.mock.calls.flat();
    expect(calls.some((c) => c.includes('"query":"test"') || c.includes('"query": "test"'))).toBe(true);
  });

  it('should show panel output with references when not JSON mode', async () => {
    vi.resetModules();
    vi.unmock('../../../src/cli/helpers.js');
    vi.unmock('../../../src/knowledge/manager.js');

    vi.mock('../../../src/knowledge/manager.js', () => ({
      answerQuery: () => ({
        query: 'saga',
        answer: 'Saga is a pattern',
        confidence: 'medium',
        references: [
          { id: 'KP-0007', title: 'Saga Pattern', type: 'pattern', relevance: 0.95 },
        ],
        generated_at: '2026-01-01T00:00:00Z',
      }),
    }));

    const { executeChat: realExecuteChat } = await import('../../../src/cli/helpers.js');
    realExecuteChat('/root', {} as never, 'saga', false);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CHAT ANSWER'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('saga'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('medium'));
    expect(logSpy).toHaveBeenCalledWith('Saga is a pattern');
    expect(logSpy).toHaveBeenCalledWith('References:');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('KP-0007'));
  });
});
