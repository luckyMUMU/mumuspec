/**
 * Knowledge sync subcommands — export, import, tell, absorb, stats.
 *
 * Implements bidirectional knowledge transfer between MumuSpec and external agents:
 * - export: Direct file generation (MumuSpec knowledge -> agent format)
 * - tell: Conversation-based push (generate prompt for agent)
 * - import: Direct file parsing (agent format -> MumuSpec knowledge)
 * - absorb: Conversation-based extraction (parse agent response)
 * - stats: Knowledge usage metrics
 */

import type { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import type {
  KnowledgePage,
  ExportOptions,
  ImportOptions,
  KnowledgeType,
  ConflictStrategy,
} from '../../core/types.js';
import { findProjectRoot, readText, writeText, createFrontmatter } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import { listKnowledgePages, getKnowledgeDir } from '../../knowledge/pages.js';
import { runKnowledgeSearch } from './knowledge-crud.js';
import {
  initializeRegistry,
  getPlugin,
  listTargets,
} from '../../knowledge/sync-registry.js';
import {
  generateTellPrompt,
  generateAbsorbPrompt,
  parseAbsorbResponse,
} from '../../knowledge/conversation.js';

// ========== Helpers ==========

function requireRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error('Error: Not in a MumuSpec project.');
    process.exit(1);
  }
  return root;
}

function parseTypeList(typeStr: string | undefined): KnowledgeType[] | undefined {
  if (!typeStr) return undefined;
  const validTypes: KnowledgeType[] = ['decision', 'pattern', 'risk', 'rationale', 'lesson', 'imported', 'scenario'];
  return typeStr
    .split(',')
    .map((t) => t.trim() as KnowledgeType)
    .filter((t) => validTypes.includes(t));
}

function parseTagList(tagStr: string | undefined): string[] | undefined {
  if (!tagStr) return undefined;
  return tagStr.split(',').map((t) => t.trim()).filter(Boolean);
}

// ========== Register ==========

