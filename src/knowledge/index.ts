/**
 * PageIndex — index loading, rebuilding, and reverse-lookup.
 */
import { join } from 'node:path';
import type {
  PageIndex,
  PageIndexEntry,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readYaml, writeYaml } from '../core/utils.js';
import { getKnowledgeDir, listKnowledgePages } from './pages.js';

/** Load or build PageIndex */
export function loadPageIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): PageIndex {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const indexPath = join(knowledgeDir, '_index.yaml');

  const existing = readYaml<PageIndex>(indexPath);
  if (existing) return existing;

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
    const bindings = page.frontmatter.graph_bindings;
    if (bindings && Array.isArray(bindings)) {
      for (const node of bindings) {
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

/** Read reverse index from disk */
export function readReverseIndex(
  projectRoot: string,
  config: MumuSpecConfig,
): Array<{ code_node: string; knowledge_pages: string[] }> {
  const knowledgeDir = getKnowledgeDir(projectRoot, config);
  const reversePath = join(knowledgeDir, config.knowledge.reverse_index.file);
  try {
    const entries = readYaml<Array<{ code_node: string; knowledge_pages: string[] }>>(reversePath) ?? [];
    // Tolerate malformed entries (hand-edited or legacy data): the index is a
    // rebuildable derived cache, so non-string code_node rows are skipped
    // rather than crashing downstream `.includes` calls.
    return entries.filter(
      (entry) => entry && typeof entry.code_node === 'string' && Array.isArray(entry.knowledge_pages),
    );
  } catch {
    return [];
  }
}
