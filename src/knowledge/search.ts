/**
 * Knowledge full-text search — zero-dependency search with relevance scoring.
 *
 * Implements keyword-based search against knowledge pages using only Node.js
 * built-in modules. No SQLite/external deps required.
 *
 * Scoring weights:
 * - Title match: 10 points per keyword
 * - Tag match: 5 points per keyword
 * - Content match: 2 points per keyword occurrence
 * - Status bonus: +3 for 'confirmed'
 *
 * Note: Named `knowledgeSearch` to avoid conflict with `searchKnowledge` in pages.ts
 */

import { join } from 'node:path';
import type {
  KnowledgePage,
  PageIndexEntry,
  KnowledgeSearchResult,
} from '../core/types.js';
import type { MumuSpecConfig } from '../core/config.js';
import { readText } from '../core/utils.js';
import { loadPageIndex } from './index.js';

// ========== Tokenization ==========

/** Tokenize query into search keywords (handles Chinese + English) */
function tokenize(query: string): string[] {
  const cleaned = query.trim().toLowerCase();
  if (!cleaned) return [];

  // Split on whitespace and punctuation, but keep CJK characters as individual tokens
  const tokens: string[] = [];
  let current = '';

  for (const char of cleaned) {
    if (/[\s,;:!?.()[\]{}'"`~@#$%^&*+=|\\/<>—–-]/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else if (/[一-鿿]/.test(char)) {
      // CJK character: flush current and add as individual token
      if (current) {
        tokens.push(current);
        current = '';
      }
      tokens.push(char);
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);

  return tokens;
}

// ========== Scoring ==========

/** Score a single page against search tokens */
function scorePage(
  page: KnowledgePage,
  content: string,
  tokens: string[],
): { score: number; matchedFields: string[]; excerpt: string } {
  let score = 0;
  const matchedFields: string[] = [];
  const title = (page.frontmatter.title || '').toLowerCase();
  const tags = (page.frontmatter.tags || []).map((t) => t.toLowerCase());

  // Title match (10 pts per token)
  let titleMatched = false;
  for (const token of tokens) {
    if (title.includes(token)) {
      score += 10;
      titleMatched = true;
    }
  }
  if (titleMatched) matchedFields.push('title');

  // Tag match (5 pts per token)
  let tagMatched = false;
  for (const token of tokens) {
    for (const tag of tags) {
      if (token.length >= 2 && tag.includes(token)) {
        score += 5;
        tagMatched = true;
        break;
      }
    }
  }
  if (tagMatched) matchedFields.push('tags');

  // Content match (2 pts per occurrence, capped at 20)
  let contentScore = 0;
  const contentLower = content.toLowerCase();
  for (const token of tokens) {
    if (token.length < 2) continue; // skip single chars for content
    let idx = contentLower.indexOf(token);
    while (idx !== -1) {
      contentScore += 2;
      idx = contentLower.indexOf(token, idx + 1);
      if (contentScore >= 20) break;
    }
  }
  if (contentScore > 0) {
    score += Math.min(contentScore, 20);
    matchedFields.push('content');
  }

  // Status bonus only when there were actual matches
  if (score > 0 && page.frontmatter.status === 'confirmed') score += 3;

  // Generate excerpt (first 120 chars around first match)
  const excerpt = generateExcerpt(contentLower, tokens, content);

  return { score, matchedFields, excerpt };
}

/** Generate excerpt around first keyword match */
function generateExcerpt(
  contentLower: string,
  tokens: string[],
  originalContent: string,
): string {
  let firstMatchIdx = -1;
  for (const token of tokens) {
    if (token.length < 2) continue;
    const idx = contentLower.indexOf(token);
    if (idx !== -1 && (firstMatchIdx === -1 || idx < firstMatchIdx)) {
      firstMatchIdx = idx;
    }
  }

  if (firstMatchIdx === -1) {
    // No match found; return first 120 chars
    return originalContent.slice(0, 120).replace(/\n/g, ' ').trim() + '...';
  }

  const start = Math.max(0, firstMatchIdx - 40);
  const end = Math.min(originalContent.length, firstMatchIdx + 80);
  let excerpt = originalContent.slice(start, end).replace(/\n/g, ' ').trim();
  if (start > 0) excerpt = '...' + excerpt;
  if (end < originalContent.length) excerpt += '...';
  return excerpt;
}

// ========== Public API ==========

export interface SearchOptions {
  /** Filter by knowledge type */
  type?: string[];
  /** Filter by scope (substring match) */
  scope?: string;
  /** Filter by status */
  status?: string[];
  /** Filter by tags (substring match, OR logic) */
  tags?: string[];
  /** Filter by code graph node binding */
  graphNode?: string;
  /** Maximum results to return */
  limit?: number;
}

/**
 * Search knowledge pages by keyword with relevance scoring.
 * Returns results sorted by score descending.
 */
export function knowledgeSearch(
  projectRoot: string,
  config: MumuSpecConfig,
  query: string,
  options: SearchOptions = {},
): KnowledgeSearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // Load index for quick filtering before loading full content
  const pageIndex = loadPageIndex(projectRoot, config);

  let candidates = pageIndex.pages;

  // Apply filters
  if (options.type && options.type.length > 0) {
    candidates = candidates.filter((e) => options.type!.includes(e.type));
  }
  if (options.scope) {
    candidates = candidates.filter((e) => e.scope.includes(options.scope!));
  }
  if (options.status && options.status.length > 0) {
    candidates = candidates.filter((e) => options.status!.includes(e.status));
  }
  if (options.tags && options.tags.length > 0) {
    candidates = candidates.filter((e) =>
      options.tags!.some((tag) => e.tags.some((t) => t.includes(tag))),
    );
  }
  if (options.graphNode) {
    candidates = candidates.filter((e) =>
      e.file.includes(options.graphNode!),
    );
  }

  // Load full page content for scoring
  const results: KnowledgeSearchResult[] = [];

  for (const entry of candidates) {
    const filePath = join(projectRoot, entry.file);
    const fullContent = readText(filePath);
    if (!fullContent) continue;

    // Parse frontmatter + body
    const parts = splitFrontmatter(fullContent);
    if (!parts) continue;

    const page: KnowledgePage = {
      path: entry.file,
      frontmatter: parts.frontmatter as unknown as KnowledgePage['frontmatter'],
      content: parts.body,
    };

    const { score, matchedFields, excerpt } = scorePage(page, parts.body, tokens);

    if (score > 0) {
      results.push({ entry, score, matchedFields, excerpt });
    }
  }

  // Sort by score desc, then by title asc for stability
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.title.localeCompare(b.entry.title);
  });

  const limit = options.limit ?? 20;
  return results.slice(0, limit);
}

