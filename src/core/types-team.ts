/**
 * Team Orchestration Types — Multi-role collaborative编排 framework.
 *
 * Inspired by the bidding-team pattern: lead agent spawns N parallel member
 * instances, an evaluator scores outputs, and iterations continue until a
 * quality bar is met.
 *
 * This module defines the data structures for the team-orchestration build mode.
 * The runtime-agnostic design allows different execution backends (CatPaw subagent,
 * child process, remote worker) via the RuntimeAdapter interface.
 */

// ════════════════════════════════════════════════════════════════════
// Team Phase — sub-states within the team orchestration lifecycle
// ════════════════════════════════════════════════════════════════════

/** Team orchestration lifecycle phases */
export type TeamPhase =
  | 'pending'       // Config loaded, not yet started
  | 'clarify'       // Lead agent clarifying requirements
  | 'propose'       // Members running in parallel, producing outputs
  | 'evaluate'      // Evaluator scoring proposals
  | 'iterate'       // Feedback sent back to members for regeneration
  | 'converged'     // Quality bar met, awaiting user confirmation
  | 'exhausted'     // Max rounds reached without convergence
  | 'blocked';      // Needs user input to proceed

/** Member variant orientation for diverging proposals */
export type MemberOrientation =
  | 'stable'
  | 'innovative'
  | 'cost-effective'
  | 'custom';

// ════════════════════════════════════════════════════════════════════
// Team Configuration (YAML-serializable)
// ════════════════════════════════════════════════════════════════════

/** Scoring dimension with weight */
export interface TeamScoreDimension {
  /** Dimension name (e.g. "技术方案") */
  name: string;
  /** Weight points (weights across dimensions should sum to 100) */
  weight: number;
  /** Optional description of what this dimension evaluates */
  description?: string;
}

/** Member role configuration */
export interface TeamMemberConfig {
  /** Role/agent identifier (maps to agent definition file) */
  role: string;
  /** Number of parallel instances to spawn */
  instances: number;
  /** Optional orientation hints for each instance (length should match instances) */
  orientations?: MemberOrientation[];
  /** Custom label for this member role */
  label?: string;
}

/** Evaluator configuration */
export interface TeamEvaluatorConfig {
  /** Evaluator agent identifier */
  role: string;
  /** Minimum score threshold to consider "passed" (0-100) */
  min_score: number;
  /** Scoring dimensions with weights */
  dimensions: TeamScoreDimension[];
  /** Optional custom label */
  label?: string;
}

/** Iteration control configuration */
export interface TeamIterationConfig {
  /** Maximum number of propose→evaluate cycles */
  max_rounds: number;
  /** Whether to stop at first convergence (true) or always run all rounds (false) */
  stop_on_convergence: boolean;
}

/** Complete team configuration — stored in .mumuspec/team/<name>.yaml */
export interface TeamConfig {
  /** Schema version */
  version: 1;
  /** Lead agent definition path or identifier */
  lead: string;
  /** Member roles that produce proposals in parallel */
  members: TeamMemberConfig[];
  /** Evaluator that scores proposals */
  evaluator: TeamEvaluatorConfig;
  /** Iteration control settings */
  iteration: TeamIterationConfig;
  /** Optional description of this team's purpose */
  description?: string;
}

// ════════════════════════════════════════════════════════════════════
// Team State — persisted in ChangeState.team_state
// ════════════════════════════════════════════════════════════════════

/** Result from a single member instance in one round */
export interface TeamMemberResult {
  /** Instance identifier (e.g. "technical-solution-expert-1") */
  instance_id: string;
  /** Role this instance belongs to */
  role: string;
  /** Orientation variant assigned */
  orientation: MemberOrientation | string;
  /** Output artifact path or content reference */
  output_ref: string;
  /** Whether the instance completed successfully */
  completed: boolean;
  /** Error message if failed */
  error?: string;
}

/** Evaluation scores for one proposal */
export interface TeamScoreBreakdown {
  /** Per-dimension scores (dimension name → points earned) */
  dimensions: Record<string, number>;
  /** Total score (0-100) */
  total: number;
  /** Whether this meets the min_score threshold */
  passed: boolean;
}

/** Evaluator output for one round */
export interface TeamEvaluationResult {
  /** Evaluator instance identifier */
  evaluator_id: string;
  /** Per-proposal scores keyed by instance_id */
  scores: Record<string, TeamScoreBreakdown>;
  /** Ranking of instance_ids by total score (highest first) */
  ranking: string[];
  /** Best candidate instance_id */
  best_instance_id: string;
  /** Best score achieved */
  best_score: number;
  /** Whether any proposal passed the bar */
  bar_met: boolean;
  /** Improvement feedback per underperforming instance */
  feedback: Record<string, string>;
  /** Full evaluation report reference */
  report_ref: string;
}

/** Record of a single team iteration round */
export interface TeamRound {
  /** Round number (1-based) */
  round: number;
  /** When this round started */
  started_at: string;
  /** When this round completed */
  completed_at?: string;
  /** Member results this round */
  member_results: TeamMemberResult[];
  /** Evaluation result this round */
  evaluation: TeamEvaluationResult | null;
  /** Phase the round ended in */
  end_phase: TeamPhase;
}

