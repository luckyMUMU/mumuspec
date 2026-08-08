/**
 * Branch coverage tests for src/cli/commands/change.ts — uncovered branches:
 * - MumuSpecError handling in new/archive/discard handlers (lines 165, 258, 285)
 * - Scope signals with various option combinations (lines 119-127)
 * - Next steps output for hotfix/tweak/full workflows (line 153-162)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadConfig,
  mockCreateChange,
  mockLoadChangeState,
  mockSaveChangeState,
  mockListActiveChanges,
  mockListArchivedChanges,
  mockGetActiveChange,
  mockDiscardChange,
  mockArchiveChange,
  mockGetChangeStatusSummary,
  mockGetChangeDir,
  mockReadText,
  mockWriteText,
  mockEstimateScope,
  mockRecommendPath,
  mockFormatRecommendation,
  mockComputeSkillSet,
  mockFormatError,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadConfig: vi.fn(),
  mockCreateChange: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockSaveChangeState: vi.fn(),
  mockListActiveChanges: vi.fn(),
  mockListArchivedChanges: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockDiscardChange: vi.fn(),
  mockArchiveChange: vi.fn(),
  mockGetChangeStatusSummary: vi.fn(),
  mockGetChangeDir: vi.fn(),
  mockReadText: vi.fn(),
  mockWriteText: vi.fn(),
  mockEstimateScope: vi.fn(),
  mockRecommendPath: vi.fn(),
  mockFormatRecommendation: vi.fn(),
  mockComputeSkillSet: vi.fn(),
  mockFormatError: vi.fn(),
}));

// ── Module mocks ──

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    writeText: mockWriteText,
  };
});

vi.mock('../../../src/core/config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/config.js')>();
  return {
    ...actual,
    loadConfig: mockLoadConfig,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    createChange: mockCreateChange,
    loadChangeState: mockLoadChangeState,
    saveChangeState: mockSaveChangeState,
    listActiveChanges: mockListActiveChanges,
    listArchivedChanges: mockListArchivedChanges,
    getActiveChange: mockGetActiveChange,
    discardChange: mockDiscardChange,
    archiveChange: mockArchiveChange,
    getChangeStatusSummary: mockGetChangeStatusSummary,
    getChangeDir: mockGetChangeDir,
  };
});

vi.mock('../../../src/core/workflow-recommender.js', () => ({
  estimateScope: mockEstimateScope,
  recommendPath: mockRecommendPath,
  formatRecommendation: mockFormatRecommendation,
}));

vi.mock('../../../src/core/skill-loader.js', () => ({
  computeSkillSet: mockComputeSkillSet,
}));

vi.mock('../../../src/core/errors.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/errors.js')>();
  return {
    ...actual,
    formatError: mockFormatError,
  };
});

// Import after mocks
const { registerChangeCommands } = await import('../../../src/cli/commands/change.js');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function createProgram(): Command {
  const program = new Command();
  registerChangeCommands(program);
  return program;
}

const FAKE_ROOT = '/fake/project';
const VALID_CONFIG = { constraint_strength: { technical_design: 'high', requirement_goals: 'high', exceptions: [] } };

function validState(overrides: Record<string, unknown> = {}) {
  return {
    name: 'test-change',
    workflow: 'full',
    phase: 'open',
    scope: [],
    dist_spec: { prd: '.mumuspec/prd.md', tech: '.mumuspec/tech.md' },
    estimated_files: 0,
    modules_affected: 1,
    cross_module: false,
    new_public_api: false,
    new_external_dep: false,
    data_migration: false,
    is_doc_only: false,
    is_pure_bugfix: false,
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('change command — MumuSpecError handling', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(JSON.parse(JSON.stringify(VALID_CONFIG)));
    mockGetChangeDir.mockReturnValue(`${FAKE_ROOT}/.mumuspec/changes/test-change`);
    mockEstimateScope.mockReturnValue('medium');
    mockRecommendPath.mockReturnValue({ path: 'full', confidence: 0.85 });
    mockFormatRecommendation.mockReturnValue('## Path Recommendation\nUse full workflow.');
    mockComputeSkillSet.mockReturnValue([]);
    mockFormatError.mockReturnValue('[E-CHANGE-001] CHANGE_ALREADY_ACTIVE\n  描述: 已有活跃变更');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle MumuSpecError in new handler with formatError output', async () => {
    const { MumuSpecError } = await import('../../../src/core/errors.js');
    mockCreateChange.mockImplementation(() => {
      throw new MumuSpecError('E-CHANGE-001', { '当前变更': 'existing-change' });
    });

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'new', 'dup-change']))
      .rejects.toThrow('process.exit called with code 1');

    expect(mockFormatError).toHaveBeenCalledWith('E-CHANGE-001', { '当前变更': 'existing-change' });
    expect(errorSpy).toHaveBeenCalledWith('[E-CHANGE-001] CHANGE_ALREADY_ACTIVE\n  描述: 已有活跃变更');
  });

  it('should handle MumuSpecError in archive handler', async () => {
    const { MumuSpecError } = await import('../../../src/core/errors.js');
    mockArchiveChange.mockImplementation(() => {
      throw new MumuSpecError('E-CHANGE-006', { '当前phase': 'build', '需要': 'archive-in-progress' });
    });

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'archive', '--confirm', 'bad-phase']))
      .rejects.toThrow('process.exit called with code 1');

    expect(mockFormatError).toHaveBeenCalledWith('E-CHANGE-006', { '当前phase': 'build', '需要': 'archive-in-progress' });
    expect(errorSpy).toHaveBeenCalledWith('[E-CHANGE-001] CHANGE_ALREADY_ACTIVE\n  描述: 已有活跃变更');
  });

  it('should handle MumuSpecError in discard handler', async () => {
    const { MumuSpecError } = await import('../../../src/core/errors.js');
    mockDiscardChange.mockImplementation(() => {
      throw new MumuSpecError('E-CHANGE-004', { reason: 'test cases locked' });
    });

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'discard', '--confirm', 'locked-change']))
      .rejects.toThrow('process.exit called with code 1');

    expect(mockFormatError).toHaveBeenCalledWith('E-CHANGE-004', { reason: 'test cases locked' });
  });
});

describe('change command — scope signals and recommendation output', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(JSON.parse(JSON.stringify(VALID_CONFIG)));
    mockGetChangeDir.mockReturnValue(`${FAKE_ROOT}/.mumuspec/changes/test-change`);
    mockEstimateScope.mockReturnValue('medium');
    mockRecommendPath.mockReturnValue({ path: 'full', confidence: 0.92 });
    mockFormatRecommendation.mockReturnValue('## Path Recommendation\nUse full workflow.');
    mockComputeSkillSet.mockReturnValue([]);
    mockReadText.mockReturnValue('Existing proposal');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should output recommended path with confidence percentage when scope signals present', async () => {
    mockCreateChange.mockReturnValue(validState({ estimated_files: 10, modules_affected: 3 }));

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'big-change', '--files', '10', '--modules', '3']);

    // Recommendation should be printed with confidence
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Recommended:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('92% confidence'));
  });

  it('should persist scope signals in state with cross_module flag', async () => {
    const savedState: Record<string, unknown> = {};
    mockCreateChange.mockReturnValue(validState());
    mockSaveChangeState.mockImplementation((_root: string, _name: string, state: Record<string, unknown>) => {
      Object.assign(savedState, state);
    });

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'cross-change', '--cross-module']);

    // State should have scope signals persisted
    expect(mockSaveChangeState).toHaveBeenCalled();
    expect(savedState.cross_module).toBe(true);
    expect(savedState.involves_concurrency).toBeUndefined(); // not in state, just checking save called
  });

  it('should persist new_public_api and new_external_dep signals', async () => {
    const savedState: Record<string, unknown> = {};
    mockCreateChange.mockReturnValue(validState());
    mockSaveChangeState.mockImplementation((_root: string, _name: string, state: Record<string, unknown>) => {
      Object.assign(savedState, state);
    });

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'api-change', '--new-api', '--new-dep']);

    expect(savedState.new_public_api).toBe(true);
    expect(savedState.new_external_dep).toBe(true);
  });

  it('should persist data_migration, doc_only, and bugfix signals', async () => {
    const savedState: Record<string, unknown> = {};
    mockCreateChange.mockReturnValue(validState());
    mockSaveChangeState.mockImplementation((_root: string, _name: string, state: Record<string, unknown>) => {
      Object.assign(savedState, state);
    });

    const program = createProgram();
    await program.parseAsync([
      'node', 'mumuspec', 'new', 'multi-change',
      '--data-migration', '--doc-only', '--bugfix',
    ]);

    expect(savedState.data_migration).toBe(true);
    expect(savedState.is_doc_only).toBe(true);
    expect(savedState.is_pure_bugfix).toBe(true);
  });

  it('should inject recommendation text into proposal.md when proposal exists', async () => {
    mockCreateChange.mockReturnValue(validState({ estimated_files: 5 }));
    mockReadText.mockReturnValue('# My Proposal\nOriginal content');

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'prop-change', '--files', '5']);

    // writeText should be called with original + recommendation
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('proposal.md'),
      expect.stringContaining('Original content')
    );
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('proposal.md'),
      expect.stringContaining('Path Recommendation')
    );
  });

  it('should use fallback values (?? 0, ?? 1, ?? false) when state fields are undefined', async () => {
    // State with undefined scope signal fields → ?? operators kick in
    const stateWithUndefined = {
      name: 'fallback-change',
      workflow: 'full',
      phase: 'open',
      scope: [],
      dist_spec: { prd: '.mumuspec/prd.md', tech: '.mumuspec/tech.md' },
      // estimated_files, modules_affected, etc. are all undefined
    };
    mockCreateChange.mockReturnValue(stateWithUndefined);
    mockSaveChangeState.mockReturnValue(undefined);
    mockReadText.mockReturnValue('Proposal');

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'fallback-change', '--files', '3']);

    // estimateScope should be called with fallback values
    expect(mockEstimateScope).toHaveBeenCalledWith(
      expect.objectContaining({
        estimated_files: 3, // from --files 3
        modules_affected: 1, // fallback
        cross_module: false, // fallback
        new_public_api: false, // fallback
        new_external_dep: false, // fallback
        data_migration: false, // fallback
        is_doc_only: false, // fallback
        is_pure_bugfix: false, // fallback
      })
    );
  });

  it('should NOT inject recommendation when no scope signals provided', async () => {
    mockCreateChange.mockReturnValue(validState());
    mockReadText.mockReturnValue('Original proposal');

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'plain-change']);

    // writeText should NOT be called since hasScopeSignals is false
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('should log Spec files when dist_spec is present', async () => {
    const stateWithDist = {
      name: 'with-dist',
      workflow: 'full',
      phase: 'open',
      scope: [],
      dist_spec: { prd: '.mumuspec/prd.md', tech: '.mumuspec/tech.md' },
    };
    mockCreateChange.mockReturnValue(stateWithDist);
    mockSaveChangeState.mockReturnValue(undefined);

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'with-dist']);

    // Should log "Spec files:" since dist_spec is set
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Spec files:'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('.mumuspec/prd.md'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('.mumuspec/tech.md'));
  });
});

describe('change command — list handler uncovered branches', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: returnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(JSON.parse(JSON.stringify(VALID_CONFIG)));
    mockGetChangeDir.mockReturnValue(`${FAKE_ROOT}/.mumuspec/changes/test-change`);
    mockEstimateScope.mockReturnValue('medium');
    mockRecommendPath.mockReturnValue({ path: 'full', confidence: 0.85 });
    mockFormatRecommendation.mockReturnValue('## Path Recommendation\nUse full workflow.');
    mockComputeSkillSet.mockReturnValue([]);
    mockListActiveChanges.mockReturnValue([]);
    mockListArchivedChanges.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exit(1) when listing and not in project', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'list']))
      .rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should display active changes with state info when present', async () => {
    mockListActiveChanges.mockReturnValue(['change1', 'change2']);
    mockLoadChangeState.mockReturnValue(validState());

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'list']);

    expect(logSpy).toHaveBeenCalledWith('\nActive changes:');
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('change1 [open]'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('change2 [open]'));
  });

  it('should skip active changes where loadChangeState returns null', async () => {
    mockListActiveChanges.mockReturnValue(['change1', 'change2']);
    // loadChangeState returns null for all → if (state) is false
    mockLoadChangeState.mockReturnValue(null);

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'list']);

    expect(logSpy).toHaveBeenCalledWith('\nActive changes:');
    // Should NOT log any change details since state is null
    const changeLog = logSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('[open]')
    );
    expect(changeLog).toBe(false);
  });

  it('should list archived changes with --all flag', async () => {
    mockListActiveChanges.mockReturnValue(['active1']);
    mockListArchivedChanges.mockReturnValue(['archived1', 'archived2']);
    mockLoadChangeState.mockReturnValue(validState());

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'list', '--all']);

    expect(logSpy).toHaveBeenCalledWith('\nArchived changes:');
    expect(logSpy).toHaveBeenCalledWith('  archived1');
    expect(logSpy).toHaveBeenCalledWith('  archived2');
  });
});

describe('change command — discard handler not-in-project', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(JSON.parse(JSON.stringify(VALID_CONFIG)));
    mockDiscardChange.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exit(1) when discarding and not in project', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'discard', 'test-change']))
      .rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should handle MumuSpecError in discard with formatError output', async () => {
    const { MumuSpecError } = await import('../../../src/core/errors.js');
    mockDiscardChange.mockImplementation(() => {
      throw new MumuSpecError('E-CHANGE-004', { reason: 'locked' });
    });
    mockFormatError.mockReturnValue('[E-CHANGE-004] CHANGE_TEST_CASES_LOCKED');

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'discard', '--confirm', 'locked']))
      .rejects.toThrow('process.exit called with code 1');

    expect(mockFormatError).toHaveBeenCalledWith('E-CHANGE-004', { reason: 'locked' });
  });
});

describe('change command — status handler not-in-project', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(JSON.parse(JSON.stringify(VALID_CONFIG)));
    mockGetChangeStatusSummary.mockReturnValue('## Status');
    mockGetActiveChange.mockReturnValue(null);
    mockListArchivedChanges.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should exit(1) when checking status and not in project', async () => {
    mockFindProjectRoot.mockReturnValue(null);

    const program = createProgram();
    await expect(program.parseAsync(['node', 'mumuspec', 'status']))
      .rejects.toThrow('process.exit called with code 1');

    expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
  });

  it('should show "No active changes" and no archived section when both empty', async () => {
    mockGetActiveChange.mockReturnValue(null);
    mockListArchivedChanges.mockReturnValue([]);

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'status']);

    expect(logSpy).toHaveBeenCalledWith('No active changes.');
    // Should NOT log "Archived changes: 0"
    const archivedLog = logSpy.mock.calls.some(
      (call) => typeof call[0] === 'string' && call[0].includes('Archived changes:')
    );
    expect(archivedLog).toBe(false);
  });
});

describe('change command — workflow-specific next steps', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    mockFindProjectRoot.mockReturnValue(FAKE_ROOT);
    mockLoadConfig.mockReturnValue(JSON.parse(JSON.stringify(VALID_CONFIG)));
    mockGetChangeDir.mockReturnValue(`${FAKE_ROOT}/.mumuspec/changes/test-change`);
    mockEstimateScope.mockReturnValue('medium');
    mockRecommendPath.mockReturnValue({ path: 'full', confidence: 0.85 });
    mockFormatRecommendation.mockReturnValue('## Path Recommendation\nUse full workflow.');
    mockComputeSkillSet.mockReturnValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show full workflow next steps (transition to design)', async () => {
    mockCreateChange.mockReturnValue(validState({ workflow: 'full' }));

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'full-change', '--workflow', 'full']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Edit proposal.md'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Create delta-specs/'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Transition to design'));
  });

  it('should show hotfix-specific next steps (skip design)', async () => {
    mockCreateChange.mockReturnValue(validState({ workflow: 'hotfix' }));

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'hotfix-change', '--workflow', 'hotfix']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Edit proposal.md'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Define test-cases/layer-0-cases.md'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Lock test cases'));
  });

  it('should show tweak-specific next steps', async () => {
    mockCreateChange.mockReturnValue(validState({ workflow: 'tweak' }));

    const program = createProgram();
    await program.parseAsync(['node', 'mumuspec', 'new', 'tweak-change', '--workflow', 'tweak']);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Edit proposal.md'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Define test-cases/layer-0-cases.md'));
  });
});
