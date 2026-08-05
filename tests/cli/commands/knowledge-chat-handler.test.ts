/**
 * Handler-level tests for knowledge chat command.
 *
 * Strategy: mock core/utils (findProjectRoot), core/config (loadConfig),
 * and cli/helpers (executeChat), then register the chat command and
 * invoke its action handler to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mocks ──

vi.mock('../../../src/core/utils.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/core/utils.js')>('../../../src/core/utils.js');
  return {
    ...actual,
    findProjectRoot: vi.fn(),
  };
});

vi.mock('../../../src/core/config.js', () => ({
  loadConfig: vi.fn(),
}));

vi.mock('../../../src/cli/helpers.js', () => ({
  executeChat: vi.fn(),
}));

const { findProjectRoot } = await import('../../../src/core/utils.js');
const { loadConfig } = await import('../../../src/core/config.js');
const { executeChat } = await import('../../../src/cli/helpers.js');

const mockedFindProjectRoot = vi.mocked(findProjectRoot);
const mockedLoadConfig = vi.mocked(loadConfig);
const mockedExecuteChat = vi.mocked(executeChat);

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('chat command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  const fakeConfig = { lang: 'en' } as ReturnType<typeof loadConfig>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    mockedFindProjectRoot.mockReturnValue('/fake/root');
    mockedLoadConfig.mockReturnValue(fakeConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── direct query mode ──

  it('should call executeChat with query when argument provided', async () => {
    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['node', 'test', 'chat', 'How does the saga pattern work?'], { from: 'user' });

    expect(mockedExecuteChat).toHaveBeenCalledWith(
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

    await program.parseAsync(['node', 'test', 'chat', 'KP-0007', '--json'], { from: 'user' });

    expect(mockedExecuteChat).toHaveBeenCalledWith(
      '/fake/root',
      fakeConfig,
      'KP-0007',
      true
    );
  });

  it('should treat empty string query as interactive mode', async () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stdinOnceSpy = vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event, handler) => {
        // Simulate user typing a query
        (handler as (data: Buffer) => void)(Buffer.from('payment architecture\n'));
        return process.stdin;
      }) as typeof process.stdin.once
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    // No argument → interactive mode
    await program.parseAsync(['node', 'test', 'chat'], { from: 'user' });

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
    expect(mockedExecuteChat).toHaveBeenCalledWith(
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
      ((_event, handler) => {
        // Simulate user pressing Enter without typing
        (handler as (data: Buffer) => void)(Buffer.from('\n'));
        return process.stdin;
      }) as typeof process.stdin.once
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['node', 'test', 'chat'], { from: 'user' });

    expect(mockedExecuteChat).not.toHaveBeenCalled();
  });

  // ── error handling ──

  it('should exit(1) when not in a project', async () => {
    mockedFindProjectRoot.mockReturnValue(undefined);

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['node', 'test', 'chat', 'some query'], { from: 'user' });

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockedExecuteChat).not.toHaveBeenCalled();
  });

  // ── whitespace-only argument ──

  it('should treat whitespace-only argument as interactive mode', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event, _handler) => {
        // Interactive mode triggered: provide fallback input
        (vi.mocked(process.stdin.once).mock.calls[0][1] as (data: Buffer) => void)(
          Buffer.from('fallback query\n')
        );
        return process.stdin;
      }) as typeof process.stdin.once
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['node', 'test', 'chat', '   '], { from: 'user' });

    // Banner prints for interactive mode
    expect(logSpy).toHaveBeenCalledWith(
      '|                   MUMUSPEC CHAT                          |'
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// executeChat helper tests (direct branch testing)
// ════════════════════════════════════════════════════════════════════

describe('executeChat helper output branches', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output JSON when jsonMode is true', async () => {
    const mockResult = {
      query: 'test',
      answer: 'Test answer',
      confidence: 'high' as const,
      references: [],
      generated_at: '2026-01-01T00:00:00Z',
    };

    // Re-import to get the real executeChat
    vi.resetModules();
    vi.unmock('../../../src/cli/helpers.js');
    vi.unmock('../../../src/knowledge/manager.js');

    vi.mock('../../../src/knowledge/manager.js', () => ({
      answerQuery: () => mockResult,
    }));

    const { executeChat: realExecuteChat } = await import('../../../src/cli/helpers.js');

    realExecuteChat('/root', {} as any, 'test', true);

    // Should have called console.log with JSON
    const calls = logSpy.mock.calls.flat();
    expect(calls.some((c) => c.includes('"query":"test"') || c.includes('"query": "test"'))).toBe(true);
  });

  it('should show panel output with references when not JSON mode', async () => {
    const mockResult = {
      query: 'saga',
      answer: 'Saga is a pattern',
      confidence: 'medium' as const,
      references: [
        { id: 'KP-0007', title: 'Saga Pattern', type: 'pattern' as const, relevance: 0.95 },
      ],
      generated_at: '2026-01-01T00:00:00Z',
    };

    vi.resetModules();
    vi.unmock('../../../src/cli/helpers.js');
    vi.unmock('../../../src/knowledge/manager.js');

    vi.mock('../../../src/knowledge/manager.js', () => ({
      answerQuery: () => mockResult,
    }));

    const { executeChat: realExecuteChat } = await import('../../../src/cli/helpers.js');

    realExecuteChat('/root', {} as any, 'saga', false);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('CHAT ANSWER'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('saga'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('medium'));
    expect(logSpy).toHaveBeenCalledWith('Saga is a pattern');
    expect(logSpy).toHaveBeenCalledWith('References:');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('KP-0007')
    );
  });
});
