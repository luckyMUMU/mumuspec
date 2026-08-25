/**
 * Tests for team/engine.ts — TeamEngine orchestration and MockRuntimeAdapter.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { TeamEngine, MockRuntimeAdapter } from '../../src/team/engine.js';
import type { TeamConfig, TeamState } from '../../src/core/types-team.js';

// ── Test config fixture ──
function createTestConfig(minScore = 80, maxRounds = 5): TeamConfig {
  return {
    version: 1,
    lead: 'team-lead',
    description: 'Test team config',
    members: [
      {
        role: 'member-a',
        instances: 2,
        orientations: ['stable', 'innovative'],
      },
      {
        role: 'member-b',
        instances: 1,
      },
    ],
    evaluator: {
      role: 'evaluator',
      min_score: minScore,
      dimensions: [
        { name: '质量', weight: 50 },
        { name: '成本', weight: 50 },
      ],
    },
    iteration: {
      max_rounds: maxRounds,
      stop_on_convergence: true,
    },
  };
}

function createInitialState(config: TeamConfig): TeamState {
  return {
    enabled: true,
    config_path: 'test-config.yaml',
    config,
    phase: 'clarify',
    current_round: 0,
    rounds: [],
    proposal_refs: {},
    best_score: 0,
    best_round: 0,
  };
}

describe('team/engine', () => {
  let adapter: MockRuntimeAdapter;
  let config: TeamConfig;

  beforeEach(() => {
    adapter = new MockRuntimeAdapter();
    config = createTestConfig();
  });

  // ── TeamEngine initialization ──
  describe('TeamEngine initialization', () => {
    it('initializes with valid config', () => {
      const engine = new TeamEngine(adapter);
      const result = engine.initialize(config);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects invalid config', () => {
      const engine = new TeamEngine(adapter);
      const invalidConfig = { ...config, lead: '' };
      const result = engine.initialize(invalidConfig);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('sets phase to clarify after init', () => {
      const engine = new TeamEngine(adapter);
      engine.initialize(config);
      expect(engine.getState().phase).toBe('clarify');
    });

    it('restores state from initialState', () => {
      const state = createInitialState(config);
      state.current_round = 2;
      const engine = new TeamEngine(adapter, state);
      expect(engine.getState().current_round).toBe(2);
    });
  });

  // ── Phase checks ──
  describe('phase checks', () => {
    it('isTerminal returns false for clarify phase', () => {
      const engine = new TeamEngine(adapter, createInitialState(config));
      expect(engine.isTerminal()).toBe(false);
    });

    it('isTerminal returns true for converged phase', () => {
      const state = createInitialState(config);
      state.phase = 'converged';
      const engine = new TeamEngine(adapter, state);
      expect(engine.isTerminal()).toBe(true);
    });

    it('isTerminal returns true for exhausted phase', () => {
      const state = createInitialState(config);
      state.phase = 'exhausted';
      const engine = new TeamEngine(adapter, state);
      expect(engine.isTerminal()).toBe(true);
    });

    it('canContinue returns true for iterate phase', () => {
      const state = createInitialState(config);
      state.phase = 'iterate';
      state.current_round = 1;
      const engine = new TeamEngine(adapter, state);
      expect(engine.canContinue()).toBe(true);
    });

    it('canContinue returns false when max rounds reached', () => {
      const state = createInitialState(config);
      state.phase = 'iterate';
      state.current_round = 5; // max is 5
      const engine = new TeamEngine(adapter, state);
      expect(engine.canContinue()).toBe(false);
    });

    it('isBarMet returns true when best_score >= min_score', () => {
      const state = createInitialState(config);
      state.best_score = 85;
      const engine = new TeamEngine(adapter, state);
      expect(engine.isBarMet()).toBe(true);
    });

    it('isBarMet returns false when best_score < min_score', () => {
      const state = createInitialState(config);
      state.best_score = 75;
      const engine = new TeamEngine(adapter, state);
      expect(engine.isBarMet()).toBe(false);
    });
  });

  // ── Clarify phase ──
  describe('clarify', () => {
    it('runs lead and returns brief', async () => {
      const engine = new TeamEngine(adapter, createInitialState(config));
      const result = await engine.clarify('Test request');
      expect(result.brief).toBeTruthy();
      expect(result.clarification_complete).toBe(true);
    });

    it('logs clarify event', async () => {
      const engine = new TeamEngine(adapter, createInitialState(config));
      await engine.clarify('Test');
      const events = engine.getEventLog();
      expect(events.some(e => e.event === 'team_clarify_complete')).toBe(true);
    });
  });

  // ── Full round execution ──
  describe('runRound', () => {
    let engine: TeamEngine;

    beforeEach(() => {
      engine = new TeamEngine(adapter, createInitialState(config));
    });

    it('executes a complete round', async () => {
      const round = await engine.runRound('Test brief');
      expect(round.round).toBe(1);
      expect(round.member_results.length).toBe(3); // 2 + 1 instances
      expect(round.evaluation).not.toBeNull();
    });

    it('increments round counter', async () => {
      await engine.runRound('Brief 1');
      expect(engine.getState().current_round).toBe(1);
      await engine.runRound('Brief 2');
      expect(engine.getState().current_round).toBe(2);
    });

    it('tracks best score across rounds', async () => {
      // Configure adapter to give increasing scores
      adapter.scoreSequence = [70, 85];
      await engine.runRound('Brief 1');
      await engine.runRound('Brief 2');
      expect(engine.getState().best_score).toBeGreaterThanOrEqual(85);
    });

    it('converges when bar is met', async () => {
      adapter.scoreSequence = [90]; // Above min_score=80
      await engine.runRound('Brief');
      expect(engine.getState().phase).toBe('converged');
    });

    it('iterates when bar is not met', async () => {
      adapter.scoreSequence = [70]; // Below min_score=80
      await engine.runRound('Brief');
      expect(engine.getState().phase).toBe('iterate');
    });

    it('exhausts when max rounds reached without convergence', async () => {
      const exhaustConfig = createTestConfig(80, 2);
      const exhaustEngine = new TeamEngine(adapter, createInitialState(exhaustConfig));
      adapter.scoreSequence = [70, 75]; // Both below bar
      await exhaustEngine.runRound('Brief 1');
      await exhaustEngine.runRound('Brief 2');
      expect(exhaustEngine.getState().phase).toBe('exhausted');
    });

    it('persists proposal refs after round', async () => {
      await engine.runRound('Brief');
      const refs = engine.getState().proposal_refs;
      expect(Object.keys(refs).length).toBeGreaterThan(0);
    });

    it('rounds history grows with each round', async () => {
      await engine.runRound('Brief 1');
      await engine.runRound('Brief 2');
      expect(engine.getState().rounds).toHaveLength(2);
    });
  });

  // ── Event logging ──
  describe('event logging', () => {
    it('logs init event on initialize', () => {
      const engine = new TeamEngine(adapter);
      engine.initialize(config);
      const events = engine.getEventLog();
      expect(events.some(e => e.event === 'team_init')).toBe(true);
    });

    it('logs round_start event', async () => {
      const engine = new TeamEngine(adapter, createInitialState(config));
      await engine.runRound('Brief');
      const events = engine.getEventLog();
      expect(events.some(e => e.event === 'team_round_start')).toBe(true);
    });

    it('logs convergence event when bar met', async () => {
      adapter.scoreSequence = [90];
      const engine = new TeamEngine(adapter, createInitialState(config));
      await engine.runRound('Brief');
      const events = engine.getEventLog();
      expect(events.some(e => e.event === 'team_converged')).toBe(true);
    });
  });

  // ── Status summary ──
  describe('getStatusSummary', () => {
    it('returns correct summary', () => {
      const engine = new TeamEngine(adapter, createInitialState(config));
      const summary = engine.getStatusSummary('test-change');
      expect(summary.changeName).toBe('test-change');
      expect(summary.currentRound).toBe(0);
      expect(summary.maxRounds).toBe(5);
      expect(summary.memberCount).toBe(3); // 2 + 1
    });
  });

  // ── Confirm selection ──
  describe('confirmSelection', () => {
    it('sets confirmed selection', () => {
      const engine = new TeamEngine(adapter, createInitialState(config));
      engine.confirmSelection('member-a-1');
      expect(engine.getState().confirmed_selection).toBe('member-a-1');
    });

    it('logs user confirm event', () => {
      const engine = new TeamEngine(adapter, createInitialState(config));
      engine.confirmSelection('member-b-1');
      const events = engine.getEventLog();
      expect(events.some(e => e.event === 'team_user_confirm')).toBe(true);
    });
  });
});

// ── MockRuntimeAdapter tests ──
describe('MockRuntimeAdapter', () => {
  let adapter: MockRuntimeAdapter;

  beforeEach(() => {
    adapter = new MockRuntimeAdapter();
  });

  it('spawnMember returns mock output ref', async () => {
    const result = await adapter.spawnMember({
      instance_id: 'test-1',
      role: 'test',
      orientation: 'stable',
      round: 1,
      brief: 'Test',
      feedback: '',
    });
    expect(result.output_ref).toContain('test-1');
    expect(result.output_ref).toContain('round1');
    expect(result.success).toBe(true);
  });

  it('runLeader returns mock brief', async () => {
    const result = await adapter.runLead({
      config: createTestConfig(),
      initial_request: 'Test request',
      project_context: {},
    });
    expect(result.brief).toContain('Test request');
    expect(result.clarification_complete).toBe(true);
  });

  it('runEvaluator returns deterministic scores', async () => {
    adapter.scoreSequence = [85];
    const result = await adapter.runEvaluator({
      proposals: { 'a-1': 'ref1', 'a-2': 'ref2' },
      dimensions: [{ name: '质量', weight: 100 }],
      min_score: 80,
      brief: 'Test',
    });
    expect(result.scores['a-1']).toBeDefined();
    expect(result.scores['a-2']).toBeDefined();
    expect(result.bar_met).toBe(true);
  });

  it('runEvaluator ranks by score', async () => {
    adapter.scoreSequence = [85];
    const result = await adapter.runEvaluator({
      proposals: { 'a-1': 'ref1', 'a-2': 'ref2' },
      dimensions: [{ name: '质量', weight: 100 }],
      min_score: 80,
      brief: 'Test',
    });
    expect(result.ranking.length).toBe(2);
    expect(result.best_instance_id).toBe(result.ranking[0]);
  });

  it('name is "mock"', () => {
    expect(adapter.name).toBe('mock');
  });
});
