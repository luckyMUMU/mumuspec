/**
 * Team Engine — orchestrates multi-role collaborative work.
 *
 * Core loop:
 *   clarify → propose → evaluate → (iterate if needed) → converged
 *
 * The engine is runtime-agnostic: it delegates agent execution to a
 * RuntimeAdapter, making it testable and portable across backends.
 *
 * ponytail: Engine state mutations are centralized in `applyRoundResult`.
 * No side effects outside state transitions — adapter handles I/O.
 */

import type {
  TeamConfig,
  TeamState,
  TeamRound,
  TeamMemberResult,
  TeamEvaluationResult,
  TeamScoreBreakdown,
  RuntimeAdapter,
  MemberExecutionContext,
  EvaluatorExecutionContext,
  LeadExecutionContext,
  MemberExecutionResult,
  EvaluatorExecutionResult,
  LeadExecutionResult,
  TeamStatusSummary,
  TeamEventRecord,
} from '../core/types-team.js';
import { validateTeamConfig } from './config.js';

// ════════════════════════════════════════════════════════════════════
// Engine Configuration
// ════════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════
// Team Engine
// ════════════════════════════════════════════════════════════════════

export class TeamEngine {
  private state: TeamState;
  private adapter: RuntimeAdapter;
  private eventLog: TeamEventRecord[] = [];

  constructor(adapter: RuntimeAdapter, initialState?: Partial<TeamState>) {
    this.adapter = adapter;
    this.state = {
      enabled: true,
      config_path: initialState?.config_path ?? '',
      phase: 'pending',
      current_round: 0,
      rounds: [],
      proposal_refs: {},
      best_score: 0,
      best_round: 0,
      ...initialState,
    };
  }

  // ─── Getters ─────────────────────────────────────────────────────

  getState(): TeamState {
    return { ...this.state };
  }

  getEventLog(): TeamEventRecord[] {
    return [...this.eventLog];
  }

  // ─── Phase Checks ────────────────────────────────────────────────

  isTerminal(): boolean {
    return this.state.phase === 'converged' || this.state.phase === 'exhausted';
  }

  isBarMet(): boolean {
    return this.state.best_score >= (this.state.config?.evaluator.min_score ?? 80);
  }

  canContinue(): boolean {
    if (this.isTerminal()) return false;
    if (this.state.phase === 'blocked') return false;
    const maxRounds = this.state.config?.iteration.max_rounds ?? 5;
    return this.state.current_round < maxRounds;
  }

  // ─── Core Orchestration ──────────────────────────────────────────

  /**
   * Initialize team mode: validate config and set initial state.
   */
  initialize(config: TeamConfig): { success: boolean; errors: string[]; warnings: string[] } {
    const validation = validateTeamConfig(config);
    if (!validation.valid) {
      return { success: false, errors: validation.errors, warnings: validation.warnings };
    }

    this.state.config = config;
    this.state.phase = 'clarify';
    this.logEvent('team_init', 'Team mode initialized');

    return { success: true, errors: [], warnings: validation.warnings };
  }

  /**
   * Run the clarification phase via the lead agent.
   * Returns the structured brief for distribution to members.
   */
  async clarify(initialRequest: string, projectContext: Record<string, string> = {}): Promise<LeadExecutionResult> {
    if (!this.state.config) {
      throw new Error('TeamEngine: config not set. Call initialize() first.');
    }

    this.state.phase = 'clarify';
    this.logEvent('team_clarify_complete', 'Starting clarification');

    const ctx: LeadExecutionContext = {
      config: this.state.config,
      initial_request: initialRequest,
      project_context: projectContext,
    };

    const result = await this.adapter.runLead(ctx);

    if (result.clarification_complete) {
      this.logEvent('team_clarify_complete', 'Clarification complete');
    }

    return result;
  }

  /**
   * Execute one full round: propose → evaluate.
   * Updates state with results.
   */
  async runRound(brief: string): Promise<TeamRound> {
    if (!this.state.config) {
      throw new Error('TeamEngine: config not set. Call initialize() first.');
    }

    if (!this.canContinue()) {
      throw new Error(`TeamEngine: cannot continue (phase=${this.state.phase}, round=${this.state.current_round})`);
    }

    const roundNum = this.state.current_round + 1;
    const startedAt = new Date().toISOString();

    this.state.current_round = roundNum;
    this.state.phase = 'propose';
    this.logEvent('team_round_start', `Round ${roundNum} started`, roundNum);

    // ── Phase 1: Propose (parallel member execution) ──
    const memberResults = await this.runProposePhase(brief, roundNum);

    // ── Phase 2: Evaluate ──
    this.state.phase = 'evaluate';
    const evaluation = await this.runEvaluatePhase(memberResults, brief);

    // ── Build round record ──
    const round: TeamRound = {
      round: roundNum,
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      member_results: memberResults,
      evaluation,
      end_phase: this.state.phase,
    };

    // ── Update state ──
    this.applyRoundResult(round);

    return round;
  }

