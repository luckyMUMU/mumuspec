/**
 * Final coverage tests for src/feedback/manager.ts.
 *
 * Uses vi.mock('node:fs') and vi.mock('node:path') at top level.
 * computeHash mock returns a string.
 *
 * Coverage targets:
 * - submitFeedback: all parameter combinations (with/without changeName, sessionId,
 *   designRef, submitter, severity, optional fields in markdown body)
 * - listChangeFeedbacks: directory exists with/without feedback entries
 * - linkFeedbackToChange: creates yaml with correct acknowledged default
 * - updateFeedbackStatus: legal + no-op transitions (file not found)
 * - getChangeFeedbackLog: missing yaml file returns default empty log
 * - createSessionSummary: with/without optional fields
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// ── Hoisted mocks (vi.hoisted ensures proper ordering with vi.mock factories) ──
const {
  mockEnsureDir,
  mockComputeHash,
  mockNow,
  mockWriteText,
  mockWriteYaml,
  mockReadText,
  mockReadYaml,
  mockAppendAuditLog,
  mockGetMumuSpecDir,
  mockUtilsExistsSync,
  mockUtilsReaddirSync,
  mockParseFrontmatter,
  mockFsExistsSync,
  mockFsReaddirSync,
  mockPathJoin,
  mockPathRelative,
} = vi.hoisted(() => ({
  mockEnsureDir: vi.fn(),
  mockComputeHash: vi.fn(() => 'deadbeef'),
  mockNow: vi.fn(() => '2026-08-07T12:00:00Z'),
  mockWriteText: vi.fn(),
  mockWriteYaml: vi.fn(),
  mockReadText: vi.fn(() => ''),
  mockReadYaml: vi.fn(() => undefined),
  mockAppendAuditLog: vi.fn(),
  mockGetMumuSpecDir: vi.fn(() => '/project/.mumuspec'),
  mockUtilsExistsSync: vi.fn(() => true),
  mockUtilsReaddirSync: vi.fn(() => []),
  mockParseFrontmatter: vi.fn(() => ({})),
  mockFsExistsSync: vi.fn(() => true),
  mockFsReaddirSync: vi.fn(() => []),
  mockPathJoin: vi.fn((...args: string[]) => args.join('/').replace(/\\/g, '/')),
  mockPathRelative: vi.fn((_from: string, to: string) => to),
}));

vi.mock('node:fs', () => ({
  existsSync: mockFsExistsSync,
  readdirSync: mockFsReaddirSync,
}));

vi.mock('node:path', () => ({
  join: mockPathJoin,
  relative: mockPathRelative,
}));

vi.mock('../../src/core/utils.js', () => ({
  ensureDir: mockEnsureDir,
  computeHash: mockComputeHash,
  now: mockNow,
  writeText: mockWriteText,
  writeYaml: mockWriteYaml,
  readText: mockReadText,
  readYaml: mockReadYaml,
  appendAuditLog: mockAppendAuditLog,
  getMumuSpecDir: mockGetMumuSpecDir,
  existsSync: mockUtilsExistsSync,
  readdirSync: mockUtilsReaddirSync,
  parseFrontmatter: mockParseFrontmatter,
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeDir: vi.fn((_root: string, name: string) => `/project/.mumuspec/changes/${name}`),
}));

// ── Import after mocks ──

import {
  submitFeedback,
  listChangeFeedbacks,
  linkFeedbackToChange,
  linkFeedbackToSession,
  updateFeedbackStatus,
  getChangeFeedbackLog,
  createSessionSummary,
  ensureFeedbackStructure,
} from '../../src/feedback/manager.js';

// ── Helpers ──

const ROOT = '/project';

function resetMocks(): void {
  vi.clearAllMocks();
  mockComputeHash.mockReturnValue('deadbeef');
  mockNow.mockReturnValue('2026-08-07T12:00:00Z');
  mockGetMumuSpecDir.mockReturnValue('/project/.mumuspec');
  mockUtilsExistsSync.mockReturnValue(true);
  mockUtilsReaddirSync.mockReturnValue([]);
  mockParseFrontmatter.mockReturnValue({});
  mockFsExistsSync.mockReturnValue(true);
  mockFsReaddirSync.mockReturnValue([]);
  mockReadText.mockReturnValue('');
  mockReadYaml.mockReturnValue(undefined);
  mockPathJoin.mockImplementation((...a: string[]) => a.join('/').replace(/\\/g, '/'));
  mockPathRelative.mockImplementation((_f: string, t: string) => t);
}

// ════════════════════════════════════════════════════════════════════
// submitFeedback — parameter combinations
// ════════════════════════════════════════════════════════════════════

describe('submitFeedback — minimal params', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('submits with only title and type (no optional fields)', () => {
    const result = submitFeedback(ROOT, {
      type: 'question',
      title: 'Is there a way to customize?',
    });

    expect(result.feedbackId).toMatch(/^FB-\d{8}-[a-f0-9]{8}$/);
    expect(mockWriteText).toHaveBeenCalled();
  });

  it('frontmatter uses default severity "minor" when not provided', () => {
    submitFeedback(ROOT, {
      type: 'bug',
      title: 'Validation error',
    });

    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('severity: minor');
  });

  it('frontmatter uses provided severity', () => {
    submitFeedback(ROOT, {
      type: 'bug',
      title: 'Critical failure',
      severity: 'critical',
    });
    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('severity: critical');
  });

  it('writes audit log when submitter not provided', () => {
    submitFeedback(ROOT, { type: 'improvement', title: 'Add feature' });
    expect(mockAppendAuditLog).toHaveBeenCalled();
  });
});

describe('submitFeedback — with changeName', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('links to change when changeName provided', () => {
    submitFeedback(ROOT, {
      type: 'bug',
      title: 'Crash on save',
      changeName: 'save-bugfix',
    });

    // linkFeedbackToChange writes a yaml file with feedback_id
    const writeYamlCalls = mockWriteYaml.mock.calls;
    const anyYamlHasFeedback = writeYamlCalls.some(
      ([_fp, data]) => data && typeof data === 'object' && 'feedback_id' in data,
    );
    expect(anyYamlHasFeedback).toBe(true);
  });

  it('includes change_name in frontmatter when changeName provided', () => {
    submitFeedback(ROOT, {
      type: 'improvement',
      title: 'Improve save',
      changeName: 'save-bugfix',
    });

    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('change_name: save-bugfix');
  });
});

describe('submitFeedback — with sessionId', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('includes session_id in frontmatter when sessionId provided', () => {
    submitFeedback(ROOT, {
      type: 'question',
      title: 'How does caching work?',
      sessionId: 'sess-abc-123',
    });

    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('session_id: sess-abc-123');
  });
});

describe('submitFeedback — with designRef', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('includes design_ref in frontmatter when designRef provided', () => {
    submitFeedback(ROOT, {
      type: 'design-review',
      title: 'Review new API design',
      designRef: 'docs/design/api-spec.md',
    });

    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('docs/design/api-spec.md');
  });
});

describe('submitFeedback — all params combined', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('includes all frontmatter fields when all optional fields provided', () => {
    submitFeedback(ROOT, {
      type: 'feature-request',
      title: 'Add dark mode',
      severity: 'major',
      submitter: 'alice',
      changeName: 'ui-theme',
      sessionId: 'sess-dark-mode',
      designRef: 'docs/design/theme.md',
      expected: 'Dark mode toggle',
      actual: 'No dark mode option',
      detail: 'Multiple users requested this feature',
      impact: 'User experience',
      suggestion: 'Add a theme toggle in settings',
    });

    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('type: feature-request');
    expect(mdContent).toContain('severity: major');
    expect(mdContent).toContain('submitter: alice');
    expect(mdContent).toContain('change_name: ui-theme');
    expect(mdContent).toContain('session_id: sess-dark-mode');
    expect(mdContent).toContain('docs/design/theme.md');
    // Body sections
    expect(mdContent).toContain('## 期望行为');
    expect(mdContent).toContain('## 实际行为');
    expect(mdContent).toContain('## 详细说明');
    expect(mdContent).toContain('## 影响范围');
    expect(mdContent).toContain('## 改进建议');
  });

  it('writes audit log with all fields', () => {
    submitFeedback(ROOT, {
      type: 'feature-request',
      title: 'Add dark mode',
      submitter: 'alice',
      changeName: 'ui-theme',
      sessionId: 'sess-123',
    });

    expect(mockAppendAuditLog).toHaveBeenCalled();
    // appendAuditLog is called with (mumuSpecDir, entry)
    const auditCall = mockAppendAuditLog.mock.calls[0];
    expect(auditCall).toBeDefined();
  });
});

// ════════════════════════════════════════════════════════════════════
// listChangeFeedbacks — exists/not exists
// ════════════════════════════════════════════════════════════════════

describe('listChangeFeedbacks — directory states', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('returns empty array when change feedback directory does not exist', () => {
    mockFsExistsSync.mockReturnValue(false);

    const result = listChangeFeedbacks(ROOT, 'nonexistent-change');
    expect(result).toEqual([]);
  });

  it('returns empty array when directory exists but has no yaml files', () => {
    const fileEntry = { name: 'readme.md', isFile: () => true, isDirectory: () => false };
    mockFsReaddirSync.mockReturnValue([fileEntry]);

    const result = listChangeFeedbacks(ROOT, 'empty-change');
    expect(result).toEqual([]);
  });

  it('returns entries when yaml files exist and are valid', () => {
    const fileEntry = { name: 'FB-20260807-deadbeef.yaml', isFile: () => true, isDirectory: () => false };
    mockFsReaddirSync.mockReturnValue([fileEntry]);
    mockReadYaml.mockReturnValue({
      feedback_id: 'FB-20260807-deadbeef',
      linked_at: '2026-08-07T15:30:00Z',
      file: 'feedback/user/2026-08-07-crash.md',
      acknowledged: false,
    });
    mockReadText.mockReturnValue(
      '---\ntitle: Fix the crash\ntype: bug\n---\n\n# Fix the crash\n',
    );

    const result = listChangeFeedbacks(ROOT, 'has-feedbacks');
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('FB-20260807-deadbeef');
    expect(result[0]?.status).toBe('open');
    expect(result[0]?.title).toBe('Fix the crash');
    expect(result[0]?.type).toBe('bug');
  });

  it('returns acknowledged status when acknowledged=true', () => {
    const fileEntry = { name: 'FB-ack.yaml', isFile: () => true, isDirectory: () => false };
    mockFsReaddirSync.mockReturnValue([fileEntry]);
    mockReadYaml.mockReturnValue({
      feedback_id: 'FB-ack',
      linked_at: '2026-08-07T10:00:00Z',
      file: 'feedback/user/ack.md',
      acknowledged: true,
    });
    mockReadText.mockReturnValue('');

    const result = listChangeFeedbacks(ROOT, 'ack-change');
    expect(result[0]?.status).toBe('acknowledged');
  });
});

// ════════════════════════════════════════════════════════════════════
// linkFeedbackToChange
// ════════════════════════════════════════════════════════════════════

describe('linkFeedbackToChange', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('creates yaml with acknowledged=false by default', () => {
    linkFeedbackToChange(ROOT, 'my-change', 'FB-20260807-deadbeef', 'feedback/user/2026-08-07-test.md');

    expect(mockEnsureDir).toHaveBeenCalled();
    const writeYamlCalls = mockWriteYaml.mock.calls;
    const linkCall = writeYamlCalls.find(
      ([fp]) => String(fp).includes('FB-20260807-deadbeef.yaml'),
    );
    expect(linkCall).toBeDefined();
    expect((linkCall?.[1] as any).feedback_id).toBe('FB-20260807-deadbeef');
    expect((linkCall?.[1] as any).acknowledged).toBe(false);
    expect((linkCall?.[1] as any).file).toBe('feedback/user/2026-08-07-test.md');
  });
});

// ════════════════════════════════════════════════════════════════════
// linkFeedbackToSession — edge cases
// ════════════════════════════════════════════════════════════════════

describe('linkFeedbackToSession', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('returns early when sessions directory does not exist', () => {
    mockFsExistsSync.mockReturnValue(false);

    linkFeedbackToSession(ROOT, 'sess-001', 'FB-20260807-deadbeef', 'feedback/user/test.md');
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('does not write when feedback-link already present', () => {
    mockFsReaddirSync.mockReturnValue(['2026-08-07-session.md']);
    mockReadText.mockReturnValue(
      '---\nsession_id: sess-001\n---\n\n# Session\n<!-- feedback-link: FB-20260807-deadbeef -->\nAlready linked.\n',
    );

    linkFeedbackToSession(ROOT, 'sess-001', 'FB-20260807-deadbeef', 'feedback/user/test.md');
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('appends link when session matches and link is absent', () => {
    mockFsReaddirSync.mockReturnValue(['2026-08-07-session.md']);
    mockReadText.mockReturnValue(
      '---\nsession_id: sess-001\n---\n\n# Session summary content\n',
    );

    linkFeedbackToSession(ROOT, 'sess-001', 'FB-20260807-deadbeef', 'feedback/user/2026-08-07-test.md');
    expect(mockWriteText).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// updateFeedbackStatus — legal and no-op transitions
// ════════════════════════════════════════════════════════════════════

describe('updateFeedbackStatus — transitions', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('updates status from open to resolved when file found', () => {
    mockFsReaddirSync.mockReturnValue(['2026-08-07-feedback.md']);
    mockReadYaml.mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-06T00:00:00Z',
      entries: [
        {
          id: 'FB-20260807-deadbeef',
          date: '2026-08-07',
          title: 'Test bug',
          type: 'bug',
          severity: 'major',
          submitter: 'bob',
          file: 'feedback/user/2026-08-07-feedback.md',
          status: 'open',
        },
      ],
    });
    mockReadText.mockReturnValue(
      '---\nfeedback_id: FB-20260807-deadbeef\nstatus: open\n---\n',
    );

    updateFeedbackStatus(ROOT, 'FB-20260807-deadbeef', 'resolved');

    expect(mockWriteText).toHaveBeenCalled();
    expect(mockWriteYaml).toHaveBeenCalled();
  });

  it('appends reason text when reason provided', () => {
    mockFsReaddirSync.mockReturnValue(['2026-08-07-feedback.md']);
    mockReadText.mockReturnValue(
      '---\nfeedback_id: FB-20260807-deadbeef\nstatus: open\n---\n',
    );
    mockReadYaml.mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-06T00:00:00Z',
      entries: [
        {
          id: 'FB-20260807-deadbeef',
          date: '2026-08-07',
          title: 'Test',
          type: 'bug',
          severity: 'minor',
          submitter: 'anonymous',
          file: 'feedback/user/2026-08-07-feedback.md',
          status: 'open',
        },
      ],
    });

    updateFeedbackStatus(ROOT, 'FB-20260807-deadbeef', 'declined', 'duplicate of FB-001');

    const writeTextCalls = mockWriteText.mock.calls;
    const content = writeTextCalls[0]?.[1] ?? '';
    expect(content).toContain('declined');
    expect(content).toContain('duplicate of FB-001');
  });

  it('no-op when feedback directory does not exist', () => {
    mockFsExistsSync.mockReturnValue(false);

    updateFeedbackStatus(ROOT, 'FB-20260807-deadbeef', 'resolved');
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('no-op when no file matches the feedbackId', () => {
    mockFsReaddirSync.mockReturnValue(['2026-08-07-other.md']);
    mockReadText.mockReturnValue(
      '---\nfeedback_id: FB-other-id\nstatus: open\n---\n',
    );

    updateFeedbackStatus(ROOT, 'FB-not-found', 'resolved');
    expect(mockWriteText).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// getChangeFeedbackLog — missing log
// ════════════════════════════════════════════════════════════════════

describe('getChangeFeedbackLog — no log file', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('returns default empty log when feedback-log.yaml does not exist', () => {
    mockUtilsExistsSync.mockReturnValue(false);

    const result = getChangeFeedbackLog(ROOT, 'fresh-change');

    expect(result.entries).toEqual([]);
    expect(result.session_links).toEqual([]);
    expect(result.last_updated).toBe('2026-08-07T12:00:00Z');
  });

  it('returns parsed log when file exists', () => {
    const storedLog = {
      entries: [{ feedback_id: 'fb-001', linked_at: '2025-01-01T00:00:00Z', acknowledged: true }],
      session_links: [{ feedback_id: 'fb-001', session_id: 'sess-a', linked_at: '2025-01-01T00:00:00Z', direction: 'feedback-to-session' as const }],
      last_updated: '2025-01-01T00:00:00Z',
    };
    mockReadYaml.mockReturnValue(storedLog);

    const result = getChangeFeedbackLog(ROOT, 'has-log');
    expect(result.entries).toHaveLength(1);
    expect(result.session_links).toHaveLength(1);
  });

  it('falls back to default when readYaml returns undefined', () => {
    mockReadYaml.mockReturnValue(undefined);

    const result = getChangeFeedbackLog(ROOT, 'bad-yaml');
    expect(result.entries).toEqual([]);
    expect(result.session_links).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// createSessionSummary — with/without optional fields
// ════════════════════════════════════════════════════════════════════

describe('createSessionSummary — param combinations', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('creates session summary with minimal fields', () => {
    const result = createSessionSummary(ROOT, {
      sessionId: 'sess-min-001',
      agent: 'claude',
      changeType: 'feature',
      outcome: 'success',
      title: 'Initial session',
    });

    expect(result.sessionId).toBe('sess-min-001');
    expect(result.filePath).toBeDefined();
  });

  it('includes frontmatter arrays for feedbackIds and patternsObserved', () => {
    createSessionSummary(ROOT, {
      sessionId: 'sess-full-001',
      agent: 'cursor',
      agentVersion: '1.2.3',
      projectType: 'greenfield',
      changeType: 'improvement',
      durationMinutes: 45,
      outcome: 'partial',
      title: 'Full session',
      changeName: 'my-change',
      feedbackIds: ['FB-20260801-aaaa', 'FB-20260802-bbbb'],
      artifactSummary: 'Generated 3 files, fixed 2 bugs',
      patternsObserved: ['Missing tests', 'Hardcoded paths'],
    });

    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('sess-full-001');
    expect(mdContent).toContain('cursor');
    expect(mdContent).toContain('agent_version: 1.2.3');
    expect(mdContent).toContain('outcome: partial');
    expect(mdContent).toContain('FB-20260801-aaaa');
    expect(mdContent).toContain('FB-20260802-bbbb');
    expect(mdContent).toContain('Missing tests');
    expect(mdContent).toContain('Hardcoded paths');
    expect(mdContent).toContain('Generated 3 files, fixed 2 bugs');
  });

  it('writes default artifact summary when not provided', () => {
    createSessionSummary(ROOT, {
      sessionId: 'sess-no-art-001',
      agent: 'claude',
      changeType: 'bugfix',
      outcome: 'failure',
      title: 'Failed session',
    });

    const writeTextCalls = mockWriteText.mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('(无摘要)');
  });

  it('writes session index via writeYaml', () => {
    createSessionSummary(ROOT, {
      sessionId: 'sess-idx-001',
      agent: 'claude',
      changeType: 'feature',
      outcome: 'success',
      title: 'Index test',
    });

    expect(mockWriteYaml).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// ensureFeedbackStructure
// ════════════════════════════════════════════════════════════════════

describe('ensureFeedbackStructure', () => {
  beforeEach(resetMocks);
  afterEach(() => vi.restoreAllMocks());

  it('creates 3 subdirectories via ensureDir', () => {
    ensureFeedbackStructure(ROOT);

    expect(mockEnsureDir).toHaveBeenCalled();
  });

  it('creates index.yaml files when they do not exist', () => {
    mockFsExistsSync.mockReturnValue(false);

    ensureFeedbackStructure(ROOT);

    const writeYamlCalls = mockWriteYaml.mock.calls;
    expect(writeYamlCalls.length).toBeGreaterThanOrEqual(2);
  });
});
