import { describe, it, expect } from 'vitest';
import { PhaseGraph, DEFAULT_PHASE_GRAPH, type PhaseEdge } from '../src/change/phase-graph.js';
import {
  getPhaseGraph,
  findTransitionPath,
  detectPhaseCycles,
  getAllPhaseEdges,
  canTransitionWithContext,
  getValidTransitionsWithContext,
  executeRollbackByEdge,
} from '../src/change/state-machine.js';
import type { ChangeState, ChangePhase } from '../src/core/types.js';

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

describe('PhaseGraph', () => {
  describe('basic graph operations', () => {
    it('should have all 7 phases as nodes', () => {
      const nodes = DEFAULT_PHASE_GRAPH.getAllNodes();
      expect(nodes).toContain('open');
      expect(nodes).toContain('design');
      expect(nodes).toContain('build');
      expect(nodes).toContain('verify');
      expect(nodes).toContain('archive-in-progress');
      expect(nodes).toContain('archive-completed');
      expect(nodes).toContain('discarded');
      expect(nodes).toHaveLength(7);
    });

    it('should have terminal states', () => {
      expect(DEFAULT_PHASE_GRAPH.isTerminalState('archive-completed')).toBe(true);
      expect(DEFAULT_PHASE_GRAPH.isTerminalState('discarded')).toBe(true);
      expect(DEFAULT_PHASE_GRAPH.isTerminalState('open')).toBe(false);
      expect(DEFAULT_PHASE_GRAPH.isTerminalState('design')).toBe(false);
    });

    it('should provide the graph instance via accessor', () => {
      const graph = getPhaseGraph();
      expect(graph).toBe(DEFAULT_PHASE_GRAPH);
    });
  });

  describe('edge queries', () => {
    it('should return outgoing edges from a phase', () => {
      const edges = DEFAULT_PHASE_GRAPH.getOutgoingEdges('open');
      const targets = edges.map((e) => e.to);
      expect(targets).toContain('design');
      expect(targets).toContain('build');
      expect(targets).toContain('discarded');
    });

    it('should return forward edges only', () => {
      const forwardEdges = DEFAULT_PHASE_GRAPH.getForwardEdges('open');
      expect(forwardEdges).toHaveLength(1);
      expect(forwardEdges[0].to).toBe('design');
    });

    it('should return backward edges only', () => {
      const backwardEdges = DEFAULT_PHASE_GRAPH.getBackwardEdges('build');
      expect(backwardEdges).toHaveLength(1);
      expect(backwardEdges[0].to).toBe('design');
      expect(backwardEdges[0].direction).toBe('backward');
    });

    it('should return skip edges', () => {
      const skipEdges = DEFAULT_PHASE_GRAPH.getSkipEdges('open');
      const targets = skipEdges.map((e) => e.to);
      expect(targets).toContain('build');
      expect(targets).toContain('discarded');
    });

    it('should get a specific edge', () => {
      const edge = DEFAULT_PHASE_GRAPH.getEdge('open', 'design');
      expect(edge).toBeDefined();
      expect(edge?.direction).toBe('forward');
      expect(edge?.blockingPoint?.bp).toBe('BP-3');
    });

    it('should check edge existence', () => {
      expect(DEFAULT_PHASE_GRAPH.hasEdge('open', 'design')).toBe(true);
      expect(DEFAULT_PHASE_GRAPH.hasEdge('open', 'verify')).toBe(false);
      expect(DEFAULT_PHASE_GRAPH.hasEdge('archive-completed', 'open')).toBe(false);
    });
  });

  describe('context-aware edge filtering', () => {
    it('should filter skip edges by workflow context (hotfix)', () => {
      const edges = DEFAULT_PHASE_GRAPH.getOutgoingEdges('open', { workflow: 'hotfix' });
      const buildEdge = edges.find((e) => e.to === 'build');
      expect(buildEdge).toBeDefined();
      expect(buildEdge?.direction).toBe('skip');
    });

    it('should not expose skip edges for incompatible workflow', () => {
      const edges = DEFAULT_PHASE_GRAPH.getOutgoingEdges('open', { workflow: 'full' });
      const buildEdge = edges.find((e) => e.to === 'build');
      expect(buildEdge).toBeUndefined();
    });

    it('should expose skip edges for tweak workflow', () => {
      const edges = DEFAULT_PHASE_GRAPH.getOutgoingEdges('open', { workflow: 'tweak' });
      const buildEdge = edges.find((e) => e.to === 'build');
      expect(buildEdge).toBeDefined();
    });
  });

  describe('edge types', () => {
    it('should classify edges by type', () => {
      const allEdges = DEFAULT_PHASE_GRAPH.getAllEdges();
      const forwardEdges = allEdges.filter((e) => e.direction === 'forward');
      const backwardEdges = allEdges.filter((e) => e.direction === 'backward');
      const skipEdges = allEdges.filter((e) => e.direction === 'skip');

      // Should have: open→design, design→build, build→verify, verify→archive, archive→completed = 5 forward
      expect(forwardEdges).toHaveLength(5);

      // Should have: build→design, verify→design, verify→build, archive→build = 4 backward
      expect(backwardEdges).toHaveLength(4);

      // Should have: open→build (skip), + 5 terminal discard edges = 6 skip
      expect(skipEdges).toHaveLength(6);
    });

    it('should mark backward edges with counter types', () => {
      const backwardEdges = DEFAULT_PHASE_GRAPH.getAllEdges().filter((e) => e.direction === 'backward');
      for (const edge of backwardEdges) {
        expect(['rollback', 'rebuild']).toContain(edge.countAs);
      }
    });
  });

  describe('path finding', () => {
    it('should find direct path', () => {
      const path = DEFAULT_PHASE_GRAPH.findPath('open', 'design');
      expect(path).toEqual(['open', 'design']);
    });

    it('should find multi-hop forward path (with full context)', () => {
      // With full workflow context, skip edges are filtered out
      const path = DEFAULT_PHASE_GRAPH.findPath('open', 'verify', { workflow: 'full' });
      expect(path[0]).toBe('open');
      expect(path[path.length - 1]).toBe('verify');
      // Should traverse through design, build
      expect(path).toContain('design');
      expect(path).toContain('build');
    });

    it('should find shortest path via skip edge (without context)', () => {
      // Without context, the skip edge open→build is available
      const path = DEFAULT_PHASE_GRAPH.findPath('open', 'verify');
      expect(path[0]).toBe('open');
      expect(path[path.length - 1]).toBe('verify');
      // Shortest path: open → build → verify (2 hops)
      expect(path).toHaveLength(3);
      expect(path).toContain('build');
    });

    it('should find path through backward edge', () => {
      const path = DEFAULT_PHASE_GRAPH.findPath('build', 'design');
      expect(path).toEqual(['build', 'design']);
    });

    it('should find path from terminal', () => {
      const path = DEFAULT_PHASE_GRAPH.findPath('archive-completed', 'open');
      expect(path).toHaveLength(0);
    });

    it('should find path to discarded', () => {
      const path = DEFAULT_PHASE_GRAPH.findPath('build', 'discarded');
      expect(path).toEqual(['build', 'discarded']);
    });
  });

  describe('cycle detection', () => {
    it('should detect cycles in the graph', () => {
      const cycles = detectPhaseCycles();
      // The graph has backward edges that create cycles
      expect(cycles.length).toBeGreaterThan(0);
    });

    it('should include build→design→build cycle', () => {
      const cycles = detectPhaseCycles();
      // Check for cycle that goes through build→design and back
      const hasBuildDesignCycle = cycles.some((cycle) =>
        cycle.includes('build') && cycle.includes('design')
      );
      expect(hasBuildDesignCycle).toBe(true);
    });
  });

  describe('edge enumeration', () => {
    it('should return all edges', () => {
      const edges = getAllPhaseEdges();
      expect(edges.length).toBeGreaterThan(0);

      // Verify all edges have required fields
      for (const edge of edges) {
        expect(edge.from).toBeDefined();
        expect(edge.to).toBeDefined();
        expect(['forward', 'backward', 'skip']).toContain(edge.direction);
        expect(['rollback', 'rebuild', 'none']).toContain(edge.countAs);
        expect(edge.label).toBeDefined();
      }
    });
  });
});