export function registerKnowledgeSync(knowledgeCmd: Command): void {
  // Initialize plugin registry on first use
  initializeRegistry();

  // --- search2 (deprecated alias) ---
  // 2026-09-05 去重：增强搜索已合并进 `knowledge search`（runKnowledgeSearch），
  // search2 保留为隐藏弃用别名以兼容既有脚本；将在下一个 minor 版本移除。
  knowledgeCmd
    .command('search2', { hidden: true })
    .description('Deprecated alias of `knowledge search`')
    .argument('<query>', 'search keywords')
    .option('--type <types>', 'filter by type (comma-separated)')
    .option('--scope <scope>', 'filter by scope')
    .option('--status <status>', 'filter by status (comma-separated)')
    .option('--tags <tags>', 'filter by tags (comma-separated)')
    .option('--graph <node>', 'filter by graph binding')
    .option('--limit <n>', 'max results', '20')
    .option('--json', 'output as JSON')
    .action((query: string, options: Record<string, string>) => {
      console.error('[deprecated] `knowledge search2` is deprecated — use `knowledge search` instead.');
      runKnowledgeSearch(query, options);
    });

  // --- export ---
  knowledgeCmd
    .command('export')
    .description('Export knowledge to agent-specific format')
    .argument('<target>', 'target agent (claude|cursor|windsurf|continue|copilot|aider|generic)')
    .option('--scope <scope>', 'filter by scope')
    .option('--type <types>', 'filter by type (comma-separated)')
    .option('--tags <tags>', 'filter by tags (comma-separated)')
    .option('--ids <ids>', 'specific entry IDs (comma-separated)')
    .option('--level <levels>', 'filter by level (L0-L3, comma-separated)')
    .option('--since <date>', 'only entries updated since date (ISO)')
    .option('--output <path>', 'output file path (default: agent-specific)')
    .option('--dry-run', 'preview without writing')
    .option('--list-targets', 'list all supported targets')
    .action((target: string, options: Record<string, string>) => {
      const root = requireRoot();
      const config = loadConfig(root);

      if (options.listTargets) {
        console.log('\nSupported export targets:');
        for (const t of listTargets()) {
          const plugin = getPlugin(t);
          const caps = plugin?.capabilities;
          console.log(`  ${t}:`);
          console.log(`    directExport: ${caps?.directExport ?? false}`);
          console.log(`    directImport: ${caps?.directImport ?? false}`);
          console.log(`    conversation: ${caps?.conversationFallback ?? false}`);
        }
        return;
      }

      // Find the best plugin (fallback to generic)
      let plugin = getPlugin(target);
      if (!plugin) {
        const generic = getPlugin('generic');
        if (!generic) {
          console.error(`Error: No plugin found for target "${target}" (no generic fallback).`);
          process.exit(1);
        }
        console.log(`Note: Using generic plugin for unknown target "${target}".`);
        plugin = generic;
      }

      if (!plugin.capabilities.directExport) {
        console.error(
          `Error: Target "${target}" does not support direct export. Use "mumuspec knowledge tell" instead.`,
        );
        process.exit(1);
      }

      // Load filtered entries
      const allPages = listKnowledgePages(root, config);
      const filtered = filterPagesForExport(allPages, {
        scope: options.scope,
        type: parseTypeList(options.type),
        tags: parseTagList(options.tags),
        ids: options.ids ? options.ids.split(',') : undefined,
        level: options.level ? (options.level.split(',') as ExportOptions['level']) : undefined,
        since: options.since,
      });

      if (filtered.length === 0) {
        console.log('No entries match the given filters.');
        return;
      }

      const artifact = plugin.formatForAgent(filtered, {
        scope: options.scope,
        type: parseTypeList(options.type),
        tags: parseTagList(options.tags),
        ids: options.ids ? options.ids.split(',') : undefined,
        level: options.level ? (options.level.split(',') as ExportOptions['level']) : undefined,
        since: options.since,
      });

      if (options.dryRun) {
        console.log(`\n--- DRY RUN: Export to ${target} ---\n`);
        console.log(`Would export ${artifact.entryCount} entries.`);
        console.log(`Format: ${artifact.format}`);
        console.log(`Target path: ${options.output || artifact.filePath}`);
        console.log(`\n--- Preview (first 800 chars) ---\n`);
        console.log(artifact.content.slice(0, 800));
        if (artifact.content.length > 800) console.log('\n... [truncated]');
        return;
      }

      // Write to file
      const outputPath = options.output
        ? resolve(root, options.output)
        : resolve(root, artifact.filePath);

      const outputDir = outputPath.substring(0, outputPath.lastIndexOf('/'));
      if (outputDir && !existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      writeText(outputPath, artifact.content);
      console.log(`Exported ${artifact.entryCount} entries to ${outputPath}`);
      console.log(`Target: ${target} | Format: ${artifact.format}`);
    });

  // --- tell (conversation push) ---
  knowledgeCmd
    .command('tell')
    .description('Push knowledge to agent via conversation prompt')
    .argument('<target>', 'target agent')
    .option('--scope <scope>', 'filter by scope')
    .option('--type <types>', 'filter by type (comma-separated)')
    .option('--tags <tags>', 'filter by tags (comma-separated)')
    .option('--ids <ids>', 'specific entry IDs (comma-separated)')
    .option('--since <date>', 'only entries updated since date')
    .option('--output <path>', 'save prompt to file instead of printing')
    .option('--dry-run', 'preview prompt without saving')
    .action((target: string, options: Record<string, string>) => {
      const root = requireRoot();
      const config = loadConfig(root);

      const result = generateTellPrompt(root, config, target, {
        scope: options.scope,
        type: parseTypeList(options.type),
        tags: parseTagList(options.tags),
        ids: options.ids ? options.ids.split(',') : undefined,
        since: options.since,
      });

      if (options.dryRun || options.output) {
        const content = [
          result.instructions,
          '',
          '---',
          '',
          result.prompt,
        ].join('\n');

        if (options.output) {
          const outputPath = resolve(root, options.output);
          writeText(outputPath, content);
          console.log(`Prompt saved to ${outputPath}`);
          console.log(`${result.entryCount} entries prepared for "${target}".`);
        } else {
          console.log(content);
        }
        return;
      }

      console.log(result.instructions);
      console.log('\n---\n');
      console.log(result.prompt);
    });

  // --- import ---
  knowledgeCmd
    .command('import')
    .description('Import knowledge from agent-specific file')
    .argument('<target>', 'source agent (claude|cursor|windsurf|continue|copilot|aider|generic)')
    .option('--file <path>', 'source file path (default: agent-specific location)')
    .option('--scope <scope>', 'set scope for imported entries')
    .option('--type <types>', 'filter by type (comma-separated)')
    .option('--conflict <strategy>', 'conflict resolution (skip|overwrite|new-version|merge|manual)', 'skip')
    .option('--dry-run', 'preview without saving')
    .action((target: string, options: Record<string, string>) => {
      const root = requireRoot();
      const config = loadConfig(root);

      const plugin = getPlugin(target);
      if (!plugin) {
        console.error(`Error: No plugin found for target "${target}".`);
        process.exit(1);
      }

      if (!plugin.capabilities.directImport) {
        console.error(
          `Error: Target "${target}" does not support direct import. Use "mumuspec knowledge absorb" instead.`,
        );
        process.exit(1);
      }

      // Read source file
      const sourcePath = options.file
        ? resolve(root, options.file)
        : resolve(root, getDefaultSourcePath(target));

      if (!existsSync(sourcePath)) {
        console.error(`Error: Source file not found: ${sourcePath}`);
        process.exit(1);
      }

      const fileContent = readText(sourcePath);
      if (!fileContent) {
        console.error(`Error: Could not read source file: ${sourcePath}`);
        process.exit(1);
      }

      const importOpts: ImportOptions = {
        scope: options.scope,
        type: parseTypeList(options.type),
        conflict: (options.conflict || 'skip') as ConflictStrategy,
        dryRun: !!options.dryRun,
      };

      const entries = plugin.parseFromAgent(fileContent, importOpts);

      if (entries.length === 0) {
        console.log('No knowledge entries found in source.');
        return;
      }

      if (options.dryRun) {
        console.log(`\n--- DRY RUN: Import from ${target} ---\n`);
        console.log(`Found ${entries.length} entries to import:`);
        for (const entry of entries.slice(0, 10)) {
          console.log(
            `  - [${entry.frontmatter.type}] ${entry.frontmatter.title} (${entry.frontmatter.status})`,
          );
        }
        if (entries.length > 10) {
          console.log(`  ... and ${entries.length - 10} more`);
        }
        return;
      }

      // Write entries
      const knowledgeDir = getKnowledgeDir(root, config);
      let imported = 0;
      for (const entry of entries) {
        const dirPath = join(knowledgeDir, `${entry.frontmatter.type}s`);
        if (!existsSync(dirPath)) {
          mkdirSync(dirPath, { recursive: true });
        }
        const filename = sanitizeFilename(entry.frontmatter.title);
        const filePath = join(dirPath, `${filename}.md`);

        const fm = { ...entry.frontmatter, scope: 'imported', source_agent: target };
        const content = createFrontmatter(fm as unknown as Record<string, unknown>) + entry.content;
        writeText(filePath, content);
        imported++;
      }

      console.log(`Imported ${imported} entries from ${target} to knowledge/`);
    });

  // --- absorb (conversation extract) ---
  knowledgeCmd
    .command('absorb')
    .description('Extract knowledge from agent via conversation')
    .argument('<target>', 'source agent')
    .option('--parse <response>', 'parse agent response directly (use "-" for stdin)')
    .option('--file <path>', 'read agent response from file')
    .option('--conflict <strategy>', 'conflict resolution', 'skip')
    .option('--dry-run', 'preview without saving')
    .action((target: string, options: Record<string, string>) => {
      const root = requireRoot();
      const config = loadConfig(root);

      // Mode 1: Generate extraction prompt
      if (!options.parse && !options.file) {
        const preview = generateAbsorbPrompt(root, config, target);
        console.log('=== Extraction Prompt ===\n');
        console.log(preview.extractPrompt);
        console.log('\n=== Instructions ===\n');
        console.log(preview.instructions);
        return;
      }

      // Mode 2: Parse agent response
      let response: string;
      if (options.parse === '-') {
        // Read from stdin
        response = readStdin();
      } else if (options.file) {
        const filePath = resolve(root, options.file);
        if (!existsSync(filePath)) {
          console.error(`Error: File not found: ${filePath}`);
          process.exit(1);
        }
        response = readText(filePath) || '';
      } else if (options.parse) {
        response = options.parse;
      } else {
        console.error('Error: Provide --parse <response> or --file <path>');
        process.exit(1);
      }

      const importOpts: ImportOptions = {
        conflict: (options.conflict as ConflictStrategy) || 'skip',
        dryRun: !!options.dryRun,
      };

      const result = parseAbsorbResponse(root, config, target, response, importOpts);

      if (options.dryRun) {
        console.log(`\n--- DRY RUN: Absorb from ${target} ---\n`);
        console.log(`Parsed ${result.parsedEntries.length} entries from response:`);
        for (const entry of result.parsedEntries) {
          console.log(`  - [${entry.frontmatter.type}] ${entry.frontmatter.title}`);
        }
        if (result.conflicts.length > 0) {
          console.log(`\n${result.conflicts.length} conflict(s) detected:`);
          for (const c of result.conflicts.slice(0, 5)) {
            console.log(`  - Similar to ${c.existing_id} (${Math.round(c.similarity * 100)}%)`);
          }
        }
        return;
      }

      console.log(`Imported ${result.imported} entries from ${target}.`);
      if (result.conflicts.length > 0) {
        console.log(`${result.conflicts.length} conflict(s) skipped (use --conflict to change).`);
      }
    });

  // --- stats ---
  knowledgeCmd
    .command('stats')
    .description('Show knowledge usage statistics')
    .option('--json', 'output as JSON')
    .action((options: Record<string, string>) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const pages = listKnowledgePages(root, config);

      // Aggregate stats
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const byScope: Record<string, number> = {};
      const byLevel: Record<string, number> = {};

      for (const p of pages) {
        byType[p.frontmatter.type] = (byType[p.frontmatter.type] || 0) + 1;
        byStatus[p.frontmatter.status] = (byStatus[p.frontmatter.status] || 0) + 1;
        byScope[p.frontmatter.scope] = (byScope[p.frontmatter.scope] || 0) + 1;
        const lvl = p.frontmatter.level || 'unset';
        byLevel[lvl] = (byLevel[lvl] || 0) + 1;
      }

      if (options.json) {
        console.log(
          JSON.stringify({ total: pages.length, byType, byStatus, byScope, byLevel }, null, 2),
        );
        return;
      }

      console.log(`\nKnowledge Base Stats`);
      console.log(`====================`);
      console.log(`Total entries: ${pages.length}`);
      console.log('');
      console.log('By type:');
      for (const [t, c] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${t}: ${c}`);
      }
      console.log('');
      console.log('By status:');
      for (const [s, c] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${s}: ${c}`);
      }
      console.log('');
      console.log('By scope:');
      for (const [s, c] of Object.entries(byScope).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${s}: ${c}`);
      }
      if (Object.keys(byLevel).length > 1 || !byLevel['unset']) {
        console.log('');
        console.log('By level:');
        for (const [l, c] of Object.entries(byLevel).sort()) {
          console.log(`  ${l}: ${c}`);
        }
      }
    });
}

// ========== Internal Helpers ==========

function filterPagesForExport(
  pages: KnowledgePage[],
  options: ExportOptions,
): KnowledgePage[] {
  let result = pages;

  if (options.scope) {
    result = result.filter(
      (p) => p.frontmatter.scope === options.scope || p.frontmatter.scope.includes(options.scope!),
    );
  }
  if (options.type && options.type.length > 0) {
    result = result.filter((p) => options.type!.includes(p.frontmatter.type));
  }
  if (options.tags && options.tags.length > 0) {
    result = result.filter((p) =>
      options.tags!.some((tag) => (p.frontmatter.tags || []).includes(tag)),
    );
  }
  if (options.ids && options.ids.length > 0) {
    result = result.filter((p) => options.ids!.includes(p.frontmatter.id));
  }
  if (options.level && options.level.length > 0) {
    result = result.filter(
      (p) => p.frontmatter.level && options.level!.includes(p.frontmatter.level),
    );
  }
  if (options.since) {
    const sinceDate = new Date(options.since);
    result = result.filter((p) => {
      const updated = new Date(p.frontmatter.updated_at || p.frontmatter.created_at);
      return updated >= sinceDate;
    });
  }

  return result;
}

function getDefaultSourcePath(target: string): string {
  const paths: Record<string, string> = {
    claude: 'MEMORY.md',
    cursor: '.cursor/rules/mumuspec-knowledge.md',
    windsurf: '.windsurf/rules/mumuspec-knowledge.md',
    continue: '.continuerules',
    cline: '.clinerules',
    copilot: '.github/copilot-instructions.md',
    aider: '.aider.rules.md',
    generic: '.mumuspec-knowledge.md',
  };
  return paths[target] || '.mumuspec-knowledge.md';
}

function sanitizeFilename(title: string): string {
  return (
    title
      .slice(0, 50)
      .replace(/[^a-zA-Z0-9-_.\u4e00-\u9fff]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') ||
    `imported-${Date.now().toString(36)}`
  );
}

function readStdin(): string {
  try {
    // Synchronous stdin read via /dev/stdin (works in Node.js)
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

// Re-export for external use
export { initializeRegistry as ensureSyncInitialized };
