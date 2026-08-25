/**
 * eval command — Lightweight eval framework.
 */
import type { Command } from 'commander';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot } from '../../core/utils.js';
import {
  loadScenario,
  runScenario,
  runAllEvals,
  discoverScenarios,
  initEvalsDir,
  type EvalReport,
} from '../../eval/runner.js';

export function registerEvalCommands(program: Command): void {
  const evalCmd = program
    .command('eval')
    .description('Run eval scenarios to verify guard/skill behavior');

  evalCmd
    .command('init')
    .description('Initialize .mumuspec/evals/ with sample scenarios')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const root = findProjectRoot(options.workspacePath);
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const result = initEvalsDir(root);
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          console.error(`✗ ${err}`);
        }
        process.exit(1);
      }

      console.log('✓ Created eval scenarios:');
      for (const f of result.created) {
        console.log(`  ${f}`);
      }
      console.log('\nEdit the scenarios in .mumuspec/evals/ to match your project.');
    });

  evalCmd
    .command('list')
    .description('List available eval scenarios')
    .option('--workspace-path <path>', 'workspace path', '.')
    .action((options) => {
      const root = findProjectRoot(options.workspacePath);
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const scenarios = discoverScenarios(root);
      if (scenarios.length === 0) {
        console.log('No eval scenarios found.');
        console.log('  Run `mumuspec eval init` to create sample scenarios.');
        return;
      }

      console.log(`\n${scenarios.length} eval scenario(s):\n`);
      for (const file of scenarios) {
        try {
          const s = loadScenario(file);
          console.log(`  ${s.name}${s.description ? ` — ${s.description}` : ''}`);
          console.log(`    Type: ${s.type}`);
          console.log(`    File: ${file}`);
        } catch (err) {
          console.log(`  ✗ ${file} — ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    });

  evalCmd
    .command('run [name]')
    .description('Run eval scenarios (all or by name)')
    .option('--workspace-path <path>', 'workspace path', '.')
    .option('--verbose', 'show detailed output')
    .action((name, options) => {
      const root = findProjectRoot(options.workspacePath);
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      let report: EvalReport;

      if (name) {
        // Run specific scenario
        const evalsDir = join(root, '.mumuspec', 'evals');
        const filePath = join(evalsDir, `${name}.yaml`);

        if (!existsSync(filePath)) {
          console.error(`Error: Scenario "${name}" not found at ${filePath}`);
          console.error('  Run `mumuspec eval list` to see available scenarios.');
          process.exit(1);
        }

        const scenario = loadScenario(filePath);
        const result = runScenario(scenario);
        report = {
          total: 1,
          passed: result.passed ? 1 : 0,
          failed: result.passed ? 0 : 1,
          results: [result],
          duration: result.duration,
        };
      } else {
        // Run all
        report = runAllEvals(root);
      }

      // Output
      console.log(`\nEval Report: ${report.passed}/${report.total} passed (${report.duration}ms)\n`);

      for (const result of report.results) {
        const icon = result.passed ? '✓' : '✗';
        console.log(`  ${icon} ${result.scenario}`);
        if (options.verbose) {
          console.log(`    ${result.details}`);
        }
        for (const err of result.errors) {
          console.error(`    ✗ ${err}`);
        }
        for (const warn of result.warnings) {
          console.log(`    ⚠ ${warn}`);
        }
      }

      console.log('');

      if (report.failed > 0) {
        console.error(`✗ ${report.failed} scenario(s) failed.`);
        process.exit(1);
      } else if (report.total === 0) {
        console.log('No eval scenarios found. Run `mumuspec eval init` to get started.');
      } else {
        console.log('✓ All scenarios passed.');
      }
    });

  evalCmd.action(() => {
    console.log('Run eval scenarios to verify guard/skill behavior.\n');
    console.log('Usage:');
    console.log('  mumuspec eval init              Create sample eval scenarios');
    console.log('  mumuspec eval list              List available scenarios');
    console.log('  mumuspec eval run [name]        Run scenarios (all or specific)');
    console.log('\nScenarios are YAML files in .mumuspec/evals/');
    console.log('Each scenario verifies compliance/drift/guard behavior with assertions.');
  });
}
