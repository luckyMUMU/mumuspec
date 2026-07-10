import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  KnowledgePage,
  KnowledgePageFrontmatter,
  PageIndex,
  PageIndexEntry,
  KnowledgePage as KPage,
} from '../core/types.js';
import { readText, writeText, readYaml, writeYaml, parseFrontmatter, createFrontmatter, now, computeHash } from '../core/utils.js';
import type { MumuSpecConfig } from '../core/config.js';

/** Get the knowledge directory */
export function getKnowledgeDir(projectRoot: string, config: MumuSpecConfig): string {
  return join(projectRoot, config.knowledge.wiki.dir);
}

/** List all knowledge pages */
export function listKnowledgePages(
  projectRoot: string,
  config: MumuSpecConfig,
  options?: { type?: string; scope?: string },
): KnowledgePage[] {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  if (!existsSync(knowledgeDir)) return [];

  const pages: KnowledgePage[] = [];
  const typeDirs = ['decisions', 'patterns', 'risks', 'rationale', 'lessons'];

  for (const typeDir of typeDirs) {
    const dirPath = join(knowledgeDir, typeDir);
    if (!existsSync(dirPath)) continue;

    const files = readdirSync(dirPath).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = join(dirPath, file);
      const page = loadKnowledgePage(filePath);
      if (page) {
        // Filter by type
        if (options?.type && page.frontmatter.type !== options.type) continue;
        // Filter by scope
        if (options?.scope && !page.frontmatter.scope.includes(options.scope)) continue;
        pages.push(page);
      }
    }
  }

  return pages;
}

/** Load a knowledge page from file */
export function loadKnowledgePage(filePath: string): KnowledgePage | undefined {
  const content = readText(filePath);
  if (!content) return undefined;

  const { frontmatter, body } = parseFrontmatter<KnowledgePageFrontmatter>(content);
  if (!frontmatter) return undefined;

  return {
    path: filePath,
    frontmatter,
    content: body,
  };
}

/** Get a knowledge page by ID */
export function getKnowledgePage(
  projectRoot: string,
  config: MumuSpecConfig,
  id: string,
): KnowledgePage | undefined {
  const pages = listKnowledgePages(projectRoot, config);
  return pages.find((p) => p.frontmatter.id === id);
}

/** Search knowledge pages by keyword or tag */
export function searchKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  options: { keyword?: string; tag?: string; type?: string },
): KnowledgePage[] {
  let pages = listKnowledgePages(projectRoot, config, { type: options.type });

  if (options.tag) {
    pages = pages.filter((p) => p.frontmatter.tags?.includes(options.tag!));
  }

  if (options.keyword) {
    const keyword = options.keyword.toLowerCase();
    pages = pages.filter(
      (p) =>
        p.frontmatter.title.toLowerCase().includes(keyword) ||
        p.content.toLowerCase().includes(keyword),
    );
  }

  return pages;
}

/** Get knowledge context for a path (progressive loading) */
export function getKnowledgeContext(
  projectRoot: string,
  config: MumuSpecConfig,
  targetPath: string,
): KnowledgePage[] {
  const pages = listKnowledgePages(projectRoot, config);

  // Filter by scope (matching or parent scope)
  const relPath = targetPath.replace(projectRoot, '').replace(/^[\\/]/, '');
  const scopedPages = pages.filter((p) => {
    const scope = p.frontmatter.scope;
    if (scope === '.' || scope === '') return true;
    return relPath.startsWith(scope) || scope === relPath;
  });

  // Sort by verified_at (most recent first)
  scopedPages.sort((a, b) => {
    const aTime = a.frontmatter.verified_at || a.frontmatter.created_at;
    const bTime = b.frontmatter.verified_at || b.frontmatter.created_at;
    return bTime.localeCompare(aTime);
  });

  // Limit per layer
  return scopedPages.slice(0, config.knowledge.progressive_disclosure.max_pages_per_layer);
}

/** Create a new knowledge page */
export function createKnowledgePage(
  projectRoot: string,
  config: MumuSpecConfig,
  page: {
    id: string;
    title: string;
    type: KnowledgePageFrontmatter['type'];
    scope: string;
    content: string;
    tags?: string[];
    graph_bindings?: string[];
  },
): string {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const typeDir = join(knowledgeDir, `${page.type}s`);
  if (!existsSync(typeDir)) {
    mkdirSync(typeDir, { recursive: true });
  }

  const fileName = `${page.id}.md`;
  const filePath = join(typeDir, fileName);

  const frontmatter: KnowledgePageFrontmatter = {
    id: page.id,
    title: page.title,
    type: page.type,
    status: 'confirmed',
    scope: page.scope,
    created_at: now().split('T')[0],
    tags: page.tags || [],
    graph_bindings: page.graph_bindings || [],
  };

  const content = createFrontmatter(frontmatter as unknown as Record<string, unknown>) + page.content;
  writeText(filePath, content);

  // Update PageIndex
  updatePageIndex(projectRoot, config);

  return filePath;
}

