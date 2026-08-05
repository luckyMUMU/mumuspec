import type {
  ChangePhase,
  ChangeState,
  Workflow,
  GuardResult,
} from '../core/types.js';
import { PhaseGraph, DEFAULT_PHASE_GRAPH, type PhaseEdge } from './phase-graph.js';

/**
 * State machine implementation using a Directed Cyclic Graph (DCG).
 *
 * The graph explicitly models:
 * - Forward edges: progress toward completion
 * - Backward edges: rollback/rework (these create cycles)
 * - Skip edges: conditional shortcuts (hotfix/tweak)
 *
 * All public APIs maintain backward compatibility with the previous flat
 * transition tables. Internally, all operations delegate to the PhaseGraph.
 */

/**
 * Legacy rollback type identifiers — preserved for backward compatibility.
 * These map to specific backward edges in the DCG.
 */
export type RollbackType =
  | 'build_to_design'
  | 'verify_to_design'
  | 'verify_to_build'
  | 'archive_ci_fail';

/**
 * Map legacy rollback types to their corresponding graph edges.
 */
function resolveRollbackEdge(graph: PhaseGraph, type: RollbackType): PhaseEdge | undefined {
  const mapping: Record<RollbackType, { from: ChangePhase; to: ChangePhase }> = {
    'build_to_design': { from: 'build', to: 'design' },
    'verify_to_design': { from: 'verify', to: 'design' },
    'verify_to_build': { from: 'verify', to: 'build' },
    'archive_ci_fail': { from: 'archive-in-progress', to: 'build' },
  };

  const { from, to } = mapping[type];
  return graph.getEdge(from, to);
}

/**
 * Get the PhaseGraph instance. Currently uses the default singleton,
 * but allows future injection of custom graphs.
 */
function getGraph(): PhaseGraph {
  return DEFAULT_PHASE_GRAPH;
}

/**
 * Get the graph instance (public accessor for advanced usage).
 */
export function getPhaseGraph(): PhaseGraph {
  return DEFAULT_PHASE_GRAPH;
}

// ─── Backward-compatible API ──────────────────────────────────────────────

/**
 * Check if a transition is valid (edge exists in the DCG).
 * For backward compatibility, this does not check runtime conditions.
 * Use `canTransitionWithContext` for context-aware checks.
 */
export function canTransition(from: ChangePhase, to: ChangePhase): boolean {
  return getGraph().hasEdge(from, to);
}

/**
 * Context-aware transition check.
 * Returns true only if the edge exists AND any runtime conditions are satisfied.
 */
export function canTransitionWithContext(
  from: ChangePhase,
  to: ChangePhase,
  state: ChangeState,
): boolean {
  return getGraph().hasEdge(from, to, {
    workflow: state.workflow,
    ...stateToContext(state),
  });
}

/**
 * Get all valid transitions from a phase (all outgoing edges).
 */
export function getValidTransitions(from: ChangePhase): ChangePhase[] {
  return getGraph().getOutgoingEdges(from).map((e) => e.to);
}

/**
 * Get valid transitions with context awareness (filters conditional edges).
 */
export function getValidTransitionsWithContext(from: ChangePhase, state: ChangeState): ChangePhase[] {
  return getGraph()
    .getOutgoingEdges(from, { workflow: state.workflow, ...stateToContext(state) })
    .map((e) => e.to);
}

/**
 * Check if a transition requires user confirmation (has a blocking point).
 */
export function requiresUserConfirmation(from: ChangePhase, to: ChangePhase): {
  required: boolean;
  bp: string;
  description: string;
} {
  const edge = getGraph().getEdge(from, to);
  if (edge?.blockingPoint) {
    return {
      required: edge.blockingPoint.required,
      bp: edge.blockingPoint.bp,
      description: edge.blockingPoint.description,
    };
  }
  return { required: false, bp: '', description: '' };
}

/**
 * Execute a transition (returns updated state).
 * Preserves backward-compatible signature.
 */
