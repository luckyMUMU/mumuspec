/**
 * Blocking Point Advisor — LLM Freedom Enhancement (P1)
 *
 * When a blocking point fires, the advisor generates 2-3 resolution options
 * with analysis, letting the user choose or the system auto-resolve within L2 rules.
 */

import type {
  BPOption,
  BPRecommendation,
} from './types-workflow.js';

/** Context available to BP advisors */
export interface BPContext {
  /** Current phase */
  phase: string;
  /** Change name */
  changeName: string;
  /** Change dist_spec info */
  hasDistSpec: boolean;
  /** Completion status of related phases */
  designComplete: boolean;
  buildLayersComplete: boolean;
}

/** BP Advisor function signature */
export type BPAdvisorFn = (ctx: BPContext) => BPRecommendation;

/**
 * Generic advisor: creates a BPRecommendation from options.
 */
function makeRecommendation(
  bp_id: string,
  analysis: string,
  options: BPOption[],
): BPRecommendation {
  const recommended = options.find((o) => o.recommended) ?? options[0];
  return {
    bp_id,
    analysis,
    options,
    recommended_option_id: recommended.id,
  };
}

// ════════════════════════════════════════════════════════════════════
// BP-1: Spec inheritance integrity
// ════════════════════════════════════════════════════════════════════

