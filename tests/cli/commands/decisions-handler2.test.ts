/**
 * Handler-level extra tests for decisions command — append subcommand branches.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

const mockFindProjectRoot = vi.fn();
const mockGetActiveChange = vi.fn();
const mockLoadChangeState = vi.fn();
const mockAppendDecision = vi.fn();

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return { ...actual, findProjectRoot: mockFindProjectRoot };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return { ...actual, getActiveChange: mockGetActiveChange };
});

vi.mock('../../../src/change/state.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
}));

vi.mock('../../../src/change/decisions.js', () => ({
  appendDecision: (...args: unknown[]) => mockAppendDecision(...args),
}));

describe('decisions command handler — append subcommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => { throw new Error('exit'); }) as () => never);
    mockFindProjectRoot.mockReset();
    mockGetActiveChange.mockReset();
    mockLoadChangeState.mockReset();
    mockAppendDecision.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('append: should exit(1) when no change name and no active change', async () => {
    mockGetActiveChange.mockReturnValue(undefined);
    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);
    await program.parseAsync(['decisions', 'append', 'some text'], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith(
      'Error: No active change. Specify --change or run inside a change directory.'
    );
  });

  it('append: should exit(1) when decision text is empty', async () => {
    mockGetActiveChange.mockReturnValue('my-change');
    mockLoadChangeState.mockReturnValue({ phase: 'design', auto_decisions: [] });
    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);
    await program.parseAsync(['decisions', 'append', ''], { from: 'user' }).catch(() => {});
    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Decision text required (positional args or --text).'
    );
  });

  it('append: should call appendDecision with --text option', async () => {
    mockGetActiveChange.mockReturnValue('test-change');
    mockLoadChangeState.mockReturnValue({ phase: 'build', auto_decisions: [] });
    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);
    await program.parseAsync(['decisions', 'append', '--text', 'Use pattern X', '--phase', 'build'], { from: 'user' });
    expect(mockAppendDecision).toHaveBeenCalledWith('/fake/root', 'test-change', 'build', 'Use pattern X');
  });

  it('append: should use --change option to override active change', async () => {
    mockGetActiveChange.mockReturnValue('other-change');
    mockLoadChangeState.mockReturnValue({ phase: 'verify', auto_decisions: [] });
    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);
    await program.parseAsync(['decisions', 'append', '--change', 'override-change', 'my decision'], { from: 'user' });
    expect(mockAppendDecision).toHaveBeenCalledWith('/fake/root', 'override-change', 'design', 'my decision');
  });
});
