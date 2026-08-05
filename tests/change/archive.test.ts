/**
 * Tests for src/change/archive.ts — archiveChange, bumpVersionForArchive,
 * mergeDeltaSpecsToMain, extractKnowledgeToGlobal.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';

// ════════════════════════════════════════════════════════════════════
// Mocks
// ════════════════════════════════════════════════════════════════════

const mockLoadChangeState = vi.fn();
const mockSaveChangeState = vi.fn();
const mockGetChangeDir = vi.fn();
const mockGetArchiveDir = vi.fn();
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockAppendFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockRenameSync = vi.fn();
const mockReadText = vi.fn();
const mockNow = vi.fn();
const mockAppendAuditLog = vi.fn();
const mockGetMumuSpecDir = vi.fn();
const mockComputeHash = vi.fn();
const mockReadYaml = vi.fn();
const mockEnsureDir = vi.fn();
const mockLoadConfig = vi.fn();
const mockCreateKnowledgePage = vi.fn();
const mockGetKnowledgeDir = vi.fn();

vi.mock('../../src/change/state.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
  saveChangeState: (...args: unknown[]) => mockSaveChangeState(...args),
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeDir: (...args: unknown[]) => mockGetChangeDir(...args),
  getArchiveDir: (...args: unknown[]) => mockGetArchiveDir(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  appendFileSync: (...args: unknown[]) => mockAppendFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  renameSync: (...args: unknown[]) => mockRenameSync(...args),
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../src/core/utils.js', () => ({
  readYaml: (...args: unknown[]) => mockReadYaml(...args),
  readText: (...args: unknown[]) => mockReadText(...args),
  now: () => mockNow(),
  appendAuditLog: (...args: unknown[]) => mockAppendAuditLog(...args),
  getMumuSpecDir: (...args: unknown[]) => mockGetMumuSpecDir(...args),
  computeHash: (...args: unknown[]) => mockComputeHash(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
}));

vi.mock('../../src/core/config.js', () => ({
  loadConfig: (...args: unknown[]) => mockLoadConfig(...args),
}));

vi.mock('../../src/knowledge/manager.js', () => ({
  createKnowledgePage: (...args: unknown[]) => mockCreateKnowledgePage(...args),
  getKnowledgeDir: (...args: unknown[]) => mockGetKnowledgeDir(...args),
}));

// Import after mocks are set up
import {
  archiveChange,
  bumpVersionForArchive,
  mergeDeltaSpecsToMain,
  extractKnowledgeToGlobal,
} from '../../src/change/archive.js';
import { MumuSpecError } from '../../src/core/errors.js';

// ════════════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════════════

const PROJECT_ROOT = '/tmp/test-project';
const CHANGE_NAME = 'test-change';

function makeChangeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: CHANGE_NAME,
    phase: 'archive-in-progress',
    workflow: 'full',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    affected_scopes: ['src/core'],
    build_layers: [],
    test_cases: {
      design_locked: true,
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 3,
    build_mode: 'incremental',
    tdd_mode: 'tdd',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: true,
    decisions_log: { counts: {}, content_hash: 'hash123' },
    rollback_history: [],
    ...overrides,
  };
}

function setupDefaultMocks(): void {
  mockNow.mockReturnValue('2025-06-15T10:30:00Z');
  mockGetMumuSpecDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec`);
  mockComputeHash.mockReturnValue('abc1234567890def');
  mockGetChangeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/changes/${CHANGE_NAME}`);
  mockGetArchiveDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/changes/archive`);
  mockExistsSync.mockReturnValue(true);
  mockReadFileSync.mockReturnValue('{}');
  mockReadText.mockReturnValue('some content');
  mockLoadConfig.mockReturnValue({ knowledge: { wiki: { dir: '.mumuspec/knowledge' } } });
  mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
  mockCreateKnowledgePage.mockReturnValue(undefined);
  mockReaddirSync.mockReturnValue([]);
  mockReadYaml.mockReturnValue({ entries: [] });
  mockAppendFileSync.mockReturnValue(undefined);
  mockWriteFileSync.mockReturnValue(undefined);
  mockRenameSync.mockReturnValue(undefined);
  mockAppendAuditLog.mockReturnValue(undefined);
  mockEnsureDir.mockReturnValue(undefined);
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('bumpVersionForArchive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('returns null when package.json does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = bumpVersionForArchive(PROJECT_ROOT, 'full');

    expect(result).toBeNull();
  });

  it('returns null when cli.ts does not exist', () => {
    mockExistsSync.mockImplementation((p: string) => !p.includes('cli.ts'));

    const result = bumpVersionForArchive(PROJECT_ROOT, 'full');

    expect(result).toBeNull();
  });

  it('bumps to alpha.0 from release version', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));

    const result = bumpVersionForArchive(PROJECT_ROOT, 'full');

    expect(result).toBe('1.2.4-alpha.0');
  });

  it('increments tag number for tweak workflow', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3-alpha.5' }));

    const result = bumpVersionForArchive(PROJECT_ROOT, 'tweak');

    expect(result).toBe('1.2.3-alpha.6');
  });

  it('increments tag number for hotfix workflow', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '2.0.0-beta.3' }));

    const result = bumpVersionForArchive(PROJECT_ROOT, 'hotfix');

    expect(result).toBe('2.0.0-beta.4');
  });

  it('adds tag.0 when tag exists but has no number', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '3.0.0-rc' }));

    const result = bumpVersionForArchive(PROJECT_ROOT, 'hotfix');

    expect(result).toBe('3.0.0-rc.0');
  });

  it('increments minor and resets tag for standard workflow with prerelease tag', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3-alpha.5' }));

    const result = bumpVersionForArchive(PROJECT_ROOT, 'full');

    expect(result).toBe('1.3.0-alpha.0');
  });

  it('returns null for unparseable version string', () => {
    mockReadFileSync.mockReturnValue(JSON.stringify({ version: 'not-a-version' }));

    const result = bumpVersionForArchive(PROJECT_ROOT, 'full');

    expect(result).toBeNull();
  });

  it('returns null on JSON parse error', () => {
    mockReadFileSync.mockReturnValue('not valid json');

    const result = bumpVersionForArchive(PROJECT_ROOT, 'full');

    expect(result).toBeNull();
  });

  it('updates cli.ts version string when cli.ts contains version pattern', () => {
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('package.json')) return JSON.stringify({ version: '1.0.0' });
      if (p.includes('cli.ts')) return `.version('1.0.0')`;
      return '';
    });
    mockExistsSync.mockReturnValue(true);

    bumpVersionForArchive(PROJECT_ROOT, 'tweak');

    // writeFileSync gets called for both package.json and cli.ts
    expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
  });
});

describe('archiveChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('throws error when change does not exist', () => {
    mockLoadChangeState.mockReturnValue(undefined);

    expect(() => {
      archiveChange(PROJECT_ROOT, 'nonexistent');
    }).toThrow(/Change not found: nonexistent/);
  });

  it('throws E-CHANGE-006 when phase is not archive-in-progress', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ phase: 'build' }));

    expect(() => {
      archiveChange(PROJECT_ROOT, CHANGE_NAME);
    }).toThrow(MumuSpecError);
  });

  it('throws E-CHANGE-006 with correct error code', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ phase: 'verify' }));

    try {
      archiveChange(PROJECT_ROOT, CHANGE_NAME);
      expect.fail('Expected MumuSpecError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(MumuSpecError);
      expect((err as MumuSpecError).code).toBe('E-CHANGE-006');
    }
  });

  it('completes successful archive for full workflow', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ workflow: 'full' }));
    mockExistsSync.mockImplementation((p: string) => !p.includes('delta-specs') && !p.includes('cognitive-map.yaml') && !p.includes('decisions.md') && !p.includes('design.md'));
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockReturnValue(true);

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    expect(mockSaveChangeState).toHaveBeenCalled();
    expect(mockLoadChangeState).toHaveBeenCalledWith(PROJECT_ROOT, CHANGE_NAME, undefined);
  });

  it('sets phase to archive-completed after successful archive', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.phase).toBe('archive-completed');
  });

  it('updates updated_at timestamp during archive', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.updated_at).toBe('2025-06-15T10:30:00Z');
  });

  it('calls appendAuditLog with version bump info when version bumps', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ workflow: 'tweak' }));
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('package.json')) return JSON.stringify({ version: '0.17.0' });
      if (p.includes('cli.ts')) return `.version('0.17.0')`;
      return '';
    });

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    const auditCalls = mockAppendAuditLog.mock.calls;
    const versionBumpEntry = auditCalls.find(
      (call) => call[1].action === 'version.bump'
    );
    expect(versionBumpEntry).toBeDefined();
  });

  it('skips knowledge extraction and delta merge for tweak workflow', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ workflow: 'tweak' }));
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('package.json')) return JSON.stringify({ version: '0.17.0' });
      if (p.includes('cli.ts')) return `.version('0.17.0')`;
      return '';
    });

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.knowledge_extraction).toBeUndefined();
  });

  it('sets knowledge_extraction for non-tweak workflow', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ workflow: 'full' }));
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return false;
      if (p.includes('cognitive-map.yaml')) return false;
      if (p.includes('decisions.md')) return false;
      if (p.includes('design.md')) return false;
      return true;
    });

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.knowledge_extraction).toBeDefined();
    expect(savedState.knowledge_extraction!.completed).toBe(true);
    expect(savedState.knowledge_extraction!.graph_bindings_verified).toBe(true);
    expect(savedState.knowledge_extraction!.conflicts_resolved).toBe(true);
  });

  it('calls getArchiveDir and ensureDir for final move', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('package.json')) return JSON.stringify({ version: '0.17.0' });
      if (p.includes('cli.ts')) return `.version('0.17.0')`;
      return '';
    });

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    expect(mockGetArchiveDir).toHaveBeenCalledWith(PROJECT_ROOT, undefined);
    expect(mockEnsureDir).toHaveBeenCalled();
    expect(mockRenameSync).toHaveBeenCalled();
  });

  it('passes scope parameter to loadChangeState and getChangeDir', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('package.json')) return JSON.stringify({ version: '0.17.0' });
      if (p.includes('cli.ts')) return `.version('0.17.0')`;
      return '';
    });

    archiveChange(PROJECT_ROOT, CHANGE_NAME, 'src/api');

    expect(mockLoadChangeState).toHaveBeenCalledWith(PROJECT_ROOT, CHANGE_NAME, 'src/api');
    expect(mockSaveChangeState).toHaveBeenCalledWith(PROJECT_ROOT, CHANGE_NAME, expect.any(Object), 'src/api');
    expect(mockGetArchiveDir).toHaveBeenCalledWith(PROJECT_ROOT, 'src/api');
  });

  it('appends change.archive audit log entry', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('package.json')) return JSON.stringify({ version: '0.17.0' });
      if (p.includes('cli.ts')) return `.version('0.17.0')`;
      return '';
    });

    archiveChange(PROJECT_ROOT, CHANGE_NAME);

    const auditCalls = mockAppendAuditLog.mock.calls;
    const archiveEntry = auditCalls.find(
      (call) => call[1].action === 'change.archive'
    );
    expect(archiveEntry).toBeDefined();
    expect(archiveEntry![1].result).toBe('success');
    expect(archiveEntry![1].knowledge_extracted).toBe(true);
  });

  it('handles renameSync failure gracefully', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());
    mockRenameSync.mockImplementation(() => { throw new Error('ENOENT'); });
    mockExistsSync.mockReturnValue(false);
    mockReadFileSync.mockImplementation((p: string) => {
      if (p.includes('package.json')) return JSON.stringify({ version: '0.17.0' });
      if (p.includes('cli.ts')) return `.version('0.17.0')`;
      return '';
    });
    mockReaddirSync.mockReturnValue([]);

    expect(() => {
      archiveChange(PROJECT_ROOT, CHANGE_NAME);
    }).not.toThrow();
  });
});

describe('mergeDeltaSpecsToMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('returns early when delta-specs directory does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('returns early when delta-specs has no md files', () => {
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['readme.txt', 'notes.json']);

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it('merges -tech.md file into target scope tech.md when it exists', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return true;
      if (p.includes('-tech.md')) return true;
      if (p.includes('/.mumuspec/tech.md')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['api-tech.md']);
    mockReadFileSync.mockReturnValue('# Delta tech spec');
    mockGetMumuSpecDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec`);

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).toHaveBeenCalled();
    expect(mockAppendFileSync.mock.calls[0][1]).toContain('delta-merged from');
  });

  it('falls back to spec.md when tech.md does not exist in scope', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return true;
      if (p.endsWith('-tech.md')) return true;
      if (p.includes('/.mumuspec/spec.md')) return true;
      if (p.includes('/.mumuspec/tech.md')) return false;
      return false;
    });
    mockReaddirSync.mockReturnValue(['src-api-tech.md']);
    mockReadFileSync.mockReturnValue('# Delta content');

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('merges root -prd.md into root prd.md', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return true;
      if (p.endsWith('-prd.md')) return true;
      if (p.includes('/.mumuspec/prd.md')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['feature-prd.md']);
    mockReadFileSync.mockReturnValue('# Delta prd content');

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('falls back to design.md when prd.md not found', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return true;
      if (p.endsWith('-prd.md')) return true;
      if (p.includes('/.mumuspec/design.md')) return true;
      if (p.includes('/.mumuspec/prd.md')) return false;
      return false;
    });
    mockReaddirSync.mockReturnValue(['feature-prd.md']);
    mockReadFileSync.mockReturnValue('# Delta design content');

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).toHaveBeenCalled();
  });

  it('falls back to main spec.md when no scope match', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return true;
      if (p.endsWith('-tech.md')) return true;
      if (p.endsWith('.md')) return true;
      return false;
    });
    mockReaddirSync.mockReturnValue(['unknown-tech.md']);
    mockReadFileSync.mockReturnValue('# Orphan delta');
    mockGetMumuSpecDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec`);

    // existsSync only returns true for delta-specs and the md files themselves
    // so no scope targets resolve — should fall back to main spec.md
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return true;
      if (p === `${PROJECT_ROOT}/.mumuspec/changes/${CHANGE_NAME}/delta-specs/unknown-tech.md`) return true;
      if (p === `${PROJECT_ROOT}/.mumuspec/spec.md`) return true;
      return false;
    });

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).toHaveBeenCalled();
  });
});

describe('extractKnowledgeToGlobal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      return false;
    });
  });

  it('returns early when knowledge directory does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).not.toHaveBeenCalled();
  });

  it('extracts Q1 persistent entries from cognitive map', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('cognitive-map.yaml')) return true;
      return false;
    });
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q1', category: 'persistent', question: 'What pattern to use?', answer: 'Observer' },
        { quadrant: 'Q2', category: 'persistent', question: 'Unknown knowns?', answer: 'TBD' },
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({ type: 'decision', title: expect.stringContaining('What pattern to use') })
    );
  });

  it('extracts Q3 confirmed entries as rationales', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('cognitive-map.yaml')) return true;
      return false;
    });
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q3', status: 'confirmed', question: 'Why this approach?', answer: 'Simplicity' },
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({ type: 'rationale' })
    );
  });

  it('extracts Q4 entries as risk knowledge page', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('cognitive-map.yaml')) return true;
      return false;
    });
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q4', question: 'Risk A', answer: 'mitigated' },
        { quadrant: 'Q4', question: 'Risk B', answer: 'TBD' },
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({ type: 'risk', title: expect.stringContaining('Residual risks') })
    );
  });

  it('extracts lessons from decisions.md', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('decisions.md')) return true;
      return false;
    });
    mockReadText.mockReturnValue('## Design decision\n\nUse TDD approach.');

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({ type: 'lesson' })
    );
  });

  it('skips decisions.md when content is empty', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('decisions.md')) return true;
      return false;
    });
    mockReadText.mockReturnValue('');

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).not.toHaveBeenCalled();
  });

  it('extracts patterns from design.md', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('design.md')) return true;
      return false;
    });
    mockReadText.mockReturnValue('# Architecture Design\n\nDetailed pattern info.');

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({ type: 'pattern', title: expect.stringContaining('Architecture patterns') })
    );
  });

  it('extracts hyperplan insights when hard_constraints_merged is true', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      return false;
    });
    const state = makeChangeState({
      hyperplan_result: {
        triggered: true,
        hard_constraints_merged: true,
        open_questions_resolved: true,
        degraded: false,
      },
    });

    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalled();
    const callArgs = mockCreateKnowledgePage.mock.calls[0];
    expect(callArgs[0]).toBe(PROJECT_ROOT);
    const pageArg = callArgs[2] as { type: string; title: string; scope: string; id: string; tags: string[] };
    expect(pageArg.type).toBe('decision');
    expect(pageArg.title).toContain('Adversarial design review');
    expect(pageArg.scope).toBe(CHANGE_NAME);
    expect(pageArg.id).toBe(`KE-${CHANGE_NAME}-hyperplan`);
    expect(pageArg.tags).toContain('hyperplan');
  });

  it('updates state knowledge_extraction with pages_created_count', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('design.md')) return true;
      return false;
    });
    mockReadText.mockReturnValue('# Design content with patterns.');

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(state.knowledge_extraction).toBeDefined();
    expect(state.knowledge_extraction!.completed).toBe(true);
    expect(state.knowledge_extraction!.pages_created_count).toBeGreaterThanOrEqual(1);
  });

  it('appends knowledge.extract audit log when pages were created', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('design.md')) return true;
      return false;
    });
    mockReadText.mockReturnValue('# Some architecture patterns.');

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    const auditCalls = mockAppendAuditLog.mock.calls;
    const extractEntry = auditCalls.find(
      (call) => call[1].action === 'knowledge.extract'
    );
    expect(extractEntry).toBeDefined();
    expect(extractEntry![1].result).toBe('success');
  });
});
