/**
 * metrics command — read-only freedom-metrics report.
 *
 * Exposes evaluator metrics and the advisory constraint-strength suggestions
 * derived from them for ANY workflow, not just `loop` (freedom-metrics-loop-closure
 * D2: the previous change assumed loop was the only consumer, which left every
 * `full`-workflow change without a freedom signal).
 *
 * Read-only by construction: it consumes `collectMetrics` (which does not call
 * `recordProgress`) and writes nothing — no state artifact, no phase transition.
 *
 * Usage:
 *   mumuspec metrics [change]
 *   mumuspec metrics --json
 */

import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { getActiveChange } from '../../change/manager.js';
import {
  collectMetrics,
  buildSuggestions,
  registerBuiltInEvaluators,
} from '../../core/metrics/auto-evaluate.js';
import type { EvaluatorContext } from '../../core/metrics/types.js';
import { createInProcessMetricSources } from '../../guard/checker.js';
import { tip } from '../ui-helpers.js';

export function registerMetricsCommands(program: Command): void {
  program
    .command('metrics')
    .description('Read-only freedom-metrics report (evaluator values + advisory suggestions)')
    .argument('[change]', 'change name (defaults to the active change)')
    .option('--json', 'output structured JSON (for agents)')
    .action(async (change: string | undefined, options: { json?: boolean }) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const changeName = change || getActiveChange(root);
      if (!changeName) {
        console.error('Error: No active change. Specify a change name.');
        process.exit(1);
      }

      // Idempotent: registerEvaluator replaces same-name entries.
      registerBuiltInEvaluators();

      const ctx: EvaluatorContext = { projectRoot: root, changeName, roundHistory: [], inProcess: createInProcessMetricSources() };
      const metrics = await collectMetrics(ctx);
      const suggestions = buildSuggestions(metrics);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              change: changeName,
              metrics: metrics.map((m) => ({
                name: m.name,
                value: m.value,
                weight: m.weight,
                details: m.details,
              })),
              suggestions,
            },
            null,
            2
          )
        );
        return;
      }

      console.log('');
      console.log(`  Freedom metrics — ${changeName} (read-only)`);
      console.log('  ────────────────────────────────────────────────');

      if (metrics.length === 0) {
        console.log('  (no evaluator produced a value)');
      }
      for (const m of metrics) {
        const value = m.value.toFixed(3).padStart(6);
        const weight = m.weight.toFixed(2).padStart(5);
        console.log(`  ${m.name.padEnd(26)} ${value}  w=${weight}`);
        if (m.details) {
          console.log(`  ${' '.repeat(26)} ${m.details}`);
        }
      }

      console.log('');
      console.log('  ── 自由度信号建议（advisory） ──────────────');
      if (suggestions.length === 0) {
        console.log('  （本轮无调整建议）');
      }
      for (const suggestion of suggestions) {
        console.log(`  • ${suggestion}`);
      }
      tip('advisory 须人工签收后生效: mumuspec decisions append "<裁定>"');
      console.log('');
    });
}
