import type { ChangePhase, Workflow } from '../core/types.js';
import { loadWorkflowConfig, buildFallbackConfig } from './phase-graph-loader.js';

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
 * Canonical phase order — used to derive edge direction for flexible edges.
 * A flexible edge is backward when its target appears earlier in this list.
 */
export const PHASE_ORDER: ChangePhase[] = [
  'open', 'design', 'build', 'verify',
  'archive-in-progress', 'archive-completed', 'discarded',
];

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
  /** Declarative condition source (CHG-6) — compiled into `condition` at build time */
  conditionSpec?: WorkflowConditionSpec;
}

/**
 * Declarative condition spec (CHG-6) — YAML 可表达，本期仅支持 workflow_in。
 */
export interface WorkflowConditionSpec {
  workflow_in: Workflow[];
}

/**
 * YAML edge spec (CHG-6) — WorkflowEdgeSpec.bp.id 映射为 PhaseEdge.blockingPoint.bp。
 */
export interface WorkflowEdgeSpec {
  from: ChangePhase;
  to: ChangePhase;
  direction: EdgeDirection;
  countAs: EdgeCounter;
  label: string;
  bp?: { id: string; description: string; required: boolean };
  condition?: WorkflowConditionSpec;
}

/**
 * WorkflowConfig (CHG-6) — workflow.default.yaml 的运行时形态，单一事实源。
 * 置于本文件以规避 types-workflow ↔ phase-graph 循环依赖（EdgeDirection/EdgeCounter 定义于此）。
 */
export interface WorkflowConfig {
  version: number;
  phases: ChangePhase[];
  terminal: ChangePhase[];
  edges: WorkflowEdgeSpec[];
  workflows: Record<Workflow, { phases: ChangePhase[]; skip_design?: boolean }>;
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
  private config: WorkflowConfig;

  constructor(config?: WorkflowConfig) {
    // 无 config → 内置 fallback（与历史硬编码同构，AC-02 向后兼容）
    this.config = config ?? buildFallbackConfig();

    // Initialize adjacency list for all configured phases
    for (const phase of this.config.phases) {
      this.adjacencyList.set(phase, []);
    }

    // Mark terminal states
    for (const phase of this.config.terminal) {
      this.terminalStates.add(phase);
    }

    // Build edges from config (replaces the old hardcoded buildDefaultEdges)
    this.buildFromConfig(this.config.edges);
  }

  /**
   * Build graph edges from a WorkflowConfig (CHG-6).
   * bp.id → blockingPoint.bp；conditionSpec → condition 函数（调用点零改动）。
   */
  private buildFromConfig(edges: WorkflowEdgeSpec[]): void {
    for (const spec of edges) {
      this.addEdge(compileEdge(spec));
    }
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
   * Get the phase sequence for a workflow preset (CHG-6).
   * Reads from config.workflows — single source of truth (replaces the
   * hardcoded switch in state-machine.ts).
   */
  getWorkflowPhases(workflow: Workflow): ChangePhase[] {
    return this.config.workflows[workflow]?.phases ?? [];
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

  /**
   * Resolve an edge from→to, synthesizing a flexible edge when no explicit
   * edge exists. Explicit edges always take priority (filtered by context
   * when provided — a condition-gated explicit edge still owns its pair).
   *
   * Flexible edges connect any two distinct non-terminal states:
   * - forward (target later in PHASE_ORDER): countAs 'none'
   * - backward (target earlier in PHASE_ORDER): countAs 'rollback'
   * They carry no blocking point and no runtime condition.
   *
   * Returns undefined when: the explicit edge fails its condition, either
   * endpoint is terminal, or from === to.
   */
  resolveEdge(from: ChangePhase, to: ChangePhase, context?: Record<string, unknown>): PhaseEdge | undefined {
    const explicit = this.getEdge(from, to);
    if (explicit) {
      if (!context || !explicit.condition || explicit.condition(context as { workflow: string; [key: string]: unknown })) {
        return explicit;
      }
      return undefined;
    }

    if (from === to) return undefined;
    if (this.isTerminalState(from) || this.isTerminalState(to)) return undefined;

    const fromIndex = PHASE_ORDER.indexOf(from);
    const toIndex = PHASE_ORDER.indexOf(to);
    if (fromIndex < 0 || toIndex < 0) return undefined;

    const backward = toIndex < fromIndex;
    return {
      from,
      to,
      direction: backward ? 'backward' : 'forward',
      countAs: backward ? 'rollback' : 'none',
      label: `${from}→${to}（柔性${backward ? '回退' : '前跳'}）`,
    };
  }

  /**
   * Get synthesized flexible edges from a phase. Terminal states return [].
   * Pairs already covered by an explicit edge (even a condition-gated one)
   * are excluded — the explicit edge owns that transition.
   */
  getFlexibleTargets(from: ChangePhase): PhaseEdge[] {
    if (this.isTerminalState(from)) return [];

    const explicitTargets = new Set<ChangePhase>();
    for (const edge of this.adjacencyList.get(from) || []) {
      explicitTargets.add(edge.to);
    }

    const fromIndex = PHASE_ORDER.indexOf(from);
    if (fromIndex < 0) return [];

    const flexible: PhaseEdge[] = [];
    for (const phase of PHASE_ORDER) {
      if (phase === from) continue;
      if (this.isTerminalState(phase)) continue;
      if (explicitTargets.has(phase)) continue;
      const backward = PHASE_ORDER.indexOf(phase) < fromIndex;
      flexible.push({
        from,
        to: phase,
        direction: backward ? 'backward' : 'forward',
        countAs: backward ? 'rollback' : 'none',
        label: `${from}→${phase}（柔性${backward ? '回退' : '前跳'}）`,
      });
    }
    return flexible;
  }
}

/**
 * Compile a declarative condition spec into a runtime condition function.
 * Calling sites (resolveEdge/getOutgoingEdges/findPath/getSkipEdges/hasEdge)
 * only ever see `edge.condition` — zero call-site changes.
 */
function compileCondition(spec?: WorkflowConditionSpec): PhaseEdge['condition'] {
  if (!spec) return undefined;
  return (state) => spec.workflow_in.includes(state.workflow as Workflow);
}

/**
 * Compile a YAML edge spec into a runtime PhaseEdge.
 * - spec.bp.id → blockingPoint.bp（保持 PhaseEdge 结构不变）
 * - spec.condition（声明式）→ condition 函数 + conditionSpec 原文（供测试断言）
 */
function compileEdge(spec: WorkflowEdgeSpec): PhaseEdge {
  return {
    from: spec.from,
    to: spec.to,
    direction: spec.direction,
    countAs: spec.countAs,
    label: spec.label,
    blockingPoint: spec.bp
      ? { bp: spec.bp.id, description: spec.bp.description, required: spec.bp.required }
      : undefined,
    conditionSpec: spec.condition,
    condition: compileCondition(spec.condition),
  };
}

/**
 * Singleton instance of the default phase graph.
 * Built from workflow.default.yaml (CHG-6) with fail-safe fallback to the
 * built-in default when the YAML is missing/corrupt.
 */
export const DEFAULT_PHASE_GRAPH = new PhaseGraph(loadWorkflowConfig());
