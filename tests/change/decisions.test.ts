/**
 * Tests for src/change/decisions.ts — appendDecision, getChangeStatusSummary,
 * getNextPhaseHint, appendFeedbackToChange, getChangeFeedbacks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChangeState } from '../../src/core/types.js';

// ════════════════════════════════════════════════════════════════════
// Mocks
// ════════════════════════════════════════════════════════════════════

const mockLoadChangeState = vi.fn();
const mockSaveChangeState = vi.fn();
const mockGetChangeDir = vi.fn();
const mockReadText = vi.fn();
const mockWriteText = vi.fn();
const mockComputeHash = vi.fn();
const mockNow = vi.fn();

vi.mock('../../src/change/state.js', () => ({
  loadChangeState: (...args: unknown[]) => mockLoadChangeState(...args),
  saveChangeState: (...args: unknown[]) => mockSaveChangeState(...args),
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeDir: (...args: unknown[]) => mockGetChangeDir(...args),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
  readdirSync: vi.fn(() => []),
}));

vi.mock('node:path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../../src/core/utils.js', () => ({
  readText: (...args: unknown[]) => mockReadText(...args),
  writeText: (...args: unknown[]) => mockWriteText(...args),
  computeHash: (...args: unknown[]) => mockComputeHash(...args),
  now: () => mockNow(),
}));

// Import after mocks are set up
import {
  appendDecision,
  getChangeStatusSummary,
  getNextPhaseHint,
  appendFeedbackToChange,
  getChangeFeedbacks,
} from '../../src/change/decisions.js';

// ════════════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════════════

const PROJECT_ROOT = '/tmp/test-project';
const CHANGE_NAME = 'test-change';

function makeChangeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: CHANGE_NAME,
    phase: 'open',
    workflow: 'full',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    affected_scopes: ['src/core'],
    build_layers: [],
    test_cases: {
      design_locked: false,
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
  mockGetChangeDir.mockReturnValue(`${PROJECT_ROOT}/.mumuspec/changes/${CHANGE_NAME}`);
  mockReadText.mockReturnValue('');
  mockComputeHash.mockReturnValue('abc1234567890def');
  mockWriteText.mockReturnValue(undefined);
  mockSaveChangeState.mockReturnValue(undefined);
}

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('appendDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('appends a decision entry to decisions.md', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'design', 'Use TDD approach');

    expect(mockWriteText).toHaveBeenCalled();
    const [path, content] = mockWriteText.mock.calls[0];
    expect(path).toContain('decisions.md');
    expect(content).toContain('[design]');
    expect(content).toContain('Use TDD approach');
  });

  it('includes timestamp in the decision entry', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'build', 'Layer 1 first');

    const [, content] = mockWriteText.mock.calls[0];
    expect(content).toContain('2025-06-15T10:30:00Z');
  });

  it('appends to existing content rather than overwriting', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());
    mockReadText.mockReturnValue('## Previous decision\n\nExisting content');

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'verify', 'New decision');

    const [, content] = mockWriteText.mock.calls[0];
    expect(content).toContain('## Previous decision');
    expect(content).toContain('New decision');
  });

  it('increments phase count in state decisions_log', () => {
    const state = makeChangeState();
    mockLoadChangeState.mockReturnValue(state);
    mockReadText.mockReturnValue('');

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'design', 'First design decision');

    expect(mockSaveChangeState).toHaveBeenCalled();
    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.decisions_log.counts['design']).toBe(1);
  });

  it('accumulates count for repeated phase decisions', () => {
    const state = makeChangeState();
    state.decisions_log.counts = { design: 2 };
    mockLoadChangeState.mockReturnValue(state);
    mockReadText.mockReturnValue('');

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'design', 'Third design decision');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.decisions_log.counts['design']).toBe(3);
  });

  it('updates content_hash after writing', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());
    mockReadText.mockReturnValue('existing decisions content');

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'build', 'Build decision');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.decisions_log.content_hash).toBe('abc1234567890def');
  });

  it('updates updated_at timestamp', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'design', 'Some desc');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.updated_at).toBe('2025-06-15T10:30:00Z');
  });

  it('handles case when state is null (no save called)', () => {
    mockLoadChangeState.mockReturnValue(undefined);

    appendDecision(PROJECT_ROOT, CHANGE_NAME, 'design', 'Orphan decision');

    expect(mockWriteText).toHaveBeenCalled();
    expect(mockSaveChangeState).not.toHaveBeenCalled();
  });
});

describe('getChangeStatusSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('returns "Change not found" when state is null', () => {
    mockLoadChangeState.mockReturnValue(undefined);

    const result = getChangeStatusSummary(PROJECT_ROOT, 'nonexistent');

    expect(result).toBe('Change not found: nonexistent');
  });

  it('includes change name in summary', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ name: 'my-feature' }));

    const result = getChangeStatusSummary(PROJECT_ROOT, 'my-feature');

    expect(result).toContain('变更: my-feature');
  });

  it('includes current phase in summary', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ phase: 'design' }));

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('Phase: design');
  });

  it('includes workflow type in summary', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ workflow: 'hotfix' }));

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('Workflow: hotfix');
  });

  it('includes created_at and updated_at timestamps', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({ created_at: '2025-03-01T00:00:00Z', updated_at: '2025-03-10T12:00:00Z' })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('创建时间: 2025-03-01T00:00:00Z');
    expect(result).toContain('更新时间: 2025-03-10T12:00:00Z');
  });

  it('displays build layers when present', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({
        build_layers: [
          { layer: 1, scope: 'src/core', status: 'done' },
          { layer: 2, scope: 'src/cli', status: 'in-progress' },
        ],
      })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('Build Layers:');
    expect(result).toContain('Layer 1 (src/core): done');
    expect(result).toContain('Layer 2 (src/cli): in-progress');
  });

  it('shows checkmark for done layers', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({
        build_layers: [{ layer: 1, scope: 'src/core', status: 'done' }],
      })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('✓');
  });

  it('shows in-progress icon for in-progress layers', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({
        build_layers: [{ layer: 1, scope: 'src/core', status: 'in-progress' }],
      })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('◐');
  });

  it('shows circle for pending layers', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({
        build_layers: [{ layer: 1, scope: 'src/core', status: 'pending' }],
      })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('○');
  });

  it('does not display build layers section when empty', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ build_layers: [] }));

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).not.toContain('Build Layers:');
  });

  it('includes test cases lock status', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({
        test_cases: {
          design_locked: true,
          suites_locked: true,
          suites_locked_layers: [1, 2],
          suites_hash: {},
        },
      })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('Test Cases Locked: true');
    expect(result).toContain('Suites Locked: true');
  });

  it('includes rollback and rebuild counts', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({ rollback_count: 1, rollback_limit: 3, rebuild_count: 2, rebuild_limit: 5 })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('Rollback Count: 1/3');
    expect(result).toContain('Rebuild Count: 2/5');
  });

  it('includes cognitive framework output when enabled', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({
        cognitive_framework: {
          enabled: true,
          cognitive_map_ref: 'cognitive-map.yaml',
          q1_count: 5,
          q2_pending: 0,
          q3_pending: 2,
          q4_scans_completed: 4,
          converged: false,
          rounds_completed: 3,
        },
      })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('Cognitive Framework:');
    expect(result).toContain('Q1 entries: 5');
    expect(result).toContain('Q2 pending: 0');
    expect(result).toContain('Q3 pending: 2');
    expect(result).toContain('Q4 scans: 4');
    expect(result).toContain('Converged: false');
    expect(result).toContain('Rounds: 3');
  });

  it('does not include cognitive framework when disabled', () => {
    mockLoadChangeState.mockReturnValue(
      makeChangeState({
        cognitive_framework: {
          enabled: false,
          q1_count: 0,
          q2_pending: 0,
          q3_pending: 0,
          q4_scans_completed: 0,
          converged: false,
          rounds_completed: 0,
        },
      })
    );

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).not.toContain('Cognitive Framework:');
  });

  it('includes next phase hint', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ phase: 'open' }));

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toContain('下一步:');
    expect(result).toContain('design');
  });

  it('does not include next phase hint for archive-completed', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState({ phase: 'archive-completed' }));

    const result = getChangeStatusSummary(PROJECT_ROOT, CHANGE_NAME);

    expect(result).not.toContain('下一步:');
  });
});

describe('getNextPhaseHint', () => {
  it('returns build hint for hotfix workflow in open phase', () => {
    const state = makeChangeState({ phase: 'open', workflow: 'hotfix' });
    const result = getNextPhaseHint(state);
    expect(result).toContain('build');
    expect(result).toContain('hotfix/tweak');
  });

  it('returns build hint for tweak workflow in open phase', () => {
    const state = makeChangeState({ phase: 'open', workflow: 'tweak' });
    const result = getNextPhaseHint(state);
    expect(result).toContain('build');
  });

  it('returns design hint for full workflow in open phase', () => {
    const state = makeChangeState({ phase: 'open', workflow: 'full' });
    const result = getNextPhaseHint(state);
    expect(result).toContain('design');
    expect(result).toContain('Design');
  });

  it('returns build hint for design phase', () => {
    const state = makeChangeState({ phase: 'design' });
    const result = getNextPhaseHint(state);
    expect(result).toContain('build');
  });

  it('returns verify hint for build phase', () => {
    const state = makeChangeState({ phase: 'build' });
    const result = getNextPhaseHint(state);
    expect(result).toContain('verify');
  });

  it('returns archive-in-progress hint for verify phase', () => {
    const state = makeChangeState({ phase: 'verify' });
    const result = getNextPhaseHint(state);
    expect(result).toContain('archive-in-progress');
  });

  it('returnsarchive hint for archive-in-progress phase', () => {
    const state = makeChangeState({ phase: 'archive-in-progress' });
    const result = getNextPhaseHint(state);
    expect(result).toContain('archive');
  });

  it('returns undefined for archive-completed', () => {
    const state = makeChangeState({ phase: 'archive-completed' });
    const result = getNextPhaseHint(state);
    expect(result).toBeUndefined();
  });
});

describe('appendFeedbackToChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('throws error when change does not exist', () => {
    mockLoadChangeState.mockReturnValue(undefined);

    expect(() => {
      appendFeedbackToChange(PROJECT_ROOT, 'nonexistent', 'fb-001');
    }).toThrow(/Change not found: nonexistent/);
  });

  it('creates feedback_log if it does not exist', () => {
    const state = makeChangeState();
    state.feedback_log = undefined;
    mockLoadChangeState.mockReturnValue(state);

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.feedback_log).toBeDefined();
    expect(savedState.feedback_log!.entries.length).toBe(1);
  });

  it('appends a new feedback entry', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.feedback_log!.entries[0].feedback_id).toBe('fb-001');
    expect(savedState.feedback_log!.entries[0].acknowledged).toBe(false);
    expect(savedState.feedback_log!.entries[0].linked_at).toBe('2025-06-15T10:30:00Z');
  });

  it('does not duplicate existing feedback entry', () => {
    const state = makeChangeState();
    state.feedback_log = {
      entries: [{ feedback_id: 'fb-001', linked_at: '2025-01-01T00:00:00Z', acknowledged: false }],
      session_links: [],
    };
    mockLoadChangeState.mockReturnValue(state);

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.feedback_log!.entries.length).toBe(1);
  });

  it('creates new entry when feedback_id is different', () => {
    const state = makeChangeState();
    state.feedback_log = {
      entries: [{ feedback_id: 'fb-001', linked_at: '2025-01-01T00:00:00Z', acknowledged: false }],
      session_links: [],
    };
    mockLoadChangeState.mockReturnValue(state);

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-002');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.feedback_log!.entries.length).toBe(2);
  });

  it('appends session link when sessionId is provided', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001', 'session-abc');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.feedback_log!.session_links.length).toBe(1);
    expect(savedState.feedback_log!.session_links[0]).toEqual({
      feedback_id: 'fb-001',
      session_id: 'session-abc',
      linked_at: '2025-06-15T10:30:00Z',
    });
  });

  it('does not create duplicate session links', () => {
    const state = makeChangeState();
    state.feedback_log = {
      entries: [{ feedback_id: 'fb-001', linked_at: '2025-01-01T00:00:00Z', acknowledged: false }],
      session_links: [{ feedback_id: 'fb-001', session_id: 'session-abc', linked_at: '2025-01-01T00:00:00Z' }],
    };
    mockLoadChangeState.mockReturnValue(state);

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001', 'session-abc');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.feedback_log!.session_links.length).toBe(1);
  });

  it('does not add session link when sessionId is not provided', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.feedback_log!.session_links.length).toBe(0);
  });

  it('updates updated_at timestamp', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    appendFeedbackToChange(PROJECT_ROOT, CHANGE_NAME, 'fb-001');

    const savedState = mockSaveChangeState.mock.calls[0][2] as ChangeState;
    expect(savedState.updated_at).toBe('2025-06-15T10:30:00Z');
  });
});

describe('getChangeFeedbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('returns empty array when state has no feedback_log', () => {
    mockLoadChangeState.mockReturnValue(makeChangeState());

    const result = getChangeFeedbacks(PROJECT_ROOT, CHANGE_NAME);

    expect(result).toEqual([]);
  });

  it('returns empty array when state is null', () => {
    mockLoadChangeState.mockReturnValue(undefined);

    const result = getChangeFeedbacks(PROJECT_ROOT, 'nonexistent');

    expect(result).toEqual([]);
  });

  it('returns mapped feedback entries with session IDs', () => {
    const state = makeChangeState();
    state.feedback_log = {
      entries: [
        { feedback_id: 'fb-001', linked_at: '2025-01-01T00:00:00Z', acknowledged: false },
        { feedback_id: 'fb-002', linked_at: '2025-02-01T00:00:00Z', acknowledged: true },
      ],
      session_links: [
        { feedback_id: 'fb-001', session_id: 'session-xyz', linked_at: '2025-01-01T00:00:00Z' },
      ],
    };
    mockLoadChangeState.mockReturnValue(state);

    const result = getChangeFeedbacks(PROJECT_ROOT, CHANGE_NAME);

    expect(result.length).toBe(2);
    expect(result[0]).toEqual({
      feedback_id: 'fb-001',
      linked_at: '2025-01-01T00:00:00Z',
      acknowledged: false,
      sessionId: 'session-xyz',
    });
    expect(result[1]).toEqual({
      feedback_id: 'fb-002',
      linked_at: '2025-02-01T00:00:00Z',
      acknowledged: true,
      sessionId: undefined,
    });
  });

  it('returns entries without sessionId when no session link exists', () => {
    const state = makeChangeState();
    state.feedback_log = {
      entries: [{ feedback_id: 'fb-003', linked_at: '2025-03-01T00:00:00Z', acknowledged: false }],
      session_links: [],
    };
    mockLoadChangeState.mockReturnValue(state);

    const result = getChangeFeedbacks(PROJECT_ROOT, CHANGE_NAME);

    expect(result[0].sessionId).toBeUndefined();
  });
});
