import type { ChangePhase } from '../core/types.js';

/**
 * Edge direction in the directed graph.
 * - forward: progresses toward completion (e.g., open→design, design→build)
 * - backward: rollback/rework (e.g., build→design, verify→build)
 * - skip: conditional shortcut (e.g., open→build for hotfix/tweak)
 */
export type EdgeDirection = 'forward' | 'backward' | 'skip';

/**
 * Counter type for edges that affect limits.
 * - rollback: increments rollback_count, resets test locks
 * - rebuild: increments rebuild_count, resets failed layers only
 * - none: no counter effect
 */
export type EdgeCounter = 'rollback' | 'rebuild' | 'none';

/**
 * A directed edge in the phase graph.
 */
export interface PhaseEdge {
  from: ChangePhase;
  to: ChangePhase;
  direction: EdgeDirection;
  countAs: EdgeCounter;
  label: string;
  blockingPoint?: {
    bp: string;
    description: string;
    required: boolean;
  };
  /** Optional runtime condition that must be true for this edge to be available */
  condition?: (state: { workflow: string; [key: string]: unknown }) => boolean;
}

/**
 * PhaseGraph — directed cyclic graph for change phase transitions.
 *
 * Unlike a simple state machine, this explicitly models:
 * - Forward edges (progress)
 * - Backward edges (rollback, creating cycles)
 * - Skip edges (conditional shortcuts)
 *
 * The graph supports cycle detection, path finding, and context-aware edge filtering.
 */
export class PhaseGraph {
  private adjacencyList: Map<ChangePhase, PhaseEdge[]> = new Map();
  private terminalStates: Set<ChangePhase> = new Set();

  constructor() {
    // Initialize adjacency list for all known phases
    const allPhases: ChangePhase[] = [
      'open', 'design', 'build', 'verify',
      'archive-in-progress', 'archive-completed', 'discarded',
    ];
    for (const phase of allPhases) {
      this.adjacencyList.set(phase, []);
    }

    // Mark terminal states
    this.terminalStates.add('archive-completed');
    this.terminalStates.add('discarded');

    // Build default edges
    this.buildDefaultEdges();
  }

