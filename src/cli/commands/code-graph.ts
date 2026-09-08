/**
 * code-graph command — search, trace, and inspect the in-memory code graph.
 *
 * `mumuspec code-graph search <query>`      — fuzzy symbol search
 * `mumuspec code-graph trace <symbol>`      — call/import chain from a symbol
 * `mumuspec code-graph structure <dir>`     — structural inventory of a directory
 */
import type { Command } from 'commander';
import { resolve } from 'node:path';
import { findProjectRoot } from '../../core/utils.js';
import { getCachedCodeGraph } from '../../knowledge/graph-builder.js';
import { searchNodes, tracePath, getStructure, getGraphStats } from '../../knowledge/code-graph.js';

export function registerCodeGraphCommand(program: Command): void {
  const cmd = program
    .command('code-graph')
    .description('Search and inspect the code structure graph');

  cmd
    .command('search')
    .description('Fuzzy-search symbols (files, functions, classes, modules)')
    .argument('<query>', 'search query')
    .option('--limit <n>', 'maximum results', '20')
    .action((query: string, options: { limit: string }) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const graph = getCachedCodeGraph(root);
      const results = searchNodes(graph, query, parseInt(options.limit, 10) || 20);
      if (results.length === 0) {
        console.log('No matching symbols.');
        return;
      }
      for (const r of results) {
        console.log(`  ${r.node.name}  (${r.node.label})  ${r.node.filePath}:${r.node.startLine ?? ''}  score=${r.score}`);
      }
      console.log(`\n${results.length} result(s)`);
    });

  cmd
    .command('trace')
    .description('Trace the dependency chain starting from a symbol')
    .argument('<symbol>', 'symbol name to start from')
    .option('--file <path>', 'disambiguate start node by file path substring')
    .option('--depth <n>', 'maximum trace depth', '5')
    .action((symbol: string, options: { file?: string; depth: string }) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const graph = getCachedCodeGraph(root);
      const candidates = searchNodes(graph, symbol, 10);
      if (candidates.length === 0) {
        console.error(`Error: Symbol not found: ${symbol}`);
        process.exit(1);
      }
      let start = candidates[0];
      if (options.file) {
        const exact = candidates.find((c) => c.node.filePath?.includes(options.file!));
        if (exact) start = exact;
      }
      const path = tracePath(graph, start.node.id, parseInt(options.depth, 10) || 5);
      console.log(`  start: ${start.node.name} (${start.node.label}) ${start.node.filePath ?? ''}`);
      for (const n of path) {
        console.log(`    → ${n.name} (${n.label}) ${n.filePath ?? ''}:${n.startLine ?? ''}`);
      }
      console.log(`\ndepth: ${path.length}`);
    });

  cmd
    .command('structure')
    .description('Show structural inventory (modules/files/functions/classes) of a directory')
    .argument('<dir>', 'directory path relative to project root')
    .action((dir: string) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const graph = getCachedCodeGraph(root);
      const absDir = resolve(root, dir);
      const relDir = absDir.replace(root, '').replace(/^[\\/]/, '').replace(/\\/g, '/');
      const structure = getStructure(graph, relDir);

      console.log(`  dir: ${relDir}`);
      if (structure.modules.length > 0) {
        console.log('\n  modules:');
        for (const m of structure.modules) console.log(`    ${m.name}  ${m.filePath}`);
      }
      if (structure.files.length > 0) {
        console.log('\n  files:');
        for (const f of structure.files) console.log(`    ${f.name}  (${f.language})`);
      }
      if (structure.functions.length > 0) {
        console.log('\n  functions:');
        for (const f of structure.functions) console.log(`    ${f.name}  ${f.filePath}:${f.startLine}`);
      }
      if (structure.classes.length > 0) {
        console.log('\n  classes:');
        for (const c of structure.classes) console.log(`    ${c.name}  ${c.filePath}:${c.startLine}`);
      }
      const stats = getGraphStats(graph);
      console.log(`\n  graph: ${stats.totalNodes} nodes / ${stats.totalEdges} edges`);
    });
}
