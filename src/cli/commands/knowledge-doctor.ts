/**
 * Knowledge doctor subcommand — `mumuspec knowledge doctor`
 * 
 * 只读诊断层，对应 Obsidian LLM Wiki 的设计。
 * 检测知识库健康状态，不修改任何文件。
 */
import type { Command } from 'commander';
import { runDiagnosis } from '../../knowledge/doctor.js';
import { findProjectRoot } from '../../core/utils.js';

/** Severity icon */
function severityIcon(severity: string): string {
  switch (severity) {
    case 'error': return '[错误]';
    case 'warn': return '[警告]';
    default: return '[信息]';
  }
}

export function registerKnowledgeDoctor(knowledgeCmd: Command): void {
  knowledgeCmd
    .command('doctor')
    .description('诊断知识库健康状态（只读，不修改任何文件）')
    .option('--sources <sources...>', '指定扫描来源 (deps, code, git, docs)', 'all')
    .option('--json', '以 JSON 格式输出报告')
    .action((options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      const sourcesList: string[] = Array.isArray(options.sources) ? options.sources : [options.sources];
      const sources = !sourcesList.includes('all') ? sourcesList : undefined;

      const report = runDiagnosis(projectRoot, { sources });

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log('='.repeat(60));
      console.log('知识库诊断报告');
      console.log('='.repeat(60));
      console.log(`时间: ${report.timestamp}`);
      console.log(`现有知识页: ${report.stats.totalKnowledgePages}`);
      console.log(`扫描提议: ${report.stats.proposedFromScan}`);
      console.log('');

      if (report.findings.length === 0) {
        console.log('ok - 知识库状态良好，未发现问题');
      } else {
        console.log(`${report.findings.length} 条诊断结果:\n`);
        const errors = report.findings.filter((f) => f.severity === 'error');
        const warns = report.findings.filter((f) => f.severity === 'warn');
        const infos = report.findings.filter((f) => f.severity === 'info');

        if (errors.length > 0) {
          console.log(`严重问题 (${errors.length}):\n`);
          for (const f of errors) {
            console.log(`  ${severityIcon('error')} ${f.message}`);
            if (f.affectedScope) console.log(`           范围: ${f.affectedScope}`);
            console.log(`           建议: ${f.suggestion}`);
            console.log('');
          }
        }

        if (warns.length > 0) {
          console.log(`警告 (${warns.length}):\n`);
          for (const f of warns) {
            console.log(`  ${severityIcon('warn')} ${f.message}`);
            if (f.affectedScope) console.log(`           范围: ${f.affectedScope}`);
            console.log(`           建议: ${f.suggestion}`);
            console.log('');
          }
        }

        if (infos.length > 0) {
          console.log(`提示 (${infos.length}):\n`);
          for (const f of infos) {
            console.log(`  ${severityIcon('info')} ${f.message}`);
            console.log(`           建议: ${f.suggestion}`);
            console.log('');
          }
        }
      }

      console.log('─'.repeat(60));
      console.log(report.summary);
      console.log('');
      console.log('此为诊断报告，未修改任何文件。');
    });
}
