/**
 * Loop Engine — Dynamic Workflow Core
 *
 * Implements the Plan → Act → Evaluate iterative loop pattern.
 * Auto-manages worktree isolation, git commits, and round limits.
 *
 * Default: 3 rounds, auto-commit, worktree isolation.
 */

import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { now, appendAuditLog, getMumuSpecDir } from './utils.js';
import {
  loadChangeState,
  saveChangeState,
  getActiveChange,
} from '../change/manager.js';
import {
  LoopState,
  LoopRound,
  LoopAction,
  LoopEvaluation,
  LoopInitInput,
  LoopStatusSummary,
  EvaluateMode,
} from './types-loop.js';
import type { MetricsSnapshot } from './metrics/types.js';
import {
  autoEvaluate,
  hybridEvaluate,
  registerBuiltInEvaluators,
  getActiveEvaluatorCount,
} from './metrics/auto-evaluate.js';

// ════════════════════════════════════════════════════════════════════
// Default Configuration
// ════════════════════════════════════════════════════════════════════

const DEFAULT_MAX_ROUNDS = 3;
const CONVERGENCE_THRESHOLD = 0.85;
const STAGNATION_LIMIT = 2;

// ════════════════════════════════════════════════════════════════════
// Loop State Management
// ════════════════════════════════════════════════════════════════════

/**
 * Initialize loop state for a change.
 * Creates worktree if auto_worktree is enabled.
 */
export function initLoop(
  projectRoot: string,
  input: LoopInitInput,
): LoopState {
  const state = loadChangeState(projectRoot, input.changeName);
  if (!state) {
    throw new Error(`Change not found: ${input.changeName}`);
  }

  const maxRounds = input.max_rounds ?? DEFAULT_MAX_ROUNDS;
  const useWorktree = input.use_worktree ?? true;
  const autoCommit = input.auto_commit ?? true;
  const evalMode = input.evaluate_mode ?? 'manual';

  let worktreePath: string | undefined;
  let originalBranch: string | undefined;

  // Auto-create worktree for isolation
  if (useWorktree) {
    const result = createWorktree(projectRoot, input.changeName);
    worktreePath = result.worktreePath;
    originalBranch = result.originalBranch;
  }

  const loopState: LoopState = {
    enabled: true,
    phase: 'init',
    max_rounds: maxRounds,
    current_round: 0,
    rounds: [],
    goal: input.goal,
    convergence_criteria: input.convergence_criteria,
    auto_commit: autoCommit,
    worktree_path: worktreePath,
    original_branch: originalBranch,
    merged_back: false,
    total_actions: 0,
    progress_trend: [],
    metrics_history: [],
    evaluate_mode: evalMode,
  };

  // Persist loop state into change state
  state.loop_state = loopState;
  state.phase = 'build'; // Map loop mode to build phase in the DCG
  saveChangeState(projectRoot, input.changeName, state, state.scope);

  // Audit log
  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'loop.init',
    change: input.changeName,
    result: 'success',
  });

  return loopState;
}

/**
 * Start a new loop round.
 * Transitions phase: init/evaluate → plan → act
 */
export function startRound(
  projectRoot: string,
  changeName: string,
  plan: string,
): LoopRound {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    throw new Error(`Loop not initialized for change: ${changeName}`);
  }

  const loop = state.loop_state;

  // Check if we can continue
  if (loop.current_round >= loop.max_rounds) {
    loop.phase = 'exhausted';
    state.loop_state = loop;
    saveChangeState(projectRoot, changeName, state, state.scope);
    throw new Error(
      `Loop exhausted: reached max rounds (${loop.max_rounds}). ` +
      'Use mumuspec loop extend to add more rounds or mumuspec loop exit to finish.'
    );
  }

  if (loop.phase === 'blocked') {
    throw new Error(
      'Loop is blocked. Resolve the blocking issue and use mumuspec loop resume to continue.'
    );
  }

  // Increment round
  loop.current_round += 1;
  loop.phase = 'act';

  const round: LoopRound = {
    round: loop.current_round,
    started_at: now(),
    plan,
    actions: [],
    evaluation: null,
  };

  // Add to rounds history (will be updated as actions complete)
  loop.rounds.push(round);
  state.loop_state = loop;
  saveChangeState(projectRoot, changeName, state, state.scope);

  return round;
}

