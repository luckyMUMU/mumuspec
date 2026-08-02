/**
 * Workflow types — change lifecycle, state machine, guards, and drift detection.
 */

import type { Severity } from './types-constraint.js';

/** Change workflow type */
export type Workflow = 'full' | 'hotfix' | 'tweak';

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
  build_layers: BuildLayer[];
  test_cases: TestCasesState;
  rollback_count: number;
  rebuild_count: number;
  rollback_limit: number;
  rebuild_limit: number;
  build_mode: string;
  tdd_mode: string;
  isolation: string;
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
    completed: boolean;
    rounds: number;
    max_rounds: number;
    deferred_count: number;
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
}