  /**
   * Build the default DCG edges that represent the MumuSpec workflow.
   * This replaces the old FORWARD_TRANSITIONS + ROLLBACK_TRANSITIONS.
   */
  private buildDefaultEdges(): void {
    // === FORWARD EDGES (progress) ===
    this.addEdge({
      from: 'open',
      to: 'design',
      direction: 'forward',
      countAs: 'none',
      label: 'open→design（完整工作流）',
      blockingPoint: { bp: 'BP-3', description: '工件审查与确认', required: true },
    });

    this.addEdge({
      from: 'design',
      to: 'build',
      direction: 'forward',
      countAs: 'none',
      label: 'design→build',
      blockingPoint: { bp: 'BP-4', description: '设计方案确认', required: true },
    });

    this.addEdge({
      from: 'build',
      to: 'verify',
      direction: 'forward',
      countAs: 'none',
      label: 'build→verify',
    });

    this.addEdge({
      from: 'verify',
      to: 'archive-in-progress',
      direction: 'forward',
      countAs: 'none',
      label: 'verify→archive-in-progress',
      blockingPoint: { bp: 'BP-17', description: '归档最终确认', required: true },
    });

    this.addEdge({
      from: 'archive-in-progress',
      to: 'archive-completed',
      direction: 'forward',
      countAs: 'none',
      label: 'archive→completed',
    });

    // === SKIP EDGES (conditional shortcuts for hotfix/tweak) ===
    this.addEdge({
      from: 'open',
      to: 'build',
      direction: 'skip',
      countAs: 'none',
      label: 'open→build（hotfix/tweak 跳过 design）',
      blockingPoint: { bp: 'BP-3', description: '工件审查与确认（预设路径）', required: true },
      condition: (state) => state.workflow === 'hotfix' || state.workflow === 'tweak',
    });

    // === BACKWARD EDGES (rollback — creates cycles) ===
    this.addEdge({
      from: 'build',
      to: 'design',
      direction: 'backward',
      countAs: 'rollback',
      label: 'build→design（回退重设）',
    });

    this.addEdge({
      from: 'verify',
      to: 'design',
      direction: 'backward',
      countAs: 'rollback',
      label: 'verify→design（设计层面重做）',
    });

    this.addEdge({
      from: 'verify',
      to: 'build',
      direction: 'backward',
      countAs: 'rebuild',
      label: 'verify→build（仅修复/重建）',
    });

    this.addEdge({
      from: 'archive-in-progress',
      to: 'build',
      direction: 'backward',
      countAs: 'rollback',
      label: 'archive→build（CI 失败回退）',
    });

    // === TERMINAL EDGES ===
    this.addEdge({
      from: 'open',
      to: 'discarded',
      direction: 'skip',
      countAs: 'none',
      label: 'open→discarded（废弃变更）',
    });

    this.addEdge({
      from: 'design',
      to: 'discarded',
      direction: 'skip',
      countAs: 'none',
      label: 'design→discarded（废弃变更）',
    });

    this.addEdge({
      from: 'build',
      to: 'discarded',
      direction: 'skip',
      countAs: 'none',
      label: 'build→discarded（废弃变更）',
    });

    this.addEdge({
      from: 'verify',
      to: 'discarded',
      direction: 'skip',
      countAs: 'none',
      label: 'verify→discarded（废弃变更）',
    });

    this.addEdge({
      from: 'archive-in-progress',
      to: 'discarded',
      direction: 'skip',
      countAs: 'none',
      label: 'archive→discarded（废弃变更）',
    });
  }

  /**
   * Add a directed edge to the graph.
   */
  addEdge(edge: PhaseEdge): void {
    const edges = this.adjacencyList.get(edge.from) || [];
    // Remove existing edge between same from→to pair to avoid duplicates
    const filtered = edges.filter((e) => e.to !== edge.to);
    filtered.push(edge);
    this.adjacencyList.set(edge.from, filtered);
  }

  /**
   * Remove an edge from the graph.
   */
  removeEdge(from: ChangePhase, to: ChangePhase): void {
    const edges = this.adjacencyList.get(from) || [];
    this.adjacencyList.set(from, edges.filter((e) => e.to !== to));
  }

  /**
   * Get all outgoing edges from a phase (optionally filtered by context).
   */
  getOutgoingEdges(from: ChangePhase, context?: Record<string, unknown>): PhaseEdge[] {
    const edges = this.adjacencyList.get(from) || [];
    if (!context) return [...edges];
    return edges.filter((e) => !e.condition || e.condition(context as { workflow: string; [key: string]: unknown }));
  }

  /**
   * Get a specific edge from→to.
   */
  getEdge(from: ChangePhase, to: ChangePhase): PhaseEdge | undefined {
    const edges = this.adjacencyList.get(from) || [];
    return edges.find((e) => e.to === to);
  }

  /**
   * Check if a transition (edge) exists in the graph (optionally context-aware).
   */
  hasEdge(from: ChangePhase, to: ChangePhase, context?: Record<string, unknown>): boolean {
    const edge = this.getEdge(from, to);
    if (!edge) return false;
    if (!context) return true;
    return !edge.condition || edge.condition(context as { workflow: string; [key: string]: unknown });
  }

  /**
   * Check if a phase is terminal (no outgoing edges that lead out).
   */
  isTerminalState(phase: ChangePhase): boolean {
    return this.terminalStates.has(phase);
  }

