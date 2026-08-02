/**
 * QA keyword scoring + ranking.
 * ponytail: 用标准字符串 includes (L3 平台原生)，不加 NLP 库。
 */

import type { KnowledgeItem } from '@/types/qa';

export function scoreQuery(query: string, item: KnowledgeItem): number {
  if (!query.trim()) return 0;
  const q = query.toLowerCase();
  let score = 0;
  if (item.title.toLowerCase().includes(q)) score += 3;
  if (item.body.toLowerCase().includes(q)) score += 2;
  for (const tag of item.tags) {
    if (tag.toLowerCase().includes(q)) score += 4;
    if (q.includes(tag.toLowerCase())) score += 1;
  }
  return score;
}

export function rankResults(query: string, items: KnowledgeItem[]) {
  return items
    .map((item) => ({ item, score: scoreQuery(query, item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
