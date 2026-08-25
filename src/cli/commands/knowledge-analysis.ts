/**
 * Knowledge analysis subcommands — impact, coverage, gaps, graph-export.
 */
import type { Command } from 'commander';
import { join, dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { CoverageGap, KnowledgePage } from '../../core/types.js';
import { findProjectRoot } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import {
  listKnowledgePages,
  analyzeImpact,
  analyzeCoverage,
  readReverseIndex,
} from '../../knowledge/manager.js';

/** 从 package.json 读取版本号（ESM 下无法 require JSON，参照 mcp-server.ts 模式） */
function getPkgVersion(): string {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkgPath = resolve(__dirname, '..', '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

function requireRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error('Error: Not in a MumuSpec project.');
    process.exit(1);
  }
  return root;
}

/** Register top-level `impact` command and knowledge coverage/gaps/graph-export subcommands. */
export function registerKnowledgeAnalysis(program: Command, knowledgeCmd: Command): void {
  // === impact ===
  program
    .command('impact')
    .description('Analyze change impact with knowledge correlation')
    .option('--diff <range>', 'Git diff range (e.g., "HEAD~3..HEAD")')
    .option('--scope <path>', 'Limit analysis to scope')
    .option('--json', 'Output as JSON')
    .option('--with-knowledge', 'Include knowledge warnings', true)
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      try {
        const result = analyzeImpact(root, config, {
          diffRange: options.diff,
          scope: options.scope,
          withKnowledge: options.withKnowledge,
        });

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        console.log('\n+----------------------------------------------------------+');
        console.log('|                   IMPACT ANALYSIS                        |');
        console.log('+----------------------------------------------------------+');

        if (result.changed_files.length === 0) {
          console.log('\n  No changes detected.');
          return;
        }

        console.log(`\nChanged Files (${result.changed_files.length}):`);
        for (const f of result.changed_files.slice(0, 10)) {
          console.log(`   [${f.change_type}] ${f.path}`);
        }

        if (result.direct_impact.length > 0) {
          console.log(`\nDirect Impact (${result.direct_impact.length}):`);
          for (const n of result.direct_impact.slice(0, 10)) {
            console.log(`   [d=${n.distance}] ${n.node_path}`);
          }
        }

        if (result.knowledge_warnings.length > 0) {
          console.log(`\nKnowledge Warnings (${result.knowledge_warnings.length}):`);
          for (const w of result.knowledge_warnings) {
            const icon = w.severity === 'high' ? '[H]' : w.severity === 'medium' ? '[M]' : '[L]';
            console.log(`   ${icon} ${w.knowledge_id}: ${w.message}`);
            console.log(`     Suggestion: ${w.suggestion}`);
          }
        }

        const rec = result.recommendations;
        if (rec.regression_scope.length > 0 || rec.knowledge_pages_to_review.length > 0) {
          console.log('\nRecommendations:');
          if (rec.regression_scope.length > 0) {
            console.log(`   Regression: ${rec.regression_scope.join(', ')}`);
          }
          if (rec.knowledge_pages_to_review.length > 0) {
            console.log(`   Knowledge: ${rec.knowledge_pages_to_review.join(', ')}`);
          }
        }
      } catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
    });

  // === knowledge coverage ===
  knowledgeCmd
    .command('coverage')
    .description('Show knowledge coverage report')
    .option('--scope <path>', 'Limit to scope')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const report = analyzeCoverage(root, config, options.scope);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log('\n+----------------------------------------------------------+');
      console.log('|              KNOWLEDGE COVERAGE REPORT                   |');
      console.log('+----------------------------------------------------------+');

      const cov = report.coverage;
      const ratio = (cov.coverage_ratio * 100).toFixed(1);
      const barLen = 20;
      const filled = Math.round(cov.coverage_ratio * barLen);
      const bar = '#'.repeat(filled) + '.'.repeat(barLen - filled);

      console.log(`\nOverall: ${cov.covered_nodes}/${cov.total_code_nodes} nodes (${ratio}%)`);
      console.log(`   [${bar}]`);

      if (report.gaps.length > 0) {
        console.log(`\nCoverage Gaps (top ${Math.min(report.gaps.length, 5)}):`);
        for (const g of report.gaps.slice(0, 5)) {
          console.log(`   ${g.node} (importance: ${g.importance.toFixed(1)})`);
        }
      }

      if (report.overloads.length > 0) {
        console.log(`\nKnowledge Overloads: ${report.overloads.length}`);
      }
    });

  // === knowledge gaps ===
  knowledgeCmd
    .command('gaps')
    .description('List knowledge coverage gaps')
    .requiredOption('--scope <path>', 'Code scope path')
    .option('--min-importance <n>', 'Minimum importance threshold', '5')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const report = analyzeCoverage(root, config, options.scope);
      const minImp = parseFloat(options.minImportance);
      const filtered = report.gaps.filter((g: CoverageGap) => g.importance >= minImp);

      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }

      if (filtered.length === 0) {
        console.log('No gaps found above threshold.');
        return;
      }

      console.log(`\n${filtered.length} coverage gap(s):`);
      for (const g of filtered) {
        console.log(`  [${g.importance.toFixed(1)}] ${g.node} -> suggest: ${g.suggested_type}`);
      }
    });

  // === knowledge graph-export ===
  knowledgeCmd
    .command('graph-export')
    .description('Export knowledge graph as UA-style JSON (Git-compatible)')
    .option('--output <path>', 'Output path')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const pages = listKnowledgePages(root, config);
      const reverseIdx = readReverseIndex(root, config);

      const graph = {
        version: '1.0',
        generated_at: new Date().toISOString(),
        generator: `mumuspec@${getPkgVersion()}`,
        nodes: pages.map((p: KnowledgePage) => ({
          id: p.frontmatter.id,
          type: p.frontmatter.type,
          title: p.frontmatter.title,
          scope: p.frontmatter.scope,
          status: p.frontmatter.status,
          bindings: p.frontmatter.graph_bindings ?? [],
        })),
        edges: pages.flatMap((p: KnowledgePage) =>
          (p.frontmatter.graph_bindings ?? []).map((binding: string) => ({
            type: 'COVERED_BY',
            from: binding,
            to: p.frontmatter.id,
          })),
        ),
        reverse_index: reverseIdx.slice(0, 100),
      };

      const outputPath = options.output ?? join(root, '.mumuspec', 'knowledge', 'knowledge-graph.json');
      try {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, JSON.stringify(graph, null, 2));
        console.log(`Knowledge graph exported: ${outputPath}`);
        console.log(`  Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`);
      } catch {
        console.log(JSON.stringify(graph, null, 2));
      }
    });
}
