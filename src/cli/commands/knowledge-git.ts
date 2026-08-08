/**
 * Git command — git operations (status, commit, push, tag, flow).
 */
import type { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';

function requireRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error('Error: Not initialized. Run `mumuspec init` first.');
    process.exit(1);
  }
  return root;
}

/** Register top-level `git` command with subcommands. */
export function registerGitCommand(program: Command): void {
  program
    .command('git')
    .description('Git operations - commit, push, tag, flow (git-master style)')
    .argument('<subcommand>', 'git subcommand: status|commit|push|tag|flow')
    .argument('[args...]', 'additional arguments')
    .option('-m, --message <msg>', 'commit message (for commit subcommand)')
    .option('-b, --branch <name>', 'branch name (for flow subcommand)')
    .option('--dry-run', 'preview without executing')
    .option('--scope <scope>', 'commit scope (auto-detected from change name)')
    .action((subcommand, args, options) => {
      const root = requireRoot();

      const exec = (cmd: string, args: string[] = []): string => {
        if (options.dryRun) {
          console.log(`[dry-run] ${cmd} ${args.join(' ')}`);
          return '';
        }
        const result = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
        if (result.status !== 0 && result.stderr) {
          console.error(result.stderr);
        }
        return (result.stdout ?? '').trim();
      };

      switch (subcommand) {
        case 'status':
        case 'st': {
          console.log('Git status:\n');
          const status = exec('git', ['status', '--short', '--branch']);
          console.log(status || 'No changes');
          const recent = exec('git', ['log', '--oneline', '-5']);
          if (recent) {
            console.log('\nRecent commits:');
            console.log(recent);
          }
          break;
        }

        case 'commit':
        case 'ci': {
          let scope = options.scope || '';
          if (!scope) {
            try {
              const active = getActiveChange(root);
              if (active) {
                scope = active.replace(/[^a-zA-Z0-9-]/g, '-');
              }
            } catch {
              // No active change
            }
          }
          const msg = options.message;
          if (!msg) {
            console.error('Commit message required. Use -m "message"');
            process.exit(1);
          }
          const fullMsg = scope ? `feat(${scope}): ${msg}` : `feat: ${msg}`;
          console.log(`Committing: ${fullMsg}`);
          exec('git', ['add', '-A']);
          exec('git', ['commit', '-m', fullMsg]);
          console.log('Committed');
          break;
        }

        case 'push': {
          const branch = exec('git', ['branch', '--show-current']);
          console.log(`Pushing to origin/${branch}...`);
          exec('git', ['push', '-u', 'origin', branch]);
          console.log('Pushed');
          break;
        }

        case 'tag': {
          const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
          const tag = `v${pkg.version}`;
          console.log(`Creating tag ${tag}...`);
          exec('git', ['tag', '-a', tag, '-m', `Release ${tag}`]);
          exec('git', ['push', 'origin', tag]);
          console.log(`Tagged and pushed: ${tag}`);
          break;
        }

        case 'flow': {
          const sub = args[0];
          const name = options.branch || args[1];
          if (!sub || !['start', 'finish'].includes(sub)) {
            console.error('Usage: mumuspec git flow <start|finish> [-b <branch-name>]');
            console.error('  start feature/my-feature   - Create feature branch');
            console.error('  finish feature/my-feature  - Merge and cleanup');
            process.exit(1);
          }
          if (!name) {
            console.error('Branch name required. Use -b <name> or pass as argument.');
            process.exit(1);
          }
          if (sub === 'start') {
            console.log(`Starting flow: ${name}`);
            // Try main first, fallback to master (no shell operators)
            const mainResult = exec('git', ['checkout', 'main']);
            if (mainResult === undefined || mainResult === '') {
              const checkoutMain = spawnSync('git', ['checkout', 'main'], { cwd: root });
              if (checkoutMain.status !== 0) {
                exec('git', ['checkout', 'master']);
              }
            }
            exec('git', ['pull']);
            exec('git', ['checkout', '-b', name]);
            console.log(`Created branch: ${name}`);
          } else {
            console.log(`Finishing flow: ${name}`);
            const branches = exec('git', ['branch', '--list', 'main', 'master', '--format=%(refname:short)']);
            const base = branches
              .split('\n')
              .map((b: string) => b.trim())
              .filter(Boolean)[0] || 'main';
            exec('git', ['checkout', base]);
            exec('git', ['pull']);
            exec('git', ['merge', '--no-ff', name, '-m', `Merge branch '${name}'`]);
            exec('git', ['branch', '-d', name]);
            console.log(`Merged and removed: ${name}`);
          }
          break;
        }

        default:
          console.error(`Unknown git subcommand: ${subcommand}`);
          console.error('Available: status, commit, push, tag, flow');
          process.exit(1);
      }
    });
}
