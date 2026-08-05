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
  program
    .command('decisions')
    .description('Display autonomous decision audit trail for a change')
    .argument('[change]', 'change name (optional, uses active change if omitted)')
    .action((change) => {
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
}
