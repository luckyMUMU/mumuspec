/**
 * graph command — State machine graph inspection and verification.
 *
 * `mumuspec graph verify --change <name>` validates that a change's state
 * machine graph is consistent: the phase is a valid node, non-terminal
 * phases have reachable transitions, terminal phases are locked, limit
 * counters are respected, and a path to archive-completed exists.
 */
import type { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import { loadChangeState } from '../../change/state.js';
import { PHASE_ORDER } from '../../change/phase-graph.js';
import {
  getValidTransitionsWithContext,
  isTerminal,
  findTransitionPath,
  activateProjectWorkflow,
} from '../../change/state-machine.js';
import {
  collectWorkflowBpIds,
  collectSkillBps,
  compareBps,
  unionBps,
} from '../../change/phase-bps.js';
import { parse } from 'yaml';

interface CheckResult {
  label: string;
  pass: boolean;
  detail?: string;
}

export function registerGraphCommand(program: Command): void {
  const graph = program
    .command('graph')
    .description('State machine graph inspection and verification');

  graph
    .command('verify')
    .description('Verify a change state machine graph consistency')
    .option('--change <name>', 'change name (uses active change if omitted)')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      // CHG-7: 激活项目级 workflow 覆盖（无则回退内置）
      const wfResult = activateProjectWorkflow(root);

      const changeName = options.change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify --change or run inside a change directory.');
        process.exit(1);
      }

      const state = loadChangeState(root, changeName);
      if (!state) {
        console.error(`Error: Could not load state for change "${changeName}".`);
        process.exit(1);
      }

      const checks: CheckResult[] = [];

      // 1. Phase is a valid graph node
      checks.push({
        label: `Phase "${state.phase}" is a valid graph node`,
        pass: PHASE_ORDER.includes(state.phase),
      });

      // 2. Non-terminal phases must have reachable transitions; terminals must be locked
      const valid = getValidTransitionsWithContext(state.phase, state);
      if (isTerminal(state.phase)) {
        checks.push({
          label: 'Terminal phase has no outgoing transitions',
          pass: valid.length === 0,
          detail: valid.length > 0 ? `unexpected: ${valid.join(', ')}` : 'locked',
        });
      } else {
        checks.push({
          label: 'Non-terminal phase has reachable transitions',
          pass: valid.length > 0,
          detail: valid.length > 0 ? valid.join(', ') : 'none',
        });
      }

      // 3. Limit counters respected
      checks.push({
        label: 'Rollback limit respected',
        pass: state.rollback_count <= state.rollback_limit,
        detail: `${state.rollback_count}/${state.rollback_limit}`,
      });
      checks.push({
        label: 'Rebuild limit respected',
        pass: state.rebuild_count <= state.rebuild_limit,
        detail: `${state.rebuild_count}/${state.rebuild_limit}`,
      });

      // 4. Path to archive-completed exists (non-terminal only)
      if (!isTerminal(state.phase)) {
        const path = findTransitionPath(state.phase, 'archive-completed', state);
        checks.push({
          label: 'Path to archive-completed exists',
          pass: path.length > 0,
          detail: path.length > 0 ? path.join(' → ') : 'unreachable',
        });
      }

      const failed = checks.filter((c) => !c.pass);
      console.log(`\nGraph Verify: ${changeName} (${state.phase})\n`);
      for (const check of checks) {
        const icon = check.pass ? '✓' : '✗';
        console.log(`  ${icon} ${check.label}${check.detail ? ` — ${check.detail}` : ''}`);
      }

      // CHG-8: phase_bps 报告 + skill 侧声明一致性检查（W-GRAPH-001，WARN fail-open）
      const config = wfResult?.config;
      const bps = config ? collectWorkflowBpIds(config, state.workflow) : [];
      if (bps.length > 0) {
        console.log(`\n  Blocking points (${state.workflow}):`);
        for (const [phase, ids] of Object.entries(
          config.workflows[state.workflow].phase_bps ?? {},
        )) {
          console.log(`    ${phase}: ${ids.join(', ')}`);
        }
        const skillPath = join(root, 'skills', 'mumuspec', 'workflow.yaml');
        if (!existsSync(skillPath)) {
          console.log('  (skill 侧 workflow.yaml 缺失 — BP 一致性检查跳过)');
        } else {
          let skill: unknown;
          try {
            skill = parse(readFileSync(skillPath, 'utf8'));
          } catch {
            skill = undefined;
          }
          if (skill === undefined) {
            console.log('  (skill 侧 workflow.yaml 不可解析 — BP 一致性检查跳过)');
          } else {
            const diff = compareBps(unionBps(config), collectSkillBps(skill));
            if (diff.missing.length > 0) {
              console.log(
                `  ⚠ [W-GRAPH-001] skill 侧缺少声明: ${diff.missing.join(', ')}（权威: src/change/workflow.default.yaml 与 skills/mumuspec/workflow.yaml）`,
              );
            }
            if (diff.extra.length > 0) {
              console.log(
                `  ⚠ [W-GRAPH-001] skill 侧多余声明: ${diff.extra.join(', ')}（权威: src/change/workflow.default.yaml 与 skills/mumuspec/workflow.yaml）`,
              );
            }
            if (diff.missing.length === 0 && diff.extra.length === 0) {
              console.log('  ✓ BP 声明与 skill 侧一致');
            }
          }
        }
      }

      console.log(`\n  ${failed.length === 0 ? '✓ All checks passed' : `✗ ${failed.length} check(s) failed`}\n`);

      if (failed.length > 0) process.exit(1);
    });
}
