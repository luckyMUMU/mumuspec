/**
 * trace command — Depth-first symbol trace across the codebase.
 *
 * Scans source, test, and spec files under the project root (skipping
 * node_modules, .git, .mumuspec, dist, coverage) and reports every
 * word-boundary occurrence of the given symbol as file:line matches.
 */
import type { Command } from 'commander';
import { join, relative, sep } from 'node:path';
import { findProjectRoot, readText, readdirSync, statSync, SKIP_DIRS } from '../../core/utils.js';

// SKIP_DIRS 已统一收编到 core/utils.js（Phase 3.4）
const SEARCH_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.rb', '.php',
  '.md', '.mdx', '.yaml', '.yml', '.json',
]);

interface TraceHit {
  file: string;
  line: number;
  text: string;
  depth: number;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function registerTraceCommand(program: Command): void {
  program
    .command('trace <symbol>')
    .description('Trace a symbol across the codebase (depth-first scan)')
    .option('--depth <n>', 'max directory depth from project root', '8')
    .option('--limit <n>', 'max results shown', '100')
    .option('--scope <scope>', 'only scan paths containing this substring')
    .action((symbol: string, options) => {
      const root = findProjectRoot();
      if (!root) {
        console.error('Error: Not in a MumuSpec project.');
        process.exit(1);
      }
      const projectRoot: string = root;

      const maxDepth = parseInt(options.depth, 10) || 8;
      const limit = parseInt(options.limit, 10) || 100;
      const scopeFilter = options.scope ? String(options.scope) : undefined;
      const hits: TraceHit[] = [];
      const visited = new Set<string>();
      const pattern = new RegExp(`\\b${escapeRegExp(symbol)}\\b`);

      function scanDir(dirPath: string, depth: number): void {
        if (depth > maxDepth || visited.has(dirPath)) return;
        visited.add(dirPath);

        let entries;
        try {
          entries = readdirSync(dirPath, { withFileTypes: true });
        } catch {
          return;
        }

        for (const entry of entries) {
          const full = join(dirPath, entry.name);
          if (scopeFilter && !full.includes(scopeFilter)) continue;

          if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
            scanDir(full, depth + 1);
            continue;
          }

          const ext = entry.name.slice(entry.name.lastIndexOf('.'));
          if (!SEARCH_EXTS.has(ext)) continue;

          let content: string | undefined;
          try {
            const info = statSync(full);
            if (info.size > 2 * 1024 * 1024) continue; // skip >2MB files
            content = readText(full);
          } catch {
            continue;
          }
          if (!content) continue;

          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (pattern.test(lines[i])) {
              hits.push({
                file: relative(projectRoot, full).split(sep).join('/'),
                line: i + 1,
                text: lines[i].trim().slice(0, 120),
                depth,
              });
              if (hits.length >= limit) return;
            }
          }
        }
      }

      scanDir(root, 0);

      if (hits.length === 0) {
        console.log(`No occurrences of "${symbol}" found.`);
        return;
      }

      console.log(`\nTrace "${symbol}" — ${hits.length} match(es):\n`);
      for (const hit of hits) {
        console.log(`  ${hit.file}:${hit.line}  ${hit.text}`);
      }
      console.log(`\n  Scanned from: ${root}`);
      console.log('');
    });
}