export const bp1Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-1',
    `Change "${ctx.changeName}" has not verified spec inheritance integrity.\nThe spec from parent might be stale or drifted.`,
    [
      {
        id: 're-validate',
        title: 'Re-run spec validation',
        description: 'Run `mumuspec validate` to check all spec files for drift and errors.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'low',
      },
      {
        id: 'skip-if-stale',
        title: 'Document as accepted deviation',
        description: 'Mark spec issue as accepted deviation and continue.',
        recommended: false,
        risk: 'medium',
        estimated_effort: 'low',
      },
      {
        id: 'sync-specs',
        title: 'Run sync-specs to auto-fix',
        description: 'Use `mumuspec sync-specs --fix` to resolve missing frontmatter/format issues.',
        recommended: false,
        risk: 'low',
        estimated_effort: 'low',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// BP-4: Design missing
// ════════════════════════════════════════════════════════════════════

export const bp4Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-4',
    `Change "${ctx.changeName}" requires design.md before building.\nDesign phase has not been completed.`,
    [
      {
        id: 'create-design',
        title: 'Create design.md',
        description: 'Create design.md with architecture decisions, trade-offs, and module structure.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'medium',
      },
      {
        id: 'use-tweak',
        title: 'Switch to tweak preset (skip Design)',
        description: 'For small changes, switch to tweak workflow which does not require full Design phase.',
        recommended: false,
        risk: 'medium',
        estimated_effort: 'low',
      },
      {
        id: 'import-design',
        title: 'Import design from existing spec',
        description: 'Generate design.md from using spec.md content as baseline.',
        recommended: false,
        risk: 'low',
        estimated_effort: 'low',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// BP-9: No test-first approach (TDD violation)
// ════════════════════════════════════════════════════════════════════

export const bp9Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-9',
    `Change "${ctx.changeName}" has not followed test-first approach.\nRED tests should be written before GREEN implementation.`,
    [
      {
        id: 'write-red-first',
        title: 'Write RED tests first',
        description: 'Create failing tests that specify expected behavior, then implement.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'medium',
      },
      {
        id: 'doc-only-exception',
        title: 'Claim doc-only exception',
        description: 'If change is documentation-only (no code logic), TDD is not required.',
        recommended: false,
        risk: 'low',
        estimated_effort: 'low',
      },
      {
        id: 'add-retrofit-tests',
        title: 'Add tests retroactively',
        description: `Add tests after implementation. Note: this is a deviation from TDD process.`,
        recommended: false,
        risk: 'medium',
        estimated_effort: 'medium',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// BP-2: PRD 拆分决策
// ════════════════════════════════════════════════════════════════════

export const bp2Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-2',
    `Change "${ctx.changeName}" requires PRD scope decision.\nMultiple features detected — should this be one change or split?`,
    [
      {
        id: 'split-changes',
        title: 'Split into multiple changes',
        description: 'Create separate changes for each feature, each with its own proposal and scope.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'medium',
      },
      {
        id: 'single-change',
        title: 'Keep as single change',
        description: 'Proceed with one change if features are tightly coupled and cannot be independently delivered.',
        recommended: false,
        risk: 'medium',
        estimated_effort: 'low',
      },
      {
        id: 'merge-specs',
        title: 'Merge into parent scope',
        description: 'If the change spans multiple modules, create at parent scope with affected_scopes listing.',
        recommended: false,
        risk: 'low',
        estimated_effort: 'low',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// BP-3: 工件审查与确认
// ════════════════════════════════════════════════════════════════════

export const bp3Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-3',
    `Change "${ctx.changeName}" has artifacts ready for review.\nAll required documents should be confirmed complete before proceeding.`,
    [
      {
        id: 'review-artifacts',
        title: 'Review artifacts now',
        description: 'Walk through proposal.md, design.md, delta-specs/ to confirm completeness.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'medium',
      },
      {
        id: 'defer-review',
        title: 'Defer to verify phase',
        description: 'Skip formal review now; artifacts will be validated during Verify phase.',
        recommended: false,
        risk: 'medium',
        estimated_effort: 'low',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// BP-10: 工作区隔离 + 执行方式选择
// ════════════════════════════════════════════════════════════════════

export const bp10Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-10',
    `Change "${ctx.changeName}" requires execution mode decision.\nWorkspace isolation and TDD mode must be configured before building.`,
    [
      {
        id: 'worktree-tdd',
        title: 'Worktree isolation + TDD mode',
        description: 'Use git worktree for clean isolation. RED → GREEN → Refactor cycle.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'medium',
      },
      {
        id: 'branch-tdd',
        title: 'Branch isolation + TDD mode',
        description: 'Use feature branch in current workdir. Faster setup, but no isolation from main.',
        recommended: false,
        risk: 'medium',
        estimated_effort: 'low',
      },
      {
        id: 'skip-tdd',
        title: 'Skip TDD (hotfix only)',
        description: 'For hotfixes with confirmed root cause, write verification test after fix.',
        recommended: false,
        risk: 'high',
        estimated_effort: 'low',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// BP-14: 验证失败决策
// ════════════════════════════════════════════════════════════════════

export const bp14Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-14',
    `Change "${ctx.changeName}" has verification failures.\nTests are failing or acceptance criteria not met.`,
    [
      {
        id: 'fix-and-retry',
        title: 'Fix implementation and retry',
        description: 'Return to build phase, address root cause, re-run tests.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'medium',
      },
      {
        id: 'accept-deviation',
        title: 'Accept as deviation',
        description: 'Document failure as accepted deviation with remediation plan.',
        recommended: false,
        risk: 'high',
        estimated_effort: 'low',
      },
      {
        id: 'adjust-criteria',
        title: 'Adjust acceptance criteria',
        description: 'If spec was unrealistic, update spec and re-verify.',
        recommended: false,
        risk: 'medium',
        estimated_effort: 'medium',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// BP-17: 归档最终确认
// ════════════════════════════════════════════════════════════════════

export const bp17Advisor: BPAdvisorFn = (ctx) =>
  makeRecommendation(
    'BP-17',
    `Change "${ctx.changeName}" is ready for archive.\nFinal confirmation before moving to archive/.`,
    [
      {
        id: 'confirm-archive',
        title: 'Confirm and archive',
        description: 'All checks passed. Move to archive/ and complete the change lifecycle.',
        recommended: true,
        risk: 'low',
        estimated_effort: 'low',
      },
      {
        id: 'extract-knowledge',
        title: 'Archive with knowledge extraction',
        description: 'Archive and auto-extract knowledge pages from cognitive-map and decisions.',
        recommended: false,
        risk: 'low',
        estimated_effort: 'medium',
      },
      {
        id: 'defer-archive',
        title: 'Defer archive',
        description: 'Hold in archive-in-progress for additional verification or documentation.',
        recommended: false,
        risk: 'low',
        estimated_effort: 'low',
      },
    ],
  );

// ════════════════════════════════════════════════════════════════════
// Advisor Registry
// ════════════════════════════════════════════════════════════════════

const ADVISOR_REGISTRY: Record<string, BPAdvisorFn> = {
  'BP-1': bp1Advisor,
  'BP-2': bp2Advisor,
  'BP-3': bp3Advisor,
  'BP-4': bp4Advisor,
  'BP-9': bp9Advisor,
  'BP-10': bp10Advisor,
  'BP-14': bp14Advisor,
  'BP-17': bp17Advisor,
};

/**
 * Get a BP advisor by ID. Returns a generic fallback if none registered.
 */
export function getBPAdvisor(bp_id: string): BPAdvisorFn {
  return ADVISOR_REGISTRY[bp_id] ?? fallbackAdvisor(bp_id);
}

function fallbackAdvisor(bp_id: string): BPAdvisorFn {
  return (ctx) =>
    makeRecommendation(
      bp_id,
      `Blocking point ${bp_id} triggered for change "${ctx.changeName}".`,
      [
        {
          id: 'resolve-manually',
          title: 'Resolve manually',
          description: `Address ${bp_id} according to its original guard documentation.`,
          recommended: true,
          risk: 'medium',
          estimated_effort: 'medium',
        },
        {
          id: 'escalate',
          title: 'Escalate to user',
          description: 'Pause and defer the decision to the user.',
          recommended: false,
          risk: 'low',
          estimated_effort: 'low',
        },
      ],
    );
}

/**
 * Format a BP recommendation for display.
 */
export function formatBPRecommendation(rec: BPRecommendation): string {
  const lines: string[] = [];
  lines.push(`## ${rec.bp_id}`);
  lines.push('');
  lines.push('### Analysis');
  lines.push(rec.analysis);
  lines.push('');
  lines.push('### Options');
  lines.push('');
  for (const opt of rec.options) {
    const marker = opt.recommended ? ' **[Recommended]**' : '';
    lines.push(
      `${opt.id}. **${opt.title}**${marker}\n   ${opt.description}\n   Risk: ${opt.risk} | Effort: ${opt.estimated_effort}`,
    );
  }
  return lines.join('\n');
}
