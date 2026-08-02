/**
 * Knowledge freshness — verify freshness, list stale pages, supersede outdated entries.
 */
import type {
  KnowledgePage,
  KnowledgePageFrontmatter,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { writeText, createFrontmatter } from '../core/utils.js';
import { getKnowledgePage, listKnowledgePages } from './pages.js';
import { updatePageIndex } from './index.js';

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

  const updatedFrontmatter: KnowledgePageFrontmatter = {
    ...oldPage.frontmatter,
    status: 'superseded',
    superseded_by: newId,
  };

  const content = createFrontmatter(updatedFrontmatter as unknown as Record<string, unknown>) + oldPage.content;
  writeText(oldPage.path, content);

  const newFrontmatter: KnowledgePageFrontmatter = {
    ...newPage.frontmatter,
    supersedes: oldId,
  };
  const newContent = createFrontmatter(newFrontmatter as unknown as Record<string, unknown>) + newPage.content;
  writeText(newPage.path, newContent);

  updatePageIndex(projectRoot, config);
}
