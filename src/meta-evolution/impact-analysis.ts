/**
 * Impact Analysis Engine (R-0005).
 *
 * Pre-apply analysis that enumerates:
 * - Files that will be modified
 * - Constraint entries that will be changed
 * - Knowledge pages that will be adjusted
 * - Goal Preservation anchors that block modification
 *
 * ponytail: read-only analysis; actual modification is in the apply path.
 */

import type { EvolutionReport } from './types.js';
import type { KnowledgeEvolutionAction } from './types.js';

/** Result of impact analysis. */
export interface ImpactAnalysis {
  /** Constraint ids that will be optimized */
  affectedConstraints: string[];
  /** Knowledge pages that will have freshness adjusted */
  affectedKnowledgePages: string[];
  /** Constraint ids that are protected (cannot be modified) */
  protectedAnchors: string[];
  /** Relative file paths that will be touched */
  affectedFiles: string[];
  /** Whether user confirmation is required */
  requiresConfirmation: boolean;
  /** Human-readable summary */
  summary: string;
}

/** Goal Preservation — these constraint ids can never be auto-modified. */
export const PRESERVATION_ANCHORS = [
  'E-GUARD-003',   // SHALL NOT violation — CI invariant
  'E-CHANGE-007',  // decisions.md hash — audit integrity
  'E-CHANGE-006',  // Phase transition — workflow control
];

/**
 * Build an impact analysis for applying an evolution report.
 *
 * Separates impacted constraints into modifiable vs protected,
 * lists affected files, and generates a summary.
 *
 * @param report - evolution report from scoring
 * @param knowledgeActions - knowledge layer evolution actions
 * @returns impact analysis result
 */
export function analyzeImpact(
  report: EvolutionReport,
  knowledgeActions: KnowledgeEvolutionAction[] = [],
): ImpactAnalysis {
  // Determine which low-performing constraints are modifiable
  const affectedConstraints: string[] = [];
  const protectedAnchors: string[] = [];

  for (const id of report.lowPerformingIds) {
    if (PRESERVATION_ANCHORS.includes(id)) {
      protectedAnchors.push(id);
    } else {
      affectedConstraints.push(id);
    }
  }

  // Also add any protected anchors that were in the original report scores
  for (const s of report.scores) {
    if (PRESERVATION_ANCHORS.includes(s.constraintId) && !protectedAnchors.includes(s.constraintId)) {
      protectedAnchors.push(s.constraintId);
    }
  }

  const affectedKnowledgePages = knowledgeActions.map((a) => a.pageId);

  // Files that would be touched
  const affectedFiles = new Set<string>();
  if (affectedConstraints.length > 0) {
    affectedFiles.add('.mumuspec/constraints.yaml');
    affectedFiles.add('.mumuspec/evolution/stats.jsonl');
  }
  if (protectedAnchors.length > 0) {
    // These would be blocked — still listed for transparency
    affectedFiles.add('.mumuspec/evolution/impact-log.jsonl');
  }
  for (const _pageId of affectedKnowledgePages) {
    affectedFiles.add('.mumuspec/knowledge/');
    affectedFiles.add('.mumuspec/knowledge/_index.yaml');
  }

  // Summary
  const parts: string[] = [];
  if (affectedConstraints.length > 0) {
    parts.push(`${affectedConstraints.length} constraint(s) will be optimized`);
  }
  if (protectedAnchors.length > 0) {
    parts.push(`${protectedAnchors.length} constraint(s) are protected (Goal Preservation)`);
  }
  if (affectedKnowledgePages.length > 0) {
    parts.push(`${affectedKnowledgePages.length} knowledge page(s) will be adjusted`);
  }

  const summary = parts.length > 0
    ? parts.join('; ') + '.'
    : 'No changes needed.';

  return {
    affectedConstraints,
    affectedKnowledgePages,
    protectedAnchors,
    affectedFiles: [...affectedFiles],
    requiresConfirmation: affectedConstraints.length > 0 || affectedKnowledgePages.length > 0,
    summary,
  };
}

/**
 * Format impact analysis as human-readable text for CLI display.
 */
export function formatImpactAnalysis(analysis: ImpactAnalysis): string {
  const lines: string[] = [];
  lines.push('Impact Analysis');
  lines.push('──────────────────────────────────────');

  if (analysis.affectedConstraints.length > 0) {
    lines.push('Entries to modify:');
    for (const id of analysis.affectedConstraints) {
      lines.push(`  • ${id}`);
    }
  }

  if (analysis.protectedAnchors.length > 0) {
    lines.push('Protected (Goal Preservation):');
    for (const id of analysis.protectedAnchors) {
      lines.push(`  🛡 ${id} — cannot be modified`);
    }
  }

  if (analysis.affectedKnowledgePages.length > 0) {
    lines.push('Knowledge pages to adjust:');
    for (const id of analysis.affectedKnowledgePages) {
      lines.push(`  • ${id}`);
    }
  }

  if (analysis.affectedFiles.length > 0) {
    lines.push('Files touched:');
    for (const f of analysis.affectedFiles) {
      lines.push(`  📁 ${f}`);
    }
  }

  lines.push('');
  lines.push(`Summary: ${analysis.summary}`);
  if (analysis.requiresConfirmation) {
    lines.push('Confirmation required to proceed.');
  }

  return lines.join('\n');
}