  /**
   * Find shortest path from source to target using BFS.
   * When context is provided, edges with unmet conditions are skipped.
   * Returns empty array if no path exists.
   */
  findPath(from: ChangePhase, to: ChangePhase, context?: Record<string, unknown>, maxDepth: number = 10): ChangePhase[] {
    if (from === to) return [from];

    const visited = new Set<ChangePhase>([from]);
    // Queue stores [currentPhase, pathToCurrent]
    const queue: Array<[ChangePhase, ChangePhase[]]> = [[from, [from]]];

    while (queue.length > 0) {
      const [current, path] = queue.shift()!;

      if (path.length >= maxDepth) continue;

      // Get edges, filtered by context if provided
      const allEdges = this.adjacencyList.get(current) || [];
      const edges = context
        ? allEdges.filter((e) => !e.condition || e.condition(context as { workflow: string; [key: string]: unknown }))
        : allEdges;

      for (const edge of edges) {
        if (edge.to === to) {
          return [...path, edge.to];
        }
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push([edge.to, [...path, edge.to]]);
        }
      }
    }

    return [];
  }

  /**
   * Detect all cycles in the graph using DFS with coloring.
   * Returns array of cycles, each cycle is an array of phases.
   */
  detectCycles(): ChangePhase[][] {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<ChangePhase, number>();
    const parent = new Map<ChangePhase, ChangePhase | null>();
    const cycles: ChangePhase[][] = [];

    for (const phase of this.adjacencyList.keys()) {
      color.set(phase, WHITE);
      parent.set(phase, null);
    }

    const pathFrom = (start: ChangePhase, end: ChangePhase): ChangePhase[] => {
      const path: ChangePhase[] = [];
      let current: ChangePhase | null = start;
      while (current !== null && current !== end) {
        path.push(current);
        current = parent.get(current) ?? null;
      }
      if (current === end) path.push(end);
      return path;
    };

    const dfs = (u: ChangePhase): void => {
      color.set(u, GRAY);
      const edges = this.adjacencyList.get(u) || [];
      for (const edge of edges) {
        const v = edge.to;
        if (color.get(v) === GRAY) {
          // Found a cycle
          const cycle = pathFrom(u, v);
          cycle.reverse();
          cycle.push(v); // Close the cycle
          cycles.push(cycle);
        } else if (color.get(v) === WHITE) {
          parent.set(v, u);
          dfs(v);
        }
      }
      color.set(u, BLACK);
    };

    for (const phase of this.adjacencyList.keys()) {
      if (color.get(phase) === WHITE) {
        dfs(phase);
      }
    }

    return cycles;
  }

  /**
   * Get all edges in the graph.
   */
  getAllEdges(): PhaseEdge[] {
    const all: PhaseEdge[] = [];
    for (const edges of this.adjacencyList.values()) {
      all.push(...edges);
    }
    return all;
  }

  /**
   * Get all nodes (phases) in the graph.
   */
  getAllNodes(): ChangePhase[] {
    return Array.from(this.adjacencyList.keys());
  }

  /**
   * Get forward-only edges from a phase (progress toward completion).
   */
  getForwardEdges(from: ChangePhase): PhaseEdge[] {
    return (this.adjacencyList.get(from) || []).filter((e) => e.direction === 'forward');
  }

  /**
   * Get backward edges from a phase (rollback/rework).
   */
  getBackwardEdges(from: ChangePhase): PhaseEdge[] {
    return (this.adjacencyList.get(from) || []).filter((e) => e.direction === 'backward');
  }

  /**
   * Get skip edges from a phase (conditional shortcuts).
   */
  getSkipEdges(from: ChangePhase, context?: Record<string, unknown>): PhaseEdge[] {
    const edges = (this.adjacencyList.get(from) || []).filter((e) => e.direction === 'skip');
    if (!context) return edges;
    return edges.filter((e) => !e.condition || e.condition(context as { workflow: string; [key: string]: unknown }));
  }
}

/**
 * Singleton instance of the default phase graph.
 * Used when custom configuration is not provided.
 */
export const DEFAULT_PHASE_GRAPH = new PhaseGraph();
