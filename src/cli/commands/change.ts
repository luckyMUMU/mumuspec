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
  saveChangeState,
  listActiveChanges,
  listArchivedChanges,
  getActiveChange,
  discardChange,
  archiveChange,
  getChangeStatusSummary,
  getChangeDir,
} from '../../change/manager.js';
import { collect } from '../helpers.js';
import { join } from 'node:path';
import { readText, writeText } from '../../core/utils.js';
import {
  estimateScope,
  recommendPath,
  formatRecommendation,
} from '../../core/workflow-recommender.js';
import { computeSkillSet } from '../../core/skill-loader.js';

export function registerChangeCommands(program: Command): void {
  // === new ===
  program
    .command('new')
    .description('Create a new change')
    .argument('<name>', 'change name')
    .option('--workflow <type>', 'workflow type (full|hotfix|tweak|loop)', 'full')
    .option('--scope <scope>', 'affected scope (can be repeated)', collect, [])
    .option('--files <n>', 'estimated number of files to change (triggers path recommendation)')
    .option('--modules <n>', 'number of modules affected')
    .option('--cross-module', 'change spans multiple modules')
    .option('--new-api', 'introduces new public API')
    .option('--new-dep', 'adds new external dependency')
    .option('--data-migration', 'involves data migration')
    .option('--doc-only', 'documentation-only change')
    .option('--bugfix', 'pure bugfix (root cause confirmed)')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const config = loadConfig(root);

      try {
        const state = createChange(root, name, options.workflow, config, options.scope);

        // Update state with dist_spec pointers (Distributed Spec V2)
        state.dist_spec = {
          prd: '.mumuspec/prd.md',
          tech: '.mumuspec/tech.md',
        };

        // LLM Freedom Enhancement: path recommendation if scope signals provided
        const hasScopeSignals =
          options.files !== undefined ||
          options.crossModule ||
          options.newApi ||
          options.newDep ||
          options.dataMigration ||
          options.docOnly ||
          options.bugfix;

        if (hasScopeSignals) {
          const scopeSignals = {
            estimated_files: options.files !== undefined ? parseInt(options.files, 10) : 0,
            modules_affected: options.modules !== undefined ? parseInt(options.modules, 10) : 1,
            cross_module: options.crossModule || false,
            new_public_api: options.newApi || false,
            new_external_dep: options.newDep || false,
            data_migration: options.dataMigration || false,
            is_doc_only: options.docOnly || false,
            is_pure_bugfix: options.bugfix || false,
          };

          // Persist scope signals in state
          state.estimated_files = scopeSignals.estimated_files;
          state.modules_affected = scopeSignals.modules_affected;
          state.cross_module = scopeSignals.cross_module;
          state.new_public_api = scopeSignals.new_public_api;
          state.new_external_dep = scopeSignals.new_external_dep;
          state.data_migration = scopeSignals.data_migration;
          state.is_doc_only = scopeSignals.is_doc_only;
          state.is_pure_bugfix = scopeSignals.is_pure_bugfix;

          // Recommend path and inject into proposal.md
          const scope = estimateScope(scopeSignals);
          const recommendation = recommendPath(scope);
          const recText = formatRecommendation(recommendation);

          const changeDir = getChangeDir(root, name);
          const proposalPath = join(changeDir, 'proposal.md');
          const existingProposal = readText(proposalPath);
          if (existingProposal) {
            writeText(proposalPath, existingProposal + '\n' + recText + '\n');
          }
        }

        saveChangeState(root, name, state, state.scope);

        console.log(`\n✓ Change "${name}" created`);
        console.log(`  Workflow: ${state.workflow}`);
        console.log(`  Phase: ${state.phase}`);
        console.log(`  Directory: ${getChangeDir(root, name)}`);
        if (state.dist_spec) {
          console.log(`  Spec files: ${state.dist_spec.prd}, ${state.dist_spec.tech}`);
        }
        if (hasScopeSignals) {
          const scope = estimateScope({
            estimated_files: state.estimated_files ?? 0,
            modules_affected: state.modules_affected ?? 1,
            cross_module: state.cross_module ?? false,
            new_public_api: state.new_public_api ?? false,
            new_external_dep: state.new_external_dep ?? false,
            data_migration: state.data_migration ?? false,
            is_doc_only: state.is_doc_only ?? false,
            is_pure_bugfix: state.is_pure_bugfix ?? false,
          });
          const rec = recommendPath(scope);
          console.log(`  Recommended: ${rec.path} (${Math.round(rec.confidence * 100)}% confidence)`);
        }

        // Skill auto-loading based on task characteristics
        const taskChars = {
          involves_concurrency: options.crossModule || false,
          involves_new_dependency: options.newDep || false,
          involves_api_change: options.newApi || false,
          involves_database_schema: options.dataMigration || false,
          involves_ui: false,
          involves_config: false,
          ecosystems: [],
        };
        const skills = computeSkillSet(taskChars);
        if (skills.length > 0) {
          const skillNames = skills.map(s => s.name).join(', ');
          console.log(`  Skills: ${skillNames}`);
        }
        console.log('\nNext steps:');
        if (options.workflow === 'loop') {
          console.log('  1. Initialize loop: mumuspec loop init ' + name + ' --goal "<your goal>"');
          console.log('  2. Start round 1:   mumuspec loop round "<plan>"');
          console.log('  3. See loop help:   mumuspec loop info');
        } else if (options.workflow === 'hotfix' || options.workflow === 'tweak') {
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
