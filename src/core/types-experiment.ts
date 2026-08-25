/**
 * Experiment Mode Types — Parallel Evolution Loop
 *
 * Implements a meta-improvement loop where MumuSpec spawns multiple worktrees,
 * each running a different improvement direction against the same demo change.
 * Results are compared and the best improvements are selected for adoption.
 *
 * Workflow:
 *   plan → spawn → run → compare → adopt → (repeat, max N meta-rounds)
 */

// ════════════════════════════════════════════════════════════════════
// Experiment Phase — overall state of the meta-improvement process
// ════════════════════════════════════════════════════════════════════

/** Experiment lifecycle phases */
export type ExperimentPhase =
  | 'init'          // Experiment configured, directions generated
  | 'spawning'      // Creating worktrees with different code variants
  | 'running'       // Executing the change in each worktree
  | 'collecting'    // Gathering metrics from all worktrees
  | 'comparing'     // Analyzing and comparing results
  | 'deciding'      // User reviewing comparison, selecting improvements
  | 'adopting'      // Merging selected improvements back
  | 'converged'     // Experiment complete, improvements adopted
  | 'exhausted'     // Meta-rounds exhausted
  | 'blocked';      // Cannot proceed, needs user input

// ════════════════════════════════════════════════════════════════════
// Improvement Direction — a single variant to test
// ════════════════════════════════════════════════════════════════════

/** A generated improvement direction */
export interface ExperimentDirection {
  /** Unique identifier (e.g., "dir-1", "dir-2") */
  id: string;
  /** Short name for the direction */
  name: string;
  /** Description of what this direction proposes */
  description: string;
  /** Category of improvement */
  category: ExperimentCategory;
  /** Risk level (1-5, 1=low, 5=high) */
  riskLevel: number;
  /** Files that will be modified (relative paths) */
  affectedFiles: string[];
  /** Summary of intended code changes */
  changeSummary: string;
  /** Expected benefit */
  expectedBenefit: string;
  /** Whether this direction was adopted */
  adopted: boolean;
  /** Whether this direction was rejected and why */
  rejectionReason?: string;
}

/** Categories of improvement directions */
export type ExperimentCategory =
  | 'performance'     // Speed, memory, efficiency
  | 'usability'       // CLI UX, error messages, help text
  | 'robustness'      // Error handling, edge cases, validation
  | 'maintainability' // Code structure, modularity, docs
  | 'feature'         // New capabilities or commands
  | 'security';       // Security hardening

// ════════════════════════════════════════════════════════════════════
// Experiment Arm — one worktree running one direction
// ════════════════════════════════════════════════════════════════════

/** A single arm (worktree + direction) in the experiment */
export interface ExperimentArm {
  /** Arm identifier (e.g., "arm-1") */
  id: string;
  /** Associated direction */
  directionId: string;
  /** Worktree path for this arm */
  worktreePath: string;
  /** Git branch for this arm */
  branch: string;
  /** Arm execution status */
  status: ExperimentArmStatus;
  /** When the arm started running */
  startedAt?: string;
  /** When the arm finished */
  completedAt?: string;
  /** Execution metrics for this arm */
  metrics?: ExperimentMetrics;
  /** Error message if arm failed */
  error?: string;
}

/** Status of a single experiment arm */
export type ExperimentArmStatus =
  | 'pending'       // Not yet started
  | 'spawning'      // Worktree being created
  | 'running'       // Change being executed
  | 'collecting'    // Metrics being gathered
  | 'completed'     // Successfully finished
  | 'failed'        // Error occurred
  | 'aborted';      // Killed by user

// ════════════════════════════════════════════════════════════════════
// Metrics — collected from each arm's execution
// ════════════════════════════════════════════════════════════════════

/** Execution metrics gathered from each arm */
export interface ExperimentMetrics {
  /** Eval suite results */
  evalResults: ExperimentEvalResults;
  /** Change execution results */
  changeResults: ExperimentChangeResults;
  /** Overall quality score (0-1) */
  qualityScore: number;
  /** Performance score (0-1) */
  performanceScore: number;
  /** Robustness score (0-1) */
  robustnessScore: number;
  /** Timestamp when metrics were collected */
  collectedAt: string;
}

/** Eval suite execution results for one arm */
export interface ExperimentEvalResults {
  /** Total scenarios run */
  totalScenarios: number;
  /** Scenarios passed */
  passedScenarios: number;
  /** Scenarios failed */
  failedScenarios: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Total errors found */
  totalErrors: number;
  /** Total warnings found */
  totalWarnings: number;
  /** Execution duration in ms */
  durationMs: number;
}

