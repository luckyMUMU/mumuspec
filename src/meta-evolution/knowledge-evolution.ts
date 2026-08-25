/**
 * Knowledge Layer Meta-Evolution (R0) — R-0005.
 *
 * Analyzes knowledge page usage patterns and recommends freshness adjustments.
 *
 * Signals:
 * - promote_freshness: page referenced frequently → bump freshness
 * - demote_freshness: page stale and rarely referenced → archive candidate
 * - refresh_page_index: page drifted from index metadata
 *
 * ponytail: rules-based approach; ML-based optimization deferred to R4.
 */

import type { KnowledgeEvolutionAction } from './types.js';

/** Threshold counts for evolution decisions. */
interface FreshnessThresholds {
  /** Minimum references in window to consider promoting */
  promoteRefs: number;
  /** Days without reference before demoting */
  demoteDays: number;
}

const DEFAULT_THRESHOLDS: FreshnessThresholds = {
  promoteRefs: 5,
  demoteDays: 30,
};

/** Knowledge page reference info (simplified from index). */
interface PageRefInfo {
  pageId: string;
  currentFreshness: string;
  lastReferenced?: string;
  referenceCount: number;
}

/**
 * Analyze a knowledge page and recommend freshness evolution action.
 *
 * @param page - page reference info
 * @param thresholds - optional overrides
 * @returns recommended action, or null if no change needed
 */
export function analyzeFreshness(
  page: PageRefInfo,
  thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS,
): KnowledgeEvolutionAction | null {
  const now = new Date();
  const lastRef = page.lastReferenced ? new Date(page.lastReferenced) : null;
  const daysSinceRef = lastRef
    ? Math.floor((now.getTime() - lastRef.getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  // High activity → promote
  if (page.referenceCount >= thresholds.promoteRefs && page.currentFreshness !== 'active') {
    return {
      pageId: page.pageId,
      action: 'promote_freshness',
      reason: `referenced ${page.referenceCount} times in window`,
      previousValue: page.currentFreshness,
      newValue: 'active',
    };
  }

  // Stale and unused → demote
  if (daysSinceRef > thresholds.demoteDays && page.referenceCount === 0 && page.currentFreshness !== 'aging') {
    return {
      pageId: page.pageId,
      action: 'demote_freshness',
      reason: `unused for ${daysSinceRef} days`,
      previousValue: page.currentFreshness,
      newValue: 'aging',
    };
  }

  return null;
}

/**
 * Batch analyze multiple pages.
 */
export function analyzeAllFreshness(
  pages: PageRefInfo[],
  thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS,
): KnowledgeEvolutionAction[] {
  return pages
    .map((p) => analyzeFreshness(p, thresholds))
    .filter((a): a is KnowledgeEvolutionAction => a !== null);
}

/**
 * Produce a page index refresh action.
 *
 * Used when page frontmatter drifted from what the PageIndex records.
 */
export function refreshPageIndex(pageId: string): KnowledgeEvolutionAction {
  return {
    pageId,
    action: 'refresh_page_index',
    reason: 'page frontmatter drifted from index metadata',
    previousValue: 'stale_index',
    newValue: 'refreshed',
  };
}