/**
 * Record an action during the current loop round.
 */
export function recordAction(
  projectRoot: string,
  changeName: string,
  action: LoopAction,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    throw new Error(`Loop not initialized for change: ${changeName}`);
  }

  const loop = state.loop_state;
  const currentRound = loop.rounds[loop.rounds.length - 1];

  if (!currentRound) {
    throw new Error('No active round. Start a round first.');
  }

  currentRound.actions.push(action);
  loop.total_actions += 1;
  state.loop_state = loop;
  saveChangeState(projectRoot, changeName, state, state.scope);
}

/**
 * Evaluate the current round and determine next steps.
 * Transitions phase: act → evaluate → (commit | converged | blocked | exhausted)
 *
 * Supports three evaluation modes:
 * - manual (default): uses provided LoopEvaluation as-is
 * - auto: computes metrics automatically, ignores manual evaluation
 * - hybrid: combines auto metrics (70%) with manual progress (30%)
 */
export async function evaluateRound(
  projectRoot: string,
  changeName: string,
  evaluation: LoopEvaluation,
  options: { mode?: EvaluateMode; manualProgress?: number } = {},
): Promise<{ should_commit: boolean; should_continue: boolean }> {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    throw new Error(`Loop not initialized for change: ${changeName}`);
  }

  const loop = state.loop_state;
  const currentRound = loop.rounds[loop.rounds.length - 1];

  if (!currentRound) {
    throw new Error('No active round to evaluate.');
  }

  const mode: EvaluateMode = options.mode ?? loop.evaluate_mode ?? 'manual';

  // ── Auto / Hybrid evaluation ──
  let finalEvaluation = evaluation;
  if (mode === 'auto' || mode === 'hybrid') {
    try {
      // Lazily register built-in evaluators on first use
      if (getActiveEvaluatorCount() === 0) {
        registerBuiltInEvaluators();
      }

      const ctx = {
        projectRoot,
        changeName,
        worktreePath: loop.worktree_path,
        previousRound: loop.current_round - 1,
        roundHistory: loop.rounds,
      };

      const manualProgress = options.manualProgress ?? evaluation.progress;
      const evalResult = mode === 'auto'
        ? await autoEvaluate(ctx)
        : await hybridEvaluate(ctx, manualProgress);

      // Convert auto-evaluate result to LoopEvaluation
      finalEvaluation = {
        progress: evalResult.progress,
        goal_achieved: evalResult.goalAchieved,
        issues: [],
        next_focus: evalResult.recommendation,
        needs_user_input: false,
      };

      // Persist metrics snapshot
      const snapshot: MetricsSnapshot = {
        round: loop.current_round,
        timestamp: now(),
        progress: evalResult.progress,
        goalAchieved: evalResult.goalAchieved,
        metrics: evalResult.metrics.map(m => ({
          name: m.name,
          value: m.value,
          details: m.details,
        })),
      };
      if (!loop.metrics_history) {
        loop.metrics_history = [];
      }
      loop.metrics_history.push(snapshot);
    } catch (err) {
      // Auto-evaluation failed — fall back to manual and log warning
      console.warn(`Auto-evaluate failed, falling back to manual: ${(err as Error).message}`);
      finalEvaluation = evaluation;
    }
  }

  // Record evaluation
  currentRound.evaluation = finalEvaluation;
  currentRound.completed_at = now();
  loop.progress_trend.push(finalEvaluation.progress);

  // Determine next phase
  if (finalEvaluation.goal_achieved || finalEvaluation.progress >= CONVERGENCE_THRESHOLD) {
    loop.phase = 'converged';
  } else if (finalEvaluation.needs_user_input) {
    loop.phase = 'blocked';
  } else if (loop.current_round >= loop.max_rounds) {
    loop.phase = 'exhausted';
  } else {
    loop.phase = 'plan'; // Ready for next round
  }

  state.loop_state = loop;
  saveChangeState(projectRoot, changeName, state, state.scope);

  // Auto-commit if enabled
  const shouldCommit = loop.auto_commit && !finalEvaluation.goal_achieved;
  if (shouldCommit) {
    try {
      const commitMsg = commitRound(projectRoot, loop.current_round, finalEvaluation);
      currentRound.commit_sha = commitMsg.sha;
      currentRound.commit_message = commitMsg.message;
      state.loop_state = loop;
      saveChangeState(projectRoot, changeName, state, state.scope);
    } catch {
      // Non-fatal: commit failure doesn't block the loop
    }
  }

  return {
    should_commit: shouldCommit,
    should_continue: loop.phase === 'plan',
  };
}

