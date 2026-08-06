/**
 * Handler-level tests for the git command (src/cli/commands/knowledge-git.ts).
 *
 * Strategy: mock lower-level modules (core/utils, change/manager, node:child_process,
 * node:fs), register the git command on a fresh Commander program, then invoke
 * handlers via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockFindProjectRoot,
  mockGetActiveChange,
  mockReadFileSync,
  mockSpawnSync,
} = vi.hoisted(() => ({
  mockFindProjectRoot: vi.fn(),
  mockGetActiveChange: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockSpawnSync: vi.fn(),
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
    getActiveChange: mockGetActiveChange,
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: mockReadFileSync,
  };
});

vi.mock('node:child_process', () => ({
  spawnSync: mockSpawnSync,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('git command handlers', () => {
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
    mockGetActiveChange.mockReset();
    mockReadFileSync.mockReset();
    mockSpawnSync.mockReset();
    mockFindProjectRoot.mockReturnValue('/fake/root');
    mockSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Not initialized ──

  it('should exit(1) when not in a MumuSpec project', async () => {
    mockFindProjectRoot.mockReturnValue(undefined);

    const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
    const program = new Command();
    registerGitCommand(program);

    await program.parseAsync(['git', 'status'], { from: 'user' }).catch(() => {});

    expect(errorSpy).toHaveBeenCalledWith('Error: Not initialized. Run `mumuspec init` first.');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // ── git status ──

  describe('git status handler', () => {
    it('should print status and recent commits', async () => {
      mockSpawnSync.mockReturnValueOnce({ status: 0, stdout: '## main...origin/main\n M file.ts', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: 'abc1234 commit message\ndef5678 another', stderr: '' });

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'status'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Git status:\n');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('## main'));
      expect(logSpy).toHaveBeenCalledWith('\nRecent commits:');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('abc1234'));
    });

    it('should print "No changes" when status is empty', async () => {
      mockSpawnSync.mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'st'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('No changes');
    });

    it('should support dry-run mode for status', async () => {
      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'status', '--dry-run'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('[dry-run]'));
      expect(mockSpawnSync).not.toHaveBeenCalled();
    });
  });

  // ── git commit ──

  describe('git commit handler', () => {
    it('should commit with message and auto-detected scope from active change', async () => {
      mockGetActiveChange.mockReturnValue('my-feature');

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'commit', '-m', 'add new feature'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Committing: feat(my-feature): add new feature');
      expect(logSpy).toHaveBeenCalledWith('Committed');
    });

    it('should use provided scope over auto-detected', async () => {
      mockGetActiveChange.mockReturnValue('auto-scope');

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'commit', '-m', 'fix bug', '--scope', 'custom'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Committing: feat(custom): fix bug');
    });

    it('should use plain feat prefix when no active change and no scope', async () => {
      mockGetActiveChange.mockReturnValue(null);

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'ci', '-m', 'initial commit'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Committing: feat: initial commit');
    });

    it('should exit(1) when no commit message given', async () => {
      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'commit'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Commit message required. Use -m "message"');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should sanitize scope by replacing non-alphanumeric chars', async () => {
      mockGetActiveChange.mockReturnValue('my_feature/test');

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'commit', '-m', 'test'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Committing: feat(my-feature-test): test');
    });
  });

  // ── git push ──

  describe('git push handler', () => {
    it('should push current branch', async () => {
      mockSpawnSync.mockReturnValueOnce({ status: 0, stdout: 'feature-branch', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: 'Everything up-to-date', stderr: '' });

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'push'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Pushing to origin/feature-branch...');
      expect(logSpy).toHaveBeenCalledWith('Pushed');
    });
  });

  // ── git tag ──

  describe('git tag handler', () => {
    it('should create version tag from package.json', async () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3', name: 'test' }));

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'tag'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Creating tag v1.2.3...');
      expect(logSpy).toHaveBeenCalledWith('Tagged and pushed: v1.2.3');
    });
  });

  // ── git flow ──

  describe('git flow handler', () => {
    it('should start a feature branch', async () => {
      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'flow', 'start', '-b', 'feature/new-thing'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Starting flow: feature/new-thing');
      expect(logSpy).toHaveBeenCalledWith('Created branch: feature/new-thing');
    });

    it('should finish a feature branch and merge into main', async () => {
      mockSpawnSync.mockReturnValueOnce({ status: 0, stdout: 'main\nmaster', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' })
        .mockReturnValueOnce({ status: 0, stdout: '', stderr: '' });

      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'flow', 'finish', '-b', 'feature/done'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Finishing flow: feature/done');
      expect(logSpy).toHaveBeenCalledWith('Merged and removed: feature/done');
    });

    it('should exit(1) for invalid flow subcommand', async () => {
      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'flow', 'invalid'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Usage: mumuspec git flow <start|finish> [-b <branch-name>]');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit(1) when no branch name given for flow', async () => {
      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'flow', 'start'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Branch name required. Use -b <name> or pass as argument.');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  // ── unknown subcommand ──

  describe('git unknown subcommand', () => {
    it('should exit(1) for unrecognized subcommand', async () => {
      const { registerGitCommand } = await import('../../../src/cli/commands/knowledge-git.js');
      const program = new Command();
      registerGitCommand(program);

      await program.parseAsync(['git', 'rebase'], { from: 'user' }).catch(() => {});

      expect(errorSpy).toHaveBeenCalledWith('Unknown git subcommand: rebase');
      expect(errorSpy).toHaveBeenCalledWith('Available: status, commit, push, tag, flow');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
