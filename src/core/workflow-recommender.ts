/**
 * Workflow Recommender — LLM Freedom Enhancement (P0)
 *
 * Estimates change scope from intent + project context,
 * then recommends the appropriate workflow path (full / tweak / hotfix).
 */

import type {
  ScopeEstimation,
  PathRecommendation,
  RiskTier,
} from './types-workflow.js';

/**
 * Derive the risk tier from a scope estimation.
 */
export function deriveRiskTier(scope: Omit<ScopeEstimation, 'risk_level'>): RiskTier {
  // High risk signals
  if (
    scope.cross_module ||
    scope.new_public_api ||
    scope.data_migration ||
    scope.estimated_files > 10 ||
    scope.modules_affected > 3
  ) {
    return 'high';
  }

  // Medium risk signals
  if (
    scope.new_external_dep ||
    scope.estimated_files > 4 ||
    scope.modules_affected > 1
  ) {
    return 'medium';
  }

  // Default: low risk
  return 'low';
}

/**
 * Build a scope estimation from raw signals.
 * This is the core input for path recommendation.
 */
export function estimateScope(params: {
  estimated_files: number;
  modules_affected: number;
  cross_module: boolean;
  new_public_api: boolean;
  new_external_dep: boolean;
  data_migration: boolean;
  is_doc_only?: boolean;
  is_pure_bugfix?: boolean;
}): ScopeEstimation {
  const scope: ScopeEstimation = {
    estimated_files: params.estimated_files,
    modules_affected: params.modules_affected,
    cross_module: params.cross_module,
    new_public_api: params.new_public_api,
    new_external_dep: params.new_external_dep,
    data_migration: params.data_migration,
    is_doc_only: params.is_doc_only ?? false,
    is_pure_bugfix: params.is_pure_bugfix ?? false,
    risk_level: 'low',
  };

  scope.risk_level = deriveRiskTier(scope);
  return scope;
}

/**
 * Check which safety fence conditions are triggered.
 */
export function checkSafetyFence(scope: ScopeEstimation): {
  blocks: boolean;
  triggers: string[];
} {
  const triggers: string[] = [];

  if (scope.cross_module) triggers.push('cross_module');
  if (scope.new_public_api) triggers.push('new_public_api');
  if (scope.new_external_dep) triggers.push('new_external_dep');
  if (scope.data_migration) triggers.push('data_migration');

  return {
    blocks: triggers.length > 0,
    triggers,
  };
}

/**
 * Recommend the workflow path based on scope estimation.
 *
 * Rules (L1 — Suggestion mode):
 *   - All fence triggers force `full` (no compression allowed)
 *   - is_doc_only → tweak (code-style overrides tests)
 *   - is_pure_bugfix + low risk → hotfix
 *   - risk=high → full
 *   - risk=medium → tweak
 *   - risk=low (simple) → tweak (auto if L2, suggestion if L1)
 */
export function recommendPath(scope: ScopeEstimation): PathRecommendation {
  const fence = checkSafetyFence(scope);

  // Safety fence: never compress if any blocking condition is true
  if (fence.blocks) {
    return {
      path: 'full',
      confidence: 0.95,
      rationale: `Safety fence triggered: ${fence.triggers.join(', ')}. Full workflow required.`,
      safety_fence_blocks: true,
      fence_triggers: fence.triggers,
    };
  }

  // High risk — no compression
  if (scope.risk_level === 'high') {
    return {
      path: 'full',
      confidence: 0.85,
      rationale: `High risk detected (${scope.estimated_files} files, ${scope.modules_affected} modules). Full workflow recommended.`,
      safety_fence_blocks: false,
    };
  }

  // Documentation-only — typically tweak
  if (scope.is_doc_only) {
    return {
      path: 'tweak',
      confidence: 0.9,
      rationale: 'Documentation-only change. Tweak path sufficient.',
      safety_fence_blocks: false,
    };
  }

  // Pure bugfix with root cause confirmed → hotfix
  if (scope.is_pure_bugfix && scope.risk_level === 'low') {
    return {
      path: 'hotfix',
      confidence: 0.8,
      rationale: 'Pure bugfix with confirmed root cause and low risk. Hotfix path appropriate.',
      safety_fence_blocks: false,
    };
  }

  // Medium risk → tweak
  if (scope.risk_level === 'medium') {
    return {
      path: 'tweak',
      confidence: 0.75,
      rationale: 'Medium risk change. Tweak path recommended to skip full Design phase.',
      safety_fence_blocks: false,
    };
  }

  // Low risk simple change → tweak
  if (scope.estimated_files <= 2) {
    return {
      path: 'tweak',
      confidence: 0.85,
      rationale: `Small change (${scope.estimated_files} files, single module). Tweak path sufficient.`,
      safety_fence_blocks: false,
    };
  }

  // Fallback: medium-low with 3-4 files → tweak
  return {
    path: 'tweak',
    confidence: 0.65,
    rationale: 'Moderate change. Tweak path can be used if user confirms.',
    safety_fence_blocks: false,
  };
}

/**
 * Format a recommendation for display in proposal.md.
 */
export function formatRecommendation(rec: PathRecommendation): string {
  const lines: string[] = [];
  lines.push('## Workflow Path Recommendation');
  lines.push('');
  lines.push(`**Recommended Path:** ${rec.path}`);
  lines.push(`**Confidence:** ${Math.round(rec.confidence * 100)}%`);
  lines.push('');
  lines.push('**Rationale:**');
  lines.push(rec.rationale);
  lines.push('');

  if (rec.safety_fence_blocks && rec.fence_triggers) {
    lines.push('**Safety Fence Active:** Compression blocked by:');
    for (const trigger of rec.fence_triggers) {
      lines.push(`- ${trigger}`);
    }
    lines.push('');
  }

  lines.push('> L1 Suggestion mode — awaiting user confirmation before proceeding.');
  return lines.join('\n');
}
