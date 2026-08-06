/**
 * Handler-level tests for change commands (new, status, list, archive, discard).
 *
 * Strategy: mock all action dependencies (core/utils, core/config, change/manager,
 * core/workflow-recommender, core/skill-loader), register the change commands on a
 * fresh Commander program, then invoke its action handlers via parseAsync().
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
  mockMumuSpecError,
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
  mockMumuSpecError: vi.fn(),
}));

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

function validState() {
  return {
    name: 'test-change',
    workflow: 'full',
    phase: 'open',
    scope: [],
    dist_spec: { prd: '.mumuspec/prd.md', tech: '.mumuspec/tech.md' },
  };
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('change command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number | string) => {
      throw new Error(`process.exit called with code ${code}`);
    }) as typeof process.exit);

    // Default mocks
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

  // ── new command ────────────────────────────────────────

  describe('new handler', () => {
    it('creates change successfully with minimal flags', async () => {
      mockCreateChange.mockReturnValue(validState());
      mockSaveChangeState.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'new', 'test-change']);

      expect(mockCreateChange).toHaveBeenCalledWith(
        FAKE_ROOT, 'test-change', 'full', expect.anything(), []
      );
      expect(mockSaveChangeState).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Change "test-change" created'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Workflow: full'));
    });

    it('exits when not in a mumuspec project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'new', 'test-change']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('handles --files scope signal and injects path recommendation', async () => {
      const state = validState();
      mockCreateChange.mockReturnValue(state);
      mockSaveChangeState.mockReturnValue(undefined);
      mockReadText.mockReturnValue('Existing proposal content');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'new', 'test-change', '--files', '5']);

      expect(mockEstimateScope).toHaveBeenCalledWith(expect.objectContaining({
        estimated_files: 5,
        modules_affected: 1,
      }));
      expect(mockRecommendPath).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalled();
    });

    it('shows next steps for loop workflow', async () => {
      mockCreateChange.mockReturnValue({ ...validState(), workflow: 'loop' });
      mockSaveChangeState.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'new', 'test-change', '--workflow', 'loop']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('mumuspec loop init'));
    });

    it('shows next steps for hotfix workflow', async () => {
      mockCreateChange.mockReturnValue({ ...validState(), workflow: 'hotfix' });
      mockSaveChangeState.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'new', 'test-change', '--workflow', 'hotfix']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Edit proposal.md'));
    });

    it('shows skills when computeSkillSet returns results', async () => {
      mockCreateChange.mockReturnValue(validState());
      mockSaveChangeState.mockReturnValue(undefined);
      mockComputeSkillSet.mockReturnValue([{ name: 'typescript-strict' }]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'new', 'test-change', '--cross-module']);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Skills: typescript-strict'));
    });

    it('handles createChange errors gracefully', async () => {
      mockCreateChange.mockImplementation(() => {
        throw new Error('Change already exists');
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'new', 'test-change']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Change already exists');
    });
  });

  // ── status command ─────────────────────────────────────

  describe('status handler', () => {
    it('shows status with explicit name argument', async () => {
      mockGetChangeStatusSummary.mockReturnValue('## Change Status\nPhase: open\nRound: 0/3');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'status', 'test-change']);

      expect(mockGetChangeStatusSummary).toHaveBeenCalledWith(FAKE_ROOT, 'test-change');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('## Change Status'));
    });

    it('falls back to active change when no name given', async () => {
      mockGetActiveChange.mockReturnValue('active-change');
      mockGetChangeStatusSummary.mockReturnValue('Status for active');

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'status']);

      expect(mockGetChangeStatusSummary).toHaveBeenCalledWith(FAKE_ROOT, 'active-change');
    });

    it('shows "No active changes" when no active change exists', async () => {
      mockGetActiveChange.mockReturnValue(null);
      mockListArchivedChanges.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'status']);

      expect(logSpy).toHaveBeenCalledWith('No active changes.');
    });

    it('lists archived changes when no active but archived exist', async () => {
      mockGetActiveChange.mockReturnValue(null);
      mockListArchivedChanges.mockReturnValue(['old-change', 'older-change']);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'status']);

      expect(logSpy).toHaveBeenCalledWith('No active changes.');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Archived changes: 2'));
    });
  });

  // ── list command ──────────────────────────────────────

  describe('list handler', () => {
    it('lists active changes with state info', async () => {
      mockListActiveChanges.mockReturnValue(['change1', 'change2']);
      mockLoadChangeState.mockReturnValue(validState());

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'list']);

      expect(logSpy).toHaveBeenCalledWith('\nActive changes:');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('change1 [open]'));
    });

    it('shows no active changes when empty', async () => {
      mockListActiveChanges.mockReturnValue([]);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'list']);

      expect(logSpy).toHaveBeenCalledWith('No active changes.');
    });

    it('includes archived when --all flag is set', async () => {
      mockListActiveChanges.mockReturnValue([]);
      mockListArchivedChanges.mockReturnValue(['archived1']);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'list', '--all']);

      expect(logSpy).toHaveBeenCalledWith('\nArchived changes:');
      expect(logSpy).toHaveBeenCalledWith('  archived1');
    });
  });

  // ── archive command ───────────────────────────────────

  describe('archive handler', () => {
    it('archives change successfully', async () => {
      mockArchiveChange.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'archive', 'test-change']);

      expect(mockArchiveChange).toHaveBeenCalledWith(FAKE_ROOT, 'test-change');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Change "test-change" archived'));
    });

    it('handles archive errors', async () => {
      mockArchiveChange.mockImplementation(() => {
        throw new Error('Change not found');
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'archive', 'bad-change']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found');
    });

    it('exits when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(null);

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'archive', 'test-change']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── discard command ───────────────────────────────────

  describe('discard handler', () => {
    it('discards change with default reason', async () => {
      mockDiscardChange.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'discard', 'test-change']);

      expect(mockDiscardChange).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', 'No reason provided');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('✓ Change "test-change" discarded'));
    });

    it('discards with custom reason', async () => {
      mockDiscardChange.mockReturnValue(undefined);

      const program = createProgram();
      await program.parseAsync(['node', 'mumuspec', 'discard', 'test-change', '--reason', 'superseded']);

      expect(mockDiscardChange).toHaveBeenCalledWith(FAKE_ROOT, 'test-change', 'superseded');
    });

    it('handles discard errors', async () => {
      mockDiscardChange.mockImplementation(() => {
        throw new Error('Cannot discard archived change');
      });

      const program = createProgram();
      await expect(program.parseAsync(['node', 'mumuspec', 'discard', 'old-change']))
        .rejects.toThrow('process.exit called with code 1');

      expect(errorSpy).toHaveBeenCalledWith('Error: Cannot discard archived change');
    });
  });
});
