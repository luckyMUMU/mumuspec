/**
 * Tests for src/core/grill-me.ts — Universal Phase-Gate Questioning Engine.
 */
import { describe, it, expect } from 'vitest';
import {
  runGrillMeStatic,
  runGrillMeInteractive,
  formatStaticReport,
  buildGrillMeResult,
  type GrillMeContext,
  type GrillMePhase,
} from '../../src/core/grill-me.js';
import type { ChangeState } from '../../src/core/types-workflow.js';

// ════════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════════

function makeChangeState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: 'test-change',
    phase: 'open',
    workflow: 'full',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    affected_scopes: [],
    build_layers: [],
    test_cases: {
      design_locked: false,
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    },
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 5,
    build_mode: 'direct',
    tdd_mode: 'tdd',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: true,
    decisions_log: { counts: {} },
    rollback_history: [],
    ...overrides,
  };
}

function makeCtx(overrides: Partial<GrillMeContext> = {}): GrillMeContext {
  return {
    phase: 'design',
    projectRoot: '.',
    changeState: makeChangeState(),
    ...overrides,
  };
}

// ════════════════════════════════════════════════════════════════════
// Static Mode — Phase Qualification
// ════════════════════════════════════════════════════════════════════

describe('runGrillMeStatic', () => {
  describe('phase routing', () => {
    it('accepts valid phases', () => {
      const phases: GrillMePhase[] = ['open', 'design', 'build', 'verify', 'loop'];
      for (const phase of phases) {
        const ctx: GrillMeContext = { phase, projectRoot: '.' };
        const report = runGrillMeStatic(ctx);
        expect(report.phase).toBe(phase);
      }
    });
  });

  describe('open phase criteria', () => {
    it('fails when affected_scopes is empty', () => {
      const ctx = makeCtx({
        phase: 'open',
        changeState: makeChangeState({ affected_scopes: [] }),
      });
      const report = runGrillMeStatic(ctx);
      const scopeCriterion = report.criteria.find((c) => c.id === 'open-scope-defined');
      expect(scopeCriterion).toBeDefined();
      expect(scopeCriterion!.passed).toBe(false);
    });

    it('passes when affected_scopes is defined', () => {
      const ctx = makeCtx({
        phase: 'open',
        changeState: makeChangeState({ affected_scopes: ['src/core'] }),
      });
      const report = runGrillMeStatic(ctx);
      const scopeCriterion = report.criteria.find((c) => c.id === 'open-scope-defined');
      expect(scopeCriterion!.passed).toBe(true);
    });
  });

  describe('design phase criteria', () => {
    it('fails when no build_layers defined', () => {
      const ctx = makeCtx({
        phase: 'design',
        changeState: makeChangeState({ build_layers: [] }),
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(false);
    });

    it('fails when test cases not locked', () => {
      const ctx = makeCtx({
        phase: 'design',
        changeState: makeChangeState({
          build_layers: [{ layer: 0, scope: 'core', status: 'done' }],
          test_cases: {
            design_locked: false,
            suites_locked: false,
            suites_locked_layers: [],
            suites_hash: {},
          },
        }),
      });
      const report = runGrillMeStatic(ctx);
      const tcCriterion = report.criteria.find((c) => c.id === 'design-testcases-designed');
      expect(tcCriterion).toBeDefined();
      expect(tcCriterion!.passed).toBe(false);
    });

    it('detects ambiguities when criteria pass but questions remain', () => {
      const ctx = makeCtx({
        phase: 'design',
        changeState: makeChangeState({
          phase: 'design',
          workflow: 'full',
          build_layers: [{ layer: 0, scope: 'core', status: 'done' }],
          test_cases: {
            design_locked: true,
            suites_locked: false,
            suites_locked_layers: [],
            suites_hash: {},
          },
          decisions_log: { counts: {} }, // no design decisions
          cognitive_framework: {
            enabled: true,
            q1_count: 4,
            q2_pending: 0,
            q3_pending: 0,
            q4_scans_completed: 1, // < 3 triggers ambiguity
            converged: false,
            rounds_completed: 1,
          },
        }),
      });
      const report = runGrillMeStatic(ctx);
      // Should have detected ambiguities about design decisions and blind spots
      expect(report.ambiguities.length).toBeGreaterThan(0);
    });
  });

  describe('build phase criteria', () => {
    it('fails when suites not locked', () => {
      const ctx = makeCtx({
        phase: 'build',
        changeState: makeChangeState({
          test_cases: {
            design_locked: true,
            suites_locked: false,
            suites_locked_layers: [],
            suites_hash: {},
          },
        }),
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(false);
    });

    it('passes when suites locked and covered', () => {
      const ctx = makeCtx({
        phase: 'build',
        changeState: makeChangeState({
          build_layers: [
            { layer: 0, scope: 'core', status: 'done' },
            { layer: 1, scope: 'ui', status: 'done' },
          ],
          test_cases: {
            design_locked: true,
            suites_locked: true,
            suites_locked_layers: [0, 1],
            suites_hash: {},
          },
        }),
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(true);
    });
  });

  describe('verify phase criteria', () => {
    it('fails when verify_result is not pass', () => {
      const ctx = makeCtx({
        phase: 'verify',
        changeState: makeChangeState({ verify_result: 'fail' }),
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(false);
    });

    it('passes when all verify criteria met', () => {
      const ctx = makeCtx({
        phase: 'verify',
        changeState: makeChangeState({
          verify_result: 'pass',
          branch_status: 'handled',
        }),
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(true);
    });
  });

  describe('loop phase criteria', () => {
    it('fails with vague goal', () => {
      const ctx = makeCtx({ phase: 'loop', goal: 'fix' });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(false);
    });

    it('fails with no criteria', () => {
      const ctx = makeCtx({
        phase: 'loop',
        goal: '实现完整 grill-me 引擎',
        criteria: [],
      });
      const report = runGrillMeStatic(ctx);
      // criteria-exist is an error => not passed
      expect(report.passed).toBe(false);
    });

    it('passes with valid loop params', () => {
      const ctx = makeCtx({
        phase: 'loop',
        goal: '实现完整 grill-me 阶段准入质询引擎',
        criteria: ['功能实现完成', '测试通过'],
        maxRounds: 3,
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(true);
    });

    it('passes with maxRounds=5', () => {
      const ctx = makeCtx({
        phase: 'loop',
        goal: '实现完整 grill-me 阶段准入质询引擎',
        criteria: ['完成'],
        maxRounds: 5,
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(true);
    });

    it('fails with maxRounds=0', () => {
      const ctx = makeCtx({
        phase: 'loop',
        goal: '实现完整 grill-me 阶段准入质询引擎',
        criteria: ['完成'],
        maxRounds: 0,
      });
      const report = runGrillMeStatic(ctx);
      expect(report.passed).toBe(false);
    });

    it('detects multi-goal ambiguity', () => {
      const ctx = makeCtx({
        phase: 'loop',
        goal: '实现 A, 实现 B, 实现 C, 实现 D',
        criteria: ['完成'],
        maxRounds: 3,
      });
      const report = runGrillMeStatic(ctx);
      // Should flag the multi-goal ambiguity
      const splitAmbiguity = report.ambiguities.find((a) => a.id === 'loop-goal-split');
      expect(splitAmbiguity).toBeDefined();
    });
  });
});

// ════════════════════════════════════════════════════════════════════
// buildGrillMeResult
// ════════════════════════════════════════════════════════════════════

describe('buildGrillMeResult', () => {
  it('builds a valid result object with phase', () => {
    const report = {
      phase: 'design' as GrillMePhase,
      questions: [],
      answers: [],
      consensusReached: true,
      roundsUsed: 5,
      maxRounds: 10,
      deferredCount: 0,
      completed: true,
    };
    const result = buildGrillMeResult(report);
    expect(result).toBeDefined();
    expect(result!.completed).toBe(true);
    expect(result!.phase).toBe('design');
    expect(result!.rounds).toBe(5);
    expect(result!.max_rounds).toBe(10);
    expect(result!.deferred_count).toBe(0);
    expect(result!.consensus_reached).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════
// formatStaticReport
// ════════════════════════════════════════════════════════════════════

describe('formatStaticReport', () => {
  it('formats a passing report', () => {
    const ctx = makeCtx({
      phase: 'verify',
      changeState: makeChangeState({
        verify_result: 'pass',
        branch_status: 'handled',
      }),
    });
    const report = runGrillMeStatic(ctx);
    const output = formatStaticReport(report);

    expect(output).toContain('Grill-Me');
    expect(output).toContain('verify');
    expect(output).toContain('通过');
  });

  it('formats a failing report', () => {
    const ctx = makeCtx({
      phase: 'build',
      changeState: makeChangeState({
        test_cases: {
          design_locked: true,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
      }),
    });
    const report = runGrillMeStatic(ctx);
    const output = formatStaticReport(report);

    expect(output).toContain('需修正');
    expect(output).toContain('error');
  });

  it('includes ambiguity hints when present', () => {
    const ctx = makeCtx({
      phase: 'loop',
      goal: '实现 A, 实现 B, 实现 C, 实现 D',
      criteria: ['完成'],
    });
    const report = runGrillMeStatic(ctx);
    const output = formatStaticReport(report);

    expect(output).toContain('疑义');
    expect(output).toContain('interactive');
  });
});

// ════════════════════════════════════════════════════════════════════
// Interactive Mode — Injectable Prompt Tests
// ════════════════════════════════════════════════════════════════════

/**
 * Create a mock prompt function that returns scripted responses.
 * Default (when exhausted) returns 'y' — tests MUST provide enough responses.
 */
function createMockPrompt(defaultResponse = 'y') {
  let index = 0;
  const responses: string[] = [];
  const promptFn = async (_question: string): Promise<string> => {
    return index < responses.length ? responses[index++] : defaultResponse;
  };
  return {
    promptFn,
    setResponses: (r: string[]) => { responses.length = 0; responses.push(...r); index = 0; },
    getCallCount: () => index,
  };
}

// Seed with initial responses
function makePrompt(responses: string[], defaultResponse = 'y') {
  const mock = createMockPrompt(defaultResponse);
  mock.setResponses(responses);
  return mock;
}

describe('runGrillMeInteractive', () => {
  // Helper to create a design-phase context that generates multiple questions
  function makeMultiQuestionCtx(overrides: Partial<GrillMeContext> = {}): GrillMeContext {
    return makeCtx({
      phase: 'design',
      changeState: makeChangeState({
        phase: 'design',
        workflow: 'full',
        build_layers: [{ layer: 0, scope: 'core', status: 'pending' }],
        test_cases: {
          design_locked: false,
          suites_locked: false,
          suites_locked_layers: [],
          suites_hash: {},
        },
        decisions_log: { counts: {} }, // triggers design-decisions-sufficient
        cognitive_framework: {
          enabled: true,
          q1_count: 4,
          q2_pending: 0,
          q3_pending: 0,
          q4_scans_completed: 0, // triggers design-blind-spots
          converged: false,
          rounds_completed: 0,
        },
        hyperplan_result: {
          triggered: false,
          hard_constraints_merged: false, // triggers dfs-arch-constraints
          open_questions_resolved: false,
          degraded: false,
        },
        modules_affected: 3, // triggers dfs-multi-module
      }),
      ...overrides,
    });
  }

  it('accepts all questions and reaches consensus', async () => {
    // Design phase generates 5 questions; accept all (5 answers + gate 'y')
    const { promptFn } = makePrompt(['y', 'y', 'y', 'y', 'y', 'y']);

    const ctx = makeMultiQuestionCtx({
      interactive: true,
      maxQuestionRounds: 10,
      promptFn,
    });

    const report = await runGrillMeInteractive(ctx);

    expect(report.phase).toBe('design');
    expect(report.completed).toBe(true);
    expect(report.questions.length).toBeGreaterThan(0);
    expect(report.consensusReached).toBe(true);
    expect(report.deferredCount).toBe(0);
  });

  it('tracks deferred items and triggers gate with consensus', async () => {
    // 2 defers + 3 accepts + gate 'y'
    const { promptFn } = makePrompt(['d', 'd', 'y', 'y', 'y', 'y']);

    const ctx = makeMultiQuestionCtx({
      interactive: true,
      maxQuestionRounds: 10,
      promptFn,
    });

    const report = await runGrillMeInteractive(ctx);

    expect(report.deferredCount).toBe(2);
    expect(report.consensusReached).toBe(true);
  });

  it('rejects consensus when user says no at gate', async () => {
    // 2 defers + 3 accepts + gate 'n'
    const { promptFn } = makePrompt(['d', 'd', 'y', 'y', 'y', 'n'], 'n');

    const ctx = makeMultiQuestionCtx({
      interactive: true,
      maxQuestionRounds: 10,
      promptFn,
    });

    const report = await runGrillMeInteractive(ctx);

    expect(report.deferredCount).toBe(2);
    expect(report.consensusReached).toBe(false);
  });

  it('enforces max rounds limit', async () => {
    // 7 answers but only 2 rounds allowed (second round answer triggers comment prompt in rejection path, so answer 'y' is safer)
    const { promptFn } = makePrompt(['y', 'y']);

    const ctx = makeMultiQuestionCtx({
      interactive: true,
      maxQuestionRounds: 2,
      promptFn,
    });

    const report = await runGrillMeInteractive(ctx);

    expect(report.roundsUsed).toBe(2);
    expect(report.maxRounds).toBe(2);
    expect(report.completed).toBe(true);
  });

  it('skips questions via skip option', async () => {
    // 2 skips (become deferred) + 3 accepts + gate 'y'
    const { promptFn } = makePrompt(['s', 's', 'y', 'y', 'y', 'y']);

    const ctx = makeMultiQuestionCtx({
      interactive: true,
      maxQuestionRounds: 10,
      promptFn,
    });

    const report = await runGrillMeInteractive(ctx);

    // Skipped items count as deferred
    expect(report.deferredCount).toBe(2);
    expect(report.roundsUsed).toBe(5);
    // Skipped questions are still tracked in answers
    const deferredAnswers = report.answers.filter((a) => a.status === 'deferred');
    expect(deferredAnswers.length).toBe(2);
  });

  it('records rejection with comment', async () => {
    // Q1 reject -> needs comment, then 3 accepts + gate 'y'
    const { promptFn } = makePrompt(['n', '因为范围太大', 'y', 'y', 'y', 'y']);

    const ctx = makeMultiQuestionCtx({
      interactive: true,
      maxQuestionRounds: 10,
      promptFn,
    });

    const report = await runGrillMeInteractive(ctx);

    const rejectedAnswer = report.answers.find((a) => a.status === 'rejected');
    expect(rejectedAnswer).toBeDefined();
    expect(rejectedAnswer!.comment).toBe('因为范围太大');
  });
});
