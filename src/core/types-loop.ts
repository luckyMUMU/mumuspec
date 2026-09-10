/**
 * Loop Mode Types — Dynamic Workflow (Loop-Core)
 *
 * Defines the data structures for the iterative loop-based workflow mode.
 * Inspired by Claude Code's Plan → Act → Evaluate cycle.
 *
 * Key behaviors:
 * - Auto worktree isolation on entry
 * - Auto git commit after each round
 * - Default 3-round limit (configurable)
 */

import type { MetricsSnapshot } from './metrics/types.js';

// ════════════════════════════════════════════════════════════════════
// Loop Phase — sub-states within the loop workflow
// ════════════════════════════════════════════════════════════════════

/** Loop iteration phases */
export type LoopPhase =
  | 'init'          // Loop initialized, worktree ready
  | 'plan'          // Planning what to do this round
  | 'act'           // Executing planned actions
  | 'evaluate'      // Evaluating results
  | 'commit'        // Committing progress
  | 'converged'     // Task completed (goal achieved)
  | 'exhausted'     // Round limit reached without convergence
  | 'blocked';      // Cannot proceed, needs user input

/** Action types that can be performed in a loop round */
export type LoopActionType =
  | 'file_edit'
  | 'file_create'
  | 'file_delete'
  | 'command_run'
  | 'test_run'
  | 'spec_update'
  | 'design_update'
  | 'knowledge_query'
  | 'code_analysis'
  | 'decision_record';

/** Loop evaluation mode. */
export type LoopEvaluateMode = 'manual' | 'auto' | 'hybrid';
/** @alias for backward compatibility */
export type EvaluateMode = LoopEvaluateMode;

/** A single action taken during a loop round */
export interface LoopAction {
  /** Action type */
  type: LoopActionType;
  /** Brief description of what was done */
  description: string;
  /** Target file/command (if applicable) */
  target?: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/** Result evaluation of a loop round */
export interface LoopEvaluation {
  /** Progress score [0, 1] — how much closer to goal */
  progress: number;
  /** Whether the overall goal is achieved */
  goal_achieved: boolean;
  /** Issues discovered during evaluation */
  issues: string[];
  /** Suggested focus for next round */
  next_focus?: string;
  /** Whether user input is needed */
  needs_user_input: boolean;
  /** Reason user input is needed (if applicable) */
  block_reason?: string;
  /**
   * Advisory constraint-strength suggestions (freedom-metrics).
   * Carried through from AutoEvaluateResult so consumers (`loop evaluate` CLI,
   * decisions advisory entries) can surface them — dropping them here is what
   * made the freedom-metrics work a dead-end output. Human signoff required.
   */
  suggestions?: string[];
}

/** Record of a single loop iteration */
export interface LoopRound {
  /** Round number (1-based) */
  round: number;
  /** Phase the loop was in at start of round */
  started_at: string;
  /** When the round completed */
  completed_at?: string;
  /** Plan for this round */
  plan: string;
  /** Actions executed */
  actions: LoopAction[];
  /** Evaluation result */
  evaluation: LoopEvaluation | null;
  /** Git commit SHA (if committed) */
  commit_sha?: string;
  /** Commit message */
  commit_message?: string;
}

// ════════════════════════════════════════════════════════════════════
// Loop State — persisted in .mumuspec.yaml
// ════════════════════════════════════════════════════════════════════

/** Loop-specific state embedded in ChangeState */
export interface LoopState {
  /** Whether this change uses loop mode */
  enabled: boolean;
  /** Current loop phase */
  phase: LoopPhase;
  /** Maximum number of rounds allowed */
  max_rounds: number;
  /** Current round number (0 = not started) */
  current_round: number;
  /** History of completed rounds */
  rounds: LoopRound[];
  /** The overall goal statement */
  goal: string;
  /** Convergence criteria — what "done" means */
  convergence_criteria: string[];
  /** Whether auto-commit is enabled */
  auto_commit: boolean;
  /** Worktree path (if isolated) */
  worktree_path?: string;
  /** Original branch before worktree creation */
  original_branch?: string;
  /** Whether the worktree has been merged back */
  merged_back: boolean;
  /** Total actions taken across all rounds */
  total_actions: number;
  /** Convergence score trend (for detecting stagnation) */
  progress_trend: number[];
  /** Metrics history from auto-evaluate rounds (R-0002) */
  metrics_history?: MetricsSnapshot[];
  /** Current evaluation mode (manual | auto | hybrid) */
  evaluate_mode?: LoopEvaluateMode;
}

// ════════════════════════════════════════════════════════════════════
// Loop Configuration (from config.yaml)
// ════════════════════════════════════════════════════════════════════

/** Loop-specific configuration */
export interface LoopConfig {
  /** Enable loop mode as a workflow option */
  enabled: boolean;
  /** Default maximum rounds */
  default_max_rounds: number;
  /** Auto-create worktree on loop entry */
  auto_worktree: boolean;
  /** Auto-commit after each round */
  auto_commit: boolean;
  /** Convergence threshold (progress score to consider "done") */
  convergence_threshold: number;
  /** Stagnation detection — max rounds without progress */
  stagnation_limit: number;
  /** Whether to prompt user before each round */
  confirm_each_round: boolean;
}

// ════════════════════════════════════════════════════════════════════
// Loop Events
// ════════════════════════════════════════════════════════════════════

export type LoopEvent =
  | 'loop_init'
  | 'round_start'
  | 'round_plan'
  | 'round_act'
  | 'round_evaluate'
  | 'round_commit'
  | 'loop_converged'
  | 'loop_exhausted'
  | 'loop_blocked'
  | 'loop_user_resume';

/** Loop event record for audit trail */
export interface LoopEventRecord {
  event: LoopEvent;
  timestamp: string;
  round: number;
  phase: LoopPhase;
  detail?: string;
}

// ════════════════════════════════════════════════════════════════════
// Utility Types
// ════════════════════════════════════════════════════════════════════

/** Input to initialize a loop */
export interface LoopInitInput {
  /** Change name */
  changeName: string;
  /** Goal statement */
  goal: string;
  /** Convergence criteria */
  convergence_criteria: string[];
  /** Max rounds (defaults to config) */
  max_rounds?: number;
  /** Whether to use worktree isolation */
  use_worktree?: boolean;
  /** Whether to auto-commit */
  auto_commit?: boolean;
  /** Evaluation mode: manual (default), auto, or hybrid (R-0002) */
  evaluate_mode?: LoopEvaluateMode;
}

/** Summary of loop status for display */
export interface LoopStatusSummary {
  changeName: string;
  phase: LoopPhase;
  currentRound: number;
  maxRounds: number;
  goal: string;
  lastEvaluation: LoopEvaluation | null;
  progressTrend: number[];
  worktreePath?: string;
  totalActions: number;
  canContinue: boolean;
  blockReason?: string;
}
