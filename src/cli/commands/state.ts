/**
 * state commands — State machine management + test-cases.
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, readText } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import {
  createChange,
  loadChangeState,
  saveChangeState,
  initTestCases,
  lockTestCases,
  verifyTestCases,
  getChangeDir,
} from '../../change/manager.js';
import type { ChangePhase } from '../../core/types.js';
import {
  executeTransition,
  executeRollback,
  getValidTransitions,
  getNextPhase,
  getWorkflowPhases,
  isTerminal,
  requiresUserConfirmation,
} from '../../change/state-machine.js';

export function registerStateCommands(program: Command): void {
  // === state ===
  const stateCmd = program.command('state').description('State machine management');

  stateCmd
    .command('init')
    .description('Initialize state for a change')
    .argument('<name>', 'change name')
    .argument('<workflow>', 'workflow type (full|hotfix|tweak)')
    .action((name, workflow) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const config = loadConfig(root);
      try {
        createChange(root, name, workflow as 'full' | 'hotfix' | 'tweak', config);
        console.log(`✓ State initialized for "${name}" (${workflow})`);
      } catch (err) {
        console.error(`Error: ${(err as Error).message}`);
        process.exit(1);
      }
    });

  stateCmd
    .command('transition')
    .description('Transition state')
    .argument('<name>', 'change name')
    .argument('<event>', 'target phase')
    .option('--confirm', 'user confirmed')
    .option('--reason <reason>', 'reason for rollback')
    .action((name, event, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      // Check if it's a rollback
      if (event === 'design' && (state.phase === 'build' || state.phase === 'verify')) {
        const rollbackType = state.phase === 'build' ? 'build_to_design' : 'verify_to_design';
        const result = executeRollback(state, rollbackType, options.reason || 'No reason');
        if (result.success) {
          saveChangeState(root, name, result.state);
          console.log(`✓ Rolled back ${name}: ${state.phase} → design`);
          console.log(`  Rollback count: ${result.state.rollback_count}/${result.state.rollback_limit}`);
        } else {
          console.error(`✗ Rollback failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      if (event === 'build' && state.phase === 'verify') {
        const result = executeRollback(state, 'verify_to_build', options.reason || 'No reason');
        if (result.success) {
          saveChangeState(root, name, result.state);
          console.log(`✓ Rolled back ${name}: verify → build`);
          console.log(`  Rebuild count: ${result.state.rebuild_count}/${result.state.rebuild_limit}`);
        } else {
          console.error(`✗ Rollback failed: ${result.error}`);
          process.exit(1);
        }
        return;
      }

      // Validate event
      const validPhases: ChangePhase[] = ['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
      if (!validPhases.includes(event as ChangePhase)) {
        console.error(`✗ 无效的目标阶段: ${event}`);
        console.error(`  有效阶段: ${validPhases.join(', ')}`);
        process.exit(1);
      }

      // Enforce blocking point user confirmation
      const blockingInfo = requiresUserConfirmation(state.phase, event);
      if (blockingInfo.required && !options.confirm) {
        console.error(`✗ 阻塞点 ${blockingInfo.bp}：${blockingInfo.description}`);
        console.error(`  此阶段转换必须用户显式确认。请使用 --confirm 标志：`);
        console.error(`  mumuspec state transition ${name} ${event} --confirm`);
        process.exit(2);
      }

      // Normal transition
      const result = executeTransition(state, event as ChangePhase, { userConfirmed: options.confirm });
      if (result.success) {
        saveChangeState(root, name, result.state);
        console.log(`✓ Transitioned ${name}: ${state.phase} → ${event}`);
        if (blockingInfo.bp) {
          console.log(`  阻塞点 ${blockingInfo.bp} 已通过 (${blockingInfo.description})`);
        }
      } else {
        // Improved error messaging for known error codes
        if (result.error?.startsWith('E-CHANGE-007')) {
          console.error(`✗ 已在目标阶段 '${event}'，无需转换`);
          console.error(`  当前阶段: ${state.phase}`);
          process.exit(0);  // Not really an error, so exit 0
        } else if (result.error?.startsWith('E-CHANGE-006')) {
          console.error(`✗ 无效的阶段转换: ${result.error}`);
          console.error(`  可在当前阶段 ${state.phase} 使用 'mumuspec state next ${name}' 查看可转换目标`);
          process.exit(1);
        } else {
          console.error(`✗ Transition failed: ${result.error}`);
          process.exit(1);
        }
      }
    });

  stateCmd
    .command('next')
    .description('Get next step')
    .argument('<name>', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      const next = getNextPhase(state);
      if (next) {
        console.log(`Next: ${next.phase} — ${next.description}`);
      } else {
        console.log('No next phase (terminal state).');
      }
    });

  stateCmd
    .command('graph')
    .description('Visualize state machine')
    .argument('<name>', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      console.log(`\nState Machine for: ${name}`);
      console.log(`Current: ${state.phase}`);
      console.log(`Workflow: ${state.workflow}`);
      console.log(`\nValid transitions: ${getValidTransitions(state.phase).join(', ')}`);
      console.log(`Terminal: ${isTerminal(state.phase)}`);

      const phases = getWorkflowPhases(state.workflow);
      console.log(`\nWorkflow phases:`);
      for (const phase of phases) {
        const icon = phase === state.phase ? '▶' : phase === 'archive-completed' ? '✓' : '○';
        console.log(`  ${icon} ${phase}`);
      }

      if (state.rollback_history.length > 0) {
        console.log(`\nRollback history:`);
        for (const rh of state.rollback_history) {
          console.log(`  ${rh.timestamp}: ${rh.from} → ${rh.to} (${rh.event}) - ${rh.reason}`);
        }
      }
    });

  stateCmd
    .command('get')
    .description('Get a state field value')
    .argument('<name>', 'change name')
    .argument('<field>', 'field name (e.g. phase, workflow, verify_mode, build_mode)')
    .action((name, field) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      const value = (state as unknown as Record<string, unknown>)[field];
      if (value === undefined) {
        console.log(`<undefined>`);
      } else if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(String(value));
      }
    });

  stateCmd
    .command('set')
    .description('Set a state field value')
    .argument('<name>', 'change name')
    .argument('<field>', 'field name (e.g. verify_mode, build_mode, isolation, verify_result, branch_status)')
    .argument('<value>', 'value to set (use --json for complex structures)')
    .option('--json', 'parse value as JSON/YAML (auto-converts objects and arrays)')
    .action((name, field, value, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      let coerced: unknown = value;

      if (options.json) {
        // Parse as JSON first, fall back to treating as plain string
        try {
          coerced = JSON.parse(value);
        } catch {
          // If not valid JSON, keep as string
          console.warn('  (value is not valid JSON, storing as string)');
        }
      } else {
        // Type-coerce known numeric/boolean fields
        if (value === 'true') coerced = true;
        else if (value === 'false') coerced = false;
        else if (/^\d+$/.test(value)) coerced = parseInt(value, 10);
        else if (/^\d+\.\d+$/.test(value)) coerced = parseFloat(value);
      }

      // Support dot notation for nested fields (e.g. cognitive_framework.q1_count)
      const target = state as unknown as Record<string, unknown>;
      const parts = field.split('.');
      let current: Record<string, unknown> = target;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (typeof current[part] !== 'object' || current[part] === null) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }
      current[parts[parts.length - 1]] = coerced;

      state.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
      saveChangeState(root, name, state);
      console.log(`✓ Set ${field} = ${JSON.stringify(coerced)}`);
    });

  stateCmd
    .command('scale')
    .description('Evaluate change scale and recommend verify mode')
    .argument('<name>', 'change name')
    .action(async (name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const state = loadChangeState(root, name);
      if (!state) {
        console.error(`Error: Change not found: ${name}`);
        process.exit(1);
      }

      const changeDir = getChangeDir(root, name);
      const fs = await import('node:fs/promises');

      // Count tasks
      let taskCount = 0;
      const tasksPath = join(changeDir, 'tasks.md');
      if (existsSync(tasksPath)) {
        const tasksContent = readText(tasksPath) || '';
        taskCount = (tasksContent.match(/^- \[[ x]\]/gm) || []).length;
      }

      // Count delta specs
      let deltaSpecCount = 0;
      const deltaSpecsDir = join(changeDir, 'delta-specs');
      try {
        if (existsSync(deltaSpecsDir)) {
          const entries = await fs.readdir(deltaSpecsDir);
          deltaSpecCount = entries.filter((f: string) => f.endsWith('.md')).length;
        }
      } catch {
        // Ignore read errors
      }

      // Count build layers
      const buildLayerCount = state.build_layers.length;

      // Decision
      const isLarge = taskCount > 3 || deltaSpecCount > 1 || buildLayerCount > 4;
      const recommendedMode = isLarge ? 'full' : 'light';

      console.log(`\nScale evaluation for: ${name}`);
      console.log(`  Tasks:           ${taskCount}`);
      console.log(`  Delta specs:     ${deltaSpecCount}`);
      console.log(`  Build layers:    ${buildLayerCount}`);
      console.log(`  Verify mode:     ${recommendedMode}`);
      console.log(`\nRun: mumuspec state set ${name} verify_mode ${recommendedMode}`);
    });

  // === test-cases ===
  const testCmd = program.command('test-cases').description('Test case management');

  testCmd
    .command('init')
    .description('Initialize test cases for a change')
    .argument('<name>', 'change name')
    .option('--layers <layers>', 'layer numbers (comma-separated)', '0')
    .action((name, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const layers = options.layers.split(',').map((n: string) => parseInt(n.trim()));
      initTestCases(root, name, layers);
      console.log(`✓ Test cases initialized for ${name} (layers: ${layers.join(', ')})`);
    });

  testCmd
    .command('lock')
    .description('Lock test cases')
    .argument('<name>', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const hash = lockTestCases(root, name);
      console.log(`✓ Test cases locked for ${name}`);
      console.log(`  Hash: ${hash}`);
    });

  testCmd
    .command('verify')
    .description('Verify test cases hash')
    .argument('<name>', 'change name')
    .action((name) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const result = verifyTestCases(root, name);
      if (result.valid) {
        console.log(`✓ Test cases verified for ${name}`);
      } else {
        console.error(`✗ Test cases verification failed for ${name}`);
        console.error(`  Expected: ${result.expectedHash}`);
        console.error(`  Actual:   ${result.actualHash}`);
        process.exit(1);
      }
    });
}
