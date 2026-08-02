/**
 * change commands — new, status, list, archive, discard.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { MumuSpecError, formatError } from '../../core/errors.js';
import {
  createChange,
  loadChangeState,
  listActiveChanges,
  listArchivedChanges,
  getActiveChange,
  discardChange,
  archiveChange,
  getChangeStatusSummary,
  getChangeDir,
} from '../../change/manager.js';
import { collect } from '../helpers.js';

export function registerChangeCommands(program: Command): void {
  // === new ===
  program
    .command('new')
    .description('Create a new change')
    .argument('<name>', 'change name')
    .option('--workflow <type>', 'workflow type (full|hotfix|tweak)', 'full')
    .option('--scope <scope>', 'affected scope (can be repeated)', collect, [])
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const config = loadConfig(root);

      try {
        const state = createChange(root, name, options.workflow, config, options.scope);
        console.log(`\n✓ Change "${name}" created`);
        console.log(`  Workflow: ${state.workflow}`);
        console.log(`  Phase: ${state.phase}`);
        console.log(`  Directory: ${getChangeDir(root, name)}`);
        console.log('\nNext steps:');
        if (options.workflow === 'hotfix' || options.workflow === 'tweak') {
          console.log('  1. Edit proposal.md');
          console.log('  2. Define test-cases/layer-0-cases.md');
          console.log('  3. Lock test cases: mumuspec test-cases lock ' + name);
          console.log('  4. Transition to build: mumuspec state transition ' + name + ' build');
        } else {
          console.log('  1. Edit proposal.md');
          console.log('  2. Create delta-specs/');
          console.log('  3. Transition to design: mumuspec state transition ' + name + ' design');
        }
      } catch (err) {
        const error = err as Error;
        if (error instanceof MumuSpecError) {
          console.error(formatError(error.code, error.context));
        } else {
          console.error(`Error: ${error.message}`);
        }
        process.exit(1);
      }
    });

  // === status ===
  program
    .command('status')
    .description('View change status')
    .argument('[name]', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      if (!name) {
        name = getActiveChange(root) || undefined;
        if (!name) {
          console.log('No active changes.');
          const archived = listArchivedChanges(root);
          if (archived.length > 0) {
            console.log(`\nArchived changes: ${archived.length}`);
            for (const a of archived) {
              console.log(`  - ${a}`);
            }
          }
          return;
        }
      }

      const summary = getChangeStatusSummary(root, name);
      console.log(summary);
    });

  // === list ===
  program
    .command('list')
    .description('List active changes')
    .option('--all', 'include archived')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const active = listActiveChanges(root);
      if (active.length > 0) {
        console.log('\nActive changes:');
        for (const name of active) {
          const state = loadChangeState(root, name);
          if (state) {
            console.log(`  ${name} [${state.phase}] (${state.workflow})`);
          }
        }
      } else {
        console.log('No active changes.');
      }

      if (options.all) {
        const archived = listArchivedChanges(root);
        if (archived.length > 0) {
          console.log('\nArchived changes:');
          for (const name of archived) {
            console.log(`  ${name}`);
          }
        }
      }
    });

  // === archive ===
  program
    .command('archive')
    .description('Archive a change')
    .argument('<name>', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        archiveChange(root, name);
        console.log(`✓ Change "${name}" archived`);
      } catch (err) {
        const error = err as Error;
        if (error instanceof MumuSpecError) {
          console.error(formatError(error.code, error.context));
        } else {
          console.error(`Error: ${error.message}`);
        }
        process.exit(1);
      }
    });

  // === discard ===
  program
    .command('discard')
    .description('Discard a change')
    .argument('<name>', 'change name')
    .option('--reason <reason>', 'discard reason')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        discardChange(root, name, options.reason || 'No reason provided');
        console.log(`✓ Change "${name}" discarded`);
      } catch (err) {
        const error = err as Error;
        if (error instanceof MumuSpecError) {
          console.error(formatError(error.code, error.context));
        } else {
          console.error(`Error: ${error.message}`);
        }
        process.exit(1);
      }
    });
}
