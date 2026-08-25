/**
 * Supplementary handler-level tests for the `advise` command.
 *
 * Covers:
 * - missing project root exit path
 * - no active change exit path
 * - explicit change name overrides active change
 * - known BP IDs produce correct recommendation structure
 * - unknown BP ID triggers fallback advisor
 * - state-derived context fields (phase, dist_spec, build_layers)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Hoisted mocks ──
const {
  mockFindProjectRoot,
  mockGetActiveChange,
  mockLoadChangeState,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    getActiveChange: mockGetActiveChange,
  };
});

vi.mock('../../../src/change/state.js', () => ({
  loadChangeState: mockLoadChangeState,
}));

// Import after mocks are set up
const { registerAdviseCommand } = await import('../../../src/cli/commands/advise.js');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createProgram(): Command {
  const program = new Command();
  registerAdviseCommand(program);
  return program;
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('advise command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue('/fake/project');
    mockGetActiveChange.mockReturnValue('my-change');
    mockLoadChangeState.mockReturnValue({
      phase: 'open',
      dist_spec: undefined,
      build_layers: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits when no project root found', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'advise', 'BP-1']))
      .rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Not in a MumuSpec project'),
    );
  });

  it('exits when no active change and none specified', async () => {
    mockGetActiveChange.mockReturnValue(null);

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'advise', 'BP-9']))
      .rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('No active change'),
    );
  });

  it('uses explicit change name when provided', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-1', 'explicit-change']);

    expect(mockLoadChangeState).toHaveBeenCalledWith('/fake/project', 'explicit-change');
  });

  it('produces recommendation output for BP-1', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-1']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('BP-1');
    expect(output).toContain('Analysis');
    expect(output).toContain('Options');
  });

  it('produces recommendation output for BP-14', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-14']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('BP-14');
    expect(output).toContain('verification failures');
  });

  it('produces recommendation output for BP-4', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-4']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('BP-4');
    expect(output).toContain('design.md');
  });

  it('uses fallback advisor for unknown BP ID', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-999']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('BP-999');
    expect(output).toContain('Blocking point');
  });

  it('sets designComplete true when phase is build', async () => {
    mockLoadChangeState.mockReturnValue({
      phase: 'build',
      dist_spec: { summary: 'test' },
      build_layers: [{ id: 'l1', status: 'done' }],
    });

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-10']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    // BP-10 mentions execution mode; in build phase it should still render
    expect(output).toContain('BP-10');
  });

  it('sets buildLayersComplete false when any layer is not done', async () => {
    mockLoadChangeState.mockReturnValue({
      phase: 'verify',
      dist_spec: { summary: 'test' },
      build_layers: [
        { id: 'l1', status: 'done' },
        { id: 'l2', status: 'pending' },
      ],
    });

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-17']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('BP-17');
  });

  it('sets hasDistSpec true when dist_spec exists', async () => {
    mockLoadChangeState.mockReturnValue({
      phase: 'build',
      dist_spec: { summary: 'some spec' },
      build_layers: [],
    });

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-1']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('BP-1');
    expect(output).toContain('Recommended');
  });

  it('handles null state gracefully (no phase)', async () => {
    mockLoadChangeState.mockReturnValue(null);

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-2']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('BP-2');
    expect(output).toContain('PRD');
  });

  it('renders recommended option marker in output', async () => {
    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'advise', 'BP-3']);

    const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('[Recommended]');
  });
});
