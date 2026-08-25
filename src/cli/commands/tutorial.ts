/**
 * Tutorial command — interactive 6-stage walkthrough for first-time users.
 *
 * Usage: mumuspec tutorial
 * Guides the user through: init → quickstart → new → design → build → verify → archive
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';

const STAGES = [
  {
    title: 'Initialize your project',
    description: 'Run `mumuspec onboard quickstart --preset <type>` to generate optimized configuration.',
    command: 'mumuspec onboard quickstart --preset frontend',
    detail: 'This creates a .mumuspec.yaml with SHALL/SHALL NOT rules tailored to your project type.',
  },
  {
    title: 'Create your first change',
    description: 'Run `mumuspec new tutorial-change` to create a new change.',
    command: 'mumuspec new tutorial-change',
    detail: 'A change is a unit of work tracked through Open → Design → Build → Verify → Archive.',
  },
  {
    title: 'Design your change',
    description: 'Edit the generated design.md to specify what you want to build.',
    command: 'mumuspec status tutorial-change',
    detail: 'The design phase creates the technical blueprint and locks test cases.',
  },
  {
    title: 'Build with TDD',
    description: 'Implement your change using Red-Green-Refactor cycle.',
    command: 'mumuspec guard tutorial-change build',
    detail: 'MumuSpec enforces test-driven development by running tests after each implementation step.',
  },
  {
    title: 'Verify consistency',
    description: 'Ensure your implementation matches the spec with no drift.',
    command: 'mumuspec check',
    detail: 'Guard Layer checks SHALL/SHALL NOT compliance, drift detection, and test immutability.',
  },
  {
    title: 'Archive your change',
    description: 'Merge your work back and clean up.',
    command: 'mumuspec archive tutorial-change',
    detail: 'Archiving merges the branch, updates the knowledge index, and extracts learnings.',
  },
];

/** Register the top-level `tutorial` command. */
export function registerTutorialCommand(program: Command): void {
  program
    .command('tutorial')
    .description('Interactive tutorial: complete your first MumuSpec change in 15 minutes')
    .action(() => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║  MumuSpec Tutorial                                      ║');
      console.log('║  Complete your first change in ~15 minutes              ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');
      console.log(`Project: ${root}`);
      console.log(`Stages:  ${STAGES.length}`);
      console.log('');

      for (let i = 0; i < STAGES.length; i++) {
        const stage = STAGES[i];
        console.log(`  Stage ${i + 1}: ${stage.title}`);
        console.log(`  ${stage.description}`);
        console.log(`  Example: ${stage.command}`);
        console.log(`  ${stage.detail}`);
        if (i < STAGES.length - 1) {
          console.log('  ↓');
        }
      }

      console.log('');
      console.log('To begin:');
      console.log('  cd /path/to/your-project');
      console.log('  mumuspec onboard quickstart --preset frontend');
      console.log('  mumuspec new tutorial-change');
      console.log('');
      console.log('For detailed docs: https://github.com/mumuspec/mumuspec#readme');
      console.log('');
    });
}
