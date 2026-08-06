/**
 * decisions command — Display LLM autonomous decision audit trail.
 *
 * Shows all auto-decisions recorded in a change's state,
 * including path recommendations, phase compressions, and skill assemblies.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import { loadChangeState } from '../../change/state.js';
import { appendDecision } from '../../change/decisions.js';
import type { AutoDecision } from '../../core/types-workflow.js';

function formatDecision(entry: AutoDecision, index: number): string {
  const confidence = Math.round(entry.confidence * 100);
  const lines = [
    `  ${index + 1}. [${entry.timestamp}] ${entry.phase}`,
    `     Decision:  ${entry.decision}`,
    `     Rationale: ${entry.rationale}`,
    `     Confidence: ${confidence}% | Approved by: ${entry.approved_by}`,
  ];
  return lines.join('\n');
}

export function registerDecisionsCommand(program: Command): void {
  const decisions = program
    .command('decisions')
    .description('Display autonomous decision audit trail for a change')
    .argument('[change]', 'change name (optional, uses active change if omitted)');

  decisions.action((change) => {
    const root = findProjectRoot();
    if (!root) {
      console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
      process.exit(1);
    }

    const changeName = change || getActiveChange(root);
    if (!changeName) {
      console.error('Error: No active change. Specify a change name or run inside a change directory.');
      process.exit(1);
    }

    const state = loadChangeState(root, changeName);
    if (!state) {
      console.error(`Error: Could not load state for change "${changeName}".`);
      process.exit(1);
    }

    const decisions = state.auto_decisions || [];

    console.log(`\nDecision Audit Trail: ${changeName} (${state.phase})`);
    console.log('═'.repeat(60));

    if (decisions.length === 0) {
      console.log('\n  No autonomous decisions recorded.\n');
      console.log('  Decisions are recorded when:');
      console.log('  - Path recommendations are generated (L1)');
      console.log('  - Phase compression is auto-applied (L2)');
      console.log('  - Skills are dynamically loaded (L2)');
    } else {
      console.log(`\n  Total decisions: ${decisions.length}\n`);
      for (let i = 0; i < decisions.length; i++) {
        console.log(formatDecision(decisions[i], i));
        console.log('');
      }
    }

    console.log('═'.repeat(60));
    console.log(`  State file: .mumuspec/changes/${changeName}/.mumuspec.yaml`);
    console.log('  Immutable: Append-only audit log');
    console.log('');
  });

  decisions
    .command('append')
    .description('Append a decision to the change decisions.md')
    .argument('[text...]', 'decision text')
    .option('--phase <phase>', 'phase key (open|design|build|verify|archive)', 'design')
    .option('--change <name>', 'change name (uses active change if omitted)')
    .option('--text <text>', 'decision text (alternative to positional args)')
    .action((text: string[], options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project. Run `mumuspec init` first.');
        process.exit(1);
      }

      const changeName = options.change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify --change or run inside a change directory.');
        process.exit(1);
      }

      const decision = options.text || text.join(' ');
      if (!decision || !decision.trim()) {
        console.error('Error: Decision text required (positional args or --text).');
        process.exit(1);
      }

      const state = loadChangeState(root, changeName);
      if (!state) {
        console.error(`Error: Change "${changeName}" not found.`);
        process.exit(1);
      }

      appendDecision(root, changeName, options.phase, decision.trim());
      console.log(`✓ Decision appended to "${changeName}" [${options.phase}]`);
      console.log(`  File: .mumuspec/changes/${changeName}/decisions.md`);
    });
}
