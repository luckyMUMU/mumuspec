import { describe, it, expect } from 'vitest';
import { canTransition, executeTransition, executeRollback, getValidTransitions, getNextPhase, getWorkflowPhases, isTerminal } from '../src/change/state-machine.js';
import type { ChangeState } from '../src/core/types.js';

function createTestState(overrides: Partial<ChangeState> = {}): ChangeState {
  return {
    name: 'test-change',
    phase: 'open',
    workflow: 'full',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
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
    build_mode: 'executing-plans',
    tdd_mode: 'tdd',
    isolation: 'worktree',
    single_active_change: true,
    user_confirmed: false,
    decisions_log: { counts: {} },
    rollback_history: [],
    ...overrides,
  };
}

describe('state-machine', () => {
  it('should allow open -> design transition', () => {
    const state = createTestState({ phase: 'open' });
    expect(canTransition('open', 'design')).toBe(true);
  });

  it('should allow open -> build for hotfix', () => {
    expect(canTransition('open', 'build')).toBe(true);
  });

  it('should allow open -> verify via flexible forward edge', () => {
    expect(canTransition('open', 'verify')).toBe(true);
  });

  it('should not allow terminal state transitions', () => {
    expect(canTransition('archive-completed', 'open')).toBe(false);
    expect(canTransition('discarded', 'open')).toBe(false);
  });

  it('should execute forward transition', () => {
    const state = createTestState({ phase: 'open' });
    const result = executeTransition(state, 'design');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('design');
  });

  it('should reject transition into terminal target', () => {
    const state = createTestState({ phase: 'open' });
    const result = executeTransition(state, 'archive-completed');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-006');
  });

  it('should execute rollback from build to design', () => {
    const state = createTestState({ phase: 'build' });
    const result = executeRollback(state, 'build_to_design', 'test reason');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('design');
    expect(result.state.rollback_count).toBe(1);
    expect(result.state.rollback_history).toHaveLength(1);
  });

  it('should execute rollback from verify to build (not counted)', () => {
    const state = createTestState({ phase: 'verify' });
    const result = executeRollback(state, 'verify_to_build', 'rebuild needed');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('build');
    expect(result.state.rebuild_count).toBe(1);
    expect(result.state.rollback_count).toBe(0);
  });

  it('should block rollback when limit reached', () => {
    const state = createTestState({ phase: 'build', rollback_count: 3, rollback_limit: 3 });
    const result = executeRollback(state, 'build_to_design', 'limit test');
    expect(result.success).toBe(false);
    expect(result.error).toContain('E-CHANGE-002');
  });

  it('should block rebuild when limit reached', () => {
    const state = createTestState({ phase: 'verify', rebuild_count: 5, rebuild_limit: 5 });
    const result = executeRollback(state, 'verify_to_build', 'limit test');
    expect(result.success).toBe(false);
  });

  it('should get valid transitions', () => {
    expect(getValidTransitions('open')).toContain('design');
    expect(getValidTransitions('open')).toContain('build');
    expect(getValidTransitions('archive-completed')).toHaveLength(0);
  });

  it('should allow flexible rollback build -> open (counted)', () => {
    const state = createTestState({ phase: 'build' });
    const result = executeTransition(state, 'open');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('open');
    expect(result.state.rollback_count).toBe(1);
  });

  it('should include flexible targets in getValidTransitions', () => {
    expect(getValidTransitions('open')).toContain('verify');
    expect(getValidTransitions('open')).not.toContain('archive-completed');
  });

  it('should suggest next phase for full workflow', () => {
    const state = createTestState({ phase: 'open', workflow: 'full' });
    const next = getNextPhase(state);
    expect(next?.phase).toBe('design');
  });

  it('should suggest next phase for hotfix (skip design)', () => {
    const state = createTestState({ phase: 'open', workflow: 'hotfix' });
    const next = getNextPhase(state);
    expect(next?.phase).toBe('build');
  });

  it('should return undefined next phase for terminal', () => {
    const state = createTestState({ phase: 'archive-completed' });
    const next = getNextPhase(state);
    expect(next).toBeUndefined();
  });

  it('should get workflow phases', () => {
    const fullPhases = getWorkflowPhases('full');
    expect(fullPhases).toContain('design');
    expect(fullPhases).toContain('build');

    const hotfixPhases = getWorkflowPhases('hotfix');
    expect(hotfixPhases).not.toContain('design');
  });

  it('should detect terminal states', () => {
    expect(isTerminal('archive-completed')).toBe(true);
    expect(isTerminal('discarded')).toBe(true);
    expect(isTerminal('open')).toBe(false);
  });
});