/** Verify knowledge page freshness */
export function verifyKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  options?: { id?: string; all?: boolean },
): { id: string; status: 'fresh' | 'stale' | 'unverified'; days_since_verify: number }[] {
  const pages = options?.id
    ? [getKnowledgePage(projectRoot, config, options.id)].filter(Boolean) as KnowledgePage[]
    : listKnowledgePages(projectRoot, config);

  const results: { id: string; status: 'fresh' | 'stale' | 'unverified'; days_since_verify: number }[] = [];
  const now = new Date();
  const warnDays = config.knowledge.freshness.warn_after_days;
  const errorDays = config.knowledge.freshness.error_after_days;

  for (const page of pages) {
    const verifiedAt = page.frontmatter.verified_at || page.frontmatter.created_at;
    const verifyDate = new Date(verifiedAt);
    const daysSince = Math.floor((now.getTime() - verifyDate.getTime()) / (1000 * 60 * 60 * 24));

    let status: 'fresh' | 'stale' | 'unverified' = 'fresh';
    if (daysSince > errorDays) {
      status = 'unverified';
    } else if (daysSince > warnDays) {
      status = 'stale';
    }

    results.push({ id: page.frontmatter.id, status, days_since_verify: daysSince });
  }

  return results;
}

/** List stale knowledge pages */
export function listStalePages(
  projectRoot: string,
  config: MumuSpecConfig,
): { id: string; title: string; status: string; days: number }[] {
  const results = verifyKnowledge(projectRoot, config, { all: true });
  const pages = listKnowledgePages(projectRoot, config);

  return results
    .filter((r) => r.status !== 'fresh')
    .map((r) => {
      const page = pages.find((p) => p.frontmatter.id === r.id);
      return {
        id: r.id,
        title: page?.frontmatter.title || r.id,
        status: r.status,
        days: r.days_since_verify,
      };
    });
}

/** Supersede a knowledge page */
export function supersedeKnowledge(
  projectRoot: string,
  config: MumuSpecConfig,
  oldId: string,
  newId: string,
): void {
  const oldPage = getKnowledgePage(projectRoot, config, oldId);
  const newPage = getKnowledgePage(projectRoot, config, newId);

  if (!oldPage) throw new Error(`Knowledge page not found: ${oldId}`);
  if (!newPage) throw new Error(`Knowledge page not found: ${newId}`);

  // Update old page status
  const updatedFrontmatter: KnowledgePageFrontmatter = {
    ...oldPage.frontmatter,
    status: 'superseded',
    superseded_by: newId,
  };

  const content = createFrontmatter(updatedFrontmatter as unknown as Record<string, unknown>) + oldPage.content;
  writeText(oldPage.path, content);

  // Update new page
  const newFrontmatter: KnowledgePageFrontmatter = {
    ...newPage.frontmatter,
    supersedes: oldId,
  };
  const newContent = createFrontmatter(newFrontmatter as unknown as Record<string, unknown>) + newPage.content;
  writeText(newPage.path, newContent);

  // Update PageIndex
  updatePageIndex(projectRoot, config);
}

/** Load or build PageIndex */
export function loadPageIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): PageIndex {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const indexPath = join(knowledgeDir, '_index.yaml');

  const existing = readYaml<PageIndex>(indexPath);
  if (existing) return existing;

  // Build from scratch
  return rebuildPageIndex(projectRoot, config);
}

/** Rebuild PageIndex from actual files */
export function rebuildPageIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): PageIndex {
  const pages = listKnowledgePages(projectRoot, config);
  const entries: PageIndexEntry[] = pages.map((p) => ({
    id: p.frontmatter.id,
    title: p.frontmatter.title,
    type: p.frontmatter.type,
    status: p.frontmatter.status,
    scope: p.frontmatter.scope,
    file: p.path.replace(projectRoot + '/', '').replace(projectRoot + '\\', ''),
    tags: p.frontmatter.tags || [],
    verified_at: p.frontmatter.verified_at,
  }));

  const index: PageIndex = { pages: entries };

  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const indexPath = join(knowledgeDir, '_index.yaml');
  writeYaml(indexPath, index);

  // Also update reverse index
  rebuildReverseIndex(projectRoot, config);

  return index;
}

/** Build reverse index (code node -> knowledge pages) */
export function rebuildReverseIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): void {
  const pages = listKnowledgePages(projectRoot, config);
  const reverseMap = new Map<string, string[]>();

  for (const page of pages) {
    if (page.frontmatter.graph_bindings) {
      for (const node of page.frontmatter.graph_bindings) {
        if (!reverseMap.has(node)) {
          reverseMap.set(node, []);
        }
        reverseMap.get(node)!.push(page.frontmatter.id);
      }
    }
  }

  const reverseIndex = Array.from(reverseMap.entries()).map(([code_node, knowledge_pages]) => ({
    code_node,
    knowledge_pages,
  }));

  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const reversePath = join(knowledgeDir, '_reverse-index.yaml');
  writeYaml(reversePath, reverseIndex);
}

/** Update PageIndex (incremental) */
export function updatePageIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): void {
  rebuildPageIndex(projectRoot, config);
}
