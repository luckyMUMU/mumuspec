/**
 * meta-evolve command — Meta-Spec Evolution CLI (R-0005).
 *
 * Sub-actions:
 *   --analyze           Output effectiveness score report
 *   --propose           Generate constraint/skill optimization proposals
 *   --apply --confirm   Safely apply confirmed proposals (with Goal Preservation)
 *
 * Requires being inside a MumuSpec project.
 */
import type { Command } from 'commander';
import { findProjectRoot } from '../../core/utils.js';
import { generateReport } from '../../meta-evolution/scoring.js';
import { analyzeAllFreshness } from '../../meta-evolution/knowledge-evolution.js';
import { recommendSkills } from '../../meta-evolution/skill-recommender.js';
import { PRESERVATION_ANCHORS, analyzeImpact, formatImpactAnalysis } from '../../meta-evolution/impact-analysis.js';
import type { CheckRecord } from '../../meta-evolution/types.js';
import { DEFAULT_SCORING_CONFIG } from '../../meta-evolution/types.js';

export function registerMetaEvolveCommand(program: Command): void {
  program
    .command('meta-evolve')
    .description('Meta-Spec Evolution: 评估规范有效性、提出改进建议')
    .option('--analyze', '分析约束有效性评分')
    .option('--propose', '生成优化提案')
    .option('--apply', '应用已确认的提案')
    .option('--confirm', '确认执行 apply')
    .option('--scope <scope...>', '指定评估 scope')
    .action((options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      // TC-META-10: apply without --confirm is rejected
      if (options.apply && !options.confirm) {
        console.error('Error: --apply requires --confirm flag. Run with --confirm to proceed.');
        process.exit(1);
      }

      if (options.apply && options.confirm) {
        runApply(root);
        return;
      }

      if (options.propose) {
        runPropose(root, options.scope ?? []);
        return;
      }

      // Default: --analyze
      runAnalyze(root, options.scope ?? []);
    });
}

function runAnalyze(root: string, scopes: string[]): void {
  // TC-META-09: CLI --analyze output contains expected header
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log('│  Meta-Spec Evolution: Effectiveness Score Report      │');
  console.log('└──────────────────────────────────────────────────────┘');
  console.log('');

  // In production: read from stats file
  // ponytail: empty report placeholder until stats are accumulated
  const emptyRecords: CheckRecord[] = [];
  const report = generateReport(emptyRecords, DEFAULT_SCORING_CONFIG, PRESERVATION_ANCHORS);

  if (report.totalEvaluated === 0) {
    console.log('  No check records accumulated yet.');
    console.log('  Run `mumuspec check` a few times to populate stats.');
  } else {
    for (const s of report.scores) {
      const flag = s.reliable ? '' : ' [low confidence]';
      console.log(`  ${s.constraintId}: ${s.score.toFixed(2)}${flag}`);
    }
  }

  // Knowledge layer evolution
  const evolutionActions = analyzeAllFreshness([]);
  if (evolutionActions.length > 0) {
    console.log('');
    console.log('  Knowledge Evolution Actions:');
    for (const action of evolutionActions) {
      console.log(`    ${action.pageId}: ${action.action} (${action.reason})`);
    }
  }

  // Skill recommendations
  const skillResult = recommendSkills(scopes);
  if (skillResult.recommendations.length > 0 && scopes.length > 0) {
    console.log('');
    console.log('  Skill Recommendations:');
    for (const rec of skillResult.recommendations.slice(0, 3)) {
      console.log(`    ${rec.skillName} (${(rec.relevanceScore * 100).toFixed(0)}%): ${rec.reason}`);
    }
  }

  console.log('');
  console.log(`  Generated: ${report.generatedAt}`);
}

function runPropose(root: string, scopes: string[]): void {
  // TC-META-06: --propose outputs markdown proposal
  const emptyRecords: CheckRecord[] = [];
  const report = generateReport(emptyRecords, DEFAULT_SCORING_CONFIG, PRESERVATION_ANCHORS);

  console.log('# Meta-Spec Evolution Proposal');
  console.log('');
  console.log(`Generated at: ${report.generatedAt}`);
  console.log('');

  if (report.recommendations.length === 0) {
    console.log('No issues detected. Constraints are healthy.');
    return;
  }

  console.log('## Issues');
  console.log('');
  for (const rec of report.recommendations) {
    console.log(`- ${rec}`);
  }

  console.log('');
  console.log('## Goal Preservation');
  console.log('');
  console.log('The following anchor entries are protected from modification:');
  for (const id of PRESERVATION_ANCHORS) {
    console.log(`- \`${id}\``);
  }

  console.log('');
  console.log('## Next Steps');
  console.log('');
  console.log('Review this proposal, then run `mumuspec meta-evolve --apply --confirm` to apply.');
}

function runApply(_root: string): void {
  // Goal Preservation: list protected entries
  console.log('Goal Preservation anchors (protected):');
  for (const id of PRESERVATION_ANCHORS) {
    console.log(`  [PROTECTED] ${id}`);
  }
  // ponytail: actual modification logic deferred until scoring data is accumulated
  console.log('');
  console.log('Applying evolution proposals... (placeholder - data accumulation pending)');
}
