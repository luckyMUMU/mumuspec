/**
 * Core unit tests for feedback/manager.ts
 *
 * All external dependencies (utils, change/paths, node:fs, node:path) are
 * fully mocked with vi.mock() to keep tests deterministic and I/O-free.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fakeDir = '/fake/project/.mumuspec';

vi.mock('../../src/core/utils.js', () => ({
  existsSync: vi.fn(() => true),
  readYaml: vi.fn(() => undefined),
  writeYaml: vi.fn(),
  readText: vi.fn(() => ''),
  writeText: vi.fn(),
  ensureDir: vi.fn(),
  computeHash: vi.fn(() => 'abc12345'),
  now: vi.fn(() => '2026-08-06T00:00:00Z'),
  appendAuditLog: vi.fn(),
  getMumuSpecDir: vi.fn(() => fakeDir),
  parseFrontmatter: vi.fn(() => ({ feedback_id: 'FB-20260806-abc12345' })),
  getDefaultExport: undefined as any,
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeDir: vi.fn(() => `${fakeDir}/changes/test`),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  readdirSync: vi.fn(() => []),
}));

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  return {
    ...actual,
    join: vi.fn((...args: string[]) => args.join('/')),
    relative: vi.fn(() => 'relative/path.md'),
  };
});

// Import after mocks are declared
const {
  submitFeedback,
  updateFeedbackStatus,
  getFeedbackContent,
  listAllFeedbacks,
  createSessionSummary,
  linkFeedbackToSession,
} = await import('../../src/feedback/manager.js');

// Import mocked modules for assertions
const utils = await import('../../src/core/utils.js');
const fs = await import('node:fs');
const path = await import('node:path');

// ========== Helpers ==========

function resetMocks() {
  vi.clearAllMocks();
  // Re-apply default return values after clearAllMocks
  vi.mocked(utils.existsSync).mockReturnValue(true);
  vi.mocked(utils.readYaml).mockReturnValue(undefined);
  vi.mocked(utils.readText).mockReturnValue('');
  vi.mocked(utils.computeHash).mockReturnValue('abc12345');
  vi.mocked(utils.now).mockReturnValue('2026-08-06T00:00:00Z');
  vi.mocked(utils.getMumuSpecDir).mockReturnValue(fakeDir);
  vi.mocked(utils.parseFrontmatter).mockReturnValue({ feedback_id: 'FB-20260806-abc12345' });
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readdirSync).mockReturnValue([]);
  vi.mocked(path.join).mockImplementation((...args: string[]) => args.join('/'));
  vi.mocked(path.relative).mockReturnValue('relative/path.md');
}

// ========== Tests ==========

describe('submitFeedback', () => {
  beforeEach(resetMocks);

  it('submits basic feedback with only required parameters', () => {
    const result = submitFeedback('/fake/project', {
      type: 'bug',
      title: 'Crash on startup',
    });

    expect(result).toHaveProperty('feedbackId');
    expect(result).toHaveProperty('filePath');
    expect(result.feedbackId).toMatch(/^FB-\d{8}-[a-f0-9]{8}$/);
    expect(result.feedbackId).toBe('FB-20260806-abc12345');
  });

  it('submits feedback with all optional parameters', () => {
    const result = submitFeedback('/fake/project', {
      type: 'feature-request',
      title: 'Add dark mode',
      severity: 'major',
      submitter: 'alice',
      changeName: 'ui-theme',
      sessionId: 'sess-001',
      expected: 'Dark theme should be available',
      actual: 'No theme option exists',
      detail: 'Users have requested dark mode for accessibility',
      impact: 'Accessibility compliance',
      suggestion: 'Add a toggle in settings',
      designRef: 'docs/design/theme.md',
    });

    expect(result.feedbackId).toBe('FB-20260806-abc12345');
    expect(result.filePath).toContain('/fake/project');
  });

  it('returns feedbackId and filePath in the result object', () => {
    const result = submitFeedback('/fake/project', {
      type: 'improvement',
      title: 'Improve performance',
      submitter: 'bob',
    });

    expect(result.feedbackId).toBeDefined();
    expect(typeof result.feedbackId).toBe('string');
    expect(result.filePath).toBeDefined();
    expect(typeof result.filePath).toBe('string');
  });

  it('calls ensureDir to create the feedback directory', () => {
    submitFeedback('/fake/project', {
      type: 'question',
      title: 'How to use this feature?',
    });

    expect(utils.ensureDir).toHaveBeenCalled();
    const callArg = vi.mocked(utils.ensureDir).mock.calls[0]?.[0];
    expect(callArg).toContain('feedback');
    expect(callArg).toContain('user');
  });

  it('calls writeText to persist the feedback file', () => {
    submitFeedback('/fake/project', {
      type: 'bug',
      title: 'Null pointer exception',
      detail: 'Occurs when loading empty config',
    });

    expect(utils.writeText).toHaveBeenCalled();
    const [filePath, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(filePath).toContain('feedback');
    expect(typeof content).toBe('string');
    expect(content).toContain('Null pointer exception');
  });
});

describe('updateFeedbackStatus', () => {
  beforeEach(resetMocks);

  it('updates status to acknowledged', () => {
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260806-abc12345\nstatus: open\n---\n\n# Test Feedback\n',
    );
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-test-feedback.md']);

    updateFeedbackStatus('/fake/project', 'FB-20260806-abc12345', 'acknowledged');

    expect(utils.writeText).toHaveBeenCalled();
    const [, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(content).toContain('status: acknowledged');
  });

  it('updates status to resolved', () => {
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260806-abc12345\nstatus: open\n---\n\n# Test Feedback\n',
    );
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-test-feedback.md']);

    updateFeedbackStatus('/fake/project', 'FB-20260806-abc12345', 'resolved');

    const [, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(content).toContain('status: resolved');
  });

  it('updates status to declined', () => {
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260806-abc12345\nstatus: open\n---\n\n# Test Feedback\n',
    );
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-test-feedback.md']);

    updateFeedbackStatus('/fake/project', 'FB-20260806-abc12345', 'declined');

    const [, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(content).toContain('status: declined');
  });

  it('updates status to in-progress', () => {
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260806-abc12345\nstatus: open\n---\n\n# Test Feedback\n',
    );
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-test-feedback.md']);

    updateFeedbackStatus('/fake/project', 'FB-20260806-abc12345', 'in-progress');

    const [, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(content).toContain('status: in-progress');
  });

  it('appends reason text when provided', () => {
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260806-abc12345\nstatus: open\n---\n\n# Test Feedback\n',
    );
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-test-feedback.md']);

    updateFeedbackStatus(
      '/fake/project',
      'FB-20260806-abc12345',
      'declined',
      'Cannot reproduce in current environment',
    );

    const [, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(content).toContain('Cannot reproduce in current environment');
    expect(content).toContain('declined');
  });
});

describe('getFeedbackContent', () => {
  beforeEach(resetMocks);

  it('returns content when feedback file exists', () => {
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260806-abc12345\ntype: bug\nseverity: critical\ntitle: "Crash"\n---\n\n# Crash\n\nThis is the body.\n',
    );
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-crash.md']);
    vi.mocked(utils.parseFrontmatter).mockReturnValue({
      feedback_id: 'FB-20260806-abc12345',
      type: 'bug',
      severity: 'critical',
      title: 'Crash',
    });

    const result = getFeedbackContent('/fake/project', 'FB-20260806-abc12345');

    expect(result).toBeDefined();
    expect(result?.id).toBe('FB-20260806-abc12345');
  });

  it('returns undefined when file does not exist', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([]);

    const result = getFeedbackContent('/fake/project', 'FB-nonexistent');

    expect(result).toBeUndefined();
  });

  it('returns undefined when directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = getFeedbackContent('/fake/project', 'FB-20260806-abc12345');

    expect(result).toBeUndefined();
  });

  it('returns undefined when no file matches the feedbackId', () => {
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-other-id\ntype: bug\n---\n\n# Other\n',
    );
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-other.md']);

    const result = getFeedbackContent('/fake/project', 'FB-20260806-abc12345');

    expect(result).toBeUndefined();
  });
});

describe('listAllFeedbacks', () => {
  beforeEach(resetMocks);

  it('returns empty array when no feedbacks exist', () => {
    vi.mocked(utils.existsSync).mockReturnValue(false);

    const result = listAllFeedbacks('/fake/project');

    expect(result).toEqual([]);
  });

  it('returns array when feedbacks exist in index', () => {
    vi.mocked(utils.readYaml).mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-06T00:00:00Z',
      entries: [
        {
          id: 'FB-20260806-abc12345',
          date: '2026-08-06',
          title: 'Test bug',
          type: 'bug',
          severity: 'major',
          submitter: 'alice',
          file: 'feedback/user/2026-08-06-test-bug.md',
          status: 'open',
        },
      ],
    });

    const result = listAllFeedbacks('/fake/project');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('FB-20260806-abc12345');
    expect(result[0]?.title).toBe('Test bug');
  });
});

describe('createSessionSummary', () => {
  beforeEach(resetMocks);

  it('creates session summary and calls writeText', () => {
    const result = createSessionSummary('/fake/project', {
      sessionId: 'sess-001',
      agent: 'claude',
      agentVersion: '2.1.0',
      changeType: 'feature',
      outcome: 'success',
      title: 'Implement dark mode',
    });

    expect(utils.writeText).toHaveBeenCalled();
    expect(result.sessionId).toBe('sess-001');
    expect(result.filePath).toContain('sessions');
  });

  it('creates session summary with association to change and feedbacks', () => {
    const result = createSessionSummary('/fake/project', {
      sessionId: 'sess-002',
      agent: 'claude',
      changeType: 'bugfix',
      outcome: 'partial',
      title: 'Fix null pointer',
      changeName: 'null-pointer-fix',
      feedbackIds: ['FB-20260806-abc12345'],
      artifactSummary: 'Patched null guard in config loader',
      patternsObserved: ['Missing null guards in config path'],
    });

    const [, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(result.sessionId).toBe('sess-002');
    expect(content).toContain('FB-20260806-abc12345');
  });
});

describe('linkFeedbackToSession', () => {
  beforeEach(resetMocks);

  it('links feedback to session summary file when session is found', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-session.md']);
    vi.mocked(utils.readText).mockReturnValue(
      '---\nsession_id: sess-001\n---\n\n# Session Summary\n',
    );

    linkFeedbackToSession(
      '/fake/project',
      'sess-001',
      'FB-20260806-abc12345',
      'feedback/user/2026-08-06-test.md',
    );

    expect(utils.writeText).toHaveBeenCalled();
    const [filePath, content] = vi.mocked(utils.writeText).mock.calls[0] ?? [];
    expect(filePath).toContain('sessions');
    expect(content).toContain('FB-20260806-abc12345');
  });

  it('does nothing when no matching session file exists', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-06-other-session.md']);
    vi.mocked(utils.readText).mockReturnValue(
      '---\nsession_id: different-session\n---\n\n# Other Session\n',
    );

    linkFeedbackToSession(
      '/fake/project',
      'sess-target',
      'FB-20260806-abc12345',
      'feedback/user/test.md',
    );

    // writeText should NOT have been called since no match was found
    expect(utils.writeText).not.toHaveBeenCalled();
  });

  it('does nothing when sessions directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    linkFeedbackToSession(
      '/fake/project',
      'sess-001',
      'FB-20260806-abc12345',
      'feedback/user/test.md',
    );

    expect(utils.writeText).not.toHaveBeenCalled();
  });
});
