/**
 * Workflow types — change lifecycle, state machine, guards, and drift detection.
 */

import type { Severity } from './types-constraint.js';
import type { LoopState } from './types-loop.js';
import type { TeamState } from './types-team.js';

/** Change workflow type */
export type Workflow = 'full' | 'hotfix' | 'tweak' | 'loop';

/** Change phase in the lifecycle */
export type ChangePhase =
  | 'open'
  | 'design'
  | 'build'
  | 'verify'
  | 'archive-in-progress'
  | 'archive-completed'
  | 'discarded';

/** Build layer status */
export type LayerStatus = 'pending' | 'in-progress' | 'done';

/** Build layer definition */
export interface BuildLayer {
  layer: number;
  scope: string;
  status: LayerStatus;
}

/** Test cases lock state */
export interface TestCasesState {
  design_locked: boolean;
  design_content_hash?: string;
  suites_locked: boolean;
  suites_locked_layers: number[];
  suites_hash: Record<number, string>;
}

/** Rollback history entry */
export interface RollbackHistoryEntry {
  from: ChangePhase;
  to: ChangePhase;
  reason: string;
  timestamp: string;
  counted: boolean;
  event: string;
}

/** Change state stored in .mumuspec.yaml */
export interface ChangeState {
  name: string;
  phase: ChangePhase;
  workflow: Workflow;
  created_at: string;
  updated_at: string;
  scope?: string;
  affected_scopes: string[];
  /** Scope signals for workflow path recommendation (LLM Freedom Enhancement) */
  estimated_files?: number;
  modules_affected?: number;
  cross_module?: boolean;
  new_public_api?: boolean;
  new_external_dep?: boolean;
  data_migration?: boolean;
  is_doc_only?: boolean;
  is_pure_bugfix?: boolean;
  build_layers: BuildLayer[];
  test_cases: TestCasesState;
  rollback_count: number;
  rebuild_count: number;
  rollback_limit: number;
  rebuild_limit: number;
  build_mode: string;
  tdd_mode: string;
  isolation: string;
  /** Change branch name (branch-driven workflow, e.g. "mumuspec/<name>") */
  branch?: string;
  single_active_change: boolean;
  user_confirmed: boolean;
  decisions_log: { counts: Record<string, number>; content_hash?: string };
  rollback_history: RollbackHistoryEntry[];
  cognitive_framework?: {
    enabled: boolean;
    cognitive_map_ref?: string;
    q1_count: number;
    q2_pending: number;
    q3_pending: number;
    q4_scans_completed: number;
    converged: boolean;
    rounds_completed: number;
  };
  hyperplan_result?: {
    triggered: boolean;
    hard_constraints_merged: boolean;
    open_questions_resolved: boolean;
    degraded: boolean;
  };
  grill_me_result?: {
    /** Whether the grill-me questioning session completed */
    completed: boolean;
    /** Which phase this result is for (allows phase-specific tracking) */
    phase?: string;
    /** Number of questioning rounds used */
    rounds: number;
    /** Maximum rounds allowed */
    max_rounds: number;
    /** Number of deferred (postponed) answers */
    deferred_count: number;
    /** Whether explicit consensus gate was passed */
    consensus_reached: boolean;
  };
  git_merge?: {
    merged: boolean;
    commit_sha?: string;
    strategy?: string;
  };
  knowledge_extraction?: {
    completed: boolean;
    pages_created_count: number;
    graph_bindings_verified: boolean;
    conflicts_resolved: boolean;
  };
  accepted_deviations?: string[];
  deviation_reviewer?: string;
  deviation_approved_at?: string;
  /** Distributed spec file pointers for this change (Distributed Spec V2) */
  dist_spec?: {
    /** Relative path to change's prd.md */
    prd: string;
    /** Relative path to change's tech.md */
    tech: string;
    /** Optional: independent spec.md for change-specific constraints */
    spec?: string;
  };
  /** Audit trail of LLM autonomous decisions (LLM Freedom Enhancement) */
  auto_decisions?: AutoDecision[];
  verify_result?: 'pending' | 'pass' | 'pass-with-deviations' | 'fail';
  branch_status?: 'pending' | 'handled';
  verification_report?: string;
  verify_mode?: 'light' | 'full';
  clarify_result?: {
    completed: boolean;
    questions_asked: number;
    questions_answered: number;
  };
  review_result?: {
    completed: boolean;
    critical_count: number;
    major_count: number;
    minor_count: number;
  };
  feedback_log?: {
    entries: Array<{ feedback_id: string; linked_at: string; acknowledged: boolean }>;
    session_links: Array<{ feedback_id: string; session_id: string; linked_at: string }>;
  };
  /** Loop state for dynamic workflow mode */
  loop_state?: LoopState;
  /** Team orchestration state for multi-role collaborative mode */
  team_state?: TeamState;
}

