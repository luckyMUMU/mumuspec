/**
 * Handler-level tests for feedback subcommands (submit, list, show, update-status, session-summary, change-feedbacks).
 *
 * Strategy: mock lower-level modules (core/utils, change/manager, feedback/manager),
 * register feedback commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockLoadChangeState,
  mockAppendFeedbackToChange,
  mockGetChangeFeedbacks,
  mockSubmitFeedback,
  mockListAllFeedbacks,
  mockGetFeedbackContent,
  mockUpdateFeedbackStatus,
  mockCreateSessionSummary,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockLoadChangeState: vi.fn(),
  mockAppendFeedbackToChange: vi.fn(),
  mockGetChangeFeedbacks: vi.fn(),
  mockSubmitFeedback: vi.fn(),
  mockListAllFeedbacks: vi.fn(),
  mockGetFeedbackContent: vi.fn(),
  mockUpdateFeedbackStatus: vi.fn(),
  mockCreateSessionSummary: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
  };
});

vi.mock('../../../src/change/manager.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/change/manager.js')>();
  return {
    ...actual,
    loadChangeState: mockLoadChangeState,
    appendFeedbackToChange: mockAppendFeedbackToChange,
    getChangeFeedbacks: mockGetChangeFeedbacks,
  };
});

vi.mock('../../../src/feedback/manager.js', () => ({
  submitFeedback: mockSubmitFeedback,
  listAllFeedbacks: mockListAllFeedbacks,
  getFeedbackContent: mockGetFeedbackContent,
  updateFeedbackStatus: mockUpdateFeedbackStatus,
  createSessionSummary: mockCreateSessionSummary,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('feedback command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockFindProjectRoot.mockReset();
    mockLoadChangeState.mockReset();
    mockAppendFeedbackToChange.mockReset();
    mockGetChangeFeedbacks.mockReset();
    mockSubmitFeedback.mockReset();
    mockListAllFeedbacks.mockReset();
    mockGetFeedbackContent.mockReset();
    mockUpdateFeedbackStatus.mockReset();
    mockCreateSessionSummary.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── submit subcommand ──

  describe('feedback submit handler', () => {
    it('should submit feedback with basic title', async () => {
      mockSubmitFeedback.mockReturnValue({
        feedbackId: 'FB-20260115-abc12345',
        filePath: '/fake/root/.mumuspec/feedback/user/2026-01-15-test.md',
      });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Test feedback'],
        { from: 'user' }
      );

      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        '/fake/root',
        expect.objectContaining({ title: 'Test feedback' }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feedback submitted: FB-20260115-abc12345'),
      );
    });

    it('should exit(1) when invalid type is provided', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Bad', '--type', 'invalid-type'],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid type 'invalid-type'"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when invalid severity is provided', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Bad', '--severity', 'catastrophic'],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid severity 'catastrophic'"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when change specified but not found', async () => {
      mockLoadChangeState.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Change feedback', '--change', 'nonexistent'],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Change not found: nonexistent');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should link feedback to change when --change provided', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'my-change' });
      mockSubmitFeedback.mockReturnValue({
        feedbackId: 'FB-20260115-xyz99999',
        filePath: '/fake/root/.mumuspec/feedback/user/2026-01-15-linked.md',
      });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Linked', '--change', 'my-change'],
        { from: 'user' }
      );

      expect(mockAppendFeedbackToChange).toHaveBeenCalledWith(
        '/fake/root', 'my-change', 'FB-20260115-xyz99999', undefined,
      );
      expect(logSpy).toHaveBeenCalledWith('  Linked to change: my-change');
    });

    it('should print linked session when --session provided', async () => {
      mockSubmitFeedback.mockReturnValue({
        feedbackId: 'FB-20260115-sess0001',
        filePath: '/fake/root/.mumuspec/feedback/user/2026-01-15-session.md',
      });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'With session', '--session', 'sess-abc'],
        { from: 'user' }
      );

      expect(logSpy).toHaveBeenCalledWith('  Linked to session: sess-abc');
    });

    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Fail'],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── list subcommand ──

  describe('feedback list handler', () => {
    it('should print "No feedback entries found" when empty', async () => {
      mockListAllFeedbacks.mockReturnValue([]);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['feedback', 'list'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No feedback entries found.');
    });

    it('should print each feedback entry with details', async () => {
      mockListAllFeedbacks.mockReturnValue([
        {
          id: 'FB-20260115-aaa11111',
          title: 'First feedback',
          type: 'bug',
          severity: 'critical',
          status: 'open',
          date: '2026-01-15',
          submitter: 'alice',
        },
        {
          id: 'FB-20260115-bbb22222',
          title: 'Second feedback',
          type: 'feature-request',
          severity: 'minor',
          status: 'acknowledged',
          date: '2026-01-14',
          submitter: 'bob',
          changeName: 'feature-x',
          sessionId: 'sess-123',
        },
      ]);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['feedback', 'list'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 feedback entry(s)'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('First feedback'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[feature-x]'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session: sess-123'),
      );
    });
  });

  // ── show subcommand ──

  describe('feedback show handler', () => {
    it('should print full feedback content when found', async () => {
      mockGetFeedbackContent.mockReturnValue({
        id: 'FB-20260115-show001',
        title: 'Show me',
        type: 'bug',
        severity: 'major',
        status: 'open',
        date: '2026-01-15',
        submitter: 'carol',
        body: 'Detailed bug description here',
        changeName: 'bugfix-1',
        sessionId: 'sess-456',
        designRef: 'design.md',
      });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['feedback', 'show', 'FB-20260115-show001'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Feedback: FB-20260115-show001'));
      expect(logSpy).toHaveBeenCalledWith('Title: Show me');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Detailed bug description here'));
      expect(logSpy).toHaveBeenCalledWith('Change: bugfix-1');
      expect(logSpy).toHaveBeenCalledWith('Session: sess-456');
      expect(logSpy).toHaveBeenCalledWith('Design: design.md');
    });

    it('should exit(1) when feedback not found', async () => {
      mockGetFeedbackContent.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['feedback', 'show', 'FB-NONEXISTENT'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Feedback not found: FB-NONEXISTENT');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── update-status subcommand ──

  describe('feedback update-status handler', () => {
    it('should update status when valid', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'update-status', 'FB-20260115-xxx', '--status', 'resolved'],
        { from: 'user' }
      );

      expect(mockUpdateFeedbackStatus).toHaveBeenCalledWith(
        '/fake/root', 'FB-20260115-xxx', 'resolved', undefined,
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('status updated to: resolved'),
      );
    });

    it('should exit(1) when invalid status', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'update-status', 'FB-20260115-xxx', '--status', 'banana'],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid status. Must be one of'),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── session-summary subcommand ──

  describe('feedback session-summary handler', () => {
    it('should create session summary on success', async () => {
      mockCreateSessionSummary.mockReturnValue({
        sessionId: 'sess-789',
        filePath: '/fake/root/.mumuspec/feedback/sessions/2026-01-15-sess-789.md',
      });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        [
          'feedback', 'session-summary',
          '--session-id', 'sess-789',
          '--title', 'My session',
          '--change-type', 'feature',
          '--outcome', 'success',
        ],
        { from: 'user' }
      );

      expect(mockCreateSessionSummary).toHaveBeenCalledWith(
        '/fake/root',
        expect.objectContaining({
          sessionId: 'sess-789',
          title: 'My session',
          changeType: 'feature',
          outcome: 'success',
        }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Session summary created: sess-789'),
      );
    });

    it('should exit(1) when invalid outcome is provided', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        [
          'feedback', 'session-summary',
          '--session-id', 'sess-1',
          '--title', 'Test',
          '--change-type', 'feature',
          '--outcome', 'in-progress',
        ],
        { from: 'user' }
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid outcome. Must be one of'),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should parse comma-separated feedback IDs and patterns', async () => {
      mockCreateSessionSummary.mockReturnValue({
        sessionId: 'sess-multi',
        filePath: '/fake/sessions/multi.md',
      });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        [
          'feedback', 'session-summary',
          '--session-id', 'sess-multi',
          '--title', 'Multi links',
          '--change-type', 'feature',
          '--outcome', 'success',
          '--feedback', 'FB-1, FB-2, FB-3',
          '--patterns', 'pattern-a, pattern-b',
        ],
        { from: 'user' }
      );

      expect(mockCreateSessionSummary).toHaveBeenCalledWith(
        '/fake/root',
        expect.objectContaining({
          feedbackIds: ['FB-1', 'FB-2', 'FB-3'],
          patternsObserved: ['pattern-a', 'pattern-b'],
        }),
      );
      expect(logSpy).toHaveBeenCalledWith('  Linked feedback: FB-1, FB-2, FB-3');
    });
  });

  // ── change-feedbacks subcommand ──

  describe('change-feedbacks handler', () => {
    it('should print message when no feedback linked to change', async () => {
      mockGetChangeFeedbacks.mockReturnValue([]);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['change-feedbacks', 'my-change'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No feedback linked to change: my-change');
    });

    it('should print linked feedback entries with status', async () => {
      mockGetChangeFeedbacks.mockReturnValue([
        { feedback_id: 'FB-20260115-link01', linked_at: '2026-01-15T10:00:00Z', acknowledged: true, sessionId: 'sess-1' },
        { feedback_id: 'FB-20260115-link02', linked_at: '2026-01-14T09:00:00Z', acknowledged: false },
      ]);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['change-feedbacks', 'feature-y'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 feedback(s) linked to feature-y'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('FB-20260115-link01'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[session: sess-1]'),
      );
    });
  });
});
