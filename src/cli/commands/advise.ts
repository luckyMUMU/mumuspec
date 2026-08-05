/**
 * advise command — Get BP advisor recommendation for a blocking point.
 *
 * Usage: mumuspec advise <bp_id>
 * Shows analysis + resolution options for the specified blocking point.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import { loadChangeState } from '../../change/state.js';
import { getBPAdvisor, formatBPRecommendation } from '../../core/bp-advisor.js';

export function registerAdviseCommand(program: Command): void {
  program
    .command('advise')
    .description('Get advisor recommendation for a blocking point')
    .argument('<bp_id>', 'blocking point ID (e.g., BP-1, BP-9, BP-14)')
    .argument('[change]', 'change name (optional, uses active change if omitted)')
    .action((bpId, change) => {
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
      const advisor = getBPAdvisor(bpId);

      const ctx = {
        phase: state?.phase || 'open',
        changeName,
        hasDistSpec: !!state?.dist_spec,
        designComplete: state?.phase === 'build' || state?.phase === 'verify' || state?.phase === 'archive-in-progress',
        buildLayersComplete: state?.build_layers?.every(l => l.status === 'done') || false,
      };

      const recommendation = advisor(ctx);
      console.log('');
      console.log(formatBPRecommendation(recommendation));
      console.log('');
    });
}