  /**
   * Run the propose phase: spawn all member instances in parallel.
   */
  private async runProposePhase(brief: string, roundNum: number): Promise<TeamMemberResult[]> {
    const config = this.state.config!;
    const contexts: MemberExecutionContext[] = [];

    for (const member of config.members) {
      for (let i = 0; i < member.instances; i++) {
        const instanceId = `${member.role}-${i + 1}`;
        const orientation = member.orientations?.[i] ?? 'default';
        const previousOutputRef = this.state.proposal_refs[instanceId];
        const previousRound = this.state.rounds[roundNum - 2];
        const previousFeedback = previousRound?.evaluation?.feedback[instanceId] ?? '';

        contexts.push({
          instance_id: instanceId,
          role: member.role,
          orientation,
          round: roundNum,
          brief,
          feedback: previousFeedback,
          previous_output_ref: previousOutputRef,
        });
      }
    }

    // Execute all member instances in parallel
    const results = await Promise.all(
      contexts.map((ctx) => this.spawnMemberSafely(ctx)),
    );

    this.logEvent('team_propose_complete', `Propose phase complete: ${results.length} instances`);

    return results;
  }

  /**
   * Safely spawn a member, catching errors to avoid failing the entire round.
   */
  private async spawnMemberSafely(ctx: MemberExecutionContext): Promise<TeamMemberResult> {
    try {
      const result: MemberExecutionResult = await this.adapter.spawnMember(ctx);
      return {
        instance_id: ctx.instance_id,
        role: ctx.role,
        orientation: ctx.orientation,
        output_ref: result.output_ref,
        completed: result.success,
        error: result.error,
      };
    } catch (err) {
      return {
        instance_id: ctx.instance_id,
        role: ctx.role,
        orientation: ctx.orientation,
        output_ref: '',
        completed: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Run the evaluate phase: score all proposals.
   */
  private async runEvaluatePhase(
    memberResults: TeamMemberResult[],
    brief: string,
  ): Promise<TeamEvaluationResult> {
    const config = this.state.config!;
    const proposals: Record<string, string> = {};
    for (const r of memberResults) {
      if (r.completed) {
        proposals[r.instance_id] = r.output_ref;
      }
    }

    const ctx: EvaluatorExecutionContext = {
      proposals,
      dimensions: config.evaluator.dimensions,
      min_score: config.evaluator.min_score,
      brief,
    };

    let result: EvaluatorExecutionResult;
    try {
      result = await this.adapter.runEvaluator(ctx);
    } catch (err) {
      // Fallback: mark all as failed
      result = {
        scores: {},
        ranking: [],
        best_instance_id: '',
        best_score: 0,
        bar_met: false,
        feedback: {},
        report_ref: '',
      };
    }

    const evaluation: TeamEvaluationResult = {
      evaluator_id: config.evaluator.role,
      scores: result.scores,
      ranking: result.ranking,
      best_instance_id: result.best_instance_id,
      best_score: result.best_score,
      bar_met: result.bar_met,
      feedback: result.feedback,
      report_ref: result.report_ref,
    };

    this.logEvent('team_evaluate_complete', `Best score: ${result.best_score}`);

    return evaluation;
  }

  /**
   * Apply round results to state and determine next phase.
   */
  private applyRoundResult(round: TeamRound): void {
    this.state.rounds.push(round);

    // Update proposal refs
    for (const r of round.member_results) {
      if (r.completed) {
        this.state.proposal_refs[r.instance_id] = r.output_ref;
      }
    }

    // Update evaluation ref
    if (round.evaluation) {
      this.state.evaluation_ref = round.evaluation.report_ref;
    }

    // Track best score
    if (round.evaluation && round.evaluation.best_score > this.state.best_score) {
      this.state.best_score = round.evaluation.best_score;
      this.state.best_round = round.round;
    }

    // Determine next phase
    const config = this.state.config!;

    if (round.evaluation?.bar_met) {
      // Bar met → converged
      this.state.phase = 'converged';
      this.state.convergence_reason = `Round ${round.round}: best score ${round.evaluation.best_score} >= ${config.evaluator.min_score}`;
      this.logEvent('team_converged', this.state.convergence_reason);
    } else if (this.state.current_round >= config.iteration.max_rounds) {
      // Max rounds reached → exhausted
      this.state.phase = 'exhausted';
      this.logEvent('team_exhausted', `Max rounds (${config.iteration.max_rounds}) reached`);
    } else {
      // Continue iterating
      this.state.phase = 'iterate';
      this.logEvent('team_iteration_feedback', `Round ${round.round} below bar, iterating`);
    }
  }

  /**
   * Confirm user's final selection.
   */
  confirmSelection(instanceId: string): void {
    this.state.confirmed_selection = instanceId;
    this.logEvent('team_user_confirm', `User confirmed: ${instanceId}`);
  }

  /**
   * Get a status summary for display.
   */
  getStatusSummary(changeName: string): TeamStatusSummary {
    const config = this.state.config;
    const memberCount = config?.members.reduce((sum, m) => sum + m.instances, 0) ?? 0;
    const maxRounds = config?.iteration.max_rounds ?? 5;

    return {
      changeName,
      phase: this.state.phase,
      currentRound: this.state.current_round,
      maxRounds,
      bestScore: this.state.best_score,
      bestRound: this.state.best_round,
      configPath: this.state.config_path,
      memberCount,
      canContinue: this.canContinue(),
      barMet: this.isBarMet(),
      blockReason: this.state.phase === 'blocked' ? 'Needs user input' : undefined,
    };
  }

  // ─── Event Logging ───────────────────────────────────────────────

  private logEvent(event: TeamEventRecord['event'], detail: string, round?: number): void {
    this.eventLog.push({
      event,
      timestamp: new Date().toISOString(),
      round: round ?? this.state.current_round,
      phase: this.state.phase,
      detail,
    });
  }
}

// ════════════════════════════════════════════════════════════════════
// Mock Adapter (for testing and dry-run)
// ════════════════════════════════════════════════════════════════════

/**
 * MockRuntimeAdapter — deterministic adapter for testing.
 * Generates placeholder outputs and scores without invoking real agents.
 */
export class MockRuntimeAdapter implements RuntimeAdapter {
  readonly name = 'mock';

  /** Configurable score sequence per round (for testing convergence) */
  scoreSequence: number[] = [];
  /** Current index into scoreSequence */
  private scoreIndex = 0;

  async spawnMember(ctx: MemberExecutionContext): Promise<MemberExecutionResult> {
    return {
      output_ref: `mock-output/${ctx.instance_id}-round${ctx.round}.md`,
      success: true,
    };
  }

  async runEvaluator(ctx: EvaluatorExecutionContext): Promise<EvaluatorExecutionResult> {
    const score = this.scoreSequence[this.scoreIndex] ?? 70;
    this.scoreIndex++;

    const scores: Record<string, TeamScoreBreakdown> = {};
    const ranking: string[] = [];
    let bestId = '';
    let bestScore = 0;

    for (const [id] of Object.entries(ctx.proposals)) {
      // Deterministic pseudo-score based on instance and configured sequence
      const instanceNum = parseInt(id.split('-').pop() ?? '1', 10);
      const variant = score + (instanceNum - 2) * 3; // slight variation
      const clamped = Math.max(0, Math.min(100, variant));

      scores[id] = {
        dimensions: Object.fromEntries(
          ctx.dimensions.map((d) => [d.name, Math.round((clamped / 100) * d.weight)]),
        ),
        total: clamped,
        passed: clamped >= ctx.min_score,
      };
      ranking.push(id);
      if (clamped > bestScore) {
        bestScore = clamped;
        bestId = id;
      }
    }

    ranking.sort((a, b) => scores[b].total - scores[a].total);

    return {
      scores,
      ranking,
      best_instance_id: bestId,
      best_score: bestScore,
      bar_met: bestScore >= ctx.min_score,
      feedback: Object.fromEntries(
        ranking.slice(1).map((id) => [id, `Improve: score ${scores[id].total} < ${ctx.min_score}`]),
      ),
      report_ref: `mock-eval/report-round${this.scoreIndex}.md`,
    };
  }

  async runLead(ctx: LeadExecutionContext): Promise<LeadExecutionResult> {
    return {
      brief: `[Mock Brief] ${ctx.initial_request}`,
      clarification_complete: true,
    };
  }
}
