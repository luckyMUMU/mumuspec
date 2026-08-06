/**
 * Extra handler-level tests for knowledge-chat command.
 *
 * Complements knowledge-chat-handler.test.ts by covering:
 * - executeChat helper JSON and panel output branches
 * - Empty/whitespace input handling in interactive mode
 * - --json flag propagation
 * - Multiple query invocation patterns
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock core/utils.js ──
const mockFindProjectRoot = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

// ── Mock knowledge/manager.js (answerQuery) ──
const mockAnswerQuery = vi.fn();

vi.mock('../../../src/knowledge/manager.js', () => ({
  answerQuery: mockAnswerQuery,
}));

// ── Mock core/config.js ──
const mockLoadConfig = vi.fn();

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('knowledge-chat extra handler coverage', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: returnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockLoadConfig.mockReturnValue({ knowledge: { commit_update: { enabled: true } } });
    mockAnswerQuery.mockReturnValue({
      query: 'test query',
      answer: 'This is the answer.',
      confidence: 0.85,
      references: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call executeChat and render panel output when query is given', async () => {
    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat', 'payment flow'], { from: 'user' });

    // Panel output is produced by executeChat
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('CHAT ANSWER')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Confidence:')
    );
  });

  it('should render references when present', async () => {
    mockAnswerQuery.mockReturnValue({
      query: 'arch',
      answer: 'Architecture overview.',
      confidence: 0.9,
      references: [
        { id: 'KP-0001', title: 'Saga pattern', type: 'pattern', relevance: 0.95 },
        { id: 'KP-0002', title: 'Payment flow', type: 'decision', relevance: 0.8 },
      ],
    });

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat', 'arch'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('References:');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('KP-0001')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Saga pattern')
    );
  });

  it('should output JSON when --json flag is used', async () => {
    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    // Use a fresh spy to track JSON output specifically
    const jsonLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['chat', 'query', '--json'], { from: 'user' });

    // JSON.stringify output should contain the result fields
    const calls = jsonLogSpy.mock.calls.flat();
    const hasJsonOutput = calls.some((c: unknown) => {
      const str = String(c);
      return str.includes('query') && str.includes('answer') && str.includes('confidence');
    });
    expect(hasJsonOutput).toBe(true);

    jsonLogSpy.mockRestore();
  });

  it('should call process.exit(0) after interactive input completes', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, handler: (data: Buffer) => void) => {
        handler(Buffer.from('my interactive query\n'));
        return process.stdin;
      }) as typeof process.stdin.once
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    let exitCode: number | undefined;
    try {
      await program.parseAsync(['chat'], { from: 'user' });
    } catch (err: unknown) {
      // process.exit throws — that's expected
    }

    // The interactive mode calls process.exit(0) after executeChat
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('should not call executeChat in interactive mode when stdin input is empty', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, handler: (data: Buffer) => void) => {
        handler(Buffer.from('\n')); // empty input
        return process.stdin;
      }) as typeof process.stdin.once
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat'], { from: 'user' }).catch(() => {});

    // answerQuery should NOT have been called because input is empty
    expect(mockAnswerQuery).not.toHaveBeenCalled();
  });

  it('should print separator line in banner', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, _handler: (data: Buffer) => void) => process.stdin) as typeof process.stdin.once
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(
      '+----------------------------------------------------------+'
    );
  });

  it('should print guidance text in interactive mode', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.spyOn(process.stdin, 'once').mockImplementation(
      ((_event: string, _handler: (data: Buffer) => void) => process.stdin) as typeof process.stdin.once
    );

    const { registerChatCommand } = await import('../../../src/cli/commands/knowledge-chat.js');
    const program = new Command();
    registerChatCommand(program);

    await program.parseAsync(['chat'], { from: 'user' }).catch(() => {});

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Ask questions about your project knowledge base')
    );
  });
});
