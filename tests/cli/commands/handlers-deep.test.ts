/**
 * Deep coverage tests for feedback, env, and trace command handlers.
 *
 * Targets uncovered lines and branches in:
 * - src/cli/commands/feedback.ts (~205-207, ~252-254, ~47-52)
 * - src/cli/commands/env.ts (~85-97, ~138-143, + branches)
 * - src/cli/commands/trace.ts (~60-61, ~68-71, ~82-83, + branches)
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
  mockDetectEnvironment,
  mockSaveEnvSpec,
  mockValidateEnv,
  mockDiffEnv,
  mockReadText,
  mockReaddirSync,
  mockStatSync,
  mockReadFileSync,
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
  mockDetectEnvironment: vi.fn(),
  mockSaveEnvSpec: vi.fn(),
  mockValidateEnv: vi.fn(),
  mockDiffEnv: vi.fn(),
  mockReadText: vi.fn(),
  mockReaddirSync: vi.fn(),
  mockStatSync: vi.fn(),
  mockReadFileSync: vi.fn(),
}));

vi.mock('../../../src/core/utils.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/core/utils.js')>();
  return {
    ...actual,
    findProjectRoot: mockFindProjectRoot,
    readText: mockReadText,
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
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

vi.mock('../../../src/core/env-detector.js', () => ({
  detectEnvironment: mockDetectEnvironment,
  saveEnvSpec: mockSaveEnvSpec,
  validateEnv: mockValidateEnv,
  diffEnv: mockDiffEnv,
}));

vi.mock('node:path', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:path')>();
  return {
    ...actual,
    join: (...p: string[]) => p.join('/'),
    relative: (from: string, to: string) => to.replace(from + '/', ''),
    sep: '/',
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: mockReadFileSync,
  };
});

// ════════════════════════════════════════════════════════════════════
// Shared setup
// ════════════════════════════════════════════════════════════════════

let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;
let exitSpy: ReturnType<typeof vi.spyOn>;

const mockDetectionWithIssues = {
  timestamp: '2026-01-15T10:00:00Z',
  os: { type: 'Windows', version: '10.0', arch: 'x64' },
  tools: [
    { name: 'node', ecosystem: 'build', status: 'ok' as const, version: '22.0.0', location: 'C:\\nodejs' },
    { name: 'git', ecosystem: 'build', status: 'ok' as const, version: '2.40.0' },
    { name: 'python', ecosystem: 'python', status: 'missing' as const, version: 'unknown' },
    { name: 'eslint', ecosystem: 'node', status: 'warn' as const, version: 'unknown' },
  ],
  missing: ['python'],
  warnings: [],
};

const mockDetectionAllOk = {
  timestamp: '2026-01-15T10:00:00Z',
  os: { type: 'Linux', version: '22.04', arch: 'x64' },
  tools: [
    { name: 'node', ecosystem: 'build', status: 'ok' as const, version: '22.0.0', location: '/usr/bin/node' },
    { name: 'git', ecosystem: 'build', status: 'ok' as const, version: '2.40.0' },
  ],
  missing: [],
  warnings: [],
};

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
  mockDetectEnvironment.mockReset();
  mockSaveEnvSpec.mockReset();
  mockValidateEnv.mockReset();
  mockDiffEnv.mockReset();
  mockReadText.mockReset();
  mockReaddirSync.mockReset();
  mockStatSync.mockReset();
  mockReadFileSync.mockReset();

  mockFindProjectRoot.mockReturnValue('/fake/root');
  mockSubmitFeedback.mockReturnValue({
    feedbackId: 'FB-20260115-test001',
    filePath: '/fake/root/.mumuspec/feedback/user/2026-01-15-test.md',
  });
  mockDetectEnvironment.mockResolvedValue(mockDetectionWithIssues);
  mockSaveEnvSpec.mockResolvedValue('/fake/root/.mumuspec/env-spec.md');
  mockValidateEnv.mockResolvedValue({ exitCode: 0, messages: [], suggestions: [] });
  mockDiffEnv.mockResolvedValue('Environment Diff Result');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════
// FEEDBACK handler tests
// ════════════════════════════════════════════════════════════════════

describe('feedback command handlers — deep coverage', () => {
  // ── submit: session linkage with all feedback types ──

  describe('feedback submit — type coverage', () => {
    const validTypes = ['bug', 'feature-request', 'improvement', 'question', 'design-review'];

    for (const fbType of validTypes) {
      it(`should accept type '${fbType}' as valid`, async () => {
        const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
        const program = new Command();
        registerFeedbackCommands(program);

        await program.parseAsync(
          ['feedback', 'submit', '--title', `${fbType} test`, '--type', fbType],
          { from: 'user' },
        );

        expect(mockSubmitFeedback).toHaveBeenCalledWith(
          '/fake/root',
          expect.objectContaining({ type: fbType }),
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Feedback submitted'),
        );
      });
    }
  });

  // ── submit: all options coverage ──

  describe('feedback submit with all options', () => {
    it('should pass all parameters correctly', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'valid-change' });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        [
          'feedback', 'submit',
          '--title', 'Full options test',
          '--type', 'bug',
          '--severity', 'critical',
          '--submitter', 'alice',
          '--change', 'some-change',
          '--session', 'sess-999',
          '--design', 'design.md',
          '--expected', 'Should work',
          '--actual', 'Does not work',
          '--detail', 'Extra details',
          '--impact', 'High impact',
          '--suggestion', 'Fix it',
        ],
        { from: 'user' },
      );

      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        '/fake/root',
        expect.objectContaining({
          type: 'bug',
          severity: 'critical',
          submitter: 'alice',
          changeName: 'some-change',
          sessionId: 'sess-999',
          title: 'Full options test',
          expected: 'Should work',
          actual: 'Does not work',
          detail: 'Extra details',
          impact: 'High impact',
          suggestion: 'Fix it',
          designRef: 'design.md',
        }),
      );
    });

    it('should use default type (improvement) when --type not specified', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Defaults'],
        { from: 'user' },
      );

      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        '/fake/root',
        expect.objectContaining({ type: 'improvement', severity: 'minor', submitter: 'anonymous' }),
      );
    });

    it('should accept info severity as valid', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Info sev', '--severity', 'info'],
        { from: 'user' },
      );

      expect(mockSubmitFeedback).toHaveBeenCalledWith(
        '/fake/root',
        expect.objectContaining({ severity: 'info' }),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Feedback submitted'),
      );
    });
  });

  // ── session-summary: not in project (covers ~205-207) ──

  describe('feedback session-summary — not in project', () => {
    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        [
          'feedback', 'session-summary',
          '--session-id', 'sess-1',
          '--title', 'Test',
          '--change-type', 'feature',
          '--outcome', 'success',
        ],
        { from: 'user' },
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── change-feedbacks: not in project (covers ~252-254) ──

  describe('change-feedbacks — not in project', () => {
    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['change-feedbacks', 'some-change'],
        { from: 'user' },
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── Other subcommands: not in project branch ──

  describe('other feedback subcommands — not in project', () => {
    it('feedback list should exit(1) when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['feedback', 'list'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('feedback show should exit(1) when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(['feedback', 'show', 'FB-123'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });

    it('feedback update-status should exit(1) when not in project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'update-status', 'FB-123', '--status', 'resolved'],
        { from: 'user' },
      ).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
    });
  });

  // ── submit: link session to change ──

  describe('feedback submit — change linkage', () => {
    it('should link feedback with both change and session', async () => {
      mockLoadChangeState.mockReturnValue({ name: 'linked-change' });
      mockSubmitFeedback.mockReturnValue({
        feedbackId: 'FB-20260115-link001',
        filePath: '/fake/root/.mumuspec/feedback/user/linked.md',
      });

      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'Linked', '--change', 'linked-change', '--session', 'sess-linked'],
        { from: 'user' },
      );

      expect(mockAppendFeedbackToChange).toHaveBeenCalledWith(
        '/fake/root', 'linked-change', 'FB-20260115-link001', 'sess-linked',
      );
      expect(logSpy).toHaveBeenCalledWith('  Linked to change: linked-change');
      expect(logSpy).toHaveBeenCalledWith('  Linked to session: sess-linked');
    });

    it('should not call appendFeedbackToChange when no --change', async () => {
      const { registerFeedbackCommands } = await import('../../../src/cli/commands/feedback.js');
      const program = new Command();
      registerFeedbackCommands(program);

      await program.parseAsync(
        ['feedback', 'submit', '--title', 'No link'],
        { from: 'user' },
      );

      expect(mockAppendFeedbackToChange).not.toHaveBeenCalled();
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// ENV handler tests
// ════════════════════════════════════════════════════════════════════

describe('env command handlers — deep coverage', () => {
  // ── validate: not in project (covers ~85-97) ──

  describe('env validate — not in project', () => {
    it('should exit(1) when not in a MumuSpec project', async () => {
      mockFindProjectRoot.mockReturnValue(undefined);

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'validate'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Error: Not in a MumuSpec project.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── fallback handler (covers ~138-143) ──

  describe('env fallback usage handler', () => {
    it('should display usage when no subcommand given', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Environment detection and validation'));
      expect(logSpy).toHaveBeenCalledWith('  mumuspec env detect           Detect installed tools');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec env detect --save    Detect and save to env-spec.md');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec env validate         Validate environment against spec');
      expect(logSpy).toHaveBeenCalledWith('  mumuspec env diff             Compare with saved env-spec.md');
    });
  });

  // ── detect: all OK branch (no missing/warnings) ──

  describe('env detect — all tools OK branch', () => {
    it('should display "all detected" when no missing or warnings', async () => {
      mockDetectEnvironment.mockResolvedValue(mockDetectionAllOk);

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Result: all detected ✓');
    });

    it('should display warning count when tools have warnings', async () => {
      mockDetectEnvironment.mockResolvedValue(mockDetectionWithIssues);

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('missing'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('warnings'),
      );
    });
  });

  // ── detect: save branch ──

  describe('env detect --save', () => {
    it('should save and display save confirmation', async () => {
      mockDetectEnvironment.mockResolvedValue(mockDetectionAllOk);

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'detect', '--save'], { from: 'user' });

      expect(mockSaveEnvSpec).toHaveBeenCalledWith('/fake/root', mockDetectionAllOk);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Saved to .mumuspec/env-spec.md'),
      );
    });
  });

  // ── validate: --fix with non-zero exit code ──

  describe('env validate — fix with non-zero exit', () => {
    it('should NOT show suggestions when exit code is non-zero', async () => {
      mockValidateEnv.mockResolvedValue({
        exitCode: 2,
        messages: ['Some issues found'],
        suggestions: ['Should not be shown'],
      });

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'validate', '--fix'], { from: 'user' }).catch(() => {});

      expect(logSpy).not.toHaveBeenCalledWith('Suggestions:');
    });

    it('should pass --strict flag correctly', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'validate', '--strict'], { from: 'user' }).catch(() => {});

      expect(mockValidateEnv).toHaveBeenCalledWith('/fake/root', { strict: true });
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  // ── detect: multiple ecosystems ──

  describe('env detect — multiple ecosystems', () => {
    it('should pass multiple ecosystem filters', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(
        ['env', 'detect', '--ecosystem', 'node', '--ecosystem', 'python'],
        { from: 'user' },
      );

      expect(mockDetectEnvironment).toHaveBeenCalledWith(
        expect.objectContaining({ ecosystems: ['node', 'python'], projectRoot: '/fake/root' }),
      );
    });
  });

  // ── diff: --against option ──

  describe('env diff — advanced', () => {
    it('should display diff with --against', async () => {
      mockDiffEnv.mockResolvedValue('Diff output between specs');

      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(
        ['env', 'diff', '--against', '/path/to/old-spec.md'],
        { from: 'user' },
      );

      expect(mockDiffEnv).toHaveBeenCalledWith('/fake/root', '/path/to/old-spec.md');
      expect(logSpy).toHaveBeenCalledWith('Diff output between specs');
    });

    it('should call diffEnv with undefined --against when not provided', async () => {
      const { registerEnvCommands } = await import('../../../src/cli/commands/env.js');
      const program = new Command();
      registerEnvCommands(program);

      await program.parseAsync(['env', 'diff'], { from: 'user' });

      expect(mockDiffEnv).toHaveBeenCalledWith('/fake/root', undefined);
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// TRACE handler tests
// ════════════════════════════════════════════════════════════════════

describe('trace command handler — deep coverage', () => {
  // ── readdirSync exception (covers lines ~60-61) ──

  describe('trace — readdirSync exception', () => {
    it('should silently handle readdirSync errors and output no matches', async () => {
      mockReaddirSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'myVar'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No occurrences of "myVar" found'),
      );
    });
  });

  // ── Directory skip logic (covers lines ~68-71) ──

  describe('trace — directory skip branches', () => {
    it('should skip directories in SKIP_DIRS set', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'node_modules', isDirectory: () => true, isFile: () => false },
            { name: 'src', isDirectory: () => true, isFile: () => false },
          ] as never;
        }
        if (dir === '/fake/root/src') {
          return [
            { name: 'target.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 50, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('const target = 42;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'target'], { from: 'user' });

      // node_modules should be skipped; src should be scanned producing src/target.ts
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/target.ts'),
      );
    });

    it('should skip dot-prefixed directories', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: '.git', isDirectory: () => true, isFile: () => false },
            { name: '.turbo', isDirectory: () => true, isFile: () => false },
            { name: 'lib', isDirectory: () => true, isFile: () => false },
          ] as never;
        }
        if (dir === '/fake/root/lib') {
          return [
            { name: 'index.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 50, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('function target() {}');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'target'], { from: 'user' });

      // Only lib/index.ts should produce results; .git and .turbo skipped
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('lib/index.ts'),
      );
    });

    it('should recurse into subdirectories', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'packages', isDirectory: () => true, isFile: () => false },
          ] as never;
        }
        if (dir === '/fake/root/packages') {
          return [
            { name: 'core', isDirectory: () => true, isFile: () => false },
          ] as never;
        }
        if (dir === '/fake/root/packages/core') {
          return [
            { name: 'util.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 50, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('const targetSymbol = true;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'targetSymbol'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('packages/core/util.ts'),
      );
    });
  });

  // ── statSync exception (covers lines ~82-83) ──

  describe('trace — statSync exception', () => {
    it('should continue when statSync throws for a file', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'broken.ts', isDirectory: () => false, isFile: () => true },
            { name: 'good.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });
      mockReadText.mockReturnValue('const findme = 1;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'findme'], { from: 'user' });

      // Both files fail statSync, so no matches
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No occurrences'),
      );
    });
  });

  // ── readText returns undefined ──

  describe('trace — readText returns undefined', () => {
    it('should continue to next file when readText returns undefined', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'empty.ts', isDirectory: () => false, isFile: () => true },
            { name: 'valid.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 10, isDirectory: () => false, isFile: () => true });
      mockReadText.mockImplementation((file: string) => {
        if (file.includes('empty.ts')) return undefined;
        if (file.includes('valid.ts')) return 'const needle = 1;';
        return undefined;
      });

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'needle'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('valid.ts'),
      );
    });
  });

  // ── Large file skip ──

  describe('trace — large file skip', () => {
    it('should skip files larger than 2MB', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'big.ts', isDirectory: () => false, isFile: () => true },
            { name: 'small.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockImplementation((_file: string) => {
        return { size: 3 * 1024 * 1024, isDirectory: () => false, isFile: () => true };
      });
      mockReadText.mockReturnValue('const big = 1; const small = 2;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'big'], { from: 'user' });

      // big file skipped due to size, no matches
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No occurrences'),
      );
    });
  });

  // ── Scope filter branch ──

  describe('trace — scope filter branch', () => {
    it('should skip files not matching scope filter', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'src', isDirectory: () => true, isFile: () => false },
            { name: 'test', isDirectory: () => true, isFile: () => false },
          ] as never;
        }
        if (dir === '/fake/root/src') {
          return [
            { name: 'main.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 10, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('const scoped = 1;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'scoped', '--scope', 'src'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/main.ts'),
      );
    });
  });

  // ── Non-searchable file extension ──

  describe('trace — non-searchable extension', () => {
    it('should skip files with non-searchable extensions', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'image.png', isDirectory: () => false, isFile: () => true },
        { name: 'data.bin', isDirectory: () => false, isFile: () => true },
      ] as never);
      mockStatSync.mockReturnValue({ size: 10, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('binary data here');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'data'], { from: 'user' });

      // Both should be skipped due to non-matching extensions
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No occurrences'),
      );
    });
  });

  // ── Search results with limit ──

  describe('trace — search results & limit', () => {
    it('should find symbol across multiple files', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'a.ts', isDirectory: () => false, isFile: () => true },
            { name: 'b.ts', isDirectory: () => false, isFile: () => true },
            { name: 'c.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 100, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('funcCall(mySymbol)');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'mySymbol'], { from: 'user' });

      const calls = logSpy.mock.calls.flat();
      const traceResults = calls.filter((c) => typeof c === 'string' && c.includes(':'));
      expect(traceResults.length).toBeGreaterThanOrEqual(3);
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('3 match(es)'),
      );
    });

    it('should respect --limit to cap results', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [
            { name: 'a.ts', isDirectory: () => false, isFile: () => true },
            { name: 'b.ts', isDirectory: () => false, isFile: () => true },
            { name: 'c.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 100, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('funcCall(limitSymbol)');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      // Use default limit of 100, but files only produce 3 hits -> should show all 3
      await program.parseAsync(['trace', 'limitSymbol', '--limit', '2'], { from: 'user' });

      // With limit=2, only 2 results should be shown
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('2 match(es)'),
      );
    });
  });

  // ── Depth limit branch ──

  describe('trace — depth limit', () => {
    it('should stop scanning at max depth', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        // Simulate deep nesting: root/src/pkg/lib/deep/hidden.ts
        if (dir === '/fake/root') {
          return [{ name: 'src', isDirectory: () => true, isFile: () => false }] as never;
        }
        if (dir === '/fake/root/src') {
          return [{ name: 'pkg', isDirectory: () => true, isFile: () => false }] as never;
        }
        if (dir === '/fake/root/src/pkg') {
          return [{ name: 'lib', isDirectory: () => true, isFile: () => false }] as never;
        }
        if (dir === '/fake/root/src/pkg/lib') {
          return [
            { name: 'deep.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 50, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('const deepSymbol = 1;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      // depth=2 means it scans root(0) -> src(1) -> pkg(2), but stops at pkg (depth 3 > 2)
      await program.parseAsync(['trace', 'deepSymbol', '--depth', '2'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('No occurrences'),
      );
    });

    it('should find symbol when depth is sufficient', async () => {
      mockReaddirSync.mockImplementation((dir: string) => {
        if (dir === '/fake/root') {
          return [{ name: 'src', isDirectory: () => true, isFile: () => false }] as never;
        }
        if (dir === '/fake/root/src') {
          return [{ name: 'deep', isDirectory: () => true, isFile: () => false }] as never;
        }
        if (dir === '/fake/root/src/deep') {
          return [
            { name: 'found.ts', isDirectory: () => false, isFile: () => true },
          ] as never;
        }
        return [];
      });
      mockStatSync.mockReturnValue({ size: 50, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('const okaySymbol = 1;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'okaySymbol', '--depth', '10'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('src/deep/found.ts'),
      );
    });
  });

  // ── Scan summary output ──

  describe('trace — summary output', () => {
    it('should output scan summary after finding matches', async () => {
      mockReaddirSync.mockReturnValue([
        { name: 'file.ts', isDirectory: () => false, isFile: () => true },
      ] as never);
      mockStatSync.mockReturnValue({ size: 50, isDirectory: () => false, isFile: () => true });
      mockReadText.mockReturnValue('const summarySymbol = 1;');

      const { registerTraceCommand } = await import('../../../src/cli/commands/trace.js');
      const program = new Command();
      registerTraceCommand(program);

      await program.parseAsync(['trace', 'summarySymbol'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scanned from: /fake/root'),
      );
    });
  });
});
