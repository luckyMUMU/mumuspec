/**
 * loop commands — Dynamic Workflow (Loop-Core Mode)
 *
 * Implements iterative Plan → Act → Evaluate loop workflow.
 * Features: auto worktree isolation, auto git commit, round limit (default 3).
 *
 * Usage:
 *   mumuspec loop init <name> --goal "..."     # Initialize loop mode
 *   mumuspec loop round "<plan>"               # Start a new round
 *   mumuspec loop action "<desc>" [--target X] # Record an action
 *   mumuspec loop evaluate --progress 0.6      # Evaluate current round
 *   mumuspec loop status                       # View loop status
 *   mumuspec loop resume                       # Resume blocked loop
 *   mumuspec loop extend <n>                   # Add more rounds
 *   mumuspec loop exit                        # Exit loop (converge)
 *   mumuspec loop merge                        # Merge worktree back
 *   mumuspec loop cleanup [--dry-run]          # Clean up merged worktrees
 */

import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import { loadChangeState } from '../../change/manager.js';
import {
  initLoop,
  startRound,
  recordAction,
  evaluateRound,
  getLoopStatus,
  resumeLoop,
  extendLoop,
  exitLoop,
  mergeWorktreeBack,
  getLoopRecommendation,
  detectStagnation,
  cleanupWorktrees,
} from '../../core/loop-engine.js';
import { runLoopGrill, formatGrillReport, type GrillContext } from '../../core/loop-grill.js';
import type { LoopActionType } from '../../core/types-loop.js';
import { success, fail, warn, tip } from '../ui-helpers.js';
import { registerExperimentCommands } from './loop-experiment.js';

/** Format phase label with descriptive text. */
function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    plan: 'Plan (规划中)',
    act: 'Act (执行中)',
    evaluate: 'Evaluate (评估中)',
    converged: '✓ Converged (已收敛)',
    exhausted: '⏹ Exhausted (轮次耗尽)',
    blocked: '⛔ Blocked (阻塞中)',
  };
  return labels[phase] || phase;
}

