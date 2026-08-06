/**
 * Knowledge CRUD subcommands — list, show, search, context, verify, stale, supersede, organize, rebuild-index.
 */
import type { Command } from 'commander';
import { resolve } from 'node:path';
import type { KnowledgeIssue } from '../../core/types.js';
import { findProjectRoot } from '../../core/utils.js';
import { loadConfig } from '../../core/config.js';
import {
  listKnowledgePages,
  getKnowledgePage,
  searchKnowledge,
  getKnowledgeContext,
  verifyKnowledge,
  listStalePages,
  supersedeKnowledge,
  rebuildPageIndex,
  organizeKnowledge,
} from '../../knowledge/manager.js';

function requireRoot(): string {
  const root = findProjectRoot();
  if (!root) {
    console.error('Error: Not in a MumuSpec project.');
    process.exit(1);
  }
  return root;
}

/** Register knowledge list/show/search/context/verify/stale/supersede/organize/rebuild-index. */
export function registerKnowledgeCrud(knowledgeCmd: Command): void {
  knowledgeCmd
    .command('list')
    .description('List knowledge pages')
    .option('--type <type>', 'filter by type')
    .option('--scope <scope>', 'filter by scope')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const pages = listKnowledgePages(root, config, { type: options.type, scope: options.scope });
      if (pages.length === 0) {
        console.log('No knowledge pages found.');
        return;
      }
      console.log(`\n${pages.length} knowledge page(s):`);
      for (const page of pages) {
        console.log(
          `  [${page.frontmatter.type}] ${page.frontmatter.id}: ${page.frontmatter.title} (${page.frontmatter.status})`,
        );
      }
    });

  knowledgeCmd
    .command('show')
    .description('Show a knowledge page')
    .argument('<id>', 'page ID')
    .action((id) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const page = getKnowledgePage(root, config, id);
      if (!page) {
        console.error(`Error: Knowledge page not found: ${id}`);
        process.exit(1);
      }
      console.log(`\nID: ${page.frontmatter.id}`);
      console.log(`Title: ${page.frontmatter.title}`);
      console.log(`Type: ${page.frontmatter.type}`);
      console.log(`Status: ${page.frontmatter.status}`);
      console.log(`Scope: ${page.frontmatter.scope}`);
      console.log(`Created: ${page.frontmatter.created_at}`);
      if (page.frontmatter.verified_at) console.log(`Verified: ${page.frontmatter.verified_at}`);
      if (page.frontmatter.tags && page.frontmatter.tags.length > 0) {
        console.log(`Tags: ${page.frontmatter.tags.join(', ')}`);
      }
      console.log(`\n---\n${page.content}`);
    });

  knowledgeCmd
    .command('search')
    .description('Search knowledge pages')
    .argument('<keyword>', 'search keyword')
    .option('--tag <tag>', 'filter by tag')
    .option('--type <type>', 'filter by type')
    .action((keyword, options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const pages = searchKnowledge(root, config, { keyword, tag: options.tag, type: options.type });
      console.log(`\n${pages.length} result(s):`);
      for (const page of pages) {
        console.log(`  [${page.frontmatter.type}] ${page.frontmatter.id}: ${page.frontmatter.title}`);
      }
    });

  knowledgeCmd
    .command('context')
    .description('Get knowledge context for a path')
    .argument('<path>', 'directory path')
    .option('--scopes <scopes>', 'filter by scope (comma-separated)')
    .action((path, options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      let pages = getKnowledgeContext(root, config, resolve(path));

      if (options.scopes) {
        const scopes = String(options.scopes).split(',').map((s: string) => s.trim()).filter(Boolean);
        pages = pages.filter((p) => scopes.includes(p.frontmatter.scope));
      }

      console.log(`\n${pages.length} knowledge page(s) for ${path}:`);
      for (const page of pages) {
        console.log(`  [${page.frontmatter.type}] ${page.frontmatter.id}: ${page.frontmatter.title}`);
      }
    });

  knowledgeCmd
    .command('verify')
    .description('Verify knowledge freshness')
    .option('--id <id>', 'verify specific page')
    .option('--all', 'verify all pages')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const results = verifyKnowledge(root, config, { id: options.id, all: options.all || !options.id });
      console.log(`\n${results.length} page(s) verified:`);
      for (const r of results) {
        const icon = r.status === 'fresh' ? 'ok' : r.status === 'stale' ? 'warn' : 'err';
        console.log(`  ${icon} ${r.id}: ${r.status} (${r.days_since_verify} days)`);
      }
    });

  knowledgeCmd
    .command('stale')
    .description('List stale knowledge pages')
    .action(() => {
      const root = requireRoot();
      const config = loadConfig(root);
      const stale = listStalePages(root, config);
      if (stale.length === 0) {
        console.log('ok - No stale knowledge pages');
      } else {
        console.log(`\n${stale.length} stale page(s):`);
        for (const s of stale) {
          console.log(`  [${s.status}] ${s.id}: ${s.title} (${s.days} days)`);
        }
      }
    });

  knowledgeCmd
    .command('supersede')
    .description('Mark a knowledge page as superseded')
    .argument('<id>', 'old page ID')
    .requiredOption('--by <newId>', 'new page ID')
    .action((id, options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      supersedeKnowledge(root, config, id, options.by);
      console.log(`Knowledge page ${id} superseded by ${options.by}`);
    });

  knowledgeCmd
    .command('organize')
    .description('Scan knowledge base for issues and optionally fix them')
    .option('--dry-run', 'scan and report issues without making changes')
    .option('--fix', 'automatically fix issues that can be auto-fixed')
    .option('--verbose', 'show detailed issue reports')
    .action((options) => {
      const root = requireRoot();
      const config = loadConfig(root);
      const result = organizeKnowledge(root, config, {
        dryRun: options.dryRun,
        fix: options.fix,
        verbose: options.verbose,
      });

      console.log('\n+----------------------------------------------------------+');
      console.log('|              KNOWLEDGE BASE ORGANIZE                     |');
      console.log('+----------------------------------------------------------+');

      console.log('\nStats:');
      console.log(`  Total files:          ${result.stats.total_files}`);
      console.log(`  Total index entries:  ${result.stats.total_index_entries}`);
      console.log(`  Duplicate IDs:        ${result.stats.duplicate_ids}`);
      console.log(`  Missing from index:   ${result.stats.missing_from_index}`);
      console.log(`  Orphaned index:       ${result.stats.orphaned_index_entries}`);
      console.log(`  Missing fields:       ${result.stats.missing_required_fields}`);
      console.log(`  Type mismatches:      ${result.stats.type_mismatches}`);

      if (result.issues.length === 0) {
        console.log('\nNo issues found! Knowledge base is well organized.');
      } else {
        console.log(`\n${result.issues.length} issue(s) found:`);
        const errors = result.issues.filter((i: KnowledgeIssue) => i.severity === 'error');
        const warnings = result.issues.filter((i: KnowledgeIssue) => i.severity === 'warning');
        const infos = result.issues.filter((i: KnowledgeIssue) => i.severity === 'info');

        if (errors.length > 0) {
          console.log(`\n  Errors (${errors.length}):`);
          for (const issue of errors) {
            console.log(`    - [${issue.type}] ${issue.message}`);
            if (!issue.auto_fixable) {
              console.log('      -> Manual fix required');
            }
          }
        }

        if (warnings.length > 0) {
          console.log(`\n  Warnings (${warnings.length}):`);
          for (const issue of warnings) {
            console.log(`    - [${issue.type}] ${issue.message}`);
            if (issue.auto_fixable) {
              console.log('      -> Auto-fixable (use --fix)');
            }
          }
        }

        if (infos.length > 0 && options.verbose) {
          console.log(`\n  Info (${infos.length}):`);
          for (const issue of infos) {
            console.log(`    - [${issue.type}] ${issue.message}`);
          }
        }
      }

      if (options.fix) {
        console.log(`\nFixed ${result.fixed} issue(s).`);
      } else if (result.issues.some((i: KnowledgeIssue) => i.auto_fixable)) {
        const autoFixable = result.issues.filter((i: KnowledgeIssue) => i.auto_fixable).length;
        console.log(`\nRun with --fix to auto-fix ${autoFixable} issue(s).`);
      }
    });

  knowledgeCmd
    .command('rebuild-index')
    .description('Rebuild knowledge page index (_index.yaml) from filesystem')
    .action(() => {
      const root = requireRoot();
      const config = loadConfig(root);
      const index = rebuildPageIndex(root, config);
      console.log(`PageIndex rebuilt with ${index.pages.length} entries.`);
    });
}
