/**
 * grill-me commands — Universal Phase-Gate Questioning Engine
 *
 * Triggerable at any stage when ambiguity exists. Two modes:
 *   static  — non-interactive qualification report
 *   interactive — readline questioning loop (one question at a time)
 *
 * Usage:
 *   mumuspec grill-me run --phase <phase>              # Static check
 *   mumuspec grill-me run --phase <phase> --interactive # Interactive loop
 *   mumuspec grill-me run --phase design --change <n>   # From change context
 */

import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { loadChangeState } from '../../change/manager.js';
import {
  runGrillMeStatic,
  runGrillMeInteractive,
  formatStaticReport,
  type GrillMeContext,
  type GrillMePhase,
} from '../../core/grill-me.js';

const VALID_PHASES: GrillMePhase[] = ['open', 'design', 'build', 'verify', 'loop'];

export function registerGrillMeCommand(program: Command): void {
  const grillMe = program
    .command('grill-me')
    .description('Phase-gate questioning engine — trigger at any stage when ambiguity exists');

  grillMe
    .command('run')
    .description('Run grill-me validation for a target phase')
    .requiredOption('--phase <phase>', 'target phase: open | design | build | verify | loop')
    .option('--change <name>', 'change name (uses active change if omitted)')
    .option('--interactive', 'enter interactive questioning loop', false)
    .option('--max-rounds <n>', 'max interactive rounds (default: phase-specific)')
    // Loop-specific options (for standalone loop grilling)
    .option('--goal <statement>', 'goal statement (loop mode)')
    .option('--criteria <criteria...>', 'convergence criteria (loop mode)', [])
    .option('--rounds <n>', 'max rounds (loop mode, default: 3)', '3')
    .option('--json', 'output as JSON', false)
    .action(async (options) => {
      // Validate phase
      const phase = options.phase as string;
      if (!VALID_PHASES.includes(phase as GrillMePhase)) {
        console.error(`Error: Invalid phase "${phase}". Valid phases: ${VALID_PHASES.join(', ')}`);
        process.exit(1);
      }

      const projectRoot = findProjectRoot();
      if (!projectRoot && phase !== 'loop') {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      // Resolve change context
      let changeState = undefined;
      if (projectRoot) {
        let changeName = options.change;
        if (!changeName) {
          // Try to get active change
          try {
            const { getActiveChange } = await import('../../change/manager.js');
            changeName = getActiveChange(projectRoot) ?? undefined;
          } catch {
            // Non-fatal: proceed without change context
          }
        }
        if (changeName) {
          try {
            changeState = loadChangeState(projectRoot, changeName) ?? undefined;
          } catch {
            // Non-fatal: proceed without change context
          }
        }
      }

      // Build context
      const context: GrillMeContext = {
        phase: phase as GrillMePhase,
        projectRoot: projectRoot ?? '.',
        changeState,
        goal: options.goal,
        criteria: options.criteria?.length ? options.criteria : undefined,
        maxRounds: parseInt(options.rounds, 10),
        maxQuestionRounds: options.maxRounds ? parseInt(options.maxRounds, 10) : undefined,
        interactive: options.interactive,
      };

      // Execute
      if (options.interactive) {
        // Interactive mode
        const report = await runGrillMeInteractive(context);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        }

        // Exit code based on consensus
        if (!report.consensusReached) {
          process.exit(1);
        }

        // Persist result if we have a change context
        if (projectRoot && changeState) {
          const { buildGrillMeResult } = await import('../../core/grill-me.js');
          const { saveChangeState } = await import('../../change/manager.js');
          changeState.grill_me_result = buildGrillMeResult(report);
          saveChangeState(projectRoot, changeState.name, changeState, changeState.scope);
        }
      } else {
        // Static mode
        const report = runGrillMeStatic(context);

        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(formatStaticReport(report));
        }

        // Exit code: fail on errors
        if (!report.passed) {
          process.exit(1);
        }
      }
    });

  // Info subcommand
  grillMe
    .command('info')
    .description('Show grill-me configuration and phase criteria info')
    .action(() => {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  Grill-Me — 阶段准入质询引擎                           ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log('合格标准 (per phase):');
      console.log('');
      console.log('  open:');
      console.log('    - scope 清晰度 (affected_scopes)');
      console.log('    - proposal 完整性');
      console.log('    - 关键决策记录');
      console.log('    上限: 5 轮');
      console.log('');
      console.log('  design:');
      console.log('    - design layers 定义');
      console.log('    - SHALL/SHALL NOT 约束');
      console.log('    - 认知框架收敛 (full 工作流)');
      console.log('    - test cases 锁定');
      console.log('    + DFS 决策深度追问');
      console.log('    上限: 10 轮');
      console.log('');
      console.log('  build:');
      console.log('    - test suites 锁定');
      console.log('    - 测试覆盖所有 build_layers');
      console.log('    上限: 3 轮');
      console.log('');
      console.log('  verify:');
      console.log('    - verify_result = pass');
      console.log('    - branch_status = handled');
      console.log('    - 偏差已审查');
      console.log('    上限: 3 轮');
      console.log('');
      console.log('  loop:');
      console.log('    - goal 具体性 + 范围 + 动作动词');
      console.log('    - maxRounds 在 1-5');
      console.log('    - 收敛标准存在');
      console.log('    上限: 5 轮');
      console.log('');
      console.log('用法:');
      console.log('  mumuspec grill-me run --phase <phase>');
      console.log('  mumuspec grill-me run --phase <phase> --interactive');
      console.log('');
      console.log('触发时机:');
      console.log('  • 阶段转换前对合格标准有疑义');
      console.log('  • 需要确认关键决策或假设');
      console.log('  • 需要显式的人工共识门禁');
      console.log('');
    });
}
