/**
 * Constraint tree resolution — strength validation, scope normalization,
 * inheritance policy, and resolveConstraintTree().
 */
import type {
  ConstraintStrength,
  ConstraintDimension,
  ConstraintEntry,
  ConstraintConflict,
  ConstraintTreeNode,
  ConstraintTreeResolution,
  ConstraintsFile,
} from './types.js';
import type { WorkflowConfig } from './config.js';

// ════════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════════

/** Built-in exception list — always `block` regardless of strength level. */
export const BUILTIN_CONSTRAINT_EXCEPTIONS: ReadonlyArray<string> = [
  'archive_terminal_state',
  'discard_user_confirmation',
  'commit_sha_immutability',
  'sensitive_info_scan',
  'shall_not_violation_in_ci',
  'bp_03_user_confirmation',
  'bp_04_design_confirmation',
  'bp_14_verify_failure',
  'bp_17_archive_confirmation',
] as const;

/** Default mapping from constraint strength level to enforcement action. */
export const STRENGTH_ACTION_MAP: Readonly<
  Record<ConstraintStrength, 'block' | 'warn' | 'info'>
> = {
  high: 'block',
  medium: 'warn',
  low: 'info',
} as const;

/** Dimension → workflow rule mapping (which strength dimension governs each rule). */
export const WORKFLOW_RULE_DIMENSION: Readonly<
  Record<keyof WorkflowConfig, ConstraintDimension>
> = {
  worktree_isolation: 'requirement_goals',
  single_active_change: 'requirement_goals',
  top_down_design: 'technical_design',
  tdd_enforced: 'technical_design',
  max_active_changes: 'requirement_goals',
} as const;

/** Strength-aware workflow relaxation matrix. */
export const WORKFLOW_STRENGTH_MATRIX: Readonly<
  Record<
    ConstraintStrength,
    {
      worktree_isolation: boolean;
      single_active_change: boolean;
      top_down_design: boolean;
      tdd_enforced: boolean;
    }
  >
> = {
  high: {
    worktree_isolation: true,
    single_active_change: true,
    top_down_design: true,
    tdd_enforced: true,
  },
  medium: {
    worktree_isolation: true,
    single_active_change: false,
    top_down_design: false,
    tdd_enforced: true,
  },
  low: {
    worktree_isolation: false,
    single_active_change: false,
    top_down_design: false,
    tdd_enforced: false,
  },
} as const;

// ════════════════════════════════════════════════════════════════════
// Strength validation & ranking
// ════════════════════════════════════════════════════════════════════

const VALID_STRENGTHS: ReadonlySet<ConstraintStrength> = new Set(['high', 'medium', 'low']);

export function isValidStrength(s: unknown): s is ConstraintStrength {
  return typeof s === 'string' && VALID_STRENGTHS.has(s as ConstraintStrength);
}

/** Numeric rank for strength comparison. Higher = stricter. Throws on invalid input. */
export function strengthRank(s: ConstraintStrength): number {
  if (!isValidStrength(s)) {
    throw new Error(
      `strengthRank: invalid strength "${String(s)}" - expected high|medium|low`,
    );
  }
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}

export function safeStrengthRank(_s: unknown, fallback: number = 1): { rank: number; valid: boolean } {
  if (!isValidStrength(_s)) {
    return { rank: fallback, valid: false };
  }
  return { rank: strengthRank(_s), valid: true };
}

// ════════════════════════════════════════════════════════════════════
// Scope normalization
// ════════════════════════════════════════════════════════════════════

/**
 * Normalize a directory scope string to canonical form.
 * - `""` → `"."` (root)
 * - `"./"` → `"."`
 * - `"./src"` → `"src"`
 * - Windows separators → forward slashes
 */
export function normalizeScope(scope: string | undefined): string {
  if (scope === undefined || scope === '' || scope === '.') return '.';
  let normalized = scope.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (normalized.startsWith('./')) normalized = normalized.slice(2);
  if (normalized.startsWith('/')) normalized = normalized.slice(1);
  if (normalized.endsWith('/')) normalized = normalized.slice(0, -1);
  return normalized === '' ? '.' : normalized;
}

// ════════════════════════════════════════════════════════════════════
// Tree-distributed constraint policy
// ════════════════════════════════════════════════════════════════════

