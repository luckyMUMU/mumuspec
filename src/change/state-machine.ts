import type {
  ChangePhase,
  ChangeState,
  Workflow,
  GuardResult,
} from '../core/types.js';

/**
 * Blocking point definitions.
 * Each transition that requires user confirmation is listed here
 * with its BP code and description.
 */
const BLOCKING_TRANSITIONS: Record<string, { bp: string; description: string; required: boolean }> = {
  'open→design': { bp: 'BP-3', description: '工件审查与确认', required: true },
  'open→build': { bp: 'BP-3', description: '工件审查与确认（预设路径）', required: true },
  'design→build': { bp: 'BP-4', description: '设计方案确认', required: true },
  'build→verify': { bp: 'BP-9', description: '计划就绪暂停确认', required: false },
  'verify→archive-in-progress': { bp: 'BP-17', description: '归档最终确认', required: true },
};

/** Check if a transition requires user confirmation */
export function requiresUserConfirmation(from: ChangePhase, to: ChangePhase): { required: boolean; bp: string; description: string } {
  const key = `${from}→${to}`;
  const info = BLOCKING_TRANSITIONS[key];
  if (info) {
    return { required: info.required, bp: info.bp, description: info.description };
  }
  return { required: false, bp: '', description: '' };
}

/** Valid state transitions */
const FORWARD_TRANSITIONS: Record<ChangePhase, ChangePhase[]> = {
  'open': ['design', 'build'], // build for hotfix/tweak
  'design': ['build'],
  'build': ['verify', 'design'], // design via rollback
  'verify': ['archive-in-progress', 'design', 'build'], // rollbacks
  'archive-in-progress': ['archive-completed', 'build'], // build via CI fail rollback
  'archive-completed': [],
  'discarded': [],
};

/** Rollback transitions */
const ROLLBACK_TRANSITIONS: Record<string, { from: ChangePhase; to: ChangePhase; counted: boolean; event: string }> = {
  'build_to_design': { from: 'build', to: 'design', counted: true, event: 'build-rollback' },
  'verify_to_design': { from: 'verify', to: 'design', counted: true, event: 'verify-rollback' },
  'verify_to_build': { from: 'verify', to: 'build', counted: false, event: 'verify-rebuild' },
  'archive_ci_fail': { from: 'archive-in-progress', to: 'build', counted: true, event: 'archive-rollback' },
};

/** Check if a transition is valid */
export function canTransition(from: ChangePhase, to: ChangePhase): boolean {
  const allowed = FORWARD_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/** Get all valid transitions from a phase */
export function getValidTransitions(from: ChangePhase): ChangePhase[] {
  return [...(FORWARD_TRANSITIONS[from] || [])];
}

/** Check if a rollback is valid and within limits */
export function canRollback(
  state: ChangeState,
  rollbackType: keyof typeof ROLLBACK_TRANSITIONS,
): GuardResult {
  const errors: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];

  const transition = ROLLBACK_TRANSITIONS[rollbackType];
  if (!transition) {
    errors.push({
      code: 'E-CHANGE-006',
      message: `Unknown rollback type: ${rollbackType}`,
    });
    return { passed: false, errors, warnings };
  }

  if (state.phase !== transition.from) {
    errors.push({
      code: 'E-CHANGE-006',
      message: `Cannot rollback from ${state.phase} (expected ${transition.from})`,
    });
    return { passed: false, errors, warnings };
  }

  if (transition.counted) {
    if (state.rollback_count >= state.rollback_limit) {
      errors.push({
        code: 'E-CHANGE-002',
        message: `rollback_count已达上限 (${state.rollback_count}/${state.rollback_limit})`,
      });
      return { passed: false, errors, warnings };
    }
  } else {
    if (state.rebuild_count >= state.rebuild_limit) {
      // Force upgrade to verify_to_design_rollback
      warnings.push({
        code: 'E-CHANGE-003',
        message: `rebuild_count已达上限 (${state.rebuild_count}/${state.rebuild_limit}), 强制升级为Design回退`,
      });
      return {
        passed: false,
        errors,
        warnings,
      };
    }
  }

  return { passed: true, errors, warnings };
}