export function executeTransition(
  state: ChangeState,
  to: ChangePhase,
  options?: { userConfirmed?: boolean; reason?: string },
): { state: ChangeState; success: boolean; error?: string } {
  const from = state.phase;
  const graph = getGraph();

  // Check if already in target phase
  if (from === to) {
    return {
      state,
      success: false,
      error: `E-CHANGE-007: Already in phase '${to}', no transition needed`,
    };
  }

  // Check for terminal states
  if (graph.isTerminalState(from)) {
    return {
      state,
      success: false,
      error: `E-CHANGE-006: ${from} is terminal`,
    };
  }

  // Check edge existence
  if (!graph.hasEdge(from, to)) {
    const validTargets = graph.getOutgoingEdges(from).map((e) => e.to);
    const hint = validTargets.length > 0
      ? `valid targets from ${from}: [${validTargets.join(', ')}]`
      : `${from} is terminal`;
    return {
      state,
      success: false,
      error: `E-CHANGE-006: Invalid transition from ${from} to ${to} (${hint})`,
    };
  }

  const edge = graph.getEdge(from, to)!;

  // Execute side effects based on edge type
  const newState: ChangeState = {
    ...state,
    phase: to,
    updated_at: new Date().toISOString(),
    user_confirmed: options?.userConfirmed ?? state.user_confirmed,
  };

  // Handle backward edge side effects (rollback/rebuild resets)
  if (edge.direction === 'backward') {
    newState.rollback_history = [
      ...state.rollback_history,
      {
        from,
        to,
        reason: options?.reason ?? `transition: ${edge.label}`,
        timestamp: new Date().toISOString(),
        counted: edge.countAs === 'rollback',
        event: `${directionToEvent(edge.direction)}-${from}-to-${to}`,
      },
    ];

    if (edge.countAs === 'rollback') {
      newState.rollback_count = state.rollback_count + 1;
      // Reset build layers and test locks on rollback
      newState.build_layers = state.build_layers.map((l) => ({ ...l, status: 'pending' as const }));
      newState.test_cases = {
        ...state.test_cases,
        design_locked: false,
        suites_locked: false,
        suites_locked_layers: [],
        suites_hash: {},
      };
    } else if (edge.countAs === 'rebuild') {
      newState.rebuild_count = state.rebuild_count + 1;
      // Only reset done layers on rebuild
      newState.build_layers = state.build_layers.map((l) => ({
        ...l,
        status: l.status === 'done' ? 'pending' : l.status,
      }));
    }
  }

  return { state: newState, success: true };
}

/**
 * Execute a rollback using the legacy rollback type API.
 * Maps to backward edges in the DCG.
 */
export function executeRollback(
  state: ChangeState,
  rollbackType: RollbackType,
  reason: string,
): { state: ChangeState; success: boolean; error?: string } {
  const edge = resolveRollbackEdge(getGraph(), rollbackType);
  if (!edge) {
    return {
      state,
      success: false,
      error: `E-CHANGE-006: Unknown rollback type: ${rollbackType}`,
    };
  }

  // Validate current phase matches edge source
  if (state.phase !== edge.from) {
    return {
      state,
      success: false,
      error: `E-CHANGE-006: Cannot rollback from ${state.phase} (expected ${edge.from})`,
    };
  }

  // Check limits
  if (edge.countAs === 'rollback') {
    if (state.rollback_count >= state.rollback_limit) {
      return {
        state,
        success: false,
        error: `E-CHANGE-002: rollback_count已达上限 (${state.rollback_count}/${state.rollback_limit})`,
      };
    }
  } else if (edge.countAs === 'rebuild') {
    if (state.rebuild_count >= state.rebuild_limit) {
      return {
        state,
        success: false,
        error: `E-CHANGE-003: rebuild_count已达上限 (${state.rebuild_count}/${state.rebuild_limit}), 强制升级为Design回退`,
      };
    }
  }

  // Execute via the general transition function
  return executeTransition(state, edge.to, { reason });
}

/**
 * Execute a rollback by edge (new DCG-style API).
 */
export function executeRollbackByEdge(
  state: ChangeState,
  to: ChangePhase,
  reason: string,
): { state: ChangeState; success: boolean; error?: string } {
  const edge = getGraph().getEdge(state.phase, to);
  if (!edge || edge.direction !== 'backward') {
    return {
      state,
      success: false,
      error: `E-CHANGE-006: No backward edge from ${state.phase} to ${to}`,
    };
  }
  return executeTransition(state, to, { reason });
}

/**
 * Check if a rollback is valid and within limits (guard-style check).
 */
