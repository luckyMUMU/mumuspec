/**
 * recommend command — Workflow path recommendation (L1 Suggestion).
 *
 * Estimates change scope from flags or active change state,
 * then recommends full / tweak / hotfix path with rationale.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import { loadChangeState } from '../../change/state.js';
import {
  estimateScope,
  recommendPath,
  formatRecommendation,
} from '../../core/workflow-recommender.js';
import type { ScopeEstimation } from '../../core/types-workflow.js';

export function registerRecommendCommand(program: Command): void {
  program
    .command('recommend')
    .description('Recommend workflow path (full/tweak/hotfix) based on change scope')
    .argument('[change]', 'change name (optional, uses active change if omitted)')
    .option('--files <n>', 'estimated number of files to change', '0')
    .option('--modules <n>', 'number of modules affected', '0')
    .option('--cross-module', 'change spans multiple modules', false)
    .option('--new-api', 'introduces new public API', false)
    .option('--new-dep', 'adds new external dependency', false)
    .option('--data-migration', 'involves data migration', false)
    .option('--doc-only', 'documentation-only change', false)
    .option('--bugfix', 'pure bugfix (root cause confirmed)', false)
    .action((change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      let scope: ScopeEstimation;

      // Mode 1: explicit flags — use CLI options directly
      const usingFlags =
        options.files !== '0' ||
        options.modules !== '0' ||
        options.crossModule ||
        options.newApi ||
        options.newDep ||
        options.dataMigration ||
        options.docOnly ||
        options.bugfix;

      if (usingFlags && !change) {
        scope = estimateScope({
          estimated_files: parseInt(options.files, 10),
          modules_affected: parseInt(options.modules, 10),
          cross_module: options.crossModule,
          new_public_api: options.newApi,
          new_external_dep: options.newDep,
          data_migration: options.dataMigration,
          is_doc_only: options.docOnly,
          is_pure_bugfix: options.bugfix,
        });
      } else {
        // Mode 2: derive from change state
        const changeName = change || getActiveChange(root);
        if (!changeName) {
          console.error('Error: No active change. Use flags (--files, --modules, ...) or run inside a change directory.');
          process.exit(1);
        }

        const state = loadChangeState(root, changeName);

        if (!state) {
          console.error(`Error: Could not load state for change "${changeName}".`);
          process.exit(1);
        }

        // Derive scope from change state signals
        scope = estimateScope({
          estimated_files: state.estimated_files ?? 0,
          modules_affected: state.modules_affected ?? 1,
          cross_module: state.cross_module ?? false,
          new_public_api: state.new_public_api ?? false,
          new_external_dep: state.new_external_dep ?? false,
          data_migration: state.data_migration ?? false,
          is_doc_only: state.is_doc_only ?? false,
          is_pure_bugfix: state.is_pure_bugfix ?? false,
        });

        console.log(`\nChange: ${changeName} (${state.phase})\n`);
      }

      const recommendation = recommendPath(scope);
      console.log(formatRecommendation(recommendation));
    });
}
