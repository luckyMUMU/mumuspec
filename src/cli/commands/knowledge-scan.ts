/**
 * Knowledge scan subcommand — `mumuspec knowledge scan`
 * 
 * Runs autonomous knowledge discovery from four sources:
 * - deps (package.json / requirements.txt inference)
 * - code (architecture pattern and structural risk detection)
 * - git (revert/lesson/risk extraction from commit history)
 * - docs (documentation inventory and gap detection)
 * 
 * Proposals are confidence-tagged and require user review before registration.
 */
import type { Command } from 'commander';
import { runScan, listScanSources, getSourceDescription } from '../../knowledge/scan.js';
import type { ScanSource } from '../../knowledge/scan-types.js';
import { findProjectRoot } from '../../core/utils.js';

/** Parse --from list into ScanSource[] */
function parseSources(fromList: string[]): ScanSource[] {
  const valid: ScanSource[] = [];
  const allowed: ScanSource[] = ['deps', 'code', 'git', 'docs'];
  for (const s of fromList) {
    if (allowed.includes(s as ScanSource)) {
      valid.push(s as ScanSource);
    }
  }
  return valid;
}

/** Format a proposed page for display */
function formatProposedPage(page: { id: string; title: string; type: string; confidence: string; source: string; tags: string[] }): string {
  return `  [${page.confidence.toUpperCase()}] ${page.title}\n     type: ${page.type} | source: ${page.source} | tags: ${page.tags.join(', ')}`;
}

export function registerKnowledgeScan(knowledgeCmd: Command): void {
  const scanCmd = knowledgeCmd
    .command('scan')
    .description('从项目代码库自主发现知识 (deps / code / git / docs)')
    .option('--from <sources...>', '指定扫描来源 (deps, code, git, docs)', 'all')
    .option('--min-confidence <level>', '最低置信度过滤 (high, medium, low)', 'low')
    .option('--max-pages <count>', '最多输出条数', '50')
    .action((options) => {
      const projectRoot = findProjectRoot();
      if (!projectRoot) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }

      // Parse sources
      let sources: ScanSource[] | undefined;
      const fromList: string[] = Array.isArray(options.from) ? options.from : [options.from];
      if (!fromList.includes('all')) {
        sources = parseSources(fromList);
        if (sources.length === 0) {
          console.error('Error: 至少指定一个有效来源');
          console.log('可用来源:', listScanSources().join(', '));
          process.exit(1);
        }
      }

      const maxPages = parseInt(options.maxPages, 10) || 50;

      console.log('正在扫描项目...\n');
      for (const src of (sources ?? listScanSources())) {
        console.log(`  - ${getSourceDescription(src)}`);
      }
      console.log('');

      const result = runScan(projectRoot, {
        sources,
        minConfidence: options.minConfidence,
        maxPages,
      });

      // Display results
      if (result.totalProposed === 0) {
        console.log('扫描完成：未发现新知识。');
        console.log('可能原因：项目结构清晰、文档齐全、依赖合理。');
        return;
      }

      console.log('='.repeat(60));
      console.log(`扫描完成：${result.totalProposed} 条潜在知识 (${result.totalDurationMs}ms)`);
      console.log('='.repeat(60));
      console.log('');
      console.log(`置信度分布: 高=${result.byConfidence.high} 中=${result.byConfidence.medium} 低=${result.byConfidence.low}`);
      const typeEntries = Object.entries(result.byType);
      if (typeEntries.length > 0) {
        console.log(`类型分布: ${typeEntries.map(([k, v]) => `${k}=${v}`).join(' ')}`);
      }
      console.log('');

      // Print per-source breakdown
      for (const sourceResult of result.sources) {
        if (sourceResult.proposedPages.length === 0) continue;
        console.log(`\n--- ${getSourceDescription(sourceResult.source)} (${sourceResult.proposedPages.length} 条) ---`);
        for (const page of sourceResult.proposedPages) {
          console.log(formatProposedPage(page));
        }
      }

      console.log('');
      console.log('提示: 以上为建议知识，尚未注册到知识库。');
      console.log('运行 `mumuspec knowledge scan --help` 查看更多选项。');
    });

  // Add --from-info subcommand to describe sources
  scanCmd
    .command('sources')
    .description('列出可用的扫描来源及其描述')
    .action(() => {
      console.log('\n可用的扫描来源：\n');
      for (const src of listScanSources()) {
        console.log(`  ${src.padEnd(8)} ${getSourceDescription(src)}`);
      }
      console.log('\n使用示例:');
      console.log('  mumuspec knowledge scan --from deps code');
      console.log('  mumuspec knowledge scan --from all --min-confidence medium');
    });
}
