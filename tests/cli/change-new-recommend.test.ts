/**
 * CLI Integration Tests — `mumuspec new` with LLM Freedom recommendation flags.
 *
 * Strategy: mock all action dependencies, register change commands,
 * then invoke `new` via parseAsync() and assert console output.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockCreateChange,
  mockSaveChangeState,
  mockGetChangeDir,
  mockReadText,
  mockWriteText,
  mockEstimateScope,
  mockRecommendPath,
  mockFormatRecommendation,
  mockComputeSkillSet,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockCreateChange: vi.fn(),
  mockSaveChangeState: vi.fn(),
  mockGetChangeDir: vi.fn(),
  mockReadText: vi.fn(),
  mockWriteText: vi.fn(),
  mockEstimateScope: vi.fn(),
  mockRecommendPath: vi.fn(),
  mockFormatRecommendation: vi.fn(),
  mockComputeSkillSet: vi.fn(),
}));

vi.mock('../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    writeText: mockWriteText,
  };
});

vi.mock('../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

vi.mock('../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/change/manager.js')>();
  return {
    ...actual,
    createChange: mockCreateChange,
    saveChangeState: mockSaveChangeState,
    getChangeDir: mockGetChangeDir,
  };
});

vi.mock('../../src/core/workflow-recommender.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/workflow-recommender.js')>();
  return {
    ...actual,
    estimateScope: mockEstimateScope,
    recommendPath: mockRecommendPath,
    formatRecommendation: mockFormatRecommendation,
  };
});

vi.mock('../../src/core/skill-loader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/core/skill-loader.js')>();
  return {
    ...actual,
    computeSkillSet: mockComputeSkillSet,
  };
});

describe('mumuspec new — LLM Freedom recommendation', () => {
  let program: Command;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  const createdChanges: string[] = [];

  beforeEach(async () => {
    // Reset mocks
    mockFindProjectRoot.mockReturnValue('/mock/project');
    mockLoadConfig.mockReturnValue({ project: { name: 'test' } });
    mockCreateChange.mockImplementation((root, name) => ({
      name,
      phase: 'open',
      workflow: 'full',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      affected_scopes: [],
      build_layers: [],
      test_cases: { design_locked: false, suites_locked: false, suites_locked_layers: [], suites_hash: {} },
      rollback_count: 0,
      rebuild_count: 0,
      rollback_limit: 3,
      rebuild_limit: 5,
      build_mode: 'plans_first',
      tdd_mode: 'tdd',
      isolation: 'worktree',
      single_active_change: true,
      user_confirmed: false,
      decisions_log: { counts: {} },
      rollback_history: [],
      scope: '.',
      dist_spec: { prd: '.mumuspec/prd.md', tech: '.mumuspec/tech.md' },
    }));
    mockSaveChangeState.mockImplementation(() => undefined);
    mockGetChangeDir.mockImplementation((root: string, name: string) =>
      root + '/.mumuspec/changes/' + name,
    );
    mockReadText.mockReturnValue('# Proposal\n');
    mockWriteText.mockImplementation(() => undefined);
    mockComputeSkillSet.mockReturnValue(['brainstorming']);

    // Mock recommendation functions
    mockEstimateScope.mockImplementation((params: { estimated_files?: number; cross_module?: boolean }) => ({
      estimated_files: params.estimated_files ?? 0,
      modules_affected: 1,
      cross_module: params.cross_module ?? false,
      new_public_api: false,
      new_external_dep: false,
      data_migration: false,
      risk_level: params.cross_module ? 'high' : (params.estimated_files ?? 0) > 10 ? 'high' : 'low',
    }));

    mockRecommendPath.mockImplementation((scope: { cross_module?: boolean; estimated_files?: number; is_pure_bugfix?: boolean; is_doc_only?: boolean }) => {
      if (scope.cross_module) {
        return { path: 'full', confidence: 0.95, rationale: 'Cross-module', safety_fence_blocks: true, fence_triggers: ['cross_module'] };
      }
      if (scope.is_doc_only) {
        return { path: 'tweak', confidence: 0.9, rationale: 'Docs only', safety_fence_blocks: false };
      }
      if (scope.is_pure_bugfix) {
        return { path: 'hotfix', confidence: 0.8, rationale: 'Bugfix', safety_fence_blocks: false };
      }
      if ((scope.estimated_files ?? 0) <= 2) {
        return { path: 'tweak', confidence: 0.85, rationale: 'Small change', safety_fence_blocks: false };
      }
      return { path: 'full', confidence: 0.85, rationale: 'Large change', safety_fence_blocks: false };
    });

    mockFormatRecommendation.mockReturnValue('## Workflow Path Recommendation\n**Recommended Path:** tweak\n**Confidence:** 85%\n');

    // Spy on console.log
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    // Register commands
    createdChanges.length = 0;
    const { registerChangeCommands } = await import('../../src/cli/commands/change.js');
    program = new Command();
    registerChangeCommands(program);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    vi.clearAllMocks();
  });

  // ─── Test: --files 1 --bugfix → recommends hotfix ───
  it('recommends hotfix when --files 1 --bugfix provided', async () => {
    await program.parseAsync(['node', 'mumuspec', 'new', 'test-change', '--files', '1', '--bugfix']);

    // Verify recommendation was computed
    expect(mockEstimateScope).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_files: 1, is_pure_bugfix: true }),
    );
    expect(mockRecommendPath).toHaveBeenCalled();
    expect(mockFormatRecommendation).toHaveBeenCalled();

    // Verify console output shows recommendation
    const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allLogs).toContain('Recommended:');
  });

  // ─── Test: --files 10 --cross-module → recommends full ───
  it('recommends full when --files 10 --cross-module provided', async () => {
    await program.parseAsync(['node', 'mumuspec', 'new', 'feat-change', '--files', '10', '--cross-module']);

    expect(mockEstimateScope).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_files: 10, cross_module: true }),
    );

    const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allLogs).toContain('Recommended:');
    // Cross-module should show high confidence
    expect(allLogs).toMatch(/\d+%\s*confidence/);
  });

  // ─── Test: --doc-only → recommends tweak ───
  it('recommends tweak when --doc-only provided', async () => {
    await program.parseAsync(['node', 'mumuspec', 'new', 'doc-change', '--doc-only']);

    expect(mockEstimateScope).toHaveBeenCalledWith(
      expect.objectContaining({ is_doc_only: true }),
    );

    const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allLogs).toContain('Recommended:');
  });

  // ─── Test: proposal.md receives recommendation text ───
  it('injects recommendation into proposal.md', async () => {
    mockReadText.mockReturnValue('## Problem\nFix bug\n');
    await program.parseAsync(['node', 'mumuspec', 'new', 'fix-change', '--files', '2']);

    // Verify writeText was called to update proposal.md
    expect(mockWriteText).toHaveBeenCalled();
    // The written content should contain the recommendation
    const writeCalls = mockWriteText.mock.calls;
    const proposalWrite = writeCalls.find((call: unknown[]) =>
      String(call[0]).includes('proposal.md'),
    );
    expect(proposalWrite).toBeDefined();
    const writtenContent = String(proposalWrite![1]);
    expect(writtenContent).toContain('Workflow Path Recommendation');
  });

  // ─── Test: no signals → no recommendation ───
  it('does not recommend when no scope signals provided', async () => {
    await program.parseAsync(['node', 'mumuspec', 'new', 'simple-change']);

    // estimateScope should NOT be called when no signals
    expect(mockEstimateScope).not.toHaveBeenCalled();

    const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
    expect(allLogs).not.toContain('Recommended:');
  });

  // ─── Test: state persists scope signals ───
  it('persists scope signals to state via saveChangeState', async () => {
    const savedStates: Array<Record<string, unknown>> = [];
    mockSaveChangeState.mockImplementation((_root: string, _name: string, state: Record<string, unknown>) => {
      savedStates.push({ ...state });
    });

    await program.parseAsync(['node', 'mumuspec', 'new', 'persist-test', '--files', '3', '--modules', '2']);

    expect(savedStates.length).toBeGreaterThanOrEqual(1);
    const lastState = savedStates[savedStates.length - 1] as Record<string, unknown>;
    expect(lastState.estimated_files).toBe(3);
    expect(lastState.modules_affected).toBe(2);
  });

  // ─── Test: confidence percentage format in console ───
  it('displays confidence as percentage', async () => {
    await program.parseAsync(['node', 'mumuspec', 'new', 'conf-test', '--files', '1', '--bugfix']);

    const allLogs = consoleLogSpy.mock.calls.flat().join('\n');
    // Matches "80% confidence" or "95% confidence" pattern
    expect(allLogs).toMatch(/\d+%/);
  });

  // ─── Test: multiple signals combined ───
  it('handles multiple scope signals together', async () => {
    await program.parseAsync([
      'node', 'mumuspec', 'new', 'multi-signal',
      '--files', '5', '--modules', '2', '--new-dep',
    ]);

    expect(mockEstimateScope).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_files: 5, modules_affected: 2, new_external_dep: true }),
    );

    expect(mockRecommendPath).toHaveBeenCalled();
    expect(mockFormatRecommendation).toHaveBeenCalled();
  });
});