/** Phase guard check result */
export interface GuardResult {
  passed: boolean;
  errors: GuardError[];
  warnings: GuardWarning[];
}

export interface GuardError {
  code: string;
  message: string;
  detail?: string;
}

export interface GuardWarning {
  code: string;
  message: string;
  detail?: string;
}

/** Drift detection result */
export interface DriftResult {
  type: string;
  severity: Severity;
  message: string;
  file?: string;
  line?: number;
  /** Fix hint — displayed to user when --fix cannot auto-fix */
  fixHint?: string;
  /** Optional machine-readable error code (e.g. E-AGENTS-001) — CHG-3 */
  code?: string;
  /** Whether this drift can be auto-fixed */
  fixable?: boolean;
}

// ════════════════════════════════════════════════════════════════════
// LLM Freedom Enhancement — Dynamic Workflow Types
// ════════════════════════════════════════════════════════════════════

/** Risk tier for a change */
export type RiskTier = 'low' | 'medium' | 'high';

/** Estimated scope of a change */
export interface ScopeEstimation {
  /** Number of files likely to be modified */
  estimated_files: number;
  /** Number of modules/packages affected */
  modules_affected: number;
  /** Whether change touches multiple modules */
  cross_module: boolean;
  /** Whether new public APIs are introduced */
  new_public_api: boolean;
  /** Whether new external dependencies are needed */
  new_external_dep: boolean;
  /** Whether data migration is involved */
  data_migration: boolean;
  /** Inferred risk level */
  risk_level: RiskTier;
  /** Whether change is documentation-only */
  is_doc_only: boolean;
  /** Whether change is a pure bugfix with confirmed root cause */
  is_pure_bugfix: boolean;
}

/** Path recommendation result */
export interface PathRecommendation {
  /** Recommended workflow path */
  path: Workflow;
  /** Confidence score [0, 1] */
  confidence: number;
  /** Human-readable rationale */
  rationale: string;
  /** Whether safety fence would block compression */
  safety_fence_blocks: boolean;
  /** Which fence conditions triggered (if any) */
  fence_triggers?: string[];
}

/** Blocking Point resolution option */
export interface BPOption {
  /** Option identifier */
  id: string;
  /** Short title */
  title: string;
  /** Detailed description */
  description: string;
  /** Whether this option is recommended */
  recommended: boolean;
  /** Risk level of this option */
  risk: RiskTier;
  /** Estimated time to resolve */
  estimated_effort: 'low' | 'medium' | 'high';
}

/** BP Advisor recommendation result */
export interface BPRecommendation {
  /** Blocking point identifier */
  bp_id: string;
  /** Why this point is currently blocked */
  analysis: string;
  /** Available resolution options */
  options: BPOption[];
  /** Recommended option ID */
  recommended_option_id: string;
}

/** Phase compression evaluation result */
export interface CompressionResult {
  /** Whether compression is allowed */
  allowed: boolean;
  /** Human-readable reason */
  reason: string;
  /** Which conditions denied compression (if denied) */
  blocking_conditions?: string[];
  /** Recommended compressed path */
  compressed_path?: Workflow;
}

/** Auto-decision audit entry */
export interface AutoDecision {
  /** ISO timestamp */
  timestamp: string;
  /** Phase when decision was made */
  phase: ChangePhase;
  /** What was decided */
  decision: string;
  /** Why this decision was made */
  rationale: string;
  /** Confidence in decision */
  confidence: number;
  /** Who approved: user | auto_L2_rule */
  approved_by: 'user' | 'auto_L2_rule' | string;
}

/** Skill auto-load entry */
export interface SkillRule {
  /** Matcher: when to apply this rule */
  when: string;
  /** Skills to load */
  load: string[];
}

/** A skill entry with metadata for dynamic loading */
export interface SkillEntry {
  /** Skill name/identifier */
  name: string;
  /** Whether this skill is always loaded (vs conditionally) */
  required: boolean;
  /** The characteristic that triggered this skill (empty if required) */
  triggered_by?: string;
}

/** Task characteristics for skill matching */
export interface TaskCharacteristics {
  /** Whether change involves concurrency */
  involves_concurrency: boolean;
  /** Whether change adds new dependencies */
  involves_new_dependency: boolean;
  /** Whether change modifies APIs */
  involves_api_change: boolean;
  /** Whether change touches database schema */
  involves_database_schema: boolean;
  /** Whether change involves UI components */
  involves_ui: boolean;
  /** Whether change involves configuration */
  involves_config: boolean;
  /** Detected ecosystems */
  ecosystems: string[];
}
