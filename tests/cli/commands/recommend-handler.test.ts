/**
 * Handler-level tests for recommend command.
 *
 * Strategy: mock lower-level modules (core/utils, change/manager, change/state,
 * core/workflow-recommender), register the recommend command on a fresh Commander
 * program, then invoke its action handler via parseAsync() with { from: 'user' }
 * to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted ensures they exist before vi.mock factories run) ──
const {
  mockFindProjectRoot,
  mockGetActiveChange,
  mockLoadChangeState,
  mockEstimateScope,
  mockRecommendPath,
  mockFormatRecommendation,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockEstimateScope: vi.fn(),
  mockRecommendPath: vi.fn(),
  mockFormatRecommendation: vi.fn(),
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

vi.mock('../../../src/core/workflow-recommender.js', () => ({
  estimateScope: mockEstimateScope,
  recommendPath: mockRecommendPath,
  formatRecommendation: mockFormatRecommendation,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('recommend command handler', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    // Reset all hoisted mock functions
    mockFindProjectRoot.mockReset();
    mockGetActiveChange.mockReset();
    mockLoadChangeState.mockReset();
    mockEstimateScope.mockReset();
    mockRecommendPath.mockReset();
    mockFormatRecommendation.mockReset();
    // Default: project root found
    mockFindProjectRoot.mockReturnValue('/fake/root');
    // Default recommendation return values
    mockEstimateScope.mockReturnValue({ risk_level: 'low' } as ReturnType<typeof mockEstimateScope>);
    mockRecommendPath.mockReturnValue({
      path: 'tweak',
      confidence: 0.85,
      rationale: 'Small change',
      safety_fence_blocks: false,
    });
    mockFormatRecommendation.mockReturnValue('## Workflow Path Recommendation\n');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Not in project ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Not in a MumuSpec project. Run `mumuspec init` first.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── Mode 1: explicit flags ──

  it('should estimate scope from --files flag without change argument', async () => {
    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend', '--files', '3'], { from: 'user' });

    expect(mockEstimateScope).toHaveBeenCalledWith(expect.objectContaining({
      estimated_files: 3,
    }));
    expect(mockRecommendPath).toHaveBeenCalled();
    expect(mockFormatRecommendation).toHaveBeenCalled();
  });

  it('should detect usingFlags when --cross-module is set', async () => {
    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend', '--cross-module'], { from: 'user' });

    expect(mockEstimateScope).toHaveBeenCalledWith(expect.objectContaining({
      cross_module: true,
    }));
  });

  it('should estimate scope from multiple flags combined', async () => {
    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(
      ['recommend', '--files', '5', '--modules', '2', '--new-api', '--data-migration'],
      { from: 'user' }
    );

    expect(mockEstimateScope).toHaveBeenCalledWith(expect.objectContaining({
      estimated_files: 5,
      modules_affected: 2,
      new_public_api: true,
      data_migration: true,
    }));
  });

  it('should treat --doc-only as flag mode even without change', async () => {
    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend', '--doc-only'], { from: 'user' });

    expect(mockEstimateScope).toHaveBeenCalledWith(expect.objectContaining({
      is_doc_only: true,
    }));
  });

  // ── Mode 2: derive from change state ──

  it('should exit(1) when no change arg and no active change', async () => {
    mockGetActiveChange.mockReturnValue(undefined);

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: No active change. Use flags (--files, --modules, ...) or run inside a change directory.'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should exit(1) when change state cannot be loaded', async () => {
    mockGetActiveChange.mockReturnValue('my-change');
    mockLoadChangeState.mockReturnValue(undefined);

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith(
      'Error: Could not load state for change "my-change".'
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('should load change state and derive scope when change arg provided', async () => {
    const mockState = {
      name: 'feature-x',
      phase: 'open',
      estimated_files: 7,
      modules_affected: 2,
      cross_module: false,
      new_public_api: true,
      new_external_dep: false,
      data_migration: false,
      is_doc_only: false,
      is_pure_bugfix: false,
    };
    mockLoadChangeState.mockReturnValue(mockState);

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend', 'feature-x'], { from: 'user' });

    expect(mockLoadChangeState).toHaveBeenCalledWith('/fake/root', 'feature-x');
    expect(mockEstimateScope).toHaveBeenCalledWith(expect.objectContaining({
      estimated_files: 7,
      modules_affected: 2,
      new_public_api: true,
    }));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('feature-x'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('open'));
  });

  it('should use active change when no argument provided but active change exists', async () => {
    mockGetActiveChange.mockReturnValue('active-change');
    const mockState = {
      name: 'active-change',
      phase: 'build',
      estimated_files: 2,
      modules_affected: 1,
      cross_module: false,
      new_public_api: false,
      new_external_dep: false,
      data_migration: false,
      is_doc_only: false,
      is_pure_bugfix: false,
    };
    mockLoadChangeState.mockReturnValue(mockState);

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend'], { from: 'user' });

    expect(mockGetActiveChange).toHaveBeenCalledWith('/fake/root');
    expect(mockLoadChangeState).toHaveBeenCalledWith('/fake/root', 'active-change');
  });

  it('should fall back to state-derived mode when change arg given alongside flags (usingFlags && change)', async () => {
    // When both flags AND change arg are provided, mode 2 is used (state-derived)
    const mockState = {
      name: 'my-change',
      phase: 'design',
      estimated_files: 1,
      modules_affected: 1,
      cross_module: false,
      new_public_api: false,
      new_external_dep: false,
      data_migration: false,
      is_doc_only: false,
      is_pure_bugfix: false,
    };
    mockLoadChangeState.mockReturnValue(mockState);

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    // Change arg + flags → mode 2 (state-derived, not flag-based)
    await program.parseAsync(['recommend', 'my-change', '--files', '10'], { from: 'user' });

    // Should load state (not use flags for scope)
    expect(mockLoadChangeState).toHaveBeenCalledWith('/fake/root', 'my-change');
  });

  it('should handle state with optional fields undefined (nullish coalescing)', async () => {
    const mockState = {
      name: 'minimal-change',
      phase: 'open',
      // All optional scope fields omitted
    };
    mockLoadChangeState.mockReturnValue(mockState);

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend', 'minimal-change'], { from: 'user' });

    expect(mockEstimateScope).toHaveBeenCalledWith(expect.objectContaining({
      estimated_files: 0,
      modules_affected: 1,
      cross_module: false,
      new_public_api: false,
      new_external_dep: false,
      data_migration: false,
      is_doc_only: false,
      is_pure_bugfix: false,
    }));
  });

  it('should always print formatted recommendation', async () => {
    mockFormatRecommendation.mockReturnValue('## Workflow Path Recommendation\ntweak path');

    const { registerRecommendCommand } = await import('../../../src/cli/commands/recommend.js');
    const program = new Command();
    registerRecommendCommand(program);

    await program.parseAsync(['recommend', '--bugfix'], { from: 'user' });

    expect(mockFormatRecommendation).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('## Workflow Path Recommendation\ntweak path');
  });
});
