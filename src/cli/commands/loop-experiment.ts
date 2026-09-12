/**
 * loop-experiment commands — Parallel Evolution Loop (Experiment Mode)
 *
 * Implements a meta-improvement loop where MumuSpec generates multiple
 * improvement directions, spawns worktrees for each, executes a standard
 * change, and compares results to learn which improvements are worth adopting.
 *
 * Workflow: plan → spawn → run → compare → adopt → cleanup
 *
 * Usage:
 *   mumuspec loop experiment init <name> --goal "..."   # Initialize experiment
 *   mumuspec loop experiment spawn <name>               # Create worktrees
 *   mumuspec loop experiment run <name>                 # Execute + collect metrics
 *   mumuspec loop experiment compare <name>             # Compare all arms
 *   mumuspec loop experiment select <name> <dir-ids...> # Select directions
 *   mumuspec loop experiment adopt <name>               # Merge to main
 *   mumuspec loop experiment cleanup <name>             # Remove worktrees
 *   mumuspec loop experiment status [name]              # View status
 *   mumuspec loop experiment info                       # Help overview
 */

import { resolve } from 'node:path';
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import {
  initExperiment,
  spawnArms,
  runArm,
  compareArms,
  selectDirections,
  adoptImprovements,
  loadExperimentState,
  getExperimentStatus,
  listExperiments,
  cleanupExperiment,
} from '../../eval/experiment-engine.js';

/**
 * Register experiment subcommands under the loop command.
 *
 * Experiment mode spawns N worktrees, each running a different improvement
 * direction against the same change. Results are compared and the best
 * improvements are selected for adoption.
 */