/**
 * Commit the current round's progress to git.
 */
function commitRound(
  projectRoot: string,
  round: number,
  evaluation: LoopEvaluation,
): { sha: string; message: string } {
  const worktreePath = getActiveWorktreePath(projectRoot);
  const cwd = worktreePath || projectRoot;

  try {
    // Stage all changes
    spawnSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });

    // Build commit message
    const message = buildCommitMessage(round, evaluation);

    // Commit
    spawnSync('git', ['commit', '-m', message], {
      cwd,
      stdio: 'ignore',
    });

    // Get SHA
    const shaOut = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd,
      encoding: 'utf-8',
    });
    const sha = (shaOut.stdout ?? '').trim();

    return { sha, message };
  } catch (err) {
    throw new Error(`Git commit failed: ${(err as Error).message}`);
  }
}

/**
 * Build a conventional commit message for a loop round.
 */
function buildCommitMessage(round: number, evaluation: LoopEvaluation): string {
  const progress = Math.round(evaluation.progress * 100);
  let message = `loop(round-${round}): ${progress}% progress`;

  if (evaluation.goal_achieved) {
    message = `loop(round-${round}): goal achieved ✓`;
  }

  if (evaluation.next_focus) {
    message += `\n\nNext: ${evaluation.next_focus}`;
  }

  if (evaluation.issues.length > 0) {
    message += `\n\nIssues:\n${evaluation.issues.map((i) => `- ${i}`).join('\n')}`;
  }

  return message;
}

/**
 * Merge worktree back to original branch (cleanup).
 */
export function mergeWorktreeBack(
  projectRoot: string,
  changeName: string,
): boolean {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    throw new Error(`Loop not initialized for change: ${changeName}`);
  }

  const loop = state.loop_state;

  if (!loop.worktree_path || !loop.original_branch) {
    return false; // No worktree to merge
  }

  if (loop.merged_back) {
    return true; // Already merged
  }

  try {
    // Push worktree changes to a branch
    const worktreeBranch = `loop/${changeName}`;
    // Avoid shell operators; try -b first, then plain checkout as fallback
    const branchRes = spawnSync('git', ['checkout', '-b', worktreeBranch], {
      cwd: loop.worktree_path,
      stdio: 'ignore',
    });
    if (branchRes.status !== 0) {
      spawnSync('git', ['checkout', worktreeBranch], {
        cwd: loop.worktree_path,
        stdio: 'ignore',
      });
    }
    spawnSync('git', ['push', 'origin', worktreeBranch], {
      cwd: loop.worktree_path,
      stdio: 'ignore',
    });

    // Switch back to original branch and merge
    spawnSync('git', ['checkout', loop.original_branch], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
    spawnSync('git', ['merge', worktreeBranch], {
      cwd: projectRoot,
      stdio: 'ignore',
    });

    loop.merged_back = true;
    state.loop_state = loop;
    saveChangeState(projectRoot, changeName, state, state.scope);

    return true;
  } catch {
    return false;
  }
}

/**
 * Get loop status summary.
 */