export const CONSTRAINT_TREE_POLICY = {
  inheritance: 'full' as const,
  tightening: 'allowed' as const,
  shallAccumulation: 'union' as const,
  shallNotAccumulation: 'union' as const,
  conflictResolution: 'highest_layer_wins' as const,
  crossDimensionPriority: [
    'shall_not_over_shall',
    'rg_shall_not_over_td_shall_not',
    'rg_shall_over_td_shall',
    'high_strength_over_low',
  ] as const,
} as const;

// ════════════════════════════════════════════════════════════════════
// Tightening check
// ════════════════════════════════════════════════════════════════════

/** Check whether `child` is a valid tightening of `parent`. */
export function isTightening(
  parent: ConstraintEntry,
  child: ConstraintEntry,
): { valid: boolean; reason: string } {
  if (parent.id !== child.id) {
    return { valid: false, reason: 'id mismatch — not a tightening candidate' };
  }
  if (strengthRank(child.min_strength) < strengthRank(parent.min_strength)) {
    return {
      valid: false,
      reason: `child min_strength (${child.min_strength}) < parent (${parent.min_strength}) - relaxation disallowed`,
    };
  }
  if (parent.enforcement !== child.enforcement) {
    return {
      valid: false,
      reason: `enforcement differs (parent=${parent.enforcement}, child=${child.enforcement}) - falls back to highest_layer_wins`,
    };
  }
  return { valid: true, reason: 'tightening allowed' };
}

// ════════════════════════════════════════════════════════════════════
// resolveConstraintTree
// ════════════════════════════════════════════════════════════════════

/**
 * Resolve a tree of `ConstraintsFile`s into a `ConstraintTreeResolution`.
 * Pure function — no I/O.
 */