/** Separate frontmatter and body from raw markdown */
function splitFrontmatter(
  content: string,
): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  return {
    frontmatter: parseSimpleYaml(match[1]),
    body: match[2].trim(),
  };
}

/** Minimal YAML parser for frontmatter scoring (avoids importing yaml lib in search path) */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of yaml.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');

    // Handle arrays in simple form: [a, b, c]
    if (value.startsWith('[') && value.endsWith(']')) {
      result[key] = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Quick keyword search — returns matching entry IDs for autocomplete/highlight.
 * Lighter weight than knowledgeSearch (no excerpt generation, no content load).
 */
export function quickKnowledgeSearch(
  projectRoot: string,
  config: MumuSpecConfig,
  keyword: string,
): string[] {
  const tokens = tokenize(keyword);
  if (tokens.length === 0) return [];

  const pageIndex = loadPageIndex(projectRoot, config);
  const matched: string[] = [];

  for (const entry of pageIndex.pages) {
    const haystack = `${entry.title} ${entry.tags.join(' ')} ${entry.type} ${entry.scope}`.toLowerCase();
    if (tokens.every((t) => haystack.includes(t))) {
      matched.push(entry.id);
    }
  }

  return matched;
}

/**
 * List all knowledge entries matching filters without keyword search.
 * Useful for building candidate sets for export/import.
 */
export function filterKnowledgeEntries(
  projectRoot: string,
  config: MumuSpecConfig,
  options: SearchOptions,
): PageIndexEntry[] {
  const pageIndex = loadPageIndex(projectRoot, config);
  let candidates = pageIndex.pages;

  if (options.type && options.type.length > 0) {
    candidates = candidates.filter((e) => options.type!.includes(e.type));
  }
  if (options.scope) {
    candidates = candidates.filter((e) => e.scope.includes(options.scope!));
  }
  if (options.status && options.status.length > 0) {
    candidates = candidates.filter((e) => options.status!.includes(e.status));
  }
  if (options.tags && options.tags.length > 0) {
    candidates = candidates.filter((e) =>
      options.tags!.some((tag) => e.tags.some((t) => t.includes(tag))),
    );
  }
  if (options.limit) {
    candidates = candidates.slice(0, options.limit);
  }

  return candidates;
}
