/**
 * Handler-level tests for decisions command.
 *
 * Strategy: mock lower-level modules (change/manager, change/state, core/utils),
 * register the decisions command, then invoke its action handler to exercise
 * branch logic for empty decisions, populated decisions, and error paths.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import type { ChangeState } from '../../../src/core/types-workflow.js';

// ── Mocks ──

vi.mock('../../../src/core/utils.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/core/utils.js')>('../../../src/core/utils.js');
  return {
    ...actual,
    findProjectRoot: vi.fn(),
  };
});

vi.mock('../../../src/change/manager.js', async () => {
  const actual = await vi.importActual<typeof import('../../../src/change/manager.js')>('../../../src/change/manager.js');
  return {
    ...actual,
    getActiveChange: vi.fn(),
  };
});

vi.mock('../../../src/change/state.js', () => ({
  loadChangeState: vi.fn(),
}));

const { findProjectRoot } = await import('../../../src/core/utils.js');
const { getActiveChange } = await import('../../../src/change/manager.js');
const { loadChangeState } = await import('../../../src/change/state.js');

const mockedFindProjectRoot = vi.mocked(findProjectRoot);
const mockedGetActiveChange = vi.mocked(getActiveChange);
const mockedLoadChangeState = vi.mocked(loadChangeState);

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('decisions command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
    mockedFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── error paths ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockedFindProjectRoot.mockReturnValue(undefined);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions'], { from: 'user' });

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Not in a MumuSpec project. Run `mumuspec init` first.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit(1) when no change specified and no active change', async () => {
    mockedGetActiveChange.mockReturnValue(undefined);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions'], { from: 'user' });

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: No active change. Specify a change name or run inside a change directory.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit(1) when state cannot be loaded', async () => {
    mockedLoadChangeState.mockReturnValue(undefined);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions', 'my-change'], { from: 'user' });

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Could not load state for change "my-change".'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── empty decisions ──

  it('should print empty guidance when no decisions recorded', async () => {
    const state: Partial<ChangeState> = {
      name: 'my-change',
      phase: 'open',
      workflow: 'full',
      auto_decisions: [],
    };
    mockedLoadChangeState.mockReturnValue(state as ChangeState);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions', 'my-change'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Decision Audit Trail: my-change (open)')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No autonomous decisions recorded')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Path recommendations are generated (L1)')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Phase compression is auto-applied (L2)')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Skills are dynamically loaded (L2)')
    );
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should treat undefined auto_decisions as empty array', async () => {
    const state: Partial<ChangeState> = {
      name: 'my-change',
      phase: 'design',
      workflow: 'full',
      // auto_decisions intentionally omitted
    };
    mockedLoadChangeState.mockReturnValue(state as ChangeState);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions', 'my-change'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('No autonomous decisions recorded')
    );
  });

  // ── populated decisions ──

  it('should print all decisions with formatting', async () => {
    const state: Partial<ChangeState> = {
      name: 'feature-auth',
      phase: 'design',
      workflow: 'full',
      auto_decisions: [
        {
          timestamp: '2026-01-15T10:30:00Z',
          phase: 'open',
          decision: 'Recommend hotfix workflow',
          rationale: 'Single file change, pure bugfix',
          confidence: 0.92,
          approved_by: 'user',
        },
        {
          timestamp: '2026-01-15T10:31:00Z',
          phase: 'design',
          decision: 'Compress open→build',
          rationale: 'Doc-only change, no external deps',
          confidence: 0.85,
          approved_by: 'auto_L2_rule',
        },
      ],
    };
    mockedLoadChangeState.mockReturnValue(state as ChangeState);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions', 'feature-auth'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Total decisions: 2')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Recommend hotfix workflow')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Compress open→build')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('92%')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('85%')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Approved by: user')
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Approved by: auto_L2_rule')
    );
  });

  it('should use active change name when no argument provided', async () => {
    mockedGetActiveChange.mockReturnValue('active-change');
    const state: Partial<ChangeState> = {
      name: 'active-change',
      phase: 'build',
      workflow: 'full',
      auto_decisions: [],
    };
    mockedLoadChangeState.mockReturnValue(state as ChangeState);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions'], { from: 'user' });

    expect(mockedGetActiveChange).toHaveBeenCalledWith('/fake/root');
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Decision Audit Trail: active-change (build)')
    );
  });

  it('should print state file path and immutability notice', async () => {
    const state: Partial<ChangeState> = {
      name: 'my-change',
      phase: 'verify',
      workflow: 'full',
      auto_decisions: [],
    };
    mockedLoadChangeState.mockReturnValue(state as ChangeState);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions', 'my-change'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('.mumuspec/changes/my-change/.mumuspec.yaml')
    );
    expect(logSpy).toHaveBeenCalledWith(
      '  Immutable: Append-only audit log'
    );
  });

  it('should handle many decisions (loop coverage)', async () => {
    const decisions = Array.from({ length: 5 }, (_, i) => ({
      timestamp: `2026-01-15T10:3${i}:00Z`,
      phase: 'open' as const,
      decision: `Decision ${i}`,
      rationale: `Rationale ${i}`,
      confidence: 0.5 + i * 0.1,
      approved_by: i % 2 === 0 ? 'user' : 'auto_L2_rule',
    }));

    const state: Partial<ChangeState> = {
      name: 'bulk-change',
      phase: 'open',
      workflow: 'full',
      auto_decisions: decisions,
    };
    mockedLoadChangeState.mockReturnValue(state as ChangeState);

    const { registerDecisionsCommand } = await import('../../../src/cli/commands/decisions.js');
    const program = new Command();
    registerDecisionsCommand(program);

    await program.parseAsync(['node', 'test', 'decisions', 'bulk-change'], { from: 'user' });

    expect(logSpy).toHaveBeenCalledWith('  Total decisions: 5');
    // All 5 decisions should be printed
    for (let i = 0; i < 5; i++) {
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining(`Decision ${i}`));
    }
  });
});
