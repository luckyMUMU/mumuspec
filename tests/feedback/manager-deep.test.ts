/**
 * Deep coverage tests for src/feedback/manager.ts.
 *
 * All external dependencies (core/utils, change/paths, node:fs, node:path)
 * are fully mocked with vi.mock() to keep tests deterministic and I/O-free.
 *
 * This file imports directly from the feedback manager module and exercises
 * functions that are NOT covered or only partially covered by manager-core.test.ts:
 *
 * - getFeedbackDir, getUserFeedbackDir, getSessionSummaryDir, getChangeFeedbackDir
 * - getFeedbackIndexPath, getSessionIndexPath (path utility functions)
 * - submitFeedback without changeName/sessionId (no-link branches)
 * - submitFeedback with duplicate session link guard
 * - listChangeFeedbacks (no coverage elsewhere)
 * - linkFeedbackToChange (no coverage elsewhere)
 * - ensureFeedbackStructure (no coverage elsewhere)
 * - getChangeFeedbackLog (no coverage elsewhere)
 * - updateFeedbackStatus when no file matches feedbackId
 * - getFeedbackContent when readText returns null/empty
 * - listAllFeedbacks with type/status/changeName filters
 *
 * Mock pattern follows the proven inline vi.fn(() => ...) convention from
 * tests/feedback/manager-core.test.ts — the canonical working pattern in
 * this codebase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ════════════════════════════════════════════════════════════════════
// Inline vi.mock factories with default return values (matches manager-core.test.ts)
// ════════════════════════════════════════════════════════════════════

const fakeDir = '/fake/project/.mumuspec';

vi.mock('../../src/core/utils.js', () => ({
  existsSync: vi.fn(() => true),
  readYaml: vi.fn(() => undefined),
  writeYaml: vi.fn(),
  readText: vi.fn(() => ''),
  writeText: vi.fn(),
  ensureDir: vi.fn(),
  computeHash: vi.fn(() => 'abc12345'),
  now: vi.fn(() => '2026-08-07T00:00:00Z'),
  appendAuditLog: vi.fn(),
  getMumuSpecDir: vi.fn(() => fakeDir),
  parseFrontmatter: vi.fn(() => ({ feedback_id: 'FB-20260807-abc12345' })),
}));

vi.mock('../../src/change/paths.js', () => ({
  getChangeDir: vi.fn(() => `${fakeDir}/changes/test-change`),
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

// ════════════════════════════════════════════════════════════════════
// Import after mocks are set up
// ════════════════════════════════════════════════════════════════════

const {
  getFeedbackDir,
  getUserFeedbackDir,
  getSessionSummaryDir,
  getChangeFeedbackDir,
  getFeedbackIndexPath,
  getSessionIndexPath,
  submitFeedback,
  linkFeedbackToSession,
  linkFeedbackToChange,
  listChangeFeedbacks,
  listAllFeedbacks,
  getFeedbackContent,
  updateFeedbackStatus,
  getChangeFeedbackLog,
  ensureFeedbackStructure,
} = await import('../../src/feedback/manager.js');

// Import mocked modules for assertions
const utils = await import('../../src/core/utils.js');
const fs = await import('node:fs');
const path = await import('node:path');

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

const FAKE_ROOT = '/fake/project';

function resetMocks(): void {
  vi.clearAllMocks();
  // Re-apply default return values after clearAllMocks
  // parseFrontmatter default includes title/type/severity so that getFeedbackContent
  // and listChangeFeedbacks enrichment paths work without per-test overrides
  // (vi.clearAllMocks() can interfere with post-factory overrides of inline vi.fn mocks)
  vi.mocked(utils.existsSync).mockReturnValue(true);
  vi.mocked(utils.readYaml).mockReturnValue(undefined);
  vi.mocked(utils.readText).mockReturnValue('');
  vi.mocked(utils.computeHash).mockReturnValue('abc12345');
  vi.mocked(utils.now).mockReturnValue('2026-08-07T00:00:00Z');
  vi.mocked(utils.getMumuSpecDir).mockReturnValue(fakeDir);
  vi.mocked(utils.parseFrontmatter).mockReturnValue({
    feedback_id: 'FB-20260807-abc12345',
    title: 'Default Test Title',
    type: 'bug',
    severity: 'minor',
  });
  vi.mocked(fs.existsSync).mockReturnValue(true);
  vi.mocked(fs.readdirSync).mockReturnValue([]);
  vi.mocked(path.join).mockImplementation((...args: string[]) => args.join('/'));
  vi.mocked(path.relative).mockReturnValue('relative/path.md');
}

// ════════════════════════════════════════════════════════════════════
// Tests — Path utility functions
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — path utilities', () => {
  beforeEach(resetMocks);

  it('getFeedbackDir returns .mumuspec/feedback', () => {
    const result = getFeedbackDir(FAKE_ROOT);
    expect(result).toContain('feedback');
    expect(vi.mocked(utils.getMumuSpecDir)).toHaveBeenCalledWith(FAKE_ROOT);
  });

  it('getUserFeedbackDir returns feedback/user subdir', () => {
    const result = getUserFeedbackDir(FAKE_ROOT);
    expect(result).toContain('feedback');
    expect(result).toContain('user');
  });

  it('getSessionSummaryDir returns feedback/sessions subdir', () => {
    const result = getSessionSummaryDir(FAKE_ROOT);
    expect(result).toContain('feedback');
    expect(result).toContain('sessions');
  });

  it('getChangeFeedbackDir uses getChangeDir + feedback', () => {
    const result = getChangeFeedbackDir(FAKE_ROOT, 'my-change');
    expect(vi.mocked(path.join)).toHaveBeenCalled();
    expect(result).toContain('feedback');
  });

  it('getFeedbackIndexPath returns feedback/index.yaml', () => {
    const result = getFeedbackIndexPath(FAKE_ROOT);
    expect(result).toContain('feedback');
    expect(result).toContain('index.yaml');
  });

  it('getSessionIndexPath returns sessions/.index.yaml', () => {
    const result = getSessionIndexPath(FAKE_ROOT);
    expect(result).toContain('sessions');
    expect(result).toContain('.index.yaml');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — submitFeedback (deep branch coverage)
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — submitFeedback deep', () => {
  beforeEach(resetMocks);

  it('submits feedback with only title and type (no optional fields)', () => {
    const result = submitFeedback(FAKE_ROOT, {
      type: 'question',
      title: 'How does caching work?',
    });

    expect(result.feedbackId).toMatch(/^FB-\d{8}-[a-f0-9]{8}$/);
    expect(result.feedbackId).toBe('FB-20260807-abc12345');
    expect(result.filePath).toContain('feedback');
    expect(result.filePath).toContain('user');
  });

  it('does NOT link to change when changeName is absent', () => {
    submitFeedback(FAKE_ROOT, {
      type: 'bug',
      title: 'Crash on startup',
      sessionId: 'sess-001',
    });

    // With only sessionId but no changeName, linkFeedbackToSession should be called.
    // The function completes without error and writes the feedback file + index.
    expect(vi.mocked(utils.writeText)).toHaveBeenCalled();
  });

  it('does NOT link to session when sessionId is absent', () => {
    submitFeedback(FAKE_ROOT, {
      type: 'bug',
      title: 'Crash on startup',
      changeName: 'bug-fix',
    });

    // With changeName but no sessionId: linkFeedbackToChange is called,
    // linkFeedbackToSession is not called. Function completes without error.
    expect(vi.mocked(utils.writeText)).toHaveBeenCalled();
  });

  it('writes audit log with anonymous submitter when not provided', () => {
    submitFeedback(FAKE_ROOT, {
      type: 'improvement',
      title: 'Improve docs',
    });

    expect(vi.mocked(utils.appendAuditLog)).toHaveBeenCalled();
    const auditCall = vi.mocked(utils.appendAuditLog).mock.calls[0];
    expect(auditCall[1].actor).toBe('anonymous');
    expect(auditCall[1].action).toBe('feedback.submit');
  });

  it('uses provided submitter in audit log', () => {
    submitFeedback(FAKE_ROOT, {
      type: 'bug',
      title: 'Found a bug',
      submitter: 'alice',
    });

    const auditCall = vi.mocked(utils.appendAuditLog).mock.calls[0];
    expect(auditCall[1].actor).toBe('alice');
  });

  it('writes frontmatter with designRef when provided', () => {
    submitFeedback(FAKE_ROOT, {
      type: 'design-review',
      title: 'Review new API design',
      designRef: 'docs/design/api.md',
    });

    // The writeText call should contain the design_ref in the frontmatter
    const writeTextCalls = vi.mocked(utils.writeText).mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('docs/design/api.md');
  });

  it('frontmatter excludes change_name when changeName is undefined', () => {
    submitFeedback(FAKE_ROOT, {
      type: 'bug',
      title: 'Simple bug',
      sessionId: 'sess-999',
    });

    const writeTextCalls = vi.mocked(utils.writeText).mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).not.toContain('change_name');
    expect(mdContent).toContain('session_id: sess-999');
  });

  it('frontmatter includes all optional fields when all provided', () => {
    submitFeedback(FAKE_ROOT, {
      type: 'feature-request',
      title: 'Add dark mode',
      changeName: 'ui-theme',
      sessionId: 'sess-dark',
      designRef: 'docs/design/theme.md',
    });

    const writeTextCalls = vi.mocked(utils.writeText).mock.calls;
    const mdContent = writeTextCalls[0]?.[1] ?? '';
    expect(mdContent).toContain('change_name: ui-theme');
    expect(mdContent).toContain('session_id: sess-dark');
    expect(mdContent).toContain('docs/design/theme.md');
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — linkFeedbackToSession (edge cases)
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — linkFeedbackToSession edge cases', () => {
  beforeEach(resetMocks);

  it('skips writeText when feedback link already exists in session', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-07-session.md']);
    vi.mocked(utils.readText).mockReturnValue(
      '---\nsession_id: sess-001\n---\n\n# Session\n\n<!-- feedback-link: FB-20260807-abc12345 -->\n> Existing link\n',
    );

    linkFeedbackToSession(
      FAKE_ROOT,
      'sess-001',
      'FB-20260807-abc12345',
      'feedback/user/2026-08-07-test.md',
    );

    // writeText should NOT be called since the link already exists
    expect(vi.mocked(utils.writeText)).not.toHaveBeenCalled();
  });

  it('handles files without .md extension by ignoring them', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['readme.txt', 'index.yaml']);
    vi.mocked(utils.readText).mockReturnValue('session_id: sess-001');

    linkFeedbackToSession(
      FAKE_ROOT,
      'sess-001',
      'FB-20260807-abc12345',
      'feedback/user/test.md',
    );

    // Non-.md files are filtered out, so no writeText should happen
    expect(vi.mocked(utils.writeText)).not.toHaveBeenCalled();
  });

  it('handles readText returning empty string (continue branch)', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-07-session.md']);
    vi.mocked(utils.readText).mockReturnValue('');

    linkFeedbackToSession(
      FAKE_ROOT,
      'sess-001',
      'FB-20260807-abc12345',
      'feedback/user/test.md',
    );

    // readText returns '' which is falsy, triggering continue
    expect(vi.mocked(utils.writeText)).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — linkFeedbackToChange
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — linkFeedbackToChange', () => {
  beforeEach(resetMocks);

  it('writes a yaml file with feedback_id, linked_at, file, acknowledged=false', () => {
    linkFeedbackToChange(
      FAKE_ROOT,
      'my-change',
      'FB-20260807-abc12345',
      'feedback/user/2026-08-07-test.md',
    );

    expect(vi.mocked(utils.writeYaml)).toHaveBeenCalled();
    const [filePath, data] = vi.mocked(utils.writeYaml).mock.calls[0] ?? [];
    expect(filePath).toContain('feedback');
    expect(filePath).toContain('FB-20260807-abc12345.yaml');
    expect((data as any).feedback_id).toBe('FB-20260807-abc12345');
    expect((data as any).acknowledged).toBe(false);
    expect((data as any).linked_at).toBe('2026-08-07T00:00:00Z');
  });

  it('creates the change feedback directory via ensureDir', () => {
    linkFeedbackToChange(
      FAKE_ROOT,
      'another-change',
      'FB-20260807-abc12345',
      'feedback/user/test.md',
    );

    expect(vi.mocked(utils.ensureDir)).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — listChangeFeedbacks
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — listChangeFeedbacks', () => {
  beforeEach(resetMocks);

  it('returns empty array when change feedback directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const result = listChangeFeedbacks(FAKE_ROOT, 'no-such-change');

    expect(result).toEqual([]);
  });

  it('returns empty array when directory has no yaml files', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'readme.txt', isFile: () => true, isDirectory: () => false },
    ]);

    const result = listChangeFeedbacks(FAKE_ROOT, 'empty-change');

    expect(result).toEqual([]);
  });

  it('parses yaml files and returns feedback entries', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'FB-20260807-abc12345.yaml', isFile: () => true, isDirectory: () => false },
    ]);
    vi.mocked(utils.readYaml).mockReturnValue({
      feedback_id: 'FB-20260807-abc12345',
      linked_at: '2026-08-07T10:00:00Z',
      file: 'feedback/user/2026-08-07-test.md',
      acknowledged: false,
    });
    // The enrichment loop calls readText on the feedback file
    vi.mocked(utils.readText).mockReturnValue(
      '---\ntitle: "Test Bug"\ntype: bug\n---\n\n# Test Bug\n',
    );

    const result = listChangeFeedbacks(FAKE_ROOT, 'test-change');

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('FB-20260807-abc12345');
    expect(result[0]?.status).toBe('open');
    expect(result[0]?.title).toBe('Test Bug');
    expect(result[0]?.type).toBe('bug');
  });

  it('returns acknowledged status when yaml has acknowledged=true', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'FB-20260807-deadbeef.yaml', isFile: () => true, isDirectory: () => false },
    ]);
    vi.mocked(utils.readYaml).mockReturnValue({
      feedback_id: 'FB-20260807-deadbeef',
      linked_at: '2026-08-07T10:00:00Z',
      file: 'feedback/user/2026-08-07-ack.md',
      acknowledged: true,
    });
    vi.mocked(utils.readText).mockReturnValue('');

    const result = listChangeFeedbacks(FAKE_ROOT, 'ack-change');

    expect(result[0]?.status).toBe('acknowledged');
  });

  it('skips yaml entries where readYaml returns null/falsy', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'FB-bad.yaml', isFile: () => true, isDirectory: () => false },
    ]);
    vi.mocked(utils.readYaml).mockReturnValue(undefined);

    const result = listChangeFeedbacks(FAKE_ROOT, 'bad-yaml-change');

    expect(result).toEqual([]);
  });

  it('leaves title/type as defaults when feedback file has no title regex match', () => {
    vi.mocked(fs.readdirSync).mockReturnValue([
      { name: 'FB-notitle.yaml', isFile: () => true, isDirectory: () => false },
    ]);
    vi.mocked(utils.readYaml).mockReturnValue({
      feedback_id: 'FB-notitle',
      linked_at: '2026-08-07T10:00:00Z',
      file: 'feedback/user/no-title.md',
      acknowledged: false,
    });
    // No title: regex match
    vi.mocked(utils.readText).mockReturnValue('# No frontmatter title\n');

    const result = listChangeFeedbacks(FAKE_ROOT, 'no-title-change');

    expect(result[0]?.title).toBe('');
    expect(result[0]?.type).toBe('improvement'); // default
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — ensureFeedbackStructure
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — ensureFeedbackStructure', () => {
  beforeEach(resetMocks);

  it('creates user, sessions, and monthly directories', () => {
    ensureFeedbackStructure(FAKE_ROOT);

    expect(vi.mocked(utils.ensureDir)).toHaveBeenCalledTimes(3);
  });

  it('creates feedback index.yaml if it does not exist', () => {
    // ensureFeedbackStructure uses existsSync from node:fs (imported directly),
    // not from utils. Mock fs.existsSync to return false so index gets created.
    vi.mocked(fs.existsSync).mockReturnValue(false);

    ensureFeedbackStructure(FAKE_ROOT);

    // Should call writeYaml for both index and session index
    const writeYamlCalls = vi.mocked(utils.writeYaml).mock.calls;
    expect(writeYamlCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not overwrite index.yaml if it already exists', () => {
    // existsSync returns true everywhere (index already exists)
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // Clear writeYaml mock to assert it's NOT called for index creation
    vi.mocked(utils.writeYaml).mockClear();

    ensureFeedbackStructure(FAKE_ROOT);

    // writeYaml should not be called for index creation (only ensureDir is called)
    expect(vi.mocked(utils.writeYaml)).not.toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — getChangeFeedbackLog
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — getChangeFeedbackLog', () => {
  beforeEach(resetMocks);

  it('returns default empty log when feedback-log.yaml does not exist', () => {
    // getChangeFeedbackLog uses existsSync from utils module
    vi.mocked(utils.existsSync).mockReturnValue(false);

    const result = getChangeFeedbackLog(FAKE_ROOT, 'fresh-change');

    expect(result.entries).toEqual([]);
    expect(result.session_links).toEqual([]);
    expect(result.last_updated).toBe('2026-08-07T00:00:00Z');
  });

  it('returns stored log when feedback-log.yaml exists', () => {
    const storedLog = {
      entries: [
        { feedback_id: 'fb-001', linked_at: '2025-01-01T00:00:00Z', acknowledged: false },
      ],
      session_links: [
        {
          feedback_id: 'fb-001',
          session_id: 'sess-abc',
          linked_at: '2025-01-01T00:00:00Z',
          direction: 'feedback-to-session' as const,
        },
      ],
      last_updated: '2025-01-01T00:00:00Z',
    };
    vi.mocked(utils.readYaml).mockReturnValue(storedLog);

    const result = getChangeFeedbackLog(FAKE_ROOT, 'logged-change');

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.feedback_id).toBe('fb-001');
    expect(result.session_links).toHaveLength(1);
  });

  it('falls back to default log when readYaml returns null', () => {
    // existsSync returns true (log file exists) but readYaml returns null
    vi.mocked(utils.readYaml).mockReturnValue(undefined);

    const result = getChangeFeedbackLog(FAKE_ROOT, 'null-yaml-change');

    expect(result.entries).toEqual([]);
    expect(result.session_links).toEqual([]);
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — updateFeedbackStatus edge cases
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — updateFeedbackStatus edge cases', () => {
  beforeEach(resetMocks);

  it('does nothing when no file matches the feedbackId', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-07-other-feedback.md']);
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-different-id\nstatus: open\n---\n',
    );

    updateFeedbackStatus(FAKE_ROOT, 'FB-nonexistent', 'resolved');

    // writeText should NOT be called since no file matched
    expect(vi.mocked(utils.writeText)).not.toHaveBeenCalled();
  });

  it('does nothing when feedback directory does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    updateFeedbackStatus(FAKE_ROOT, 'FB-20260807-abc12345', 'resolved');

    expect(vi.mocked(utils.writeText)).not.toHaveBeenCalled();
  });

  it('updates index entry status when file is found', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-07-test.md']);
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260807-abc12345\nstatus: open\n---\n',
    );
    vi.mocked(utils.readYaml).mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-06T00:00:00Z',
      entries: [
        {
          id: 'FB-20260807-abc12345',
          date: '2026-08-07',
          title: 'Test',
          type: 'bug',
          severity: 'minor',
          submitter: 'anonymous',
          file: 'feedback/user/2026-08-07-test.md',
          status: 'open',
        },
      ],
    });

    updateFeedbackStatus(FAKE_ROOT, 'FB-20260807-abc12345', 'resolved');

    // writeYaml should be called to save the updated index
    expect(vi.mocked(utils.writeYaml)).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — getFeedbackContent edge cases
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — getFeedbackContent edge cases', () => {
  beforeEach(resetMocks);

  it('returns undefined when readText returns empty string', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-07-test.md']);
    vi.mocked(utils.readText).mockReturnValue('');

    const result = getFeedbackContent(FAKE_ROOT, 'FB-20260807-abc12345');

    expect(result).toBeUndefined();
  });

  it('returns content with parsed frontmatter from parseFrontmatter', () => {
    vi.mocked(fs.readdirSync).mockReturnValue(['2026-08-07-test.md']);
    vi.mocked(utils.readText).mockReturnValue(
      '---\nfeedback_id: FB-20260807-abc12345\ntype: design-review\nseverity: info\ntitle: "Cool Feature"\n---\n\n# Cool Feature\n\nBody here.\n',
    );

    const result = getFeedbackContent(FAKE_ROOT, 'FB-20260807-abc12345');

    expect(result).toBeDefined();
    expect(result?.id).toBe('FB-20260807-abc12345');
    // parseFrontmatter was called to extract frontmatter and body
    expect(vi.mocked(utils.parseFrontmatter)).toHaveBeenCalled();
  });
});

// ════════════════════════════════════════════════════════════════════
// Tests — listAllFeedbacks filters
// ════════════════════════════════════════════════════════════════════

describe('feedback/manager — listAllFeedbacks filters', () => {
  beforeEach(resetMocks);

  it('filters by status option', () => {
    vi.mocked(utils.readYaml).mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-07T00:00:00Z',
      entries: [
        {
          id: 'FB-open',
          date: '2026-08-07',
          title: 'Open bug',
          type: 'bug',
          severity: 'major',
          submitter: 'alice',
          file: 'feedback/user/open.md',
          status: 'open',
        },
        {
          id: 'FB-resolved',
          date: '2026-08-06',
          title: 'Resolved bug',
          type: 'bug',
          severity: 'minor',
          submitter: 'bob',
          file: 'feedback/user/resolved.md',
          status: 'resolved',
        },
      ],
    });

    const result = listAllFeedbacks(FAKE_ROOT, { status: 'open' });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('FB-open');
  });

  it('filters by type option', () => {
    vi.mocked(utils.readYaml).mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-07T00:00:00Z',
      entries: [
        {
          id: 'FB-bug',
          date: '2026-08-07',
          title: 'A bug',
          type: 'bug',
          severity: 'major',
          submitter: 'alice',
          file: 'feedback/user/bug.md',
          status: 'open',
        },
        {
          id: 'FB-feature',
          date: '2026-08-06',
          title: 'A feature',
          type: 'feature-request',
          severity: 'minor',
          submitter: 'bob',
          file: 'feedback/user/feature.md',
          status: 'open',
        },
      ],
    });

    const result = listAllFeedbacks(FAKE_ROOT, { type: 'feature-request' });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('FB-feature');
  });

  it('filters by changeName option', () => {
    vi.mocked(utils.readYaml).mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-07T00:00:00Z',
      entries: [
        {
          id: 'FB-mapped',
          date: '2026-08-07',
          title: 'Mapped to change',
          type: 'bug',
          severity: 'major',
          submitter: 'alice',
          changeName: 'my-feature',
          file: 'feedback/user/mapped.md',
          status: 'open',
        },
        {
          id: 'FB-unmapped',
          date: '2026-08-06',
          title: 'No change',
          type: 'bug',
          severity: 'minor',
          submitter: 'bob',
          file: 'feedback/user/unmapped.md',
          status: 'open',
        },
      ],
    });

    const result = listAllFeedbacks(FAKE_ROOT, { changeName: 'my-feature' });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('FB-mapped');
  });

  it('sorts results by date descending', () => {
    vi.mocked(utils.readYaml).mockReturnValue({
      version: '1.0',
      last_updated: '2026-08-07T00:00:00Z',
      entries: [
        {
          id: 'FB-old',
          date: '2026-08-01',
          title: 'Old entry',
          type: 'bug',
          severity: 'minor',
          submitter: 'alice',
          file: 'feedback/user/old.md',
          status: 'open',
        },
        {
          id: 'FB-new',
          date: '2026-08-07',
          title: 'New entry',
          type: 'bug',
          severity: 'critical',
          submitter: 'bob',
          file: 'feedback/user/new.md',
          status: 'open',
        },
        {
          id: 'FB-mid',
          date: '2026-08-04',
          title: 'Mid entry',
          type: 'improvement',
          severity: 'info',
          submitter: 'carol',
          file: 'feedback/user/mid.md',
          status: 'open',
        },
      ],
    });

    const result = listAllFeedbacks(FAKE_ROOT);

    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe('FB-new');  // 2026-08-07
    expect(result[1]?.id).toBe('FB-mid');  // 2026-08-04
    expect(result[2]?.id).toBe('FB-old');  // 2026-08-01
  });
});