export function registerLoopCommands(program: Command): void {
  const loopCmd = program.command('loop').description('Dynamic loop workflow (Plan → Act → Evaluate)');

  // ── grill (前置可行性验证) ──
  loopCmd
    .command('grill')
    .description('Run loop-specific grill validation (for cross-phase grilling, use: mumuspec grill-me --phase loop)')
    .requiredOption('--goal <statement>', 'overall goal statement to validate')
    .option('--criteria <criteria...>', 'convergence criteria (optional)', [])
    .option('--rounds <n>', 'max rounds (default: 3)', '3')
    .action((options) => {
      const goal = options.goal;
      const criteria = options.criteria || [];
      const maxRounds = parseInt(options.rounds, 10);

      const ctx: GrillContext = { goal, criteria, maxRounds };
      const report = runLoopGrill(ctx);

      console.log(formatGrillReport(report));

      if (!report.passed) {
        process.exit(1);
      }
    });

  // ── init ──
  loopCmd
    .command('init')
    .description('Initialize loop mode for a change (with auto worktree + grill validation)')
    .argument('<name>', 'change name')
    .requiredOption('--goal <statement>', 'overall goal statement')
    .option('--criteria <criteria...>', 'convergence criteria', [])
    .option('--rounds <n>', 'max rounds (default: 3)', '3')
    .option('--no-worktree', 'skip automatic worktree isolation')
    .option('--no-auto-commit', 'disable auto git commit after each round')
    .option('--skip-grill', 'skip grill-me validation (not recommended)')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const state = loadChangeState(root, name);
        if (!state) {
          console.error(`Error: Change not found: ${name}`);
          process.exit(1);
        }

        if (state.loop_state?.enabled) {
          console.error(`Error: Loop already initialized for change "${name}".`);
          process.exit(1);
        }

        // Grill-me validation (unless --skip-grill)
        if (!options.skipGrill) {
          const grillCtx: GrillContext = {
            goal: options.goal,
            criteria: options.criteria || [],
            maxRounds: parseInt(options.rounds, 10),
          };
          const grillReport = runLoopGrill(grillCtx);

          if (!grillReport.passed) {
            console.log('');
            console.log('❌ Grill validation failed. Fix critical issues or use --skip-grill to bypass.');
            console.log(formatGrillReport(grillReport));
            process.exit(1);
          }

          // Use validated/refined criteria
          options.criteria = grillReport.validatedContext.criteria;
        }

        const loopState = initLoop(root, {
          changeName: name,
          goal: options.goal,
          convergence_criteria: options.criteria || [],
          max_rounds: parseInt(options.rounds, 10),
          use_worktree: options.worktree !== false,
          auto_commit: options.autoCommit !== false,
        });

        console.log(`\n✓ Loop mode initialized for "${name}"`);
        console.log(`  Goal: ${loopState.goal}`);
        console.log(`  Max rounds: ${loopState.max_rounds}`);
        console.log(`  Auto-commit: ${loopState.auto_commit}`);
        console.log(`  Worktree: ${loopState.worktree_path || '(none)'}`);
        console.log(`  Criteria: ${loopState.convergence_criteria.join(', ') || '(none)'}`);
        console.log('');
        console.log('Next: mumuspec loop round "<plan>" to start round 1');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── round ──
  loopCmd
    .command('round')
    .description('Start a new loop round with a plan')
    .argument('<plan>', 'plan description for this round')
    .argument('[change]', 'change name (optional, uses active change)')
    .action((plan, change) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        const round = startRound(root, changeName, plan);
        const status = getLoopStatus(root, changeName);
        console.log(`\n▶ Round ${round.round} started`);
        console.log(`  Plan: ${round.plan}`);
        console.log(`  Started: ${round.started_at}`);
        if (status?.worktreePath) {
          console.log(`  Worktree: ${status.worktreePath}`);
        }
        console.log('');
        console.log('Record actions with: mumuspec loop action "<description>"');
        console.log('Evaluate with: mumuspec loop evaluate --progress <0-1>');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── action ──
  loopCmd
    .command('action')
    .description('Record an action in the current round')
    .argument('<description>', 'action description')
    .argument('[change]', 'change name')
    .option('--type <type>', 'action type', 'file_edit')
    .option('--target <target>', 'target file/command')
    .option('--failed', 'mark action as failed')
    .option('--error <error>', 'error message if failed')
    .action((description, change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        recordAction(root, changeName, {
          type: options.type as LoopActionType,
          description,
          target: options.target,
          success: !options.failed,
          error: options.error,
        });

        console.log(`✓ Action recorded: ${description}`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── evaluate ──
  loopCmd
    .command('evaluate')
    .description('Evaluate the current round and auto-commit')
    .argument('[change]', 'change name')
    .requiredOption('--progress <score>', 'progress score 0.0-1.0')
    .option('--goal-achieved', 'mark goal as achieved')
    .option('--next-focus <focus>', 'suggested focus for next round')
    .option('--issue <issue>', 'issue discovered (repeatable)', (val: string, prev: string[]) => [...prev, val], [] as string[])
    .option('--needs-user', 'flag that user input is needed')
    .option('--block-reason <reason>', 'reason for being blocked')
    .option('--auto', 'use auto-evaluate mode (metric-driven)')
    .option('--hybrid', 'use hybrid mode (auto 70% + manual 30%)')
    .action(async (change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      const progress = parseFloat(options.progress);
      if (isNaN(progress) || progress < 0 || progress > 1) {
        console.error('Error: --progress must be a number between 0.0 and 1.0');
        process.exit(1);
      }

      // Determine evaluation mode
      let mode: 'manual' | 'auto' | 'hybrid' = 'manual';
      if (options.auto) mode = 'auto';
      else if (options.hybrid) mode = 'hybrid';

      try {
        const result = await evaluateRound(root, changeName, {
          progress,
          goal_achieved: options.goalAchieved || false,
          issues: options.issue || [],
          next_focus: options.nextFocus,
          needs_user_input: options.needsUser || false,
          block_reason: options.blockReason,
        }, { mode, manualProgress: progress });

        const status = getLoopStatus(root, changeName);
        if (!status) {
          console.error('Error: Could not get loop status');
          process.exit(1);
        }

        console.log('');
        console.log(`  ┌──────────────────────────────────────────────────────────┐`);
        console.log(`  │  Round ${status.currentRound} Evaluation${' '.repeat(36)}│`);
        console.log(`  └──────────────────────────────────────────────────────────┘`);
        
        // Progress bar
        const barLen = 30;
        const filled = Math.round(progress * barLen);
        const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
        console.log(`  Progress:  ${bar} ${Math.round(progress * 100)}%`);
        console.log(`  Phase:     ${phaseLabel(status.phase)}`);

        if (status.lastEvaluation?.issues.length) {
          console.log('');
          for (const issue of status.lastEvaluation.issues) {
            warn(issue);
          }
        }

        if (result.should_commit) {
          console.log('');
          success('Auto-committed round state.');
        }

        // Phase-specific guidance with recovery suggestions
        console.log('');
        if (status.phase === 'converged') {
          console.log('  ──────────────────────────────────────');
          success('Goal achieved!');
          tip('Run: mumuspec loop exit    — finalize the loop');
        } else if (status.phase === 'exhausted') {
          console.log('  ──────────────────────────────────────');
          warn(`Round limit reached (${status.currentRound}/${status.maxRounds}).`);
          tip('Run: mumuspec loop extend <n>  — add more rounds');
          tip('Run: mumuspec loop exit       — finish with current progress');
          tip('Run: mumuspec loop status     — review full progress');
        } else if (status.phase === 'blocked') {
          console.log('  ──────────────────────────────────────');
          fail(`Blocked: ${status.blockReason}`, 'Resolve the issue, then run: mumuspec loop resume');
        } else if (result.should_continue) {
          console.log('  ──────────────────────────────────────');
          tip(`Ready for round ${status.currentRound + 1}: mumuspec loop round "<plan>"`);
        }
        console.log('');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── status ──
  loopCmd
    .command('status')
    .description('View loop status and progress')
    .argument('[change]', 'change name')
    .action((change) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      const status = getLoopStatus(root, changeName);
      if (!status) {
        console.log(`Change "${changeName}" is not in loop mode.`);
        console.log('Run `mumuspec loop init <name> --goal "..."` to start.');
        return;
      }

      const state = loadChangeState(root, changeName);
      
      // Enhanced display with visual progress bar
      const progressBar = (p: number) => {
        const filled = Math.round(p * 20);
        return '█'.repeat(filled) + '░'.repeat(20 - filled);
      };

      console.log('');
      console.log(`  ╔══════════════════════════════════════════════════════════╗`);
      console.log(`  ║  Loop: ${changeName.padEnd(48)}║`);
      console.log(`  ╚══════════════════════════════════════════════════════════╝`);
      console.log(`  Phase:     ${phaseLabel(status.phase)}`);
      console.log(`  Round:     ${status.currentRound} / ${status.maxRounds}`);
      console.log(`  Goal:      ${status.goal.substring(0, 50)}${status.goal.length > 50 ? '...' : ''}`);
      console.log(`  Actions:   ${status.totalActions}`);

      if (status.progressTrend.length > 0) {
        console.log('');
        console.log(`  Progress:`);
        for (let i = 0; i < status.progressTrend.length; i++) {
          const p = status.progressTrend[i];
          console.log(`    Round ${i + 1}: ${progressBar(p)} ${Math.round(p * 100)}%`);
        }
      }

      if (status.lastEvaluation?.next_focus) {
        console.log('');
        tip(status.lastEvaluation.next_focus);
      }

      // Stagnation warning with recovery
      if (state?.loop_state && detectStagnation(state.loop_state)) {
        console.log('');
        warn('Stagnation detected: no progress in recent rounds.');
        tip('Try changing approach or extend rounds with: mumuspec loop extend <n>');
      }

      // Recommendation
      if (state?.loop_state) {
        const rec = getLoopRecommendation(state.loop_state);
        if (rec) {
          console.log('');
          tip(rec);
        }
      }
      console.log('');
    });

  // ── resume ──
  loopCmd
    .command('resume')
    .description('Resume a blocked loop')
    .argument('[change]', 'change name')
    .action((change) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        resumeLoop(root, changeName);
        console.log(`✓ Loop resumed for "${changeName}"`);
        console.log('  `mumuspec loop round "<plan>"` to continue.');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── extend ──
  loopCmd
    .command('extend')
    .description('Extend the max rounds limit')
    .argument('<n>', 'number of additional rounds')
    .argument('[change]', 'change name')
    .action((n, change) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      const additional = parseInt(n, 10);
      if (isNaN(additional) || additional <= 0) {
        console.error('Error: must be a positive number');
        process.exit(1);
      }

      try {
        const loop = extendLoop(root, changeName, additional);
        console.log(`✓ Extended: max rounds is now ${loop.max_rounds} (${loop.current_round} completed)`);
        if (loop.phase === 'plan') {
          console.log('  `mumuspec loop round "<plan>"` to continue.');
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── exit ──
  loopCmd
    .command('exit')
    .description('Exit loop mode (mark as converged)')
    .argument('[change]', 'change name')
    .option('--reason <reason>', 'exit reason', 'user requested exit')
    .action((change, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        exitLoop(root, changeName, options.reason);
        console.log(`✓ Loop exited for "${changeName}"`);
        console.log(`  Reason: ${options.reason}`);
        console.log('');
        console.log('To merge worktree changes back:');
        console.log('  `mumuspec loop merge`');
        console.log('');
        console.log('To archive the change:');
        console.log('  `mumuspec state transition <name> verify`');
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── merge ──
  loopCmd
    .command('merge')
    .description('Merge worktree changes back to original branch')
    .argument('[change]', 'change name')
    .action((change) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      try {
        const merged = mergeWorktreeBack(root, changeName);
        if (merged) {
          console.log(`✓ Worktree merged back to original branch`);
        } else {
          console.log('No worktree to merge or merge not needed.');
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── cleanup (清理已合并的worktree) ──
  loopCmd
    .command('cleanup')
    .description('Clean up loop worktrees that have been merged')
    .option('--dry-run', 'preview what would be cleaned up')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      try {
        const result = cleanupWorktrees(root, { dryRun: options.dryRun });

        if (result.cleaned.length === 0 && result.remaining.length === 0) {
          console.log('No loop worktrees found.');
          return;
        }

        if (result.cleaned.length > 0) {
          console.log(`${options.dryRun ? '[DRY-RUN] Would clean' : 'Cleaned'} ${result.cleaned.length} worktree(s):`);
          for (const path of result.cleaned) {
            const relativePath = path.replace(root, '.');
            console.log(`  ✓ ${relativePath}`);
          }
        }

        if (result.remaining.length > 0) {
          console.log(`\n${result.remaining.length} active worktree(s) remaining.`);
        }
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  // ── info (helpful summary) ──
  loopCmd
    .command('info')
    .description('Show loop mode help and workflow overview')
    .action(() => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  Loop Mode — Dynamic Workflow                          ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('Pattern: Plan → Act → Evaluate → (commit) → repeat');
      console.log('');
      console.log('Default: 3 rounds, auto-commit, worktree isolation');
      console.log('');
      console.log('Pre-loop validation:');
      console.log('  mumuspec loop grill --goal "<goal>"          — Loop-specific static checks');
      console.log('  mumuspec grill-me run --phase loop            — Cross-phase static + interactive');
      console.log('');
      console.log('Workflow:');
      console.log('  1. Initialize:  mumuspec loop init <name> --goal "..."');
      console.log('  2. Round start: mumuspec loop round "<plan>"');
      console.log('  3. Do work & record:');
      console.log('     mumuspec loop action "edited foo.ts"');
      console.log('     mumuspec loop action "ran tests"');
      console.log('  4. Evaluate:    mumuspec loop evaluate --progress 0.6');
      console.log('  5. Go to 2 (auto-commits and loops back)');
      console.log('  6. Exit:        mumuspec loop exit');
      console.log('  7. Merge:       mumuspec loop merge');
      console.log('');
      console.log('State commands:');
      console.log('  mumuspec loop status     — View progress');
      console.log('  mumuspec loop resume     — Resume after block');
      console.log('  mumuspec loop extend <n>  — Add more rounds');
      console.log('');
    });

  // Delegate experiment subcommands to dedicated module
  registerExperimentCommands(loopCmd);
}
