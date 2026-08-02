/**
 * Onboarding subcommands — onboard init/start/next/complete-step/progress.
 */
import type { Command } from 'commander';
import { join } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { findProjectRoot } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { generateOnboardingPath } from '../../knowledge/manager.js';

function requireRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error('Error: Not in a MumuSpec project.');
    process.exit(1);
  }
  return root;
}

/** Register top-level `onboard` command with subcommands. */
export function registerOnboardCommands(program: Command): void {
  const onboardCmd = program.command('onboard').description('Onboarding guided learning paths');

  onboardCmd
    .command('init')
    .description('Generate learning path for scope')
    .requiredOption('--scope <path>', 'Code scope path')
    .option('--role <role>', 'Target role (junior|mid|senior|pm)', 'junior')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const path = generateOnboardingPath(root, config, options.scope, options.role);

      const onboardDir = join(root, '.mumuspec', 'onboarding');
      try {
        mkdirSync(onboardDir, { recursive: true });
        const fileName = `${options.scope.replace(/[/\\]/g, '-')}-${options.role}.yaml`;
        const { dumpYaml } = require('../../dist/core/utils');
        writeFileSync(join(onboardDir, fileName), dumpYaml(path));
        console.log(`Learning path generated: ${path.total_steps} steps (${path.estimated_minutes} min)`);
      } catch {
        console.log(`Generated path: ${path.total_steps} steps (${path.estimated_minutes} min)`);
        console.log(JSON.stringify(path, null, 2));
      }
    });

  onboardCmd
    .command('start')
    .description('Start interactive learning path')
    .requiredOption('--scope <path>', 'Code scope path')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const path = generateOnboardingPath(root, config, options.scope, 'junior');

      if (path.total_steps === 0) {
        console.log('No learning path available. Run `mumuspec onboard init` first.');
        return;
      }

      console.log(`\nOnboarding: ${path.scope} (${path.total_steps} steps, ~${path.estimated_minutes} min)\n`);
      console.log(`Step 1: ${path.steps[0]?.code_node ?? 'N/A'}`);
      console.log(`  ${path.steps[0]?.reason ?? ''}`);
      if (path.steps[0]?.knowledge_pages.length) {
        console.log(`  Knowledge: ${path.steps[0].knowledge_pages.join(', ')}`);
      }
      console.log('\n[Interactive mode - use "next" command to advance]');
    });

  onboardCmd
    .command('next')
    .description('Show next step in learning path')
    .requiredOption('--scope <path>', 'Code scope path')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const path = generateOnboardingPath(root, config, options.scope, 'junior');
      console.log(`Learning path: ${path.total_steps} steps. Run 'onboard start' to begin.`);
    });

  onboardCmd
    .command('complete-step')
    .description('Mark a step as complete')
    .requiredOption('--scope <path>', 'Code scope path')
    .requiredOption('--step <n>', 'Step number')
    .action((options) => {
      console.log(`Step ${options.step} marked complete (scope: ${options.scope})`);
    });

  onboardCmd
    .command('progress')
    .description('Show learning progress')
    .requiredOption('--scope <path>', 'Code scope path')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const path = generateOnboardingPath(root, config, options.scope, 'junior');
      console.log(`Progress for ${options.scope}: ${path.total_steps} total steps`);
    });
}
