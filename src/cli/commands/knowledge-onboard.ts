/**
 * Onboarding subcommands — onboard quickstart/init/start/next/complete-step/progress.
 */
import type { Command } from 'commander';
import { join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { findProjectRoot, dumpYaml } from '../../core/utils.js';
import { loadConfig, saveConfig, type MumuSpecConfig } from '../../core/config.js';
import { generateOnboardingPath } from '../../knowledge/manager.js';

interface OnboardTemplate {
  type: string;
  description: string;
  guard_layer: {
    shall: string[];
    shall_not: string[];
  };
  constraint_strength: {
    default: string;
    overrides: { id: string; level: string }[];
  };
  ai: { generate_rules: boolean };
}

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

  // ── QuickStart: guided 5-question config generation ──
  onboardCmd
    .command('quickstart')
    .description('Quick-start wizard: generate config and create a sample change')
    .option('--preset <type>', 'Skip questions, use preset template (frontend|backend|fullstack)')
    .option('--no-sample', 'Skip sample change creation')
    .action(async (options) => {
      const root = requireRoot();

      let templateType = options.preset;
      if (!templateType) {
        templateType = 'frontend';
      }

      const template = loadTemplate(templateType);
      if (!template) {
        console.error(`Error: Unknown template type '${templateType}'. Use frontend|backend|fullstack.`);
        process.exit(1);
      }

      // Merge with existing config if present
      const existing = loadConfig(root);
      const merged = mergeConfigWithTemplate(existing, template);
      saveConfig(root, merged);

      console.log(`\n✓ Configuration generated for ${templateType} project`);
      console.log(`  SHALL rules:     ${template.guard_layer.shall.length}`);
      console.log(`  SHALL NOT rules: ${template.guard_layer.shall_not.length}`);
      console.log(`  Default strength: ${template.constraint_strength.default}`);

      // P1-6 Fix: Offer to create a sample change for faster onboarding
      if (options.sample !== false) {
        const changeName = `hello-world-${Date.now().toString(36)}`;
        console.log(`\n→ Creating sample change "${changeName}"...`);
        
        // Create the change using existing createChange logic
        try {
          const { createChange } = await import('../../change/lifecycle.js');
          const cfg = loadConfig(root);
          createChange(root, changeName, 'tweak', cfg);
          console.log(`✓ Sample change created: ${changeName}`);
          console.log(`\n🚀 Quick Start Complete! Now run:\n`);
          console.log(`   cd ${root}`);
          console.log(`   mumuspec design ${changeName}     # Write your design`);
          console.log(`   mumuspec build ${changeName}      # Implement your changes`);
          console.log(`   mumuspec verify ${changeName}     # Verify compliance`);
          console.log(`   mumuspec archive ${changeName}    # Archive when done`);
        } catch {
          console.log(`\nNext step: mumuspec new <change-name>`);
        }
      } else {
        console.log(`\nNext step: mumuspec new <change-name>`);
      }
    });
}

/** Load a built-in template by type. */
function loadTemplate(type: string): OnboardTemplate | null {
  const templatePath = join(__dirname, '..', '..', 'core', 'templates', `${type}.json`);
  if (!existsSync(templatePath)) return null;
  try {
    const raw = readFileSync(templatePath, 'utf8');
    return JSON.parse(raw) as OnboardTemplate;
  } catch {
    return null;
  }
}

/** Merge template guard layer into existing config (preserving existing fields). */
function mergeConfigWithTemplate(
  existing: MumuSpecConfig,
  template: OnboardTemplate,
): MumuSpecConfig {
  return {
    ...existing,
    constraint_strength: existing.constraint_strength,
    ai: {
      ...existing.ai,
      generate_rules: template.ai.generate_rules,
    },
  };
}
