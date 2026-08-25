/**
 * Organize — scan knowledge base and fix issues (duplicates, orphans, mismatches).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  KnowledgeIssue,
  KnowledgeOrganizeResult,
  KnowledgePageFrontmatter,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readText, moveFile } from '../core/utils.js';
import { getKnowledgeDir, loadKnowledgePage } from './pages.js';
import { loadPageIndex, rebuildPageIndex } from './index.js';

/**
 * Scan knowledge base for issues and optionally fix them.
 * Detects duplicate IDs, missing index entries, orphaned index entries, and missing required fields.
 */
export function organizeKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  options?: { dryRun?: boolean; fix?: boolean; verbose?: boolean },
): KnowledgeOrganizeResult {
  const issues: KnowledgeIssue[] = [];
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const typeDirs = ['decisions', 'patterns', 'risks', 'rationales', 'lessons', 'imports'];
  const typeDirSet = new Set(typeDirs);

  // Collect all files from filesystem
  const allFiles: Array<{ path: string; typeDir: string; fileName: string }> = [];
  for (const typeDir of typeDirs) {
    const dirPath = join(knowledgeDir, typeDir);
    if (!existsSync(dirPath)) continue;
    const files = readdirSync(dirPath).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      allFiles.push({ path: join(dirPath, file), typeDir, fileName: file });
    }
  }

  // Load all pages
  const allPages: KnowledgePage[] = [];
  for (const file of allFiles) {
    const page = loadKnowledgePage(file.path);
    if (page) allPages.push(page);
  }

  // Load PageIndex
  const index = loadPageIndex(projectRoot, config);
  const indexEntries = index.pages || [];

  // Stats
  const stats = {
    total_files: allPages.length,
    total_index_entries: indexEntries.length,
    duplicate_ids: 0,
    missing_from_index: 0,
    orphaned_index_entries: 0,
    missing_required_fields: 0,
    type_mismatches: 0,
  };

  let fixed = 0;

  // === Check 1: Duplicate IDs ===
  const idToFileMap = new Map<string, string[]>();
  for (const page of allPages) {
    const id = page.frontmatter.id;
    if (!idToFileMap.has(id)) idToFileMap.set(id, []);
    idToFileMap.get(id)!.push(page.path);
  }
  for (const [id, paths] of idToFileMap.entries()) {
    if (paths.length > 1) {
      stats.duplicate_ids++;
      issues.push({
        severity: 'error',
        type: 'duplicate_id',
        page_id: id,
        message: `Duplicate ID "${id}" found in ${paths.length} files: ${paths.join(', ')}`,
        auto_fixable: false,
      });
    }
  }

  // === Check 2: Missing from index ===
  const indexedIds = new Set(indexEntries.map((e) => e.id));
  for (const page of allPages) {
    const id = page.frontmatter.id;
    if (!indexedIds.has(id)) {
      stats.missing_from_index++;
      issues.push({
        severity: 'warning',
        type: 'missing_from_index',
        page_id: id,
        file: page.path,
        message: `Page "${id}" (${page.frontmatter.title}) exists in filesystem but missing from _index.yaml`,
        auto_fixable: true,
      });
      if (options?.fix) {
        // ponytail: auto-fix by rebuilding the entire index
        rebuildPageIndex(projectRoot, config);
        fixed++;
      }
    }
  }

  // === Check 3: Orphaned index entries (in index but no file) ===
  const fileIds = new Set(allPages.map((p) => p.frontmatter.id));
  for (const entry of indexEntries) {
    if (!fileIds.has(entry.id)) {
      stats.orphaned_index_entries++;
      issues.push({
        severity: 'warning',
        type: 'orphaned_index',
        page_id: entry.id,
        file: entry.file,
        message: `Index entry "${entry.id}" (${entry.title}) references file "${entry.file}" which does not exist`,
        auto_fixable: true,
      });
      if (options?.fix) {
        rebuildPageIndex(projectRoot, config);
        fixed++;
      }
    }
  }

  // === Check 4: Missing required fields ===
  const requiredFields: Array<keyof KnowledgePageFrontmatter> = ['id', 'title', 'type', 'status', 'scope'];
  for (const page of allPages) {
    const missingFields: string[] = [];
    for (const field of requiredFields) {
      const value = page.frontmatter[field];
      if (value === undefined || value === null || (typeof value === 'string' && value === '')) {
        missingFields.push(field);
      }
    }
    if (missingFields.length > 0) {
      stats.missing_required_fields++;
      issues.push({
        severity: 'warning',
        type: 'missing_field',
        page_id: page.frontmatter.id,
        file: page.path,
        message: `Page "${page.frontmatter.id}" is missing required fields: ${missingFields.join(', ')}`,
        auto_fixable: false,
      });
    }
  }

  // === Check 5: Type-directory mismatch (skip imports/ - it's an archive dir) ===
  const typeToDirMap: Record<string, string> = {
    decision: 'decisions',
    pattern: 'patterns',
    risk: 'risks',
    rationale: 'rationales',
    lesson: 'lessons',
  };
  for (const page of allPages) {
    const actualDir = page.path.replace(knowledgeDir + '/', '').replace(knowledgeDir + '\\', '').split(/[/\\]/)[0];
    // Skip imports/ directory - it's an archive for imported docs, type mismatch is expected
    if (actualDir === 'imports') continue;
    const expectedDir = typeToDirMap[page.frontmatter.type];
    if (expectedDir) {
      if (actualDir && actualDir !== expectedDir && typeDirSet.has(actualDir)) {
        stats.type_mismatches++;
        issues.push({
          severity: 'warning',
          type: 'type_mismatch',
          page_id: page.frontmatter.id,
          file: page.path,
          message: `Page "${page.frontmatter.id}" has type "${page.frontmatter.type}" but is in "${actualDir}/" (expected "${expectedDir}/")`,
          auto_fixable: true,
        });
        if (options?.fix) {
          const destPath = join(knowledgeDir, expectedDir, page.path.split(/[/\\]/).pop()!);
          if (!existsSync(destPath)) {
            moveFile(page.path, destPath);
            fixed++;
          }
        }
      }
    }
  }

  // === Check 6: Files without valid frontmatter ===
  for (const file of allFiles) {
    const content = readText(file.path);
    if (content) {
      const parsed = parseFrontmatter(content);
      if (!parsed.frontmatter || !parsed.frontmatter.id) {
        issues.push({
          severity: 'error',
          type: 'missing_field',
          file: file.path,
          message: `File "${file.fileName}" in "${file.typeDir}/" has no valid frontmatter with ID`,
          auto_fixable: false,
        });
      }
    }
  }

  // Rebuild index at end if fixes were applied
  if (options?.fix && fixed > 0) {
    rebuildPageIndex(projectRoot, config);
  }

  return { issues, stats, fixed };
}

import { parseFrontmatter } from '../core/utils.js';
import type { KnowledgePage } from '../core/types.js';
