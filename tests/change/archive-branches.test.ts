/**
 * Branch coverage tests for src/change/archive.ts — uncovered branches:
 * mergeDeltaSpecsToMain (scopePath empty, outer catch),
 * extractKnowledgeToGlobal (Q1/Q3/Q4 falsy fields, catch blocks,
 * pagesCreated=0, empty extractionLog, D1/D2/D3/D4 outer/inner catches).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';

// ════════════════════════════════════════════════════════════════════
// Mocks (same pattern as archive.test.ts)
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

import {
  mergeDeltaSpecsToMain,
  extractKnowledgeToGlobal,
} from '../../src/change/archive.js';

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
// Tests — mergeDeltaSpecsToMain uncovered branches
// ════════════════════════════════════════════════════════════════════

describe('mergeDeltaSpecsToMain — scopePath empty branch (line 167)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('merges root-scope -tech.md into project root tech.md', () => {
    // specFile = ".tech.md" → scopePath = "" → targetDir = projectRoot
    // All paths exist by default (mockReturnValue(true)) — only restrict non-relevant ones
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['.tech.md']);
    mockReadFileSync.mockReturnValue('# Root delta tech');

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).toHaveBeenCalled();
    expect(mockAppendFileSync.mock.calls[0][1]).toContain('delta-merged from');
  });

  it('merges root-scope -prd.md into project root prd.md', () => {
    // specFile = ".prd.md" → scopePath = "" → targetDir = projectRoot
    mockExistsSync.mockReturnValue(true);
    mockReaddirSync.mockReturnValue(['.prd.md']);
    mockReadFileSync.mockReturnValue('# Root delta prd');

    mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);

    expect(mockAppendFileSync).toHaveBeenCalled();
  });
});

describe('mergeDeltaSpecsToMain — outer catch (line 201)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('silently catches readdirSync error in mergeDeltaSpecsToMain', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('delta-specs')) return true;
      return false;
    });
    mockReaddirSync.mockImplementation(() => {
      throw new Error('EACCES permission denied');
    });

    expect(() => {
      mergeDeltaSpecsToMain(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`);
    }).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — extractKnowledgeToGlobal uncovered branches
// ════════════════════════════════════════════════════════════════════

describe('extractKnowledgeToGlobal — Q1 branches (lines 230, 234, 241, 246)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('cognitive-map.yaml')) return true;
      return false;
    });
  });

  it('handles undefined cm.entries gracefully (falls back to [])', () => {
    mockReadYaml.mockReturnValue({}); // no entries field

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).not.toHaveBeenCalled();
  });

  it('uses fallback title when Q1 entry has no question', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q1', category: 'persistent' }, // no question field
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({ title: expect.stringContaining('Q1 decision') })
    );
  });

  it('uses N/A fallback when Q1 entry has no answer', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q1', category: 'persistent', question: 'What pattern?' }, // no answer
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({
        content: expect.stringContaining('N/A'),
      })
    );
  });

  it('catches duplicate Q1 knowledge page creation without throwing', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q1', category: 'persistent', question: 'Q1q', answer: 'A' },
      ],
    });
    mockCreateKnowledgePage.mockImplementation(() => {
      throw new Error('Duplicate page ID');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });
});

describe('extractKnowledgeToGlobal — Q3 branches (lines 251, 258, 263)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('cognitive-map.yaml')) return true;
      return false;
    });
  });

  it('uses fallback title when Q3 entry has no question', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q3', status: 'confirmed' }, // no question
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({ title: expect.stringContaining('Q3 derivation') })
    );
  });

  it('uses N/A fallback when Q3 entry has no answer', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q3', status: 'confirmed', question: 'Why this?' }, // no answer
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({
        content: expect.stringContaining('N/A'),
      })
    );
  });

  it('catches duplicate Q3 knowledge page creation without throwing', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q3', status: 'confirmed', question: 'Q3q', answer: 'B' },
      ],
    });
    mockCreateKnowledgePage.mockImplementation(() => {
      throw new Error('Duplicate');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });
});

describe('extractKnowledgeToGlobal — Q4 branches (lines 275, 280)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('cognitive-map.yaml')) return true;
      return false;
    });
  });

  it('uses TBD fallback for Q4 entries without answer', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q4', question: 'Risk X' }, // no answer
      ],
    });

    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    expect(mockCreateKnowledgePage).toHaveBeenCalledWith(
      PROJECT_ROOT,
      expect.any(Object),
      expect.objectContaining({
        type: 'risk',
        content: expect.stringContaining('TBD'),
      })
    );
  });

  it('catches duplicate Q4 risk page creation without throwing', () => {
    mockReadYaml.mockReturnValue({
      entries: [
        { quadrant: 'Q4', question: 'Risk Y', answer: 'mitigated' },
      ],
    });
    mockCreateKnowledgePage.mockImplementation(() => {
      throw new Error('Duplicate');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });
});

describe('extractKnowledgeToGlobal — D1 outer catch (line 282)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('cognitive-map.yaml')) return true;
      return false;
    });
  });

  it('silently catches readYaml error in D1 cognitive-map block', () => {
    mockReadYaml.mockImplementation(() => {
      throw new Error('Invalid YAML');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });
});

describe('extractKnowledgeToGlobal — D2 branches (lines 303, 305)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('decisions.md')) return true;
      return false;
    });
  });

  it('catches duplicate D2 lesson page creation without throwing', () => {
    mockReadText.mockReturnValue('Decision content here');

    // First call (D2) throws, second is irrelevant
    mockCreateKnowledgePage.mockImplementation(() => {
      throw new Error('Duplicate');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });

  it('silently catches readText error in D2 block', () => {
    mockReadText.mockImplementation(() => {
      throw new Error('File read error');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });
});

describe('extractKnowledgeToGlobal — D3 branches (lines 326, 328)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('design.md')) return true;
      return false;
    });
  });

  it('catches duplicate D3 pattern page creation without throwing', () => {
    mockReadText.mockReturnValue('# Design content');
    mockCreateKnowledgePage.mockImplementation(() => {
      throw new Error('Duplicate');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });

  it('silently catches readText error in D3 block', () => {
    mockReadText.mockImplementation(() => {
      throw new Error('Read failure');
    });

    const state = makeChangeState();
    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });
});

describe('extractKnowledgeToGlobal — D4 catch (line 345)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      return false;
    });
  });

  it('catches duplicate D4 hyperplan page creation without throwing', () => {
    mockCreateKnowledgePage.mockImplementation(() => {
      throw new Error('Duplicate');
    });

    const state = makeChangeState({
      hyperplan_result: {
        triggered: true,
        hard_constraints_merged: true,
        open_questions_resolved: true,
        degraded: false,
      },
    });

    expect(() => {
      extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);
    }).not.toThrow();
  });
});

describe('extractKnowledgeToGlobal — state update & audit (lines 351, 363)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    mockGetKnowledgeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/knowledge`);
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      return false;
    });
  });

  it('sets completed=false and skips audit when no pages created', () => {
    // knowledge dir exists but no artifact files exist → pagesCreated = 0
    const state = makeChangeState();
    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    // completed should be false
    expect(state.knowledge_extraction!.completed).toBe(false);
    expect(state.knowledge_extraction!.pages_created_count).toBe(0);

    // No knowledge.extract audit log should be written (extractionLog.length === 0)
    const auditCalls = mockAppendAuditLog.mock.calls;
    const extractEntry = auditCalls.find(
      (call) => call[1]?.action === 'knowledge.extract'
    );
    expect(extractEntry).toBeUndefined();
  });

  it('accumulates pages_created_count from previous value', () => {
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('.mumuspec/knowledge')) return true;
      if (p.includes('design.md')) return true;
      return false;
    });
    mockReadText.mockReturnValue('# Design with patterns');

    const state = makeChangeState({
      knowledge_extraction: {
        completed: true,
        pages_created_count: 5,
        graph_bindings_verified: true,
        conflicts_resolved: true,
      },
    });

    extractKnowledgeToGlobal(PROJECT_ROOT, CHANGE_NAME, `${PROJECT_ROOT}/changes/${CHANGE_NAME}`, state);

    // Should accumulate: 5 + 1 (from design.md) = 6
    expect(state.knowledge_extraction!.pages_created_count).toBe(6);
  });
});