export function resolveConstraintTree(
  files: ConstraintsFile[],
  rootStrength: {
    technical_design: ConstraintStrength;
    requirement_goals: ConstraintStrength;
  },
): ConstraintTreeResolution {
  const conflicts: ConstraintConflict[] = [];
  const warnings: string[] = [];

  if (files.length === 0) {
    const bareRoot: ConstraintTreeNode = {
      layer: 0,
      scope: '.',
      strength: { ...rootStrength },
      forward: { technical_design: [], requirement_goals: [] },
      reverse: { technical_design: [], requirement_goals: [] },
      children: new Map(),
      parent: null,
    };
    return { root: bareRoot, conflicts, warnings };
  }

  // 1. Index files by normalized scope; first wins on duplicate.
  const byScope = new Map<string, ConstraintsFile>();
  for (const f of files) {
    const scope = normalizeScope(f.scope);
    if (byScope.has(scope)) {
      warnings.push(`duplicate constraints.yaml at scope "${scope}" — first wins`);
      continue;
    }
    byScope.set(scope, { ...f, scope });
  }

  const layerOf = (scope: string): number => {
    if (scope === '.') return 0;
    return scope.split('/').filter(Boolean).length;
  };

  const scopes = Array.from(byScope.keys()).sort(
    (a, b) => layerOf(a) - layerOf(b) || a.localeCompare(b),
  );

  const nearestAncestorScope = (scope: string): string | null => {
    if (scope === '.') return null;
    const parts = scope.split('/').filter(Boolean);
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = i === 0 ? '.' : parts.slice(0, i).join('/');
      if (byScope.has(candidate)) return candidate;
    }
    return null;
  };

  const nodes = new Map<string, ConstraintTreeNode>();

  for (const scope of scopes) {
    const file = byScope.get(scope)!;
    const derivedLayer = layerOf(scope);

    if (file.layer !== undefined && file.layer !== derivedLayer) {
      warnings.push(
        `scope="${scope}": declared layer=${file.layer} does not match path depth=${derivedLayer} — using derived layer`,
      );
    }
    const layer = derivedLayer;

    const parentScope = nearestAncestorScope(scope);
    const parent = parentScope ? nodes.get(parentScope) ?? null : null;

    if (parentScope && !parent) {
      warnings.push(
        `scope="${scope}": ancestor scope "${parentScope}" not yet resolved — skipping inheritance`,
      );
    }

    const resolveStrengthDim = (
      dim: 'technical_design' | 'requirement_goals',
    ): ConstraintStrength => {
      const parentVal = parent?.strength[dim] ?? rootStrength[dim];
      const childVal = file.strength?.[dim];
      if (childVal === undefined) return parentVal;
      if (!isValidStrength(childVal)) {
        warnings.push(
          `scope="${scope}" strength.${dim}="${String(childVal)}" is invalid - using parent=${parentVal}`,
        );
        return parentVal;
      }
      const parentRank = strengthRank(parentVal);
      const childRank = strengthRank(childVal);
      if (childRank < parentRank) {
        warnings.push(
          `scope="${scope}" strength.${dim}=${childVal} < parent=${parentVal} - override ignored (relaxation disallowed)`,
        );
        return parentVal;
      }
      return childVal;
    };

    const strength = {
      technical_design: resolveStrengthDim('technical_design'),
      requirement_goals: resolveStrengthDim('requirement_goals'),
    };

    const forwardTd: ConstraintEntry[] = [];
    const forwardRg: ConstraintEntry[] = [];
    const reverseTd: ConstraintEntry[] = [];
    const reverseRg: ConstraintEntry[] = [];

    if (parent) {
      for (const e of parent.forward.technical_design) forwardTd.push({ ...e, inherited: true });
      for (const e of parent.forward.requirement_goals) forwardRg.push({ ...e, inherited: true });
      for (const e of parent.reverse.technical_design) reverseTd.push({ ...e, inherited: true });
      for (const e of parent.reverse.requirement_goals) reverseRg.push({ ...e, inherited: true });
    }

    const merge = (
      bucket: ConstraintEntry[],
      local: ConstraintEntry[],
      direction: 'forward' | 'reverse',
      dim: ConstraintDimension,
    ) => {
      for (const entry of local) {
        if (!isValidStrength(entry.min_strength)) {
          warnings.push(
            `scope="${scope}" id="${entry.id}": invalid min_strength — skipping entry`,
          );
          continue;
        }
        const stamped: ConstraintEntry = { ...entry, layer, scope, inherited: false };
        const existingIdx = bucket.findIndex((e) => e.id === entry.id);
        if (existingIdx === -1) {
          bucket.push(stamped);
        } else {
          const existing = bucket[existingIdx];
          if (existing.inherited === false) {
            conflicts.push({
              id: entry.id,
              dimension: dim,
              direction,
              winner: existing,
              losers: [stamped],
              resolution: 'highest_layer_wins',
            });
            warnings.push(
              `scope="${scope}" id="${entry.id}": duplicate declaration — first entry retained`,
            );
            continue;
          }
          const { valid, reason } = isTightening(existing, stamped);
          if (valid) {
            bucket[existingIdx] = {
              ...stamped,
              tightens: { layer: existing.layer ?? 0, scope: existing.scope ?? '.', id: existing.id },
            };
          } else {
            const isRelaxation = reason.includes('relaxation');
            conflicts.push({
              id: entry.id,
              dimension: dim,
              direction,
              winner: existing,
              losers: [stamped],
              resolution: isRelaxation ? 'manual_review' : 'highest_layer_wins',
            });
            warnings.push(`scope="${scope}" id="${entry.id}": ${reason} — parent entry retained`);
          }
        }
      }
    };

    merge(forwardTd, file.forward?.technical_design ?? [], 'forward', 'technical_design');
    merge(forwardRg, file.forward?.requirement_goals ?? [], 'forward', 'requirement_goals');
    merge(reverseTd, file.reverse?.technical_design ?? [], 'reverse', 'technical_design');
    merge(reverseRg, file.reverse?.requirement_goals ?? [], 'reverse', 'requirement_goals');

    const node: ConstraintTreeNode = {
      layer,
      scope,
      strength,
      forward: { technical_design: forwardTd, requirement_goals: forwardRg },
      reverse: { technical_design: reverseTd, requirement_goals: reverseRg },
      children: new Map(),
      parent,
    };
    if (parent) parent.children.set(scope, node);
    nodes.set(scope, node);
  }

  const rootScope = scopes.includes('.') ? '.' : scopes[0];
  const rootNode = nodes.get(rootScope);
  if (!rootNode) throw new Error('resolveConstraintTree: failed to locate root node');
  return { root: rootNode, conflicts, warnings };
}
