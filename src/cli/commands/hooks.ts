/**
 * hooks command — Git hook management.
 */
import type { Command } from 'commander';
import {
  installHooks,
  uninstallHooks,
  getHookStatus,
  runHook,
  type HookType,
} from '../../hooks/guard.js';

export function registerHooksCommands(program: Command): void {
  const hooksCmd = program
    .command('hooks')
    .description('Manage git hooks that auto-trigger MumuSpec guard checks');

  hooksCmd
    .command('install')
    .description('Install Mumuspec guard hooks into .git/hooks/')
    .option('--force', 'overwrite existing non-mumuspec hooks')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const results = installHooks({
        workspacePath: options.workspacePath,
        force: options.force,
      });

      let installed = 0;
      let skipped = 0;
      let failed = 0;

      for (const r of results) {
        if (r.success && !r.skipped) {
          console.log(`✓ Installed: ${r.hook} → ${r.path}`);
          installed++;
        } else if (r.skipped) {
          console.log(`⊘ Skipped: ${r.hook} — ${r.error}`);
          skipped++;
        } else {
          console.error(`✗ Failed: ${r.hook} — ${r.error}`);
          failed++;
        }
      }

      console.log(`\nDone: ${installed} installed, ${skipped} skipped, ${failed} failed.`);
      console.log('\nHooks will auto-run on git events (pre-commit, post-merge, etc.)');
      if (failed > 0) process.exit(1);
    });

  hooksCmd
    .command('uninstall')
    .description('Remove Mumuspec hooks from .git/hooks/')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const results = uninstallHooks(options.workspacePath);

      for (const r of results) {
        if (r.success && !r.skipped) {
          console.log(`✓ Removed: ${r.hook}`);
        } else if (r.skipped) {
          console.log(`⊘ Skipped: ${r.hook} — ${r.error}`);
        } else {
          console.error(`✗ Failed: ${r.hook} — ${r.error}`);
        }
      }
    });

  hooksCmd
    .command('status')
    .description('Show installed hooks status')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const status = getHookStatus(options.workspacePath);

      console.log('\nMumuSpec Git Hooks Status:\n');
      for (const hook of status.available) {
        const isInstalled = status.installed.includes(hook);
        console.log(`  ${isInstalled ? '✓' : '○'} ${hook}`);
      }
      console.log(`\n${status.installed.length}/${status.available.length} hooks installed.`);
    });

  hooksCmd
    .command('run <type>')
    .description('Manually execute hook guard logic (pre-commit, post-merge, post-checkout, commit-msg)')
    .option('--workspace-path <path>', 'workspace path', '.')
    .option('--args <args>', 'additional args (comma-separated)', '')
    .action((type, options) => {
      const hookType = type as HookType;
      const validHooks: HookType[] = ['pre-commit', 'post-merge', 'post-checkout', 'commit-msg'];

      if (!validHooks.includes(hookType)) {
        console.error(`Error: Unknown hook type "${type}". Valid: ${validHooks.join(', ')}`);
        process.exit(1);
      }

      const extraArgs = options.args ? options.args.split(',') : [];
      const result = runHook(hookType, extraArgs, options.workspacePath);

      console.log(`\nHook: ${result.hook}`);

      if (result.errors.length > 0) {
        console.log('\nErrors:');
        for (const e of result.errors) {
          console.error(`  ✗ ${e}`);
        }
      }

      if (result.warnings.length > 0) {
        console.log('\nWarnings:');
        for (const w of result.warnings) {
          console.log(`  ⚠ ${w}`);
        }
      }

      if (result.passed) {
        console.log('\n✓ Hook passed.');
      } else {
        console.error(`\n✗ Hook failed with ${result.errors.length} error(s).`);
        process.exit(1);
      }
    });

  hooksCmd.action(() => {
    console.log('Manage git hooks for automatic MumuSpec guard checks.\n');
    console.log('Usage:');
    console.log('  mumuspec hooks install        Install hooks to .git/hooks/');
    console.log('  mumuspec hooks uninstall      Remove hooks from .git/hooks/');
    console.log('  mumuspec hooks status         Show hook installation status');
    console.log('  mumuspec hooks run <type>     Manually run guard logic');
    console.log('\nHook types: pre-commit, post-merge, post-checkout, commit-msg');
  });
}
