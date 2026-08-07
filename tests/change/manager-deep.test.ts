/**
 * Deep coverage tests for src/change/manager.ts.
 *
 * All submodules (paths, state, listing, lifecycle, archive, decisions) are
 * fully mocked with vi.mock() to keep tests deterministic and I/O-free.
 *
 * This file imports from manager.js directly (not individual submodules) to
 * exercise the re-export chain and increase manager.ts coverage.
 *
 * Covers the full delegate chain for every re-exported function so that
 * manager.ts itself is fully exercised through a single import surface.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';

// ════════════════════════════════════════════════════════════════════
// Mock references — module-scope vi.fn() per existing test conventions
// (matches pattern in tests/change/decisions.test.ts)
// ════════════════════════════════════════════════════════════════════

const mockGetChangesDir = vi.fn();
const mockGetArchiveDir = vi.fn();
const mockGetArchivedChangeDir = vi.fn();
const mockGetChangeDir = vi.fn();
const mockGetChangeStatePath = vi.fn();

const mockLoadChangeState = vi.fn();
const mockSaveChangeState = vi.fn();

const mockListActiveChanges = vi.fn();
const mockListArchivedChanges = vi.fn();
const mockGetActiveChange = vi.fn();

const mockCreateChange = vi.fn();
const mockDiscardChange = vi.fn();
const mockEscalateChange = vi.fn();
const mockSaveSnapshot = vi.fn();
const mockValidateScope = vi.fn();
const mockInitTestCases = vi.fn();
const mockLockTestCases = vi.fn();
const mockVerifyTestCases = vi.fn();
const mockComputeTestCasesHash = vi.fn();
const mockInitBuildLayers = vi.fn();
const mockUpdateBuildLayerStatus = vi.fn();

const mockArchiveChange = vi.fn();
const mockBumpVersionForArchive = vi.fn();
const mockMergeDeltaSpecsToMain = vi.fn();
const mockExtractKnowledgeToGlobal = vi.fn();

const mockAppendDecision = vi.fn();
const mockGetChangeStatusSummary = vi.fn();
const mockAppendFeedbackToChange = vi.fn();
const mockGetChangeFeedbacks = vi.fn();

// ════════════════════════════════════════════════════════════════════
// Module mocks — wrapper-function pattern to keep references live
// ════════════════════════════════════════════════════════════════════

vi.mock('../../src/change/paths.js', () => ({
  getChangesDir: (...args: unknown[]) => mockGetChangesDir(...args),
  getArchiveDir: (...args: unknown[]) => mockGetArchiveDir(...args),
  getArchivedChangeDir: (...args: unknown[]) => mockGetArchivedChangeDir(...args),
  getChangeDir: (...args: unknown[]) => mockGetChangeDir(...args),
  getChangeStatePath: (...args: unknown[]) => mockGetChangeStatePath(...args),
}));

vi.mock('../../src/change/state.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
  saveChangeState: (...args: unknown[]) => mockSaveChangeState(...args),
}));

vi.mock('../../src/change/listing.js', () => ({
  listActiveChanges: (...args: unknown[]) => mockListActiveChanges(...args),
  listArchivedChanges: (...args: unknown[]) => mockListArchivedChanges(...args),
  getActiveChange: (...args: unknown[]) => mockGetActiveChange(...args),
}));

vi.mock('../../src/change/lifecycle.js', () => ({
  createChange: (...args: unknown[]) => mockCreateChange(...args),
  discardChange: (...args: unknown[]) => mockDiscardChange(...args),
  escalateChange: (...args: unknown[]) => mockEscalateChange(...args),
  saveSnapshot: (...args: unknown[]) => mockSaveSnapshot(...args),
  validateScope: (...args: unknown[]) => mockValidateScope(...args),
  initTestCases: (...args: unknown[]) => mockInitTestCases(...args),
  lockTestCases: (...args: unknown[]) => mockLockTestCases(...args),
  verifyTestCases: (...args: unknown[]) => mockVerifyTestCases(...args),
  computeTestCasesHash: (...args: unknown[]) => mockComputeTestCasesHash(...args),
  initBuildLayers: (...args: unknown[]) => mockInitBuildLayers(...args),
  updateBuildLayerStatus: (...args: unknown[]) => mockUpdateBuildLayerStatus(...args),
}));

vi.mock('../../src/change/archive.js', () => ({
  archiveChange: (...args: unknown[]) => mockArchiveChange(...args),
  bumpVersionForArchive: (...args: unknown[]) => mockBumpVersionForArchive(...args),
  mergeDeltaSpecsToMain: (...args: unknown[]) => mockMergeDeltaSpecsToMain(...args),
  extractKnowledgeToGlobal: (...args: unknown[]) => mockExtractKnowledgeToGlobal(...args),
}));

vi.mock('../../src/change/decisions.js', () => ({
  appendDecision: (...args: unknown[]) => mockAppendDecision(...args),
  getChangeStatusSummary: (...args: unknown[]) => mockGetChangeStatusSummary(...args),
  appendFeedbackToChange: (...args: unknown[]) => mockAppendFeedbackToChange(...args),
  getChangeFeedbacks: (...args: unknown[]) => mockGetChangeFeedbacks(...args),
}));

// ════════════════════════════════════════════════════════════════════
// Import from manager.js to exercise re-export chain
// ════════════════════════════════════════════════════════════════════

import {
  // paths
  getChangesDir,
  getArchiveDir,
  getArchivedChangeDir,
  getChangeDir,
  getChangeStatePath,
  // state
  loadChangeState,
  saveChangeState,
  // listing
  listActiveChanges,
  listArchivedChanges,
  getActiveChange,
  // lifecycle
  createChange,
  discardChange,
  escalateChange,
  saveSnapshot,
  validateScope,
  initTestCases,
  lockTestCases,
  verifyTestCases,
  computeTestCasesHash,
  initBuildLayers,
  updateBuildLayerStatus,
  // archive
  archiveChange,
  bumpVersionForArchive,
  mergeDeltaSpecsToMain,
  extractKnowledgeToGlobal,
  // decisions
  appendDecision,
  getChangeStatusSummary,
  appendFeedbackToChange,
  getChangeFeedbacks,
} from '../../src/change/manager.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

const PROJECT_ROOT = '/tmp/test-project';
const CHANGE_NAME = 'test-change';

function resetAllMocks(): void {
  vi.clearAllMocks();
}

// ════════════════════════════════════════════════════════════════════
// Tests — Path re-exports
// ════════════════════════════════════════════════════════════════════

describe('manager.ts — path re-exports', () => {
  beforeEach(resetAllMocks);

  it('getChangesDir delegates to paths module', () => {
    mockGetChangesDir.mockReturnValue('/root/.mumuspec/changes');
    const result = getChangesDir(PROJECT_ROOT, 'src/api');
    expect(mockGetChangesDir).toHaveBeenCalledWith(PROJECT_ROOT, 'src/api');
    expect(result).toBe('/root/.mumuspec/changes');
  });

  it('getArchiveDir delegates to paths module', () => {
    mockGetArchiveDir.mockReturnValue('/root/.mumuspec/changes/archive');
    const result = getArchiveDir(PROJECT_ROOT);
    expect(mockGetArchiveDir).toHaveBeenCalledWith(PROJECT_ROOT);
    expect(result).toBe('/root/.mumuspec/changes/archive');
  });

  it('getArchivedChangeDir delegates to paths module', () => {
    mockGetArchivedChangeDir.mockReturnValue('/root/archive/2025-01-01-old');
    const result = getArchivedChangeDir(PROJECT_ROOT, 'old');
    expect(mockGetArchivedChangeDir).toHaveBeenCalledWith(PROJECT_ROOT, 'old');
    expect(result).toContain('2025-01-01-old');
  });

  it('getChangeDir delegates to paths module', () => {
    mockGetChangeDir.mockReturnValue('/root/.mumuspec/changes/my-feature');
    const result = getChangeDir(PROJECT_ROOT, 'my-feature');
    expect(mockGetChangeDir).toHaveBeenCalledWith(PROJECT_ROOT, 'my-feature');
    expect(result).toContain('my-feature');
  });

  it('getChangeStatePath delegates to paths module', () => {
    mockGetChangeStatePath.mockReturnValue('/root/.mumuspec/changes/c/.mumuspec.yaml');
    const result = getChangeStatePath(PROJECT_ROOT, 'c', '.');
    expect(mockGetChangeStatePath).toHaveBeenCalledWith(PROJECT_ROOT, 'c', '.');
    expect(result).toContain('.mumuspec.yaml');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — State re-exports
// ════════════════════════════════════════════════════════════════════

describe('manager.ts — state re-exports', () => {
  beforeEach(resetAllMocks);

  it('loadChangeState delegates to state module', () => {
    const fakeState = { name: CHANGE_NAME, phase: 'open', workflow: 'full' } as ChangeState;
    mockLoadChangeState.mockReturnValue(fakeState);
    const result = loadChangeState(PROJECT_ROOT, CHANGE_NAME);
    expect(mockLoadChangeState).toHaveBeenCalledWith(PROJECT_ROOT, CHANGE_NAME);
    expect(result).toEqual(fakeState);
  });

  it('saveChangeState delegates to state module', () => {
    const fakeState = { name: CHANGE_NAME } as ChangeState;
    saveChangeState(PROJECT_ROOT, CHANGE_NAME, fakeState);
    expect(mockSaveChangeState).toHaveBeenCalledWith(PROJECT_ROOT, CHANGE_NAME, fakeState);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — Listing re-exports
// ════════════════════════════════════════════════════════════════════

describe('manager.ts — listing re-exports', () => {
  beforeEach(resetAllMocks);

  it('listActiveChanges delegates to listing module', () => {
    mockListActiveChanges.mockReturnValue(['change-a', 'change-b']);
    const result = listActiveChanges(PROJECT_ROOT);
    expect(mockListActiveChanges).toHaveBeenCalledWith(PROJECT_ROOT);
    expect(result).toEqual(['change-a', 'change-b']);
  });

  it('listArchivedChanges delegates to listing module', () => {
    mockListArchivedChanges.mockReturnValue(['2025-01-01-old']);
    const result = listArchivedChanges(PROJECT_ROOT);
    expect(mockListArchivedChanges).toHaveBeenCalledWith(PROJECT_ROOT);
    expect(result).toEqual(['2025-01-01-old']);
  });

  it('getActiveChange delegates to listing module', () => {
    mockGetActiveChange.mockReturnValue('active-feature');
    const result = getActiveChange(PROJECT_ROOT);
    expect(mockGetActiveChange).toHaveBeenCalledWith(PROJECT_ROOT);
    expect(result).toBe('active-feature');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — Lifecycle re-exports
// ════════════════════════════════════════════════════════════════════

describe('manager.ts — lifecycle re-exports', () => {
  beforeEach(resetAllMocks);

  it('createChange delegates to lifecycle module', () => {
    const fakeState = { name: 'new-change', phase: 'open', workflow: 'full' } as ChangeState;
    mockCreateChange.mockReturnValue(fakeState);
    const config = {} as any;
    const result = createChange(PROJECT_ROOT, 'new-change', 'full', config);
    expect(mockCreateChange).toHaveBeenCalledWith(PROJECT_ROOT, 'new-change', 'full', config);
    expect(result).toEqual(fakeState);
  });

  it('discardChange delegates to lifecycle module', () => {
    discardChange(PROJECT_ROOT, 'old-change', 'no longer needed');
    expect(mockDiscardChange).toHaveBeenCalledWith(PROJECT_ROOT, 'old-change', 'no longer needed');
  });

  it('escalateChange delegates to lifecycle module', () => {
    mockEscalateChange.mockReturnValue('.');
    const result = escalateChange(PROJECT_ROOT, 'my-change', 'src/api');
    expect(mockEscalateChange).toHaveBeenCalledWith(PROJECT_ROOT, 'my-change', 'src/api');
    expect(result).toBe('.');
  });

  it('saveSnapshot delegates to lifecycle module', () => {
    mockSaveSnapshot.mockReturnValue('/snapshots/v1');
    const result = saveSnapshot(PROJECT_ROOT, 'snap-change', 'v1');
    expect(mockSaveSnapshot).toHaveBeenCalledWith(PROJECT_ROOT, 'snap-change', 'v1');
    expect(result).toBe('/snapshots/v1');
  });

  it('validateScope delegates to lifecycle module', () => {
    mockValidateScope.mockReturnValue({ valid: true, overflowPaths: [] });
    const result = validateScope(PROJECT_ROOT, 'src/api', ['src/api/auth']);
    expect(mockValidateScope).toHaveBeenCalledWith(PROJECT_ROOT, 'src/api', ['src/api/auth']);
    expect(result.valid).toBe(true);
  });

  it('initTestCases delegates to lifecycle module', () => {
    initTestCases(PROJECT_ROOT, 'tc-change', [0, 1]);
    expect(mockInitTestCases).toHaveBeenCalledWith(PROJECT_ROOT, 'tc-change', [0, 1]);
  });

  it('lockTestCases delegates to lifecycle module', () => {
    mockLockTestCases.mockReturnValue('deadbeef');
    const result = lockTestCases(PROJECT_ROOT, 'lock-change');
    expect(mockLockTestCases).toHaveBeenCalledWith(PROJECT_ROOT, 'lock-change');
    expect(result).toBe('deadbeef');
  });

  it('verifyTestCases delegates to lifecycle module', () => {
    mockVerifyTestCases.mockReturnValue({ valid: true });
    const result = verifyTestCases(PROJECT_ROOT, 'verify-change');
    expect(mockVerifyTestCases).toHaveBeenCalledWith(PROJECT_ROOT, 'verify-change');
    expect(result.valid).toBe(true);
  });

  it('computeTestCasesHash delegates to lifecycle module', () => {
    mockComputeTestCasesHash.mockReturnValue('cafebabe');
    const result = computeTestCasesHash(PROJECT_ROOT, 'hash-change');
    expect(mockComputeTestCasesHash).toHaveBeenCalledWith(PROJECT_ROOT, 'hash-change');
    expect(result).toBe('cafebabe');
  });

  it('initBuildLayers delegates to lifecycle module', () => {
    initBuildLayers(PROJECT_ROOT, 'layers-change', [{ layer: 0, scope: 'src/core' }]);
    expect(mockInitBuildLayers).toHaveBeenCalledWith(PROJECT_ROOT, 'layers-change', [
      { layer: 0, scope: 'src/core' },
    ]);
  });

  it('updateBuildLayerStatus delegates to lifecycle module', () => {
    updateBuildLayerStatus(PROJECT_ROOT, 'status-change', 0, 'done');
    expect(mockUpdateBuildLayerStatus).toHaveBeenCalledWith(PROJECT_ROOT, 'status-change', 0, 'done');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — Archive re-exports
// ════════════════════════════════════════════════════════════════════

describe('manager.ts — archive re-exports', () => {
  beforeEach(resetAllMocks);

  it('archiveChange delegates to archive module', () => {
    archiveChange(PROJECT_ROOT, 'arch-change');
    expect(mockArchiveChange).toHaveBeenCalledWith(PROJECT_ROOT, 'arch-change');
  });

  it('bumpVersionForArchive delegates to archive module', () => {
    mockBumpVersionForArchive.mockReturnValue('1.0.1-alpha.0');
    const result = bumpVersionForArchive(PROJECT_ROOT, 'full');
    expect(mockBumpVersionForArchive).toHaveBeenCalledWith(PROJECT_ROOT, 'full');
    expect(result).toBe('1.0.1-alpha.0');
  });

  it('mergeDeltaSpecsToMain delegates to archive module', () => {
    mergeDeltaSpecsToMain(PROJECT_ROOT, 'delta-change', '/changes/delta-change');
    expect(mockMergeDeltaSpecsToMain).toHaveBeenCalledWith(
      PROJECT_ROOT,
      'delta-change',
      '/changes/delta-change',
    );
  });

  it('extractKnowledgeToGlobal delegates to archive module', () => {
    const state = { name: CHANGE_NAME } as ChangeState;
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, '/changes/test', state);
    expect(mockExtractKnowledgeToGlobal).toHaveBeenCalledWith(
      PROJECT_ROOT,
      CHANGE_NAME,
      '/changes/test',
      state,
    );
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — Decisions re-exports
// ════════════════════════════════════════════════════════════════════

describe('manager.ts — decisions re-exports', () => {
  beforeEach(resetAllMocks);

  it('appendDecision delegates to decisions module', () => {
    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'design', 'Use factory pattern');
    expect(mockAppendDecision).toHaveBeenCalledWith(
      PROJECT_ROOT,
      CHANGE_NAME,
      'design',
      'Use factory pattern',
    );
  });

  it('getChangeStatusSummary delegates to decisions module', () => {
    mockGetChangeStatusSummary.mockReturnValue('Change status summary');
    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);
    expect(mockGetChangeStatusSummary).toHaveBeenCalledWith(PROJECT_ROOT, CHANGE_NAME);
    expect(result).toBe('Change status summary');
  });

  it('appendFeedbackToChange delegates to decisions module', () => {
    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001', 'session-xyz');
    expect(mockAppendFeedbackToChange).toHaveBeenCalledWith(
      PROJECT_ROOT,
      CHANGE_NAME,
      'fb-001',
      'session-xyz',
    );
  });

  it('getChangeFeedbacks delegates to decisions module', () => {
    mockGetChangeFeedbacks.mockReturnValue([
      { feedback_id: 'fb-001', linked_at: '2025-01-01T00:00:00Z', acknowledged: false },
    ]);
    const result = getChangeFeedbacks(PROJECT_ROOT, CHANGE_NAME);
    expect(mockGetChangeFeedbacks).toHaveBeenCalledWith(PROJECT_ROOT, CHANGE_NAME);
    expect(result).toHaveLength(1);
  });
});