export function getLoopStatus(
  projectRoot: string,
  changeName: string,
): LoopStatusSummary | null {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    return null;
  }

  const loop = state.loop_state;
  const lastRound = loop.rounds[loop.rounds.length - 1];

  return {
    changeName,
    phase: loop.phase,
    currentRound: loop.current_round,
    maxRounds: loop.max_rounds,
    goal: loop.goal,
    lastEvaluation: lastRound?.evaluation ?? null,
    progressTrend: loop.progress_trend,
    worktreePath: loop.worktree_path,
    totalActions: loop.total_actions,
    canContinue:
      loop.phase !== 'converged' &&
      loop.phase !== 'exhausted' &&
      loop.phase !== 'blocked' &&
      loop.current_round < loop.max_rounds,
    blockReason:
      loop.phase === 'blocked'
        ? lastRound?.evaluation?.block_reason
        : undefined,
  };
}

/**
 * Resume a blocked loop.
 */
export function resumeLoop(
  projectRoot: string,
  changeName: string,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    throw new Error(`Loop not initialized for change: ${changeName}`);
  }

  const loop = state.loop_state;

  if (loop.phase !== 'blocked') {
    throw new Error(`Cannot resume: loop is in '${loop.phase}' phase (not blocked)`);
  }

  loop.phase = 'plan';
  state.loop_state = loop;
  saveChangeState(projectRoot, changeName, state, state.scope);

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'loop.resume',
    change: changeName,
    result: 'success',
  });
}

/**
 * Extend the max rounds limit.
 */
export function extendLoop(
  projectRoot: string,
  changeName: string,
  additionalRounds: number,
): LoopState {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    throw new Error(`Loop not initialized for change: ${changeName}`);
  }

  const loop = state.loop_state;
  loop.max_rounds += additionalRounds;

  // If exhausted, allow continuing
  if (loop.phase === 'exhausted' && loop.current_round < loop.max_rounds) {
    loop.phase = 'plan';
  }

  state.loop_state = loop;
  saveChangeState(projectRoot, changeName, state, state.scope);

  return loop;
}

/**
 * Exit the loop (mark as complete).
 */
export function exitLoop(
  projectRoot: string,
  changeName: string,
  _reason: string,
): void {
  const state = loadChangeState(projectRoot, changeName);
  if (!state?.loop_state) {
    throw new Error(`Loop not initialized for change: ${changeName}`);
  }

  const loop = state.loop_state;
  loop.phase = 'converged';

  state.loop_state = loop;
  saveChangeState(projectRoot, changeName, state, state.scope);

  appendAuditLog(getMumuSpecDir(projectRoot), {
    actor: 'user',
    action: 'loop.exit',
    change: changeName,
    result: 'success',
  });
}

// ════════════════════════════════════════════════════════════════════
// Worktree Management
// ════════════════════════════════════════════════════════════════════

/**
 * Create an isolated worktree for loop execution.
 */
function createWorktree(
  projectRoot: string,
  changeName: string,
): { worktreePath: string; originalBranch: string } {
  // Get current branch
  const branchRes = spawnSync('git', ['branch', '--show-current'], {
    cwd: projectRoot,
    encoding: 'utf-8',
  });
  const originalBranch = (branchRes.stdout ?? '').trim();

  const worktreeBranch = `loop/${changeName}`;
  const worktreePath = resolve(projectRoot, '.mumuspec', '.loop-worktrees', changeName);

  // Clean up existing worktree/branch if they exist (from previous failed attempt)
  try {
    spawnSync('git', ['worktree', 'remove', worktreePath, '--force'], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
  } catch {
    // Ignore - worktree may not exist
  }
  try {
    spawnSync('git', ['branch', '-D', worktreeBranch], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
  } catch {
    // Ignore - branch may not exist
  }

  // Create worktree on a new branch
  // Note: ensureDir is intentionally NOT called here - git worktree add creates the directory
  spawnSync(
    'git',
    ['worktree', 'add', '-b', worktreeBranch, worktreePath, originalBranch],
    { cwd: projectRoot, stdio: 'ignore' }
  );

  return { worktreePath, originalBranch };
}

/**
 * Clean up worktrees that have been merged or are stale.
 */
export function cleanupWorktrees(
  projectRoot: string,
  options: { dryRun?: boolean; stale?: boolean } = {},
): { cleaned: string[]; remaining: string[] } {
  const cleaned: string[] = [];
  const remaining: string[] = [];

  // List all worktrees
  const listRes = spawnSync('git', ['worktree', 'list', '--porcelain'], {
    cwd: projectRoot,
    encoding: 'utf-8',
  });
  const output = listRes.stdout ?? '';

  const worktrees = parseWorktreeList(output);

  for (const wt of worktrees) {
    // Skip main worktree
    if (wt.path === projectRoot) {
      remaining.push(wt.path);
      continue;
    }

    // Check if it's a loop worktree
    if (!wt.path.includes('.loop-worktrees')) {
      remaining.push(wt.path);
      continue;
    }

    // Check if merged
    const isMerged = checkBranchMerged(projectRoot, wt.branch || '');

    if (isMerged) {
      if (!options.dryRun) {
        try {
          spawnSync('git', ['worktree', 'remove', wt.path, '--force'], {
            cwd: projectRoot,
            stdio: 'ignore',
          });
        } catch {
          // Ignore cleanup errors
        }
      }
      cleaned.push(wt.path);
    } else {
      remaining.push(wt.path);
    }
  }

  return { cleaned, remaining };
}

/**
 * Parse git worktree list --porcelain output.
 */
function parseWorktreeList(output: string): Array<{ path: string; branch: string | null }> {
  const worktrees: Array<{ path: string; branch: string | null }> = [];
  const blocks = output.split('\n\n').filter((b) => b.trim());

  for (const block of blocks) {
    const lines = block.split('\n');
    let path = '';
    let branch: string | null = null;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        path = line.substring('worktree '.length);
      } else if (line.startsWith('branch ')) {
        branch = line.substring('branch '.length).replace('refs/heads/', '');
      }
    }

    if (path) {
      worktrees.push({ path, branch });
    }
  }

  return worktrees;
}

