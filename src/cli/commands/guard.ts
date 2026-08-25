/**
 * guard command — Run phase guard checks.
 */
import type { Command } from 'commander';
import { findProjectRoot, getMumuSpecDir, appendAuditLog } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { loadChangeState, saveChangeState } from '../../change/manager.js';
import { executeTransition, requiresUserConfirmation, activateProjectWorkflow } from '../../change/state-machine.js';
import type { ChangePhase } from '../../core/types.js';
import { runPhaseGuard } from '../../guard/phase-guard.js';
import { commitChangeBranch } from '../../change/branch.js';

export function registerGuardCommand(program: Command): void {
  program
    .command('guard')
    .description('Run phase guard check (use --apply to execute transition)')
    .argument('<change>', 'change name')
    .argument('<phase>', 'target phase')
    .option('--apply', 'apply transition if guard passes')
    .option('--force', 'proceed despite guard errors (flexible guard)')
    .option('--confirm', 'user confirmed (required for blocking transitions)')
    .option('--json', 'output as JSON')
    .action((change, phase, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      // CHG-7: 激活项目级 workflow 覆盖（无则回退内置）
      activateProjectWorkflow(root);

      const config = loadConfig(root);
      // CHG-5: 传入配置的默认 tdd_mode 供守卫校验（默认 'tdd'）
      const guardOptions = {
        strength: config.constraint_strength,
        expectedTddMode: config.changes?.default_tdd_mode ?? 'tdd',
      };
      let result = runPhaseGuard(root, change, phase, guardOptions);

      // Branch-driven workflow: verify → archive-in-progress applies the branch
      // commit first, then re-runs the guard (so E-VERIFY-002 branch_status
      // check passes), then transitions. Order: commit → handled → check → apply.
      if (options.apply && phase === 'archive-in-progress') {
        const preState = loadChangeState(root, change);
        if (preState && preState.phase === 'verify' && preState.branch_status !== 'handled') {
          try {
            commitChangeBranch(root, change, preState);
            result = runPhaseGuard(root, change, phase, guardOptions);
          } catch (e) {
            console.error(`✗ 变更分支提交失败: ${e instanceof Error ? e.message : String(e)}`);
            console.error('  可手动提交后执行: mumuspec state set <name> branch_status handled');
            process.exit(1);
          }
        }
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (result.passed) {
        console.log(`✓ Phase guard passed: ${change} → ${phase}`);
      } else if (options.force) {
        // CHG-2: --force 绕过审计（guard.force）+ 风险提示；bypass_audit=false 时拒绝
        const bypassAudit = config.guard?.bypass_audit !== false;
        if (!bypassAudit) {
          console.error(`✗ Phase guard failed and guard.bypass_audit=false: --force 被拒绝 (E-STATE-001)`);
          console.error('  如需绕过请在 config.yaml 设置 guard.bypass_audit: true（绕过操作将被审计）');
          process.exit(1);
        }
        appendAuditLog(getMumuSpecDir(root), {
          actor: 'user',
          action: 'guard.force',
          change,
          phase,
          result: 'bypassed',
        });
        console.warn(`⚠ Phase guard failed but --force specified, continuing: ${change} → ${phase}`);
        console.warn(`  风险提示: 已强制通过阶段守卫，本次绕过已记录到 audit.log (guard.force)`);
      } else {
        console.error(`✗ Phase guard failed: ${change} → ${phase}`);
        for (const err of result.errors) {
          console.error(`  [${err.code}] ${err.message}`);
          if (err.detail) console.error(`    ${err.detail}`);
        }
      }

      if (result.warnings.length > 0) {
        for (const warn of result.warnings) {
          console.warn(`  ⚠ [${warn.code}] ${warn.message}`);
        }
      }

      // Apply transition if requested and guard passed (or forced)
      if (options.apply && (result.passed || options.force)) {
        const state = loadChangeState(root, change);
        if (!state) {
          console.error(`Error: Change not found: ${change}`);
          process.exit(1);
        }

        // Enforce blocking point user confirmation
        const blockingInfo = requiresUserConfirmation(state.phase, phase);
        if (blockingInfo.required && !options.confirm) {
          console.error(`✗ 阻塞点 ${blockingInfo.bp}：${blockingInfo.description}`);
          console.error(`  必须显式确认。请使用：`);
          console.error(`  mumuspec guard ${change} ${phase} --apply --confirm`);
          process.exit(2);
        }

        // Validate phase
        const validPhases: ChangePhase[] = ['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
        if (!validPhases.includes(phase as ChangePhase)) {
          console.error(`✗ 无效的目标阶段: ${phase}`);
          console.error(`  有效阶段: ${validPhases.join(', ')}`);
          process.exit(1);
        }

        const transitionResult = executeTransition(state, phase as ChangePhase, { userConfirmed: options.confirm });
        if (transitionResult.success) {
          saveChangeState(root, change, transitionResult.state);
          console.log(`✓ 阶段转换已应用: ${state.phase} → ${phase}`);
          if (blockingInfo.bp) {
            console.log(`  阻塞点 ${blockingInfo.bp} 已通过 (${blockingInfo.description})`);
          }
        } else {
          if (transitionResult.error?.startsWith('E-CHANGE-007')) {
            console.log(`⊙ 已在目标阶段 '${phase}'，无需转换`);
          } else if (transitionResult.error?.startsWith('E-CHANGE-006')) {
            console.error(`✗ 无效的阶段转换: ${transitionResult.error}`);
            console.error(`  可运行 'mumuspec state next ${change}' 查看可转换目标`);
            process.exit(1);
          } else {
            console.error(`✗ 转换失败: ${transitionResult.error}`);
            process.exit(1);
          }
        }
      }

      if (!result.passed && !options.force) process.exit(1);
    });
}