/** Change execution results for one arm */
export interface ExperimentChangeResults {
  /** Change name being executed */
  changeName: string;
  /** Whether the change completed successfully */
  success: boolean;
  /** Number of phases completed */
  phasesCompleted: number;
  /** Total phases in the workflow */
  totalPhases: number;
  /** Number of actions taken */
  totalActions: number;
  /** Number of failed actions */
  failedActions: number;
  /** Execution duration in ms */
  durationMs: number;
  /** Errors encountered */
  errors: string[];
  /** Warnings encountered */
  warnings: string[];
  /** Verify result (if applicable) */
  verifyResult?: string;
}

// ════════════════════════════════════════════════════════════════════
// Comparison & Decision
// ════════════════════════════════════════════════════════════════════

/** Comparison result across all arms */
export interface ExperimentComparison {
  /** When the comparison was generated */
  generatedAt: string;
  /** Total arms compared */
  totalArms: number;
  /** Arms that completed successfully */
  successfulArms: number;
  /** Arms that failed */
  failedArms: number;
  /** Ranked list of arms (best first) */
  rankings: ExperimentRanking[];
  /** Insights generated from comparison */
  insights: ExperimentInsight[];
  /** Recommended directions to adopt */
  recommendations: string[]; // direction IDs
}

/** Ranking entry for one arm */
export interface ExperimentRanking {
  /** Rank position (1 = best) */
  rank: number;
  /** Arm ID */
  armId: string;
  /** Direction ID */
  directionId: string;
  /** Direction name */
  directionName: string;
  /** Overall composite score (0-100) */
  compositeScore: number;
  /** Strengths identified */
  strengths: string[];
  /** Weaknesses identified */
  weaknesses: string[];
}

/** Insight learned from comparing arms */
export interface ExperimentInsight {
  /** Insight category */
  category: 'performance' | 'quality' | 'robustness' | 'ux' | 'general';
  /** Insight description */
  description: string;
  /** Which arms this applies to */
  relatedArms: string[];
  /** Severity/importance (1-5) */
  importance: number;
}

// ════════════════════════════════════════════════════════════════════
// Experiment State — persisted in .mumuspec/experiments/
// ════════════════════════════════════════════════════════════════════

/** Overall experiment state */
export interface ExperimentState {
  /** Experiment name/ID */
  name: string;
  /** Experiment goal statement */
  goal: string;
  /** Whether experiment mode is enabled */
  enabled: boolean;
  /** Current experiment phase */
  phase: ExperimentPhase;
  /** Meta-round limit */
  maxMetaRounds: number;
  /** Current meta-round */
  currentMetaRound: number;
  /** Number of directions to spawn */
  directionCount: number;
  /** Demo change to execute in each arm */
  demoChangeName: string;
  /** Demo project path */
  demoProjectPath: string;
  /** Generated directions */
  directions: ExperimentDirection[];
  /** Active arms */
  arms: ExperimentArm[];
  /** Comparison results (latest) */
  comparison: ExperimentComparison | null;
  /** Selected direction IDs to adopt */
  selectedDirections: string[];
  /** Whether improvements have been merged back */
  mergedBack: boolean;
  /** Original branch before experiment */
  originalBranch?: string;
  /** Base commit for all worktrees */
  baseCommit?: string;
  /** Creation timestamp */
  createdAt: string;
  /** Completion timestamp */
  completedAt?: string;
  /** Notes/observations */
  notes: string[];
}

// ════════════════════════════════════════════════════════════════════
// Configuration
// ════════════════════════════════════════════════════════════════════

/** Experiment configuration options */
export interface ExperimentConfig {
  /** Number of directions to generate (default: 5) */
  directionCount: number;
  /** Meta-round limit (default: 2) */
  maxMetaRounds: number;
  /** Name of the change to execute in demo */
  demoChangeName: string;
  /** Path to demo project */
  demoProjectPath: string;
  /** Auto-generate directions if true */
  autoGenerate: boolean;
  /** Manual directions (if not auto-generating) */
  manualDirections?: Partial<ExperimentDirection>[];
  /** Categories to focus on */
  focusCategories?: ExperimentCategory[];
  /** Base branch/commit to spawn from */
  baseRef?: string;
}

// ════════════════════════════════════════════════════════════════════
// Utility Types
// ════════════════════════════════════════════════════════════════════

/** Input to initialize an experiment */
export interface ExperimentInitInput {
  /** Experiment name */
  name: string;
  /** Goal statement for the experiment */
  goal: string;
  /** Configuration */
  config: ExperimentConfig;
}

/** Summary for display */
export interface ExperimentStatusSummary {
  name: string;
  phase: ExperimentPhase;
  currentMetaRound: number;
  maxMetaRounds: number;
  directionCount: number;
  armsTotal: number;
  armsCompleted: number;
  armsFailed: number;
  comparisonReady: boolean;
  selectedCount: number;
  mergedBack: boolean;
}