/**
 * Check if a branch has been merged into the current branch.
 */
function checkBranchMerged(projectRoot: string, branch: string): boolean {
  if (!branch) return false;
  try {
    const mergedRes = spawnSync('git', ['branch', '--merged', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
    return (mergedRes.stdout ?? '').split('\n').some((b) => b.trim().replace('* ', '') === branch);
  } catch {
    return false;
  }
}
/**
 * Get the active worktree path for the current loop (if any).
 */
function getActiveWorktreePath(projectRoot: string): string | undefined {
  const state = getActiveLoopState(projectRoot);
  return state?.worktree_path;
}

/**
 * Load the loop state of the currently active change.
 */
function getActiveLoopState(projectRoot: string): LoopState | undefined {
  const activeChange = getActiveChange(projectRoot);
  if (!activeChange) return undefined;

  const state = loadChangeState(projectRoot, activeChange);
  return state?.loop_state;
}

// ════════════════════════════════════════════════════════════════════
// Stagnation Detection
// ════════════════════════════════════════════════════════════════════

/**
 * Detect if the loop is stagnating (no progress in recent rounds).
 */
export function detectStagnation(loop: LoopState): boolean {
  const trend = loop.progress_trend;
  if (trend.length < STAGNATION_LIMIT) return false;

  // Check if the last N rounds had no improvement
  const recent = trend.slice(-STAGNATION_LIMIT);
  const allSame = recent.every((v) => Math.abs(v - recent[0]) < 0.05);
  return allSame && recent[0] < CONVERGENCE_THRESHOLD;
}

/**
 * Get recommended action based on loop state.
 */
export function getLoopRecommendation(loop: LoopState): string {
  if (loop.phase === 'converged') {
    return 'Loop has converged. Run `mumuspec loop exit` to finalize.';
  }
  if (loop.phase === 'exhausted') {
    return `Loop exhausted after ${loop.current_round} rounds. Use 'mumuspec loop extend <n>' to add rounds or 'mumuspec loop exit' to finish.`;
  }
  if (loop.phase === 'blocked') {
    return 'Loop is blocked. Resolve the issue and run `mumuspec loop resume`.';
  }
  if (loop.phase === 'init' || loop.phase === 'plan') {
    return `Ready for round ${loop.current_round + 1}. Run 'mumuspec loop round "<plan>"' to start.`;
  }
  if (loop.phase === 'act') {
    return 'Currently executing actions. Record actions with `mumuspec loop action "<desc>"`.';
  }
  return '';
}
