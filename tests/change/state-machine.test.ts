/**
 * Tests for src/change/state-machine.ts — phase transition state machine
 *
 * Expanded coverage: valid/invalid transitions, rollback mechanics,
 * workflow preset branches, transition hooks, context-aware filtering.
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  canTransitionWithContext,
  getValidTransitions,
  getValidTransitionsWithContext,
  requiresUserConfirmation,
  executeTransition,
  executeRollback,
  executeRollbackByEdge,
  canRollback,
  getNextPhase,
  getWorkflowPhases,
  isTerminal,
  findTransitionPath,
  detectPhaseCycles,
  getAllPhaseEdges,
  getPhaseGraph,
  type RollbackType,
} from '../../src/change/state-machine.js';

// ─── Type imports ───

import type { ChangeState, ChangePhase, Workflow, BuildLayer, TestCasesState } from '../../src/core/types.js';

// ─── Helpers ───

function makeTestState(overrides: Partial<ChangeState> = {}): ChangeState {
  const buildLayers: BuildLayer[] = overrides.build_layers ?? [
    { layer: 1, scope: 'core', status: 'done' },
    { layer: 2, scope: 'api', status: 'done' },
    { layer: 3, scope: 'ui', status: 'in-progress' },
  ];
  const testCases: TestCasesState = overrides.test_cases ?? {
    design_locked: true,
    design_content_hash: 'abc123',
    suites_locked: true,
    suites_locked_layers: [1, 2],
    suites_hash: { 1: 'hash1', 2: 'hash2' },
  };

  return {
    name: 'test-change',
    phase: 'open',
    workflow: 'full',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    affected_scopes: [],
    build_layers: buildLayers,
    test_cases: testCases,
    rollback_count: 0,
    rebuild_count: 0,
    rollback_limit: 3,
    rebuild_limit: 2,
    build_mode: 'incremental',
    tdd_mode: 'auto',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {}, content_hash: undefined },
    rollback_history: [],
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Existing baseline tests (preserved)
// ═══════════════════════════════════════════════════════════════════

describe('phase state machine', () => {
  it('allows forward transitions', () => {
    expect(canTransition('open', 'design')).toBe(true);
    expect(canTransition('design', 'build')).toBe(true);
  });

  it('allows flexible backward transitions between non-terminal states', () => {
    expect(canTransition('build', 'open')).toBe(true);
  });

  it('blocks all transitions from terminal states', () => {
    expect(canTransition('archive-completed', 'build')).toBe(false);
    expect(canTransition('discarded', 'open')).toBe(false);
  });

  it('getValidTransitions returns allowed next phases', () => {
    const transitions = getValidTransitions('open');
    expect(transitions).toContain('design');
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('isTerminal identifies archive-completed as terminal', () => {
    expect(isTerminal('archive-completed')).toBe(true);
  });

  it('isTerminal returns false for reversible phases', () => {
    expect(isTerminal('open')).toBe(false);
    expect(isTerminal('build')).toBe(false);
  });

  it('findTransitionPath returns valid path', () => {
    const path = findTransitionPath('open', 'archive-completed');
    expect(path).toBeInstanceOf(Array);
    expect(path).toContain('open');
    expect(path[path.length - 1]).toBe('archive-completed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE A: Valid forward transition coverage
// ═══════════════════════════════════════════════════════════════════

describe('valid forward transitions (full graph)', () => {
  it('open to design is valid (forward)', () => {
    expect(canTransition('open', 'design')).toBe(true);
  });

  it('design to build is valid (forward)', () => {
    expect(canTransition('design', 'build')).toBe(true);
  });

  it('build to verify is valid (forward)', () => {
    expect(canTransition('build', 'verify')).toBe(true);
  });

  it('verify to archive-in-progress is valid (forward)', () => {
    expect(canTransition('verify', 'archive-in-progress')).toBe(true);
  });

  it('archive-in-progress to archive-completed is valid (forward)', () => {
    expect(canTransition('archive-in-progress', 'archive-completed')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE B: Invalid transition verification
// ═══════════════════════════════════════════════════════════════════

describe('invalid transitions', () => {
  it('open to build blocked (skip edge only valid for hotfix/tweak)', () => {
    const state = makeTestState({ workflow: 'full' });
    expect(canTransitionWithContext('open', 'build', state)).toBe(false);
  });

  it('allows open to verify via flexible forward edge', () => {
    expect(canTransition('open', 'verify')).toBe(true);
  });

  it('allows design to verify via flexible forward edge', () => {
    expect(canTransition('design', 'verify')).toBe(true);
  });

  it('blocks self-loop: open to open', () => {
    expect(canTransition('open', 'open')).toBe(false);
  });

  it('blocks terminal to anything', () => {
    expect(canTransition('archive-completed', 'open')).toBe(false);
    expect(canTransition('archive-completed', 'build')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE C: Backward transitions (rollback/rebuild edges)
// ═══════════════════════════════════════════════════════════════════

describe('backward transition edges', () => {
  it('build to design is a backward (rollback) edge', () => {
    expect(canTransition('build', 'design')).toBe(true);
  });

  it('verify to design is a backward (rollback) edge', () => {
    expect(canTransition('verify', 'design')).toBe(true);
  });

  it('verify to build is a backward (rebuild) edge', () => {
    expect(canTransition('verify', 'build')).toBe(true);
  });

  it('archive-in-progress to build is a backward (rollback) edge', () => {
    expect(canTransition('archive-in-progress', 'build')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE D: Skip edges (workflow preset branches)
// ═══════════════════════════════════════════════════════════════════

describe('skip edges (workflow presets)', () => {
  const hotfixState = makeTestState({ workflow: 'hotfix' });
  const tweakState = makeTestState({ workflow: 'tweak' });
  const fullState = makeTestState({ workflow: 'full' });

  it('open to build available for hotfix workflow', () => {
    expect(canTransitionWithContext('open', 'build', hotfixState)).toBe(true);
  });

  it('open to build available for tweak workflow', () => {
    expect(canTransitionWithContext('open', 'build', tweakState)).toBe(true);
  });

  it('open to build blocked for full workflow', () => {
    expect(canTransitionWithContext('open', 'build', fullState)).toBe(false);
  });

  it('getValidTransitionsWithContext filters skip edges for full workflow', () => {
    const transitions = getValidTransitionsWithContext('open', fullState);
    expect(transitions).toContain('design');
    expect(transitions).not.toContain('build');
  });

  it('getValidTransitionsWithContext includes skip edges for hotfix workflow', () => {
    const transitions = getValidTransitionsWithContext('open', hotfixState);
    expect(transitions).toContain('build');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE E: Terminal phase checks
// ═══════════════════════════════════════════════════════════════════

describe('terminal phase detection', () => {
  it('archive-completed is terminal', () => {
    expect(isTerminal('archive-completed')).toBe(true);
  });

  it('discarded is terminal', () => {
    expect(isTerminal('discarded')).toBe(true);
  });

  it('open is NOT terminal', () => {
    expect(isTerminal('open')).toBe(false);
  });

  it('design is NOT terminal', () => {
    expect(isTerminal('design')).toBe(false);
  });

  it('build is NOT terminal', () => {
    expect(isTerminal('build')).toBe(false);
  });

  it('verify is NOT terminal', () => {
    expect(isTerminal('verify')).toBe(false);
  });

  it('archive-in-progress is NOT terminal', () => {
    expect(isTerminal('archive-in-progress')).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE F: getWorkflowPhases
// ═══════════════════════════════════════════════════════════════════

describe('getWorkflowPhases', () => {
  it('full workflow includes all 6 phases', () => {
    const phases = getWorkflowPhases('full');
    expect(phases).toEqual([
      'open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed',
    ]);
  });

  it('hotfix workflow skips design', () => {
    const phases = getWorkflowPhases('hotfix');
    expect(phases).toEqual([
      'open', 'build', 'verify', 'archive-in-progress', 'archive-completed',
    ]);
    expect(phases).not.toContain('design');
  });

  it('tweak workflow skips design', () => {
    const phases = getWorkflowPhases('tweak');
    expect(phases).toEqual([
      'open', 'build', 'verify', 'archive-in-progress', 'archive-completed',
    ]);
  });

  it('loop workflow starts from build', () => {
    const phases = getWorkflowPhases('loop');
    expect(phases).toEqual([
      'build', 'verify', 'archive-in-progress', 'archive-completed',
    ]);
    expect(phases).not.toContain('open');
    expect(phases).not.toContain('design');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE G: executeTransition — success cases
// ═══════════════════════════════════════════════════════════════════

describe('executeTransition — success paths', () => {
  it('transitions open to design and updates state', () => {
    const state = makeTestState({ phase: 'open' });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('design');
    expect(result.state.updated_at).not.toBe(state.updated_at);
  });

  it('transitions design to build', () => {
    const state = makeTestState({ phase: 'design' });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('build');
  });

  it('transitions build to verify', () => {
    const state = makeTestState({ phase: 'build' });
    const result = executeTransition(state, 'verify');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('verify');
  });

  it('transitions verify to archive-in-progress', () => {
    const state = makeTestState({ phase: 'verify' });
    const result = executeTransition(state, 'archive-in-progress');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('archive-in-progress');
  });

  it('transitions archive-in-progress to archive-completed', () => {
    const state = makeTestState({ phase: 'archive-in-progress' });
    const result = executeTransition(state, 'archive-completed');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('archive-completed');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE H: executeTransition — error cases
// ═══════════════════════════════════════════════════════════════════

describe('executeTransition — error paths', () => {
  it('fails when transitioning to same phase', () => {
    const state = makeTestState({ phase: 'build' });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-007');
    expect(result.error).toContain('Already in phase');
  });

  it('fails when from phase is terminal', () => {
    const state = makeTestState({ phase: 'archive-completed' });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-006');
    expect(result.error).toContain('terminal');
  });

  it('fails for non-existent edge (terminal target is not flexible)', () => {
    const state = makeTestState({ phase: 'open' });
    const result = executeTransition(state, 'archive-completed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-006');
    expect(result.error).toContain('Invalid transition');
  });

  it('error message includes valid targets hint', () => {
    const state = makeTestState({ phase: 'open' });
    const result = executeTransition(state, 'archive-completed');
    expect(result.error).toContain('valid targets from open');
  });

  it('userConfirmed is updated from options', () => {
    const state = makeTestState({ phase: 'open', user_confirmed: false });
    const result = executeTransition(state, 'design', { userConfirmed: true });
    expect(result.success).toBe(true);
    expect(result.state.user_confirmed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE I: executeTransition — rollback side effects
// ═══════════════════════════════════════════════════════════════════

describe('executeTransition — rollback side effects', () => {
  it('increments rollback_count on build to design', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 0 });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.rollback_count).toBe(1);
  });

  it('increments rebuild_count on verify to build', () => {
    const state = makeTestState({ phase: 'verify', rebuild_count: 0 });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    expect(result.state.rebuild_count).toBe(1);
  });

  it('resets build_layers to pending on rollback', () => {
    const state = makeTestState({
      phase: 'build',
      build_layers: [
        { layer: 1, scope: 'core', status: 'done' },
        { layer: 2, scope: 'api', status: 'in-progress' },
      ],
    });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    for (const layer of result.state.build_layers) {
      expect(layer.status).toBe('pending');
    }
  });

  it('resets test_locks on rollback', () => {
    const state = makeTestState({
      phase: 'build',
      test_cases: {
        design_locked: true,
        design_content_hash: 'abc',
        suites_locked: true,
        suites_locked_layers: [1, 2],
        suites_hash: { 1: 'h1', 2: 'h2' },
      },
    });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.test_cases.design_locked).toBe(false);
    expect(result.state.test_cases.suites_locked).toBe(false);
    expect(result.state.test_cases.suites_locked_layers).toEqual([]);
  });

  it('only resets done layers on rebuild', () => {
    const state = makeTestState({
      phase: 'verify',
      build_layers: [
        { layer: 1, scope: 'core', status: 'done' },
        { layer: 2, scope: 'api', status: 'in-progress' },
        { layer: 3, scope: 'ui', status: 'pending' },
      ],
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    expect(result.state.build_layers[0]!.status).toBe('pending');
    expect(result.state.build_layers[1]!.status).toBe('in-progress');
    expect(result.state.build_layers[2]!.status).toBe('pending');
  });

  it('appends to rollback_history on backward transition', () => {
    const state = makeTestState({ phase: 'build', rollback_history: [] });
    const result = executeTransition(state, 'design', { reason: 'test rollback' });
    expect(result.success).toBe(true);
    expect(result.state.rollback_history.length).toBe(1);
    expect(result.state.rollback_history[0]!.from).toBe('build');
    expect(result.state.rollback_history[0]!.to).toBe('design');
    expect(result.state.rollback_history[0]!.counted).toBe(true);
    expect(result.state.rollback_history[0]!.event).toContain('rollback');
  });

  it('preserves existing rollback_history entries', () => {
    const existingEntry = {
      from: 'verify' as ChangePhase,
      to: 'build' as ChangePhase,
      reason: 'previous rollback',
      timestamp: '2024-01-01T00:00:00Z',
      counted: false,
      event: 'rollback-verify-to-build',
    };
    const state = makeTestState({ phase: 'build', rollback_history: [existingEntry] });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.rollback_history.length).toBe(2);
    expect(result.state.rollback_history[0]).toEqual(existingEntry);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE J: executeRollback
// ═══════════════════════════════════════════════════════════════════

describe('executeRollback', () => {
  it('executes build_to_design rollback', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 0 });
    const result = executeRollback(state, 'build_to_design', 'reason');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('design');
    expect(result.state.rollback_count).toBe(1);
  });

  it('executes verify_to_design rollback', () => {
    const state = makeTestState({ phase: 'verify', rollback_count: 0 });
    const result = executeRollback(state, 'verify_to_design', 'reason');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('design');
  });

  it('executes verify_to_build rollback (rebuild)', () => {
    const state = makeTestState({ phase: 'verify', rebuild_count: 0 });
    const result = executeRollback(state, 'verify_to_build', 'reason');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('build');
    expect(result.state.rebuild_count).toBe(1);
  });

  it('executes archive_ci_fail rollback', () => {
    const state = makeTestState({ phase: 'archive-in-progress', rollback_count: 0 });
    const result = executeRollback(state, 'archive_ci_fail', 'reason');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('build');
  });

  it('fails when phase does not match rollback source', () => {
    const state = makeTestState({ phase: 'open' });
    const result = executeRollback(state, 'build_to_design', 'reason');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Cannot rollback from open');
  });

  it('fails when rollback_count exceeds limit', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 3, rollback_limit: 3 });
    const result = executeRollback(state, 'build_to_design', 'reason');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-002');
    expect(result.error).toContain('rollback_count');
  });

  it('fails when rebuild_count exceeds rebuild_limit', () => {
    const state = makeTestState({ phase: 'verify', rebuild_count: 2, rebuild_limit: 2 });
    const result = executeRollback(state, 'verify_to_build', 'reason');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-003');
    expect(result.error).toContain('rebuild_count');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE K: executeRollbackByEdge
// ═══════════════════════════════════════════════════════════════════

describe('executeRollbackByEdge', () => {
  it('succeeds for valid backward edge', () => {
    const state = makeTestState({ phase: 'build' });
    const result = executeRollbackByEdge(state, 'design', 'reason');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('design');
  });

  it('fails when to-phase is not a backward edge (forward edge)', () => {
    const state = makeTestState({ phase: 'open' });
    const result = executeRollbackByEdge(state, 'design', 'reason');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No backward edge');
  });

  it('fails when edge does not exist', () => {
    const state = makeTestState({ phase: 'open' });
    const result = executeRollbackByEdge(state, 'verify', 'reason');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No backward edge');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE K2: Flexible transitions (non-terminal free jumps)
// ═══════════════════════════════════════════════════════════════════

describe('flexible transitions (non-terminal free jumps)', () => {
  it('getValidTransitions includes flexible targets', () => {
    expect(getValidTransitions('open')).toContain('verify');
    expect(getValidTransitions('open')).toContain('archive-in-progress');
    expect(getValidTransitions('build')).toContain('open');
  });

  it('getValidTransitions never synthesizes into terminal states', () => {
    expect(getValidTransitions('open')).not.toContain('archive-completed');
    expect(getValidTransitions('design')).not.toContain('archive-completed');
    expect(getValidTransitions('archive-completed')).toHaveLength(0);
  });

  it('does not synthesize flexible edges from terminal states', () => {
    expect(canTransition('archive-completed', 'verify')).toBe(false);
    expect(canTransition('discarded', 'build')).toBe(false);
  });

  it('does not synthesize flexible edges into terminal states', () => {
    expect(canTransition('open', 'archive-completed')).toBe(false);
    expect(canTransition('design', 'archive-completed')).toBe(false);
  });

  it('executeTransition flexible forward jump succeeds without counters', () => {
    const state = makeTestState({ phase: 'open', rollback_count: 1 });
    const result = executeTransition(state, 'verify');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('verify');
    expect(result.state.rollback_count).toBe(1);
    expect(result.state.rollback_history).toHaveLength(0);
  });

  it('executeTransition flexible backward jump counts as rollback', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 0 });
    const result = executeTransition(state, 'open');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('open');
    expect(result.state.rollback_count).toBe(1);
    expect(result.state.rollback_history[0]!.counted).toBe(true);
  });

  it('blocks flexible backward jump when rollback limit reached', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 3, rollback_limit: 3 });
    const result = executeTransition(state, 'open');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-002');
  });

  it('executeRollbackByEdge accepts flexible backward edges', () => {
    const state = makeTestState({ phase: 'build' });
    const result = executeRollbackByEdge(state, 'open', 'flexible rollback');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('open');
    expect(result.state.rollback_count).toBe(1);
  });

  it('requiresUserConfirmation is false for flexible edges', () => {
    expect(requiresUserConfirmation('open', 'verify').required).toBe(false);
    expect(requiresUserConfirmation('build', 'open').required).toBe(false);
  });

  it('conditional skip edge pair stays occupied for full workflow', () => {
    const fullState = makeTestState({ workflow: 'full' });
    expect(canTransitionWithContext('open', 'build', fullState)).toBe(false);
    expect(getValidTransitionsWithContext('open', fullState)).not.toContain('build');
    expect(getValidTransitionsWithContext('open', fullState)).toContain('verify');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE L: canRollback (guard checks)
// ═══════════════════════════════════════════════════════════════════

describe('canRollback guard', () => {
  it('returns passed=true for valid rollback', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 0 });
    const result = canRollback(state, 'build_to_design');
    expect(result.passed).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('returns passed=false when phase mismatches', () => {
    const state = makeTestState({ phase: 'verify' });
    const result = canRollback(state, 'build_to_design');
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-CHANGE-006')).toBe(true);
  });

  it('returns passed=false when rollback_count at limit', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 3, rollback_limit: 3 });
    const result = canRollback(state, 'build_to_design');
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === 'E-CHANGE-002')).toBe(true);
  });

  it('returns passed=false with warning when rebuild_count at limit', () => {
    const state = makeTestState({ phase: 'verify', rebuild_count: 2, rebuild_limit: 2 });
    const result = canRollback(state, 'verify_to_build');
    expect(result.passed).toBe(false);
    expect(result.warnings.some((w) => w.code === 'E-CHANGE-003')).toBe(true);
  });

  it('returns no warnings or errors when rollback is valid', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 0, rollback_limit: 5 });
    const result = canRollback(state, 'build_to_design');
    expect(result.passed).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE M: getNextPhase — workflow branching
// ═══════════════════════════════════════════════════════════════════

describe('getNextPhase — workflow preset branching', () => {
  it('suggests design for open phase (full workflow)', () => {
    const state = makeTestState({ phase: 'open', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next).toBeDefined();
    expect(next!.phase).toBe('design');
  });

  it('suggests build for open phase (hotfix workflow)', () => {
    const state = makeTestState({ phase: 'open', workflow: 'hotfix' });
    const next = getNextPhase(state);
    expect(next).toBeDefined();
    expect(next!.phase).toBe('build');
  });

  it('suggests build for open phase (tweak workflow)', () => {
    const state = makeTestState({ phase: 'open', workflow: 'tweak' });
    const next = getNextPhase(state);
    expect(next).toBeDefined();
    expect(next!.phase).toBe('build');
  });

  it('suggests build for design phase (full workflow)', () => {
    const state = makeTestState({ phase: 'design', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next).toBeDefined();
    expect(next!.phase).toBe('build');
  });

  it('suggests verify for build phase', () => {
    const state = makeTestState({ phase: 'build', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next).toBeDefined();
    expect(next!.phase).toBe('verify');
  });

  it('suggests archive-in-progress for verify phase', () => {
    const state = makeTestState({ phase: 'verify', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next).toBeDefined();
    expect(next!.phase).toBe('archive-in-progress');
  });

  it('suggests archive-completed for archive-in-progress phase', () => {
    const state = makeTestState({ phase: 'archive-in-progress', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next).toBeDefined();
    expect(next!.phase).toBe('archive-completed');
  });

  it('returns undefined for archive-completed (terminal)', () => {
    const state = makeTestState({ phase: 'archive-completed', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next).toBeUndefined();
  });

  it('returns undefined for discarded (terminal)', () => {
    const state = makeTestState({ phase: 'discarded', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next).toBeUndefined();
  });

  it('description includes workflow indicator for hotfix', () => {
    const state = makeTestState({ phase: 'open', workflow: 'hotfix' });
    const next = getNextPhase(state);
    expect(next!.description).toContain('hotfix');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE N: requiresUserConfirmation
// ═══════════════════════════════════════════════════════════════════

describe('requiresUserConfirmation', () => {
  it('open to design requires confirmation', () => {
    const result = requiresUserConfirmation('open', 'design');
    expect(result.required).toBe(true);
    expect(result.bp).toBe('BP-3');
    expect(result.description).toBeTruthy();
  });

  it('design to build requires confirmation', () => {
    const result = requiresUserConfirmation('design', 'build');
    expect(result.required).toBe(true);
    expect(result.bp).toBe('BP-4');
  });

  it('verify to archive-in-progress requires confirmation', () => {
    const result = requiresUserConfirmation('verify', 'archive-in-progress');
    expect(result.required).toBe(true);
    expect(result.bp).toBe('BP-17');
  });

  it('build to verify does NOT require confirmation', () => {
    const result = requiresUserConfirmation('build', 'verify');
    expect(result.required).toBe(false);
    expect(result.bp).toBe('');
    expect(result.description).toBe('');
  });

  it('non-existent edge returns no confirmation required', () => {
    const result = requiresUserConfirmation('open', 'archive-completed');
    expect(result.required).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE O: findTransitionPath
// ═══════════════════════════════════════════════════════════════════

describe('findTransitionPath', () => {
  it('finds path from open to archive-completed', () => {
    // Without context, findPath uses BFS which may take the shorter skip edge (open→build)
    const path = findTransitionPath('open', 'archive-completed');
    expect(path[0]).toBe('open');
    expect(path[path.length - 1]).toBe('archive-completed');
    expect(path.length).toBeGreaterThanOrEqual(4);
    // BFS finds shortest path: open→build (skip) → verify → archive-in-progress → archive-completed
    expect(path).toEqual([
      'open', 'build', 'verify', 'archive-in-progress', 'archive-completed',
    ]);
  });

  it('finds full workflow path when context filters skip edges', () => {
    // With full workflow context, skip edges are filtered out
    const state = makeTestState({ workflow: 'full' });
    const path = findTransitionPath('open', 'archive-completed', state);
    expect(path).toEqual([
      'open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed',
    ]);
  });

  it('finds path from design to verify', () => {
    const path = findTransitionPath('design', 'verify');
    expect(path).toEqual(['design', 'build', 'verify']);
  });

  it('finds path using backward edge (rollback)', () => {
    const path = findTransitionPath('verify', 'design');
    expect(path[0]).toBe('verify');
    expect(path[path.length - 1]).toBe('design');
  });

  it('returns same-phase path for identical from/to', () => {
    const path = findTransitionPath('build', 'build');
    expect(path).toEqual(['build']);
  });

  it('returns empty array when no path exists', () => {
    const path = findTransitionPath('archive-completed', 'open');
    expect(path).toEqual([]);
  });

  it('respects context for skip edges', () => {
    const state = makeTestState({ phase: 'open', workflow: 'full' });
    const path = findTransitionPath('open', 'verify', state);
    expect(path).toContain('design');
    expect(path).toContain('build');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE P: detectPhaseCycles and getAllPhaseEdges
// ═══════════════════════════════════════════════════════════════════

describe('graph inspection', () => {
  it('detects cycles in the graph (backward edges create cycles)', () => {
    const cycles = detectPhaseCycles();
    expect(Array.isArray(cycles)).toBe(true);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
  });

  it('each cycle has at least 2 phases', () => {
    const cycles = detectPhaseCycles();
    for (const cycle of cycles) {
      expect(cycle.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('cycles contain valid ChangePhase values', () => {
    const validPhases: ChangePhase[] = [
      'open', 'design', 'build', 'verify',
      'archive-in-progress', 'archive-completed', 'discarded',
    ];
    const cycles = detectPhaseCycles();
    for (const cycle of cycles) {
      for (const phase of cycle) {
        expect(validPhases).toContain(phase);
      }
    }
  });

  it('getAllPhaseEdges returns all edges', () => {
    const edges = getAllPhaseEdges();
    expect(Array.isArray(edges)).toBe(true);
    expect(edges.length).toBeGreaterThanOrEqual(10);
  });

  it('every edge has required properties', () => {
    const edges = getAllPhaseEdges();
    for (const edge of edges) {
      expect(edge).toHaveProperty('from');
      expect(edge).toHaveProperty('to');
      expect(edge).toHaveProperty('direction');
      expect(edge).toHaveProperty('countAs');
      expect(edge).toHaveProperty('label');
      expect(['forward', 'backward', 'skip']).toContain(edge.direction);
      expect(['rollback', 'rebuild', 'none']).toContain(edge.countAs);
    }
  });

  it('forward edges from each non-terminal phase', () => {
    const edges = getAllPhaseEdges();
    const forwardEdges = edges.filter((e) => e.direction === 'forward');
    const fromPhases = new Set(forwardEdges.map((e) => e.from));
    expect(fromPhases.has('open')).toBe(true);
    expect(fromPhases.has('design')).toBe(true);
    expect(fromPhases.has('build')).toBe(true);
    expect(fromPhases.has('verify')).toBe(true);
    expect(fromPhases.has('archive-in-progress')).toBe(true);
  });

  it('getPhaseGraph returns singleton', () => {
    const graph1 = getPhaseGraph();
    const graph2 = getPhaseGraph();
    expect(graph1).toBe(graph2);
  });

  it('graph isTerminalState matches isTerminal function', () => {
    const graph = getPhaseGraph();
    const phases: ChangePhase[] = [
      'open', 'design', 'build', 'verify',
      'archive-in-progress', 'archive-completed', 'discarded',
    ];
    for (const phase of phases) {
      expect(isTerminal(phase)).toBe(graph.isTerminalState(phase));
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE Q: Discard transitions
// ═══════════════════════════════════════════════════════════════════

describe('discard transitions (all phases can be abandoned)', () => {
  const discardablePhases: ChangePhase[] = ['open', 'design', 'build', 'verify', 'archive-in-progress'];

  for (const phase of discardablePhases) {
    it(`${phase} to discarded is valid`, () => {
      expect(canTransition(phase, 'discarded')).toBe(true);
    });
  }

  it('executeTransition to discarded succeeds from build', () => {
    const state = makeTestState({ phase: 'build' });
    const result = executeTransition(state, 'discarded');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('discarded');
  });

  it('discard does NOT increment rollback_count', () => {
    const state = makeTestState({ phase: 'build', rollback_count: 1 });
    const result = executeTransition(state, 'discarded');
    expect(result.success).toBe(true);
    expect(result.state.rollback_count).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE R: Rollback count accumulation
// ═══════════════════════════════════════════════════════════════════

describe('rollback count accumulation', () => {
  it('rollback_count accumulates across multiple rollbacks', () => {
    let state = makeTestState({ phase: 'build', rollback_count: 0 });

    let result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.rollback_count).toBe(1);

    result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.rollback_count).toBe(1);

    result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.rollback_count).toBe(2);
  });

  it('rebuild_count accumulates independently from rollback_count', () => {
    const state = makeTestState({
      phase: 'verify',
      rollback_count: 1,
      rebuild_count: 0,
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    expect(result.state.rebuild_count).toBe(1);
    expect(result.state.rollback_count).toBe(1);
  });

  it('respects limit across multiple calls', () => {
    let state = makeTestState({ phase: 'build', rollback_count: 2, rollback_limit: 3 });

    let result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    state = result.state;
    expect(state.rollback_count).toBe(3);

    result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    state = result.state;

    result = executeRollback(state, 'build_to_design', 'reason');
    expect(result.success).toBe(false);
    expect(result.error).toContain('rollback_count');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE S: Boundary conditions / state preservation
// ═══════════════════════════════════════════════════════════════════

describe('boundary conditions and state preservation', () => {
  it('executeTransition preserves all state fields not explicitly changed', () => {
    const state = makeTestState({
      phase: 'open',
      scope: 'custom-scope',
      affected_scopes: ['src/core', 'src/cli'],
      estimated_files: 10,
      is_pure_bugfix: true,
    });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.scope).toBe('custom-scope');
    expect(result.state.affected_scopes).toEqual(['src/core', 'src/cli']);
    expect(result.state.estimated_files).toBe(10);
    expect(result.state.is_pure_bugfix).toBe(true);
  });

  it('rolling back archives-in-progress resets build_layers', () => {
    const state = makeTestState({
      phase: 'archive-in-progress',
      build_layers: [
        { layer: 1, scope: 'core', status: 'done' },
        { layer: 2, scope: 'api', status: 'done' },
      ],
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    for (const layer of result.state.build_layers) {
      expect(layer.status).toBe('pending');
    }
  });

  it('reason option is used in rollback_history entry', () => {
    const state = makeTestState({ phase: 'build', rollback_history: [] });
    const result = executeTransition(state, 'design', { reason: 'specific failure reason' });
    expect(result.success).toBe(true);
    expect(result.state.rollback_history[0]!.reason).toBe('specific failure reason');
  });

  it('without reason option, default reason is generated from edge label', () => {
    const state = makeTestState({ phase: 'build', rollback_history: [] });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.rollback_history[0]!.reason).toContain('transition');
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE T: findTransitionPath — boundary conditions
// ═══════════════════════════════════════════════════════════════════

describe('findTransitionPath — boundary conditions', () => {
  it('finds path from open to archive-in-progress (skipping terminal)', () => {
    const path = findTransitionPath('open', 'archive-in-progress');
    expect(path[0]).toBe('open');
    expect(path[path.length - 1]).toBe('archive-in-progress');
    expect(path).not.toContain('archive-completed');
  });

  it('finds path from design to archive-in-progress', () => {
    const path = findTransitionPath('design', 'archive-in-progress');
    expect(path[0]).toBe('design');
    expect(path[path.length - 1]).toBe('archive-in-progress');
  });

  it('respects hotfix context to find shorter path via skip edges', () => {
    const state = makeTestState({ phase: 'open', workflow: 'hotfix' });
    const path = findTransitionPath('open', 'verify', state);
    // hotfix: open → build (skip) → verify
    expect(path).toEqual(['open', 'build', 'verify']);
  });

  it('respects tweak context for skip edges', () => {
    const state = makeTestState({ phase: 'open', workflow: 'tweak' });
    const path = findTransitionPath('open', 'verify', state);
    expect(path).toEqual(['open', 'build', 'verify']);
  });

  it('returns empty array for path from terminal state', () => {
    const path = findTransitionPath('discarded', 'build');
    expect(path).toEqual([]);
  });

  it('finds path from verify to archive-completed via forward edge', () => {
    // Even though flexible edges don't synthesize into terminal states,
    // the explicit forward edge from archive-in-progress → archive-completed
    // allows a path: verify → archive-in-progress → archive-completed
    const path = findTransitionPath('verify', 'archive-completed');
    expect(path[path.length - 1]).toBe('archive-completed');
    expect(path).toContain('archive-in-progress');
  });

  it('finds same-phase path for every non-terminal phase', () => {
    const phases: ChangePhase[] = ['open', 'design', 'build', 'verify', 'archive-in-progress'];
    for (const phase of phases) {
      const path = findTransitionPath(phase, phase);
      expect(path).toEqual([phase]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE U: executeTransition — additional error paths
// ═══════════════════════════════════════════════════════════════════

describe('executeTransition — additional error paths', () => {
  it('fails when transitioning from full workflow open to build (not a valid edge)', () => {
    const state = makeTestState({ phase: 'open', workflow: 'full' });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-006');
  });

  it('fails when rebuild limit exceeded on verify-to-build', () => {
    const state = makeTestState({
      phase: 'verify',
      rebuild_count: 2,
      rebuild_limit: 2,
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-003');
  });

  it('fails when rollback limit exceeded on verify-to-design', () => {
    const state = makeTestState({
      phase: 'verify',
      rollback_count: 3,
      rollback_limit: 3,
    });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-002');
  });

  it('succeeds flexible forward transition open → verify without counters', () => {
    const state = makeTestState({ phase: 'open', rollback_count: 1 });
    const result = executeTransition(state, 'verify');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('verify');
    // flexible forward does not increment rollback_count
    expect(result.state.rollback_count).toBe(1);
    expect(result.state.rollback_history).toHaveLength(0);
  });

  it('succeeds flexible backward transition verify → design with counter increment', () => {
    const state = makeTestState({ phase: 'verify', rollback_count: 0 });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.rollback_count).toBe(1);
    expect(result.state.rollback_history[0]!.counted).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// SUITE V: executeTransition with rebuild limit edge (boundary)
// ═══════════════════════════════════════════════════════════════════

describe('executeTransition — rebuild limit boundary', () => {
  it('succeeds verify-to-build rebuild when count equals limit minus one', () => {
    const state = makeTestState({
      phase: 'verify',
      rebuild_count: 1,
      rebuild_limit: 2,
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    expect(result.state.rebuild_count).toBe(2);
  });

  it('fails verify-to-build rebuild when count exactly at limit', () => {
    const state = makeTestState({
      phase: 'verify',
      rebuild_count: 2,
      rebuild_limit: 2,
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-003');
  });

  it('succeeds archive-to-build rollback when rollback below limit', () => {
    const state = makeTestState({
      phase: 'archive-in-progress',
      rollback_count: 0,
      rollback_limit: 3,
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(true);
    expect(result.state.rollback_count).toBe(1);
  });

  it('fails archive-to-build rollback when rollback at limit', () => {
    const state = makeTestState({
      phase: 'archive-in-progress',
      rollback_count: 3,
      rollback_limit: 3,
    });
    const result = executeTransition(state, 'build');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-002');
  });
});