/** Execute a transition (returns updated state) */
export function executeTransition(
  state: ChangeState,
  to: ChangePhase,
  options?: { userConfirmed?: boolean; reason?: string },
): { state: ChangeState; success: boolean; error?: string } {
  // Check if already in target phase (clearer error message)
  if (state.phase === to) {
    return {
      state,
      success: false,
      error: `E-CHANGE-007: Already in phase '${to}', no transition needed`,
    };
  }

  if (!canTransition(state.phase, to)) {
    const validTargets = getValidTransitions(state.phase);
    const hint = validTargets.length > 0
      ? `valid targets from ${state.phase}: [${validTargets.join(', ')}]`
      : `${state.phase} is terminal`;
    return {
      state,
      success: false,
      error: `E-CHANGE-006: Invalid transition from ${state.phase} to ${to} (${hint})`,
    };
  }

  // Check for terminal states
  if (state.phase === 'archive-completed' || state.phase === 'discarded') {
    return {
      state,
      success: false,
      error: `E-CHANGE-006: ${state.phase} is terminal`,
    };
  }

  const newState: ChangeState = {
    ...state,
    phase: to,
    updated_at: new Date().toISOString(),
    user_confirmed: options?.userConfirmed ?? state.user_confirmed,
  };

  return { state: newState, success: true };
}

/** Execute a rollback (returns updated state with side effects) */
export function executeRollback(
  state: ChangeState,
  rollbackType: keyof typeof ROLLBACK_TRANSITIONS,
  reason: string,
): { state: ChangeState; success: boolean; error?: string } {
  const guard = canRollback(state, rollbackType);
  if (!guard.passed) {
    return {
      state,
      success: false,
      error: guard.errors.map((e) => `${e.code}: ${e.message}`).join('; '),
    };
  }

  const transition = ROLLBACK_TRANSITIONS[rollbackType];
  const newState: ChangeState = {
    ...state,
    phase: transition.to,
    updated_at: new Date().toISOString(),
    rollback_history: [
      ...state.rollback_history,
      {
        from: transition.from,
        to: transition.to,
        reason,
        timestamp: new Date().toISOString(),
        counted: transition.counted,
        event: transition.event,
      },
    ],
  };

  if (transition.counted) {
    newState.rollback_count = state.rollback_count + 1;
    // Reset build layers and test locks
    newState.build_layers = state.build_layers.map((l) => ({ ...l, status: 'pending' as const }));
    newState.test_cases = {
      ...state.test_cases,
      design_locked: false,
      suites_locked: false,
      suites_locked_layers: [],
      suites_hash: {},
    };
  } else {
    newState.rebuild_count = state.rebuild_count + 1;
    // Only reset failed layers (for verify_to_build)
    // In practice, specific layers would be reset; here we reset all pending
    newState.build_layers = state.build_layers.map((l) => ({
      ...l,
      status: l.status === 'done' ? 'pending' : l.status,
    }));
  }

  return { state: newState, success: true };
}

/** Get the next phase suggestion */
export function getNextPhase(state: ChangeState): { phase: ChangePhase; description: string } | undefined {
  switch (state.phase) {
    case 'open':
      if (state.workflow === 'hotfix' || state.workflow === 'tweak') {
        return { phase: 'build', description: '跳过Design，进入Build阶段（hotfix/tweak）' };
      }
      return { phase: 'design', description: '进入Design阶段（技术设计）' };
    case 'design':
      return { phase: 'build', description: '进入Build阶段（实现+TDD）' };
    case 'build':
      return { phase: 'verify', description: '进入Verify阶段（验证）' };
    case 'verify':
      return { phase: 'archive-in-progress', description: '进入Archive阶段（归档）' };
    case 'archive-in-progress':
      return { phase: 'archive-completed', description: '完成归档' };
    default:
      return undefined;
  }
}

/** Get workflow-appropriate phases */
export function getWorkflowPhases(workflow: Workflow): ChangePhase[] {
  switch (workflow) {
    case 'hotfix':
      return ['open', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
    case 'tweak':
      return ['open', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
    case 'full':
      return ['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
  }
}

/** Check if a phase is terminal */
export function isTerminal(phase: ChangePhase): boolean {
  return phase === 'archive-completed' || phase === 'discarded';
}
