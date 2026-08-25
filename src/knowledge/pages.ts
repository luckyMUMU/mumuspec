/**
 * Knowledge pages — CRUD operations for knowledge base pages.
 */
import { existsSync, readdirSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type {
  KnowledgePage,
  KnowledgePageFrontmatter,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readText, writeText, parseFrontmatter, createFrontmatter, now } from '../core/utils.js';
import { updatePageIndex } from './index.js';

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
  const typeDirs = ['decisions', 'patterns', 'risks', 'rationales', 'lessons', 'imports'];
  for (const typeDir of typeDirs) {
    const dirPath = join(knowledgeDir, typeDir);
    if (!existsSync(dirPath)) continue;

    const files = readdirSync(dirPath).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = join(dirPath, file);
      const page = loadKnowledgePage(filePath);
      if (page) {
        if (options?.type && page.frontmatter.type !== options.type) continue;
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

  const relPath = targetPath.replace(projectRoot, '').replace(/^[\\/]/, '');
  const scopedPages = pages.filter((p) => {
    const scope = p.frontmatter.scope;
    if (scope === '.' || scope === '') return true;
    return relPath.startsWith(scope) || scope === relPath;
  });

  scopedPages.sort((a, b) => {
    const aTime = a.frontmatter.verified_at || a.frontmatter.created_at;
    const bTime = b.frontmatter.verified_at || b.frontmatter.created_at;
    return bTime.localeCompare(aTime);
  });

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

  updatePageIndex(projectRoot, config);

  return filePath;
}