export function canRollback(
  state: ChangeState,
  rollbackType: RollbackType,
): GuardResult {
  const edge = resolveRollbackEdge(getGraph(), rollbackType);
  const errors: { code: string; message: string }[] = [];
  const warnings: { code: string; message: string }[] = [];

  if (!edge) {
    errors.push({
      code: 'E-CHANGE-006',
      message: `Unknown rollback type: ${rollbackType}`,
    });
    return { passed: false, errors, warnings };
  }

  if (state.phase !== edge.from) {
    errors.push({
      code: 'E-CHANGE-006',
      message: `Cannot rollback from ${state.phase} (expected ${edge.from})`,
    });
    return { passed: false, errors, warnings };
  }

  if (edge.countAs === 'rollback') {
    if (state.rollback_count >= state.rollback_limit) {
      errors.push({
        code: 'E-CHANGE-002',
        message: `rollback_count已达上限 (${state.rollback_count}/${state.rollback_limit})`,
      });
      return { passed: false, errors, warnings };
    }
  } else if (edge.countAs === 'rebuild') {
    if (state.rebuild_count >= state.rebuild_limit) {
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

/**
 * Get the next phase suggestion.
 *
 * Strategy:
 * - For hotfix/tweak workflows: prefer skip edges (conditional shortcuts)
 * - For full workflow: follow forward edges
 * - Terminal states return undefined
 */
export function getNextPhase(state: ChangeState): { phase: ChangePhase; description: string } | undefined {
  if (getGraph().isTerminalState(state.phase)) {
    return undefined;
  }

  const graph = getGraph();
  const context = { workflow: state.workflow };

  // For preset workflows (hotfix/tweak), check skip edges first
  if (state.workflow === 'hotfix' || state.workflow === 'tweak') {
    const skipEdges = graph.getSkipEdges(state.phase, context).filter(
      (e) => e.to !== 'discarded', // Don't suggest discard as next phase
    );
    if (skipEdges.length > 0) {
      const edge = skipEdges[0];
      return { phase: edge.to, description: `跳过阶段（${state.workflow} 预设）→ ${edge.to}` };
    }
  }

  // Follow forward edges
  const forwardEdges = graph.getForwardEdges(state.phase);
  if (forwardEdges.length > 0) {
    const edge = forwardEdges[0];
    return { phase: edge.to, description: edge.label };
  }

  // Fallback: context-aware skip edges (not discard)
  const skipEdges = graph.getSkipEdges(state.phase, context).filter(
    (e) => e.to !== 'discarded',
  );
  if (skipEdges.length > 0) {
    const edge = skipEdges[0];
    return { phase: edge.to, description: edge.label };
  }

  return undefined;
}

/**
 * Get workflow-appropriate phases (preserved for backward compatibility).
 */
export function getWorkflowPhases(workflow: Workflow): ChangePhase[] {
  switch (workflow) {
    case 'hotfix':
      return ['open', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
    case 'tweak':
      return ['open', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
    case 'loop':
      return ['build', 'verify', 'archive-in-progress', 'archive-completed'];
    case 'full':
      return ['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed'];
  }
}

/**
 * Check if a phase is terminal.
 */
export function isTerminal(phase: ChangePhase): boolean {
  return getGraph().isTerminalState(phase);
}

// ─── New DCG-specific API ─────────────────────────────────────────────────

/**
 * Find a path from current phase to a target phase.
 * @param from Starting phase
 * @param to Target phase
 * @param state Optional state for context-aware filtering
 */
export function findTransitionPath(from: ChangePhase, to: ChangePhase, state?: ChangeState): ChangePhase[] {
  const context = state ? { workflow: state.workflow } : undefined;
  return getGraph().findPath(from, to, context);
}

/**
 * Detect all cycles in the phase graph.
 * Useful for debugging and documentation generation.
 */
export function detectPhaseCycles(): ChangePhase[][] {
  return getGraph().detectCycles();
}

/**
 * Get all edges in the graph (for inspection/documentation).
 */
export function getAllPhaseEdges(): PhaseEdge[] {
  return getGraph().getAllEdges();
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function stateToContext(state: ChangeState): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  if (state.workflow) context.workflow = state.workflow;
  return context;
}

function directionToEvent(direction: 'forward' | 'backward' | 'skip'): string {
  switch (direction) {
    case 'forward': return 'forward';
    case 'backward': return 'rollback';
    case 'skip': return 'skip';
  }
}