export function registerExperimentCommands(loopCmd: Command): void {
  const expCmd = loopCmd
    .command('experiment')
    .description('Parallel evolution loop — test multiple improvement directions simultaneously');

  // ── experiment init ──
  expCmd
    .command('init <name>')
    .description('Initialize experiment with N improvement directions')
    .requiredOption('--goal <statement>', 'overall goal for the experiment')
    .option('--directions <n>', 'number of directions (default: 5)', '5')
    .option('--meta-rounds <n>', 'max meta-rounds (default: 2)', '2')
    .option('--demo-change <change>', 'change name to execute', 'add-priority-field')
    .option('--demo-project <path>', 'demo project path', './demo')
    .option('--focus <categories...>', 'categories to focus on')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const directionCount = parseInt(options.directions, 10);
        const maxMetaRounds = parseInt(options.metaRounds, 10);

        const state = initExperiment(root, {
          name,
          goal: options.goal,
          config: {
            directionCount: isNaN(directionCount) ? 5 : directionCount,
            maxMetaRounds: isNaN(maxMetaRounds) ? 2 : maxMetaRounds,
            demoChangeName: options.demoChange,
            demoProjectPath: resolve(options.demoProject),
            autoGenerate: true,
            focusCategories: options.focus || undefined,
          },
        });

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  Experiment Initialized                                  ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`  Name:          ${state.name}`);
        console.log(`  Goal:          ${state.goal}`);
        console.log(`  Directions:    ${state.directions.length}`);
        console.log(`  Meta-rounds:   ${state.maxMetaRounds}`);
        console.log(`  Demo change:   ${state.demoChangeName}`);
        console.log(`  Base commit:   ${state.baseCommit?.substring(0, 10)}`);
        console.log('');
        console.log('  Directions generated:');
        for (const dir of state.directions) {
          console.log(`    ${dir.id}: ${dir.name} [${dir.category}] (risk: ${dir.riskLevel})`);
          console.log(`       ${dir.description.substring(0, 60)}...`);
        }
        console.log('');
        console.warn('⚠  experiment mode 未接通（P0-5 封存）：arms 不产生 commit、方向为静态启发式、');
        console.warn('   度量为文件存在性模拟 — adopt 不可用。请勿在未接通状态下把实验结果当作可采纳改进。');
        console.log('Next: mumuspec loop experiment spawn');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment spawn ──
  expCmd
    .command('spawn <name>')
    .description('Spawn worktrees for each direction')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const arms = spawnArms(root, name);
        console.log(`✓ Spawned ${arms.length} worktree(s):`);
        for (const arm of arms) {
          console.log(`  ${arm.id} → ${arm.worktreePath}`);
          console.log(`    Branch: ${arm.branch}`);
        }
        console.log('');
        console.log('Next: mumuspec loop experiment run');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment run ──
  expCmd
    .command('run <name>')
    .description('Run all arms (execute change + collect metrics)')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const state = loadExperimentState(root, name);
        if (!state) {
          console.error(`Error: Experiment not found: ${name}`);
          process.exit(1);
        }

        if (state.arms.length === 0) {
          console.error('Error: No arms spawned. Run "mumuspec loop experiment spawn" first.');
          process.exit(1);
        }

        let successCount = 0;
        let failCount = 0;

        for (const arm of state.arms) {
          console.log(`  Running ${arm.id}...`);
          try {
            runArm(root, name, arm.id);
            successCount++;
            console.log('    ✓ Completed');
          } catch (armErr) {
            failCount++;
            console.log(`    ✗ Failed: ${armErr instanceof Error ? armErr.message : String(armErr)}`);
          }
        }

        console.log('');
        console.log(`Results: ${successCount} succeeded, ${failCount} failed`);
        console.log('');
        console.log('Next: mumuspec loop experiment compare');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment compare ──
  expCmd
    .command('compare <name>')
    .description('Compare results across all arms')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const comparison = compareArms(root, name);

        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  Experiment Comparison                                   ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        console.log(`  Total arms:    ${comparison.totalArms}`);
        console.log(`  Successful:    ${comparison.successfulArms}`);
        console.log(`  Failed:        ${comparison.failedArms}`);
        console.log('');

        if (comparison.rankings.length > 0) {
          console.log('  Rankings:');
          console.log('  ┌──────┬──────────────────────────────┬──────────┐');
          console.log('  │ Rank │ Direction                    │ Score    │');
          console.log('  ├──────┼──────────────────────────────┼──────────┤');
          for (const r of comparison.rankings) {
            const dirName = r.directionName.substring(0, 28).padEnd(28);
            const score = String(r.compositeScore).padStart(6);
            console.log(`  │ ${String(r.rank).padStart(4)} │ ${dirName} │  ${score}  │`);
          }
          console.log('  └──────┴──────────────────────────────┴──────────┘');
        }

        if (comparison.insights.length > 0) {
          console.log('');
          console.log('  Insights:');
          for (const insight of comparison.insights) {
            console.log(`    [${insight.category}] ${insight.description}`);
          }
        }

        if (comparison.recommendations.length > 0) {
          console.log('');
          console.log('  Recommended to adopt:');
          for (const dirId of comparison.recommendations) {
            console.log(`    → ${dirId}`);
          }
        }

        console.log('');
        console.log('To adopt directions: mumuspec loop experiment select <name> <dir-id>...');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment select ──
  expCmd
    .command('select <name> <dir-ids...>')
    .description('Select directions to adopt')
    .action((name, dirIds) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const state = selectDirections(root, name, dirIds);
        console.log(`✓ Selected ${state.selectedDirections.length} direction(s) for adoption:`);
        for (const dirId of state.selectedDirections) {
          const dir = state.directions.find((d) => d.id === dirId);
          console.log(`  → ${dirId}: ${dir?.name ?? 'unknown'}`);
        }
        console.log('');
        console.log('Next: mumuspec loop experiment adopt <name>');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment adopt ──
  expCmd
    .command('adopt <name>')
    .description('Merge selected directions back to main project')
    .option('--dry-run', 'preview what would be adopted')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const state = loadExperimentState(root, name);
        if (!state) {
          console.error(`Error: Experiment not found: ${name}`);
          process.exit(1);
        }
        // P0-5: 未接通时 adopt（含 dry-run 预览）一律拒绝，exit 1
        if (state.enabled === false) {
          console.error('✗ experiment mode 未接通，不可采纳 — arms 不产生 commit，adopt 无对象（P0-5 封存）');
          process.exit(1);
        }
        if (options.dryRun) {
          console.log(`[DRY-RUN] Would adopt ${state.selectedDirections.length} direction(s):`);
          for (const dirId of state.selectedDirections) {
            const dir = state.directions.find((d) => d.id === dirId);
            console.log(`  → ${dirId}: ${dir?.name ?? 'unknown'}`);
            console.log(`    Files: ${dir?.affectedFiles.join(', ') ?? 'none'}`);
          }
          return;
        }

        const result = adoptImprovements(root, name);
        console.log(`✓ Adopted ${result.adopted.length} improvement(s):`);
        for (const dirId of result.adopted) {
          console.log(`  ✓ ${dirId}`);
        }
        if (result.errors.length > 0) {
          console.log('');
          console.log('Errors:');
          for (const err of result.errors) {
            console.error(`  ✗ ${err}`);
          }
        }
        console.log('');
        console.log('Next: mumuspec loop experiment cleanup <name>');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment status ──
  expCmd
    .command('status [name]')
    .description('View experiment status')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        if (name) {
          const status = getExperimentStatus(root, name);
          if (!status) {
            console.log(`Experiment "${name}" not found.`);
            return;
          }

          console.log('');
          console.log(`  Experiment: ${status.name}`);
          console.log(`  Phase:      ${status.phase}`);
          console.log(`  Mode:       ${status.enabled ? 'wired' : 'experimental (未接通, adopt 不可用)'}`);
          console.log(`  Arms:       ${status.armsCompleted}/${status.armsTotal} completed`);
          if (status.armsFailed > 0) {
            console.log(`  Failed:     ${status.armsFailed}`);
          }
          console.log(`  Directions: ${status.directionCount}`);
          console.log(`  Selected:   ${status.selectedCount}`);
          console.log(`  Merged:     ${status.mergedBack ? 'Yes' : 'No'}`);
        } else {
          const experiments = listExperiments(root);
          if (experiments.length === 0) {
            console.log('No experiments found.');
            return;
          }
          console.log(`${experiments.length} experiment(s):`);
          for (const exp of experiments) {
            const mode = exp.enabled ? '' : ' [experimental (未接通)]';
            console.log(`  ${exp.name} [${exp.phase}] — ${exp.armsCompleted}/${exp.armsTotal} arms${mode}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment cleanup ──
  expCmd
    .command('cleanup <name>')
    .description('Clean up experiment worktrees')
    .option('--dry-run', 'preview cleanup')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const result = cleanupExperiment(root, name, { dryRun: options.dryRun });

        if (result.cleaned.length === 0 && result.errors.length === 0) {
          console.log('No worktrees to clean up.');
          return;
        }

        if (result.cleaned.length > 0) {
          console.log(`${options.dryRun ? '[DRY-RUN] Would clean' : 'Cleaned'} ${result.cleaned.length} worktree(s):`);
          for (const path of result.cleaned) {
            console.log(`  ✓ ${path.replace(root, '.')}`);
          }
        }

        if (result.errors.length > 0) {
          console.log('');
          console.log('Errors:');
          for (const err of result.errors) {
            console.error(`  ✗ ${err}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── experiment info ──
  expCmd
    .command('info')
    .description('Show experiment mode help')
    .action(() => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  Experiment Mode — Parallel Evolution Loop              ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Status: experimental (未接通) — adopt 不可用');
      console.log('');
      console.log('Workflow: plan → spawn → run → compare → adopt → cleanup');
      console.log('');
      console.log('Steps:');
      console.log('  1. Initialize:  mumuspec loop experiment init <name> --goal "..."');
      console.log('  2. Spawn:       mumuspec loop experiment spawn <name>');
      console.log('  3. Run:         mumuspec loop experiment run <name>');
      console.log('  4. Compare:     mumuspec loop experiment compare <name>');
      console.log('  5. Select:      mumuspec loop experiment select <name> <dir-ids...>');
      console.log('  6. Adopt:       mumuspec loop experiment adopt <name>');
      console.log('  7. Cleanup:     mumuspec loop experiment cleanup <name>');
      console.log('');
      console.log('State commands:');
      console.log('  mumuspec loop experiment status [name]     — View status');
      console.log('  mumuspec loop experiment info              — Show this help');
      console.log('');
    });

  // ── experiment help (default action) ──
  expCmd.action(() => {
    console.log('Parallel evolution loop — test multiple improvement directions.\n');
    console.log('Usage:');
    console.log('  mumuspec loop experiment init <name> --goal "..."');
    console.log('  mumuspec loop experiment spawn <name>');
    console.log('  mumuspec loop experiment run <name>');
    console.log('  mumuspec loop experiment compare <name>');
    console.log('  mumuspec loop experiment select <name> <dir-ids...>');
    console.log('  mumuspec loop experiment adopt <name>');
    console.log('  mumuspec loop experiment cleanup <name>');
    console.log('  mumuspec loop experiment status [name]');
    console.log('\nRun "mumuspec loop experiment info" for full workflow.');
  });
}
