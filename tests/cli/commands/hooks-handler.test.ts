/**
 * Handler-level tests for hooks subcommands (install, uninstall, status, run).
 *
 * Strategy: mock src/hooks/guard.js functions via vi.hoisted + vi.mock,
 * register hooks commands on a fresh Commander program, then invoke handlers
 * via parseAsync() with { from: 'user' } to exercise branch logic.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

// ── Mock function references (vi.hoisted) ──
const {
  mockInstallHooks,
  mockUninstallHooks,
  mockGetHookStatus,
  mockRunHook,
} = vi.hoisted(() => ({
  mockInstallHooks: vi.fn(),
  mockUninstallHooks: vi.fn(),
  mockGetHookStatus: vi.fn(),
  mockRunHook: vi.fn(),
}));

vi.mock('../../../src/hooks/guard.js', () => ({
  installHooks: mockInstallHooks,
  uninstallHooks: mockUninstallHooks,
  getHookStatus: mockGetHookStatus,
  runHook: mockRunHook,
}));

// ════════════════════════════════════════════════════════════════════
// Tests
// ════════════════════════════════════════════════════════════════════

describe('hooks command handlers', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as () => never);
    mockInstallHooks.mockReset();
    mockUninstallHooks.mockReset();
    mockGetHookStatus.mockReset();
    mockRunHook.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── hooks install ──

  describe('hooks install handler', () => {
    it('logs installed/skipped/failed counts and does not exit when all succeed', async () => {
      mockInstallHooks.mockReturnValue([
        { success: true, hook: 'pre-commit', path: '/repo/.git/hooks/pre-commit' },
        { success: true, hook: 'post-merge', path: '/repo/.git/hooks/post-merge' },
        { success: true, hook: 'commit-msg', path: '/repo/.git/hooks/commit-msg' },
      ]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'install'], { from: 'user' });

      expect(mockInstallHooks).toHaveBeenCalledWith({ workspacePath: '.', force: undefined });
      expect(logSpy).toHaveBeenCalledWith('✓ Installed: pre-commit → /repo/.git/hooks/pre-commit');
      expect(logSpy).toHaveBeenCalledWith('✓ Installed: post-merge → /repo/.git/hooks/post-merge');
      expect(logSpy).toHaveBeenCalledWith('✓ Installed: commit-msg → /repo/.git/hooks/commit-msg');
      expect(logSpy).toHaveBeenCalledWith('\nDone: 3 installed, 0 skipped, 0 failed.');
      expect(logSpy).toHaveBeenCalledWith('\nHooks will auto-run on git events (pre-commit, post-merge, etc.)');
    });

    it('logs skipped hooks with reason', async () => {
      mockInstallHooks.mockReturnValue([
        { success: true, hook: 'pre-commit', path: '/repo/.git/hooks/pre-commit' },
        { success: false, skipped: true, hook: 'post-merge', error: 'already exists' },
      ]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'install'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('⊘ Skipped: post-merge — already exists');
      expect(logSpy).toHaveBeenCalledWith('\nDone: 1 installed, 1 skipped, 0 failed.');
    });

    it('logs failed hooks and calls process.exit(1) when failures exist', async () => {
      mockInstallHooks.mockReturnValue([
        { success: false, hook: 'pre-commit', error: 'permission denied' },
      ]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['hooks', 'install'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(errorSpy).toHaveBeenCalledWith('✗ Failed: pre-commit — permission denied');
      expect(logSpy).toHaveBeenCalledWith('\nDone: 0 installed, 0 skipped, 1 failed.');
      expect(exitError).not.toBeNull();
      expect(exitError!.message).toBe('process.exit called');
    });

    it('passes --force and --workspace-path options to installHooks', async () => {
      mockInstallHooks.mockReturnValue([]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'install', '--force', '--workspace-path', '/my/repo'], { from: 'user' });

      expect(mockInstallHooks).toHaveBeenCalledWith({ workspacePath: '/my/repo', force: true });
    });

    it('handles mixed results (installed + skipped + failed) correctly', async () => {
      mockInstallHooks.mockReturnValue([
        { success: true, hook: 'pre-commit', path: '/repo/.git/hooks/pre-commit' },
        { success: false, skipped: true, hook: 'commit-msg', error: 'existing hook' },
        { success: false, hook: 'post-merge', error: 'read-only filesystem' },
      ]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['hooks', 'install'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 installed'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 skipped'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('1 failed'));
      expect(exitError).not.toBeNull();
    });

    it('logs "0 installed" when all hooks are skipped', async () => {
      mockInstallHooks.mockReturnValue([
        { success: false, skipped: true, hook: 'pre-commit', error: 'exists' },
        { success: false, skipped: true, hook: 'commit-msg', error: 'exists' },
      ]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'install'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('\nDone: 0 installed, 2 skipped, 0 failed.');
    });
  });

  // ── hooks uninstall ──

  describe('hooks uninstall handler', () => {
    it('logs successful removals', async () => {
      mockUninstallHooks.mockReturnValue([
        { success: true, hook: 'pre-commit' },
        { success: true, hook: 'commit-msg' },
      ]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'uninstall'], { from: 'user' });

      expect(mockUninstallHooks).toHaveBeenCalledWith('.');
      expect(logSpy).toHaveBeenCalledWith('✓ Removed: pre-commit');
      expect(logSpy).toHaveBeenCalledWith('✓ Removed: commit-msg');
    });

    it('logs skipped and failed removals', async () => {
      mockUninstallHooks.mockReturnValue([
        { success: false, skipped: true, hook: 'pre-commit', error: 'not a mumuspec hook' },
        { success: false, hook: 'post-merge', error: 'file not found' },
      ]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'uninstall'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('⊘ Skipped: pre-commit — not a mumuspec hook');
      expect(errorSpy).toHaveBeenCalledWith('✗ Failed: post-merge — file not found');
    });

    it('passes --workspace-path option to uninstallHooks', async () => {
      mockUninstallHooks.mockReturnValue([]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'uninstall', '--workspace-path', '/test/repo'], { from: 'user' });

      expect(mockUninstallHooks).toHaveBeenCalledWith('/test/repo');
    });

    it('handles empty results (no hooks found to remove)', async () => {
      mockUninstallHooks.mockReturnValue([]);

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'uninstall'], { from: 'user' });

      expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Removed:'));
    });
  });

  // ── hooks status ──

  describe('hooks status handler', () => {
    it('shows installed and uninstalled hooks with checkmarks', async () => {
      mockGetHookStatus.mockReturnValue({
        installed: ['pre-commit', 'commit-msg'],
        available: ['pre-commit', 'post-merge', 'post-checkout', 'commit-msg'],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'status'], { from: 'user' });

      expect(mockGetHookStatus).toHaveBeenCalledWith('.');
      expect(logSpy).toHaveBeenCalledWith('\nMumuSpec Git Hooks Status:\n');
      expect(logSpy).toHaveBeenCalledWith('  ✓ pre-commit');
      expect(logSpy).toHaveBeenCalledWith('  ○ post-merge');
      expect(logSpy).toHaveBeenCalledWith('  ○ post-checkout');
      expect(logSpy).toHaveBeenCalledWith('  ✓ commit-msg');
      expect(logSpy).toHaveBeenCalledWith('\n2/4 hooks installed.');
    });

    it('shows zero installed when no hooks present', async () => {
      mockGetHookStatus.mockReturnValue({
        installed: [],
        available: ['pre-commit', 'post-merge', 'post-checkout', 'commit-msg'],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'status'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('\n0/4 hooks installed.');
    });

    it('passes --workspace-path option', async () => {
      mockGetHookStatus.mockReturnValue({
        installed: [],
        available: ['pre-commit'],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'status', '--workspace-path', '/proj'], { from: 'user' });

      expect(mockGetHookStatus).toHaveBeenCalledWith('/proj');
    });

    it('shows all installed when every hook is present', async () => {
      mockGetHookStatus.mockReturnValue({
        installed: ['pre-commit', 'post-merge', 'post-checkout', 'commit-msg'],
        available: ['pre-commit', 'post-merge', 'post-checkout', 'commit-msg'],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'status'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('\n4/4 hooks installed.');
    });
  });

  // ── hooks run ──

  describe('hooks run handler', () => {
    it('runs pre-commit hook and logs success when passed', async () => {
      mockRunHook.mockReturnValue({
        hook: 'pre-commit',
        passed: true,
        errors: [],
        warnings: [],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'run', 'pre-commit'], { from: 'user' });

      expect(mockRunHook).toHaveBeenCalledWith('pre-commit', [], '.');
      expect(logSpy).toHaveBeenCalledWith('\nHook: pre-commit');
      expect(logSpy).toHaveBeenCalledWith('\n✓ Hook passed.');
    });

    it('logs errors and exits when hook fails', async () => {
      mockRunHook.mockReturnValue({
        hook: 'pre-commit',
        passed: false,
        errors: ['SHALL NOT violation in src/foo.ts'],
        warnings: [],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['hooks', 'run', 'pre-commit'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(logSpy).toHaveBeenCalledWith('\nHook: pre-commit');
      expect(logSpy).toHaveBeenCalledWith('\nErrors:');
      expect(errorSpy).toHaveBeenCalledWith('  ✗ SHALL NOT violation in src/foo.ts');
      expect(errorSpy).toHaveBeenCalledWith('\n✗ Hook failed with 1 error(s).');
      expect(exitError).not.toBeNull();
    });

    it('logs warnings when present', async () => {
      mockRunHook.mockReturnValue({
        hook: 'post-merge',
        passed: true,
        errors: [],
        warnings: ['Drift detected in contract.ts'],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'run', 'post-merge'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('\nWarnings:');
      expect(logSpy).toHaveBeenCalledWith('  ⚠ Drift detected in contract.ts');
      expect(logSpy).toHaveBeenCalledWith('\n✓ Hook passed.');
    });

    it('rejects unknown hook type and exits with error', async () => {
      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      let exitError: Error | null = null;
      try {
        await program.parseAsync(['hooks', 'run', 'unknown-hook'], { from: 'user' });
      } catch (e) {
        exitError = e as Error;
      }

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error: Unknown hook type "unknown-hook"'),
      );
      expect(exitError).not.toBeNull();
      expect(mockRunHook).not.toHaveBeenCalled();
    });

    it('passes --args as comma-separated array to runHook', async () => {
      mockRunHook.mockReturnValue({
        hook: 'commit-msg',
        passed: true,
        errors: [],
        warnings: [],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'run', 'commit-msg', '--args', 'arg1,arg2'], { from: 'user' });

      expect(mockRunHook).toHaveBeenCalledWith('commit-msg', ['arg1', 'arg2'], '.');
    });

    it('passes --workspace-path option', async () => {
      mockRunHook.mockReturnValue({
        hook: 'pre-commit',
        passed: true,
        errors: [],
        warnings: [],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'run', 'pre-commit', '--workspace-path', '/repo'], { from: 'user' });

      expect(mockRunHook).toHaveBeenCalledWith('pre-commit', [], '/repo');
    });

    it('handles commit-msg hook type', async () => {
      mockRunHook.mockReturnValue({
        hook: 'commit-msg',
        passed: true,
        errors: [],
        warnings: [],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'run', 'commit-msg'], { from: 'user' });

      expect(mockRunHook).toHaveBeenCalledWith('commit-msg', [], '.');
      expect(logSpy).toHaveBeenCalledWith('\n✓ Hook passed.');
    });

    it('handles post-checkout hook type', async () => {
      mockRunHook.mockReturnValue({
        hook: 'post-checkout',
        passed: true,
        errors: [],
        warnings: [],
      });

      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks', 'run', 'post-checkout'], { from: 'user' });

      expect(mockRunHook).toHaveBeenCalledWith('post-checkout', [], '.');
    });
  });

  // ── hooks default action ──

  describe('hooks default action (no subcommand)', () => {
    it('prints usage help when no subcommand is given', async () => {
      const { registerHooksCommands } = await import('../../../src/cli/commands/hooks.js');
      const program = new Command();
      registerHooksCommands(program);

      await program.parseAsync(['hooks'], { from: 'user' });

      expect(logSpy).toHaveBeenCalledWith('Manage git hooks for automatic MumuSpec guard checks.\n');
      expect(logSpy).toHaveBeenCalledWith('Usage:');
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('hooks install'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('hooks run <type>'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('pre-commit, post-merge, post-checkout, commit-msg'));
    });
  });
});
