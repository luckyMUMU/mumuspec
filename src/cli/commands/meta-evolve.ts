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
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, getMumuSpecDir } from '../../core/utils.js';
import { generateReport } from '../../meta-evolution/scoring.js';
import { analyzeAllFreshness } from '../../meta-evolution/knowledge-evolution.js';
import { recommendSkills } from '../../meta-evolution/skill-recommender.js';
import { PRESERVATION_ANCHORS } from '../../meta-evolution/impact-analysis.js';
import { readCheckRecords } from '../../meta-evolution/stats.js';
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
    .action(async (options) => {
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
        await runPropose(root, options.scope ?? []);
        return;
      }

      // Default: --analyze
      await runAnalyze(root, options.scope ?? []);
    });
}

/** 知识 layer 输入是否可得（索引文件存在即视为可得；freshness 数据面未接线属 E7 独立缺口） */
function knowledgeIndexAvailable(root: string): boolean {
  return existsSync(join(getMumuSpecDir(root), 'knowledge', '_index.yaml'));
}

async function runAnalyze(root: string, scopes: string[]): Promise<void> {
  // TC-META-09: CLI --analyze output contains expected header
  console.log('┌──────────────────────────────────────────────────────┐');
  console.log('│  Meta-Spec Evolution: Effectiveness Score Report      │');
  console.log('└──────────────────────────────────────────────────────┘');
  console.log('');

  // P0-2: 读真实 CheckRecord——空数据集与健康必须可区分
  const records: CheckRecord[] = await readCheckRecords(root);
  const report = generateReport(records, DEFAULT_SCORING_CONFIG, PRESERVATION_ANCHORS);

  if (report.totalEvaluated === 0) {
    console.log('  No check records accumulated yet.');
    console.log('  Run `mumuspec guard` a few times to populate stats.');
  } else {
    for (const s of report.scores) {
      const flag = s.reliable ? '' : ' [low confidence]';
      console.log(`  ${s.constraintId}: ${s.score.toFixed(2)}${flag}`);
    }
  }

  // Knowledge layer evolution (P0-2: 索引不可得显式声明，不传空数组冒充"无动作")
  if (!knowledgeIndexAvailable(root)) {
    console.log('');
    console.log('  knowledge index unavailable — skipped');
  } else {
    // E7: 无 PageRefInfo 生产者——索引存在但 freshness 数据面未接通，不虚构评估
    const evolutionActions = analyzeAllFreshness([]);
    if (evolutionActions.length > 0) {
      console.log('');
      console.log('  Knowledge Evolution Actions:');
      for (const action of evolutionActions) {
        console.log(`    ${action.pageId}: ${action.action} (${action.reason})`);
      }
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

async function runPropose(root: string, _scopes: string[]): Promise<void> {
  // TC-META-06: --propose outputs markdown proposal
  // P0-2: 读真实 CheckRecord——空数据集不再打出"Constraints are healthy"以外的假健康
  const records: CheckRecord[] = await readCheckRecords(root);
  const report = generateReport(records, DEFAULT_SCORING_CONFIG, PRESERVATION_ANCHORS);

  console.log('# Meta-Spec Evolution Proposal');
  console.log('');
  console.log(`Generated at: ${report.generatedAt}`);
  console.log('');

  if (report.totalEvaluated === 0) {
    console.log('No check records accumulated yet — 无法评估约束健康度（空数据集 ≠ 健康）。');
    console.log('Run `mumuspec guard` a few times to populate stats.');
    return;
  }

  // 有数据但全部样本不足（< minSampleSize）也不得宣称健康——不可靠 ≠ 健康（P0-2 验证暴露）
  const unreliableCount = report.scores.filter((s) => !s.reliable).length;
  if (report.recommendations.length === 0 && unreliableCount === report.scores.length && report.scores.length > 0) {
    console.log(`已积累 ${report.totalEvaluated} 条约束记录但样本均不足（< minSampleSize）— 暂无可靠评价，不宣称健康。`);
    console.log('Continue running `mumuspec guard` to accumulate more data.');
    return;
  }

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
  // P0-3: --apply 未实现即 fail-closed——不再占位 exit 0（占位会让"命令成功"成为谎言）
  console.error('Error: meta-evolve --apply is not implemented (P0-3 fail-closed).');
  console.error('  --apply 需要真实改写约束强度并依赖 scoring 数据积累 + 人工签收，见 roadmap R-0005。');
  process.exit(1);
}