/** Persisted team state */
export interface TeamState {
  /** Whether team mode is active for this change */
  enabled: boolean;
  /** Path to the team config YAML */
  config_path: string;
  /** Resolved team config (cached from config_path) */
  config?: TeamConfig;
  /** Current team phase */
  phase: TeamPhase;
  /** Current round number (0 = not started) */
  current_round: number;
  /** History of completed rounds */
  rounds: TeamRound[];
  /** Proposal artifact URIs for current round (instance_id → ref) */
  proposal_refs: Record<string, string>;
  /** Latest evaluation report ref */
  evaluation_ref?: string;
  /** Best score across all rounds so far */
  best_score: number;
  /** Best round number (1-based; 0 = none) */
  best_round: number;
  /** User-confirmed final selection (instance_id) */
  confirmed_selection?: string;
  /**收敛原因 */
  convergence_reason?: string;
}

// ════════════════════════════════════════════════════════════════════
// Runtime Adapter Interface (pluggable execution backend)
// ════════════════════════════════════════════════════════════════════

/**
 * Runtime adapter — abstracts the execution of agent instances.
 *
 * Implementations: CatPawSubadapterAdapter, ChildProcessAdapter, MockAdapter (testing)
 *
 * Design principle: the team engine orchestrates WHAT happens (round structure,
 * scoring, iteration); the adapter handles HOW agents are invoked.
 */
export interface RuntimeAdapter {
  /** Adapter identifier */
  readonly name: string;

  /**
   * Spawn a single member instance with the given prompt.
   * @param context - execution context (role, orientation, round, brief, feedback)
   * @returns result with output reference
   */
  spawnMember(context: MemberExecutionContext): Promise<MemberExecutionResult>;

  /**
   * Run the evaluator on a set of proposals.
   * @param context - evaluation context (proposals, dimensions, brief)
   * @returns scored evaluation result
   */
  runEvaluator(context: EvaluatorExecutionContext): Promise<EvaluatorExecutionResult>;

  /**
   * Run the lead agent for requirement clarification.
   * @param context - lead context (initial_request, config)
   * @returns structured brief to distribute to members
   */
  runLead(context: LeadExecutionContext): Promise<LeadExecutionResult>;
}

/** Context for spawning a member instance */
export interface MemberExecutionContext {
  /** Instance identifier */
  instance_id: string;
  /** Role/agent type */
  role: string;
  /** Orientation variant */
  orientation: MemberOrientation | string;
  /** Round number */
  round: number;
  /** Task brief (from lead) */
  brief: string;
  /** Previous round feedback (empty string if first round) */
  feedback: string;
  /** Previous output ref (for iteration context) */
  previous_output_ref?: string;
}

/** Result from a member execution */
export interface MemberExecutionResult {
  /** Output artifact reference (file path, content hash, etc.) */
  output_ref: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/** Context for running the evaluator */
export interface EvaluatorExecutionContext {
  /** Proposals to evaluate (instance_id → output_ref) */
  proposals: Record<string, string>;
  /** Scoring dimensions and weights */
  dimensions: TeamScoreDimension[];
  /** Minimum passing score */
  min_score: number;
  /** Original task brief */
  brief: string;
}

/** Result from evaluator execution */
export interface EvaluatorExecutionResult {
  /** Per-proposal scores */
  scores: Record<string, TeamScoreBreakdown>;
  /** Ranking (best first) */
  ranking: string[];
  /** Best instance_id */
  best_instance_id: string;
  /** Best score */
  best_score: number;
  /** Whether bar was met */
  bar_met: boolean;
  /** Per-instance improvement feedback */
  feedback: Record<string, string>;
  /** Full report reference */
  report_ref: string;
}

/** Context for running the lead agent */
export interface LeadExecutionContext {
  /** The team configuration */
  config: TeamConfig;
  /** The user's initial request */
  initial_request: string;
  /** Project context (paths, existing specs) */
  project_context: Record<string, string>;
}

/** Result from lead execution */
export interface LeadExecutionResult {
  /** Structured brief to distribute to member instances */
  brief: string;
  /** Additional constraints or scoring emphasis */
  scoring_notes?: string;
  /** Whether clarification is sufficient */
  clarification_complete: boolean;
  /** Questions that still need user input (if not complete) */
  pending_questions?: string[];
}

// ════════════════════════════════════════════════════════════════════
// Team Events (for audit trail)
// ════════════════════════════════════════════════════════════════════

export type TeamEvent =
  | 'team_init'
  | 'team_clarify_complete'
  | 'team_round_start'
  | 'team_propose_complete'
  | 'team_evaluate_complete'
  | 'team_iteration_feedback'
  | 'team_converged'
  | 'team_exhausted'
  | 'team_blocked'
  | 'team_user_confirm'
  | 'team_error';

/** Team event record for audit log */
export interface TeamEventRecord {
  event: TeamEvent;
  timestamp: string;
  round: number;
  phase: TeamPhase;
  detail?: string;
}

// ════════════════════════════════════════════════════════════════════
// Utility Types
// ════════════════════════════════════════════════════════════════════

/** Input to initialize team mode */
export interface TeamInitInput {
  /** Change name */
  changeName: string;
  /** Team config path (absolute or relative to change dir) */
  config_path: string;
  /** Optional override: lead agent */
  lead_override?: string;
  /** Optional override: min_score */
  min_score_override?: number;
}

/** Summary of team status for display */
export interface TeamStatusSummary {
  changeName: string;
  phase: TeamPhase;
  currentRound: number;
  maxRounds: number;
  bestScore: number;
  bestRound: number;
  configPath: string;
  memberCount: number;
  canContinue: boolean;
  barMet: boolean;
  blockReason?: string;
}

/** Validation result for team config */
export interface TeamConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