describe('DCG-aware state machine API', () => {
  it('should check transition with context', () => {
    const state = createTestState({ phase: 'open', workflow: 'hotfix' });
    expect(canTransitionWithContext('open', 'build', state)).toBe(true);

    const fullState = createTestState({ phase: 'open', workflow: 'full' });
    expect(canTransitionWithContext('open', 'build', fullState)).toBe(false);
  });

  it('should get context-aware valid transitions', () => {
    const hotfixState = createTestState({ phase: 'open', workflow: 'hotfix' });
    const transitions = getValidTransitionsWithContext('open', hotfixState);
    expect(transitions).toContain('build');
    expect(transitions).toContain('design');
    expect(transitions).toContain('discarded');
  });

  it('should filter transitions for full workflow', () => {
    const fullState = createTestState({ phase: 'open', workflow: 'full' });
    const transitions = getValidTransitionsWithContext('open', fullState);
    expect(transitions).toContain('design');
    expect(transitions).toContain('discarded');
    // build should NOT be available without skip edge activation
    expect(transitions).not.toContain('build');
  });

  it('should find transition path with context', () => {
    // With full context, path follows forward edges only
    const path = DEFAULT_PHASE_GRAPH.findPath('open', 'archive-in-progress', { workflow: 'full' });
    expect(path[0]).toBe('open');
    expect(path[path.length - 1]).toBe('archive-in-progress');
    expect(path).toContain('design');
    expect(path).toContain('build');
    expect(path).toContain('verify');
  });

  it('should find transition path (legacy API)', () => {
    const path = findTransitionPath('open', 'archive-in-progress');
    expect(path[0]).toBe('open');
    expect(path[path.length - 1]).toBe('archive-in-progress');
    // Path should go through build (via skip edge)
    expect(path).toContain('build');
  });

  it('should execute rollback by edge (DCG-style)', () => {
    const state = createTestState({ phase: 'build' });
    const result = executeRollbackByEdge(state, 'design', 'test rollback');
    expect(result.success).toBe(true);
    expect(result.state.phase).toBe('design');
    expect(result.state.rollback_count).toBe(1);
  });

  it('should reject non-backward edge in executeRollbackByEdge', () => {
    const state = createTestState({ phase: 'open' });
    const result = executeRollbackByEdge(state, 'design', 'invalid');
    expect(result.success).toBe(false);
  });
});

describe('custom graph modification', () => {
  it('should allow adding custom edges', () => {
    const graph = new PhaseGraph();
    graph.addEdge({
      from: 'verify',
      to: 'open',
      direction: 'backward',
      countAs: 'rollback',
      label: 'verify→open（激进回退）',
    });

    expect(graph.hasEdge('verify', 'open')).toBe(true);
    expect(graph.getEdge('verify', 'open')?.label).toBe('verify→open（激进回退）');
  });

  it('should allow removing edges', () => {
    const graph = new PhaseGraph();
    expect(graph.hasEdge('build', 'design')).toBe(true);

    graph.removeEdge('build', 'design');
    expect(graph.hasEdge('build', 'design')).toBe(false);
  });
});
