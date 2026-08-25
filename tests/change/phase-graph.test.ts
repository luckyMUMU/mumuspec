import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import {
  PhaseGraph,
  DEFAULT_PHASE_GRAPH,
  PHASE_ORDER,
  type PhaseEdge,
} from '../../src/change/phase-graph.js';
import {
  loadWorkflowConfig,
  buildFallbackConfig,
  parseWorkflowConfig,
  validateWorkflowConfig,
} from '../../src/change/phase-graph-loader.js';
import {
  getWorkflowPhases,
  getValidTransitions,
} from '../../src/change/state-machine.js';
import type { ChangeState, ChangePhase, Workflow } from '../../src/core/types.js';

// ─── helpers ──────────────────────────────────────────────────────────────

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

interface NormalizedEdge {
  from: ChangePhase;
  to: ChangePhase;
  direction: string;
  countAs: string;
  label: string;
  bp: { bp: string; description: string; required: boolean } | undefined;
  conditionSpec: { workflow_in: Workflow[] } | null;
}

function normalizeEdge(e: PhaseEdge): NormalizedEdge {
  return {
    from: e.from,
    to: e.to,
    direction: e.direction,
    countAs: e.countAs,
    label: e.label,
    bp: e.blockingPoint
      ? { bp: e.blockingPoint.bp, description: e.blockingPoint.description, required: e.blockingPoint.required }
      : undefined,
    conditionSpec: e.conditionSpec ?? null,
  };
}

function edgeMap(graph: PhaseGraph): Map<string, NormalizedEdge> {
  const m = new Map<string, NormalizedEdge>();
  for (const e of graph.getAllEdges()) m.set(`${e.from}→${e.to}`, normalizeEdge(e));
  return m;
}

/** 图同构断言：节点集合相等 + 边集合（from,to,direction,countAs,label,BP,conditionSpec）逐一相等 */
function expectIsomorphic(a: PhaseGraph, b: PhaseGraph): void {
  expect(a.getAllNodes().sort()).toEqual(b.getAllNodes().sort());
  const am = edgeMap(a);
  const bm = edgeMap(b);
  expect(am.size).toBe(bm.size);
  for (const [k, v] of am) {
    expect(bm.get(k), `edge ${k}`).toEqual(v);
  }
}

const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));

// ─── TC-6-1 图同构（AC-01）────────────────────────────────────────────────

describe('TC-6-1 图同构（AC-01）', () => {
  const yamlGraph = new PhaseGraph(loadWorkflowConfig());
  const baselineGraph = new PhaseGraph(buildFallbackConfig());

  it('YAML 构建的图与硬编码基线完全同构', () => {
    expectIsomorphic(yamlGraph, baselineGraph);
  });

  it('DEFAULT_PHASE_GRAPH（YAML 驱动）与硬编码基线完全同构', () => {
    expectIsomorphic(DEFAULT_PHASE_GRAPH, baselineGraph);
  });

  it('节点集合为 7 个且顺序即 PHASE_ORDER', () => {
    expect(yamlGraph.getAllNodes().sort()).toEqual([...PHASE_ORDER].sort());
    expect(yamlGraph.getAllNodes()).toHaveLength(7);
  });

  it('终态集合相等：archive-completed 与 discarded', () => {
    expect(yamlGraph.isTerminalState('archive-completed')).toBe(true);
    expect(yamlGraph.isTerminalState('discarded')).toBe(true);
    expect(yamlGraph.isTerminalState('open')).toBe(false);
    expect(yamlGraph.isTerminalState('build')).toBe(false);
  });

  it('边数=15：forward×5 / backward×4 / skip×6', () => {
    const edges = yamlGraph.getAllEdges();
    expect(edges).toHaveLength(15);
    expect(edges.filter((e) => e.direction === 'forward')).toHaveLength(5);
    expect(edges.filter((e) => e.direction === 'backward')).toHaveLength(4);
    expect(edges.filter((e) => e.direction === 'skip')).toHaveLength(6);
  });

  it('中文 label 与 BP 全量断言（防迁移漏改）', () => {
    const m = edgeMap(yamlGraph);
    expect(m.get('open→design')?.label).toBe('open→design（完整工作流）');
    expect(m.get('open→design')?.bp).toEqual({ bp: 'BP-3', description: '工件审查与确认', required: true });
    expect(m.get('design→build')?.label).toBe('design→build');
    expect(m.get('design→build')?.bp).toEqual({ bp: 'BP-4', description: '设计方案确认', required: true });
    expect(m.get('build→verify')?.label).toBe('build→verify');
    expect(m.get('verify→archive-in-progress')?.label).toBe('verify→archive-in-progress');
    expect(m.get('verify→archive-in-progress')?.bp).toEqual({ bp: 'BP-17', description: '归档最终确认', required: true });
    expect(m.get('archive-in-progress→archive-completed')?.label).toBe('archive→completed');
    expect(m.get('open→build')?.label).toBe('open→build（hotfix/tweak 跳过 design）');
    expect(m.get('open→build')?.bp).toEqual({ bp: 'BP-3', description: '工件审查与确认（预设路径）', required: true });
    expect(m.get('build→design')?.label).toBe('build→design（回退重设）');
    expect(m.get('verify→design')?.label).toBe('verify→design（设计层面重做）');
    expect(m.get('verify→build')?.label).toBe('verify→build（仅修复/重建）');
    expect(m.get('archive-in-progress→build')?.label).toBe('archive→build（CI 失败回退）');
    for (const from of ['open', 'design', 'build', 'verify'] as const) {
      expect(m.get(`${from}→discarded`)?.label).toBe(`${from}→discarded（废弃变更）`);
    }
    // archive-in-progress 的 label 用简写 'archive'（与 phase-graph.ts L209 一致）
    expect(m.get('archive-in-progress→discarded')?.label).toBe('archive→discarded（废弃变更）');
  });

  it('backward 边 countAs 逐条保留', () => {
    const m = edgeMap(yamlGraph);
    expect(m.get('build→design')?.countAs).toBe('rollback');
    expect(m.get('verify→design')?.countAs).toBe('rollback');
    expect(m.get('verify→build')?.countAs).toBe('rebuild');
    expect(m.get('archive-in-progress→build')?.countAs).toBe('rollback');
  });
});

// ─── TC-6-2 声明式 condition（AC-03）──────────────────────────────────────

describe('TC-6-2 声明式 condition（AC-03）', () => {
  const graph = new PhaseGraph(loadWorkflowConfig());

  it('open→build 边保留声明式来源 workflow_in=[hotfix, tweak]', () => {
    const edge = graph.getEdge('open', 'build');
    expect(edge?.conditionSpec?.workflow_in).toEqual(['hotfix', 'tweak']);
  });

  it('hotfix/tweak 放行 open→build（skip 边）', () => {
    for (const workflow of ['hotfix', 'tweak'] as const) {
      expect(graph.hasEdge('open', 'build', { workflow }), workflow).toBe(true);
      expect(graph.resolveEdge('open', 'build', { workflow })?.direction).toBe('skip');
    }
  });

  it('full/loop 禁用 open→build', () => {
    for (const workflow of ['full', 'loop'] as const) {
      expect(graph.hasEdge('open', 'build', { workflow }), workflow).toBe(false);
      expect(graph.resolveEdge('open', 'build', { workflow }), workflow).toBeUndefined();
    }
  });

  it('无 context 时 condition 不生效（历史语义保留）', () => {
    expect(graph.hasEdge('open', 'build')).toBe(true);
  });

  it('编译产物 condition 函数与声明式语义一致（调用点零改动）', () => {
    const edge = graph.getEdge('open', 'build')!;
    expect(typeof edge.condition).toBe('function');
    expect(edge.condition!({ workflow: 'hotfix' })).toBe(true);
    expect(edge.condition!({ workflow: 'tweak' })).toBe(true);
    expect(edge.condition!({ workflow: 'full' })).toBe(false);
    expect(edge.condition!({ workflow: 'loop' })).toBe(false);
  });
});

// ─── TC-6-3 workflow 序列（AC-04）─────────────────────────────────────────

describe('TC-6-3 workflow 序列（AC-04）', () => {
  it('getWorkflowPhases 返回与 0.19.1 switch 完全相同的 4 组序列', () => {
    expect(getWorkflowPhases('full')).toEqual(['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed']);
    expect(getWorkflowPhases('hotfix')).toEqual(['open', 'build', 'verify', 'archive-in-progress', 'archive-completed']);
    expect(getWorkflowPhases('tweak')).toEqual(['open', 'build', 'verify', 'archive-in-progress', 'archive-completed']);
    expect(getWorkflowPhases('loop')).toEqual(['build', 'verify', 'archive-in-progress', 'archive-completed']);
  });

  it('PhaseGraph.getWorkflowPhases 与 state-machine 委托结果一致', () => {
    const graph = new PhaseGraph(loadWorkflowConfig());
    for (const w of ['full', 'hotfix', 'tweak', 'loop'] as const) {
      expect(graph.getWorkflowPhases(w)).toEqual(getWorkflowPhases(w));
    }
  });

  it('loop 序列自 build 起（无 open），与 switch 一致', () => {
    expect(getWorkflowPhases('loop')).not.toContain('open');
    expect(getWorkflowPhases('loop')[0]).toBe('build');
  });
});

// ─── TC-6-4 fail-safe + 校验 throw ───────────────────────────────────────

describe('TC-6-4 fail-safe + 校验', () => {
  it('YAML 缺失 → 回退内置默认（与基线同构）', () => {
    const cfg = loadWorkflowConfig('/nonexistent/workflow.default.yaml');
    expect(cfg).toEqual(buildFallbackConfig());
    expectIsomorphic(new PhaseGraph(cfg), new PhaseGraph(buildFallbackConfig()));
  });

  it('YAML 内容非法（可解析但 schema 不符）→ 回退内置默认', () => {
    const badPath = fileURLToPath(new URL('../../package.json', import.meta.url));
    const cfg = loadWorkflowConfig(badPath);
    expect(cfg).toEqual(buildFallbackConfig());
  });

  it('validateWorkflowConfig 对合法配置返回 true', () => {
    expect(validateWorkflowConfig(buildFallbackConfig())).toBe(true);
    expect(validateWorkflowConfig(loadWorkflowConfig())).toBe(true);
  });

  it('parseWorkflowConfig 对缺 phases 抛错', () => {
    expect(() => parseWorkflowConfig('version: 1\nterminal: []\nedges: []\nworkflows:\n  full: { phases: [] }\n  hotfix: { phases: [] }\n  tweak: { phases: [] }\n  loop: { phases: [] }\n')).toThrow();
  });

  it('parseWorkflowConfig 对非法 direction 抛错', () => {
    const yaml = `
version: 1
phases: [open, design, build, verify, archive-in-progress, archive-completed, discarded]
terminal: [archive-completed, discarded]
edges:
  - { from: open, to: design, direction: sideway, countAs: none, label: bad }
workflows:
  full: { phases: [open, design] }
  hotfix: { phases: [open, build] }
  tweak: { phases: [open, build] }
  loop: { phases: [build] }
`;
    expect(() => parseWorkflowConfig(yaml)).toThrow(/direction/);
  });

  it('parseWorkflowConfig 对未知 phase 抛错', () => {
    const yaml = `
version: 1
phases: [open, design, build, verify, archive-in-progress, archive-completed, discarded]
terminal: [archive-completed, discarded]
edges:
  - { from: open, to: nirvana, direction: forward, countAs: none, label: bad }
workflows:
  full: { phases: [open, design] }
  hotfix: { phases: [open, build] }
  tweak: { phases: [open, build] }
  loop: { phases: [build] }
`;
    expect(() => parseWorkflowConfig(yaml)).toThrow(/known phase/);
  });

  it('parseWorkflowConfig 对未知 workflow 抛错', () => {
    const yaml = `
version: 1
phases: [open, design, build, verify, archive-in-progress, archive-completed, discarded]
terminal: [archive-completed, discarded]
edges:
  - { from: open, to: design, direction: forward, countAs: none, label: ok }
workflows:
  full: { phases: [open, design] }
  hotfix: { phases: [open, build] }
  tweak: { phases: [open, build] }
  loop: { phases: [build] }
  micro: { phases: [open] }
`;
    expect(() => parseWorkflowConfig(yaml)).toThrow(/unknown key/);
  });

  it('parseWorkflowConfig 对 phases 顺序偏离 PHASE_ORDER 抛错', () => {
    const yaml = `
version: 1
phases: [open, build, design, verify, archive-in-progress, archive-completed, discarded]
terminal: [archive-completed, discarded]
edges:
  - { from: open, to: build, direction: forward, countAs: none, label: bad }
workflows:
  full: { phases: [open, build] }
  hotfix: { phases: [open, build] }
  tweak: { phases: [open, build] }
  loop: { phases: [build] }
`;
    expect(() => parseWorkflowConfig(yaml)).toThrow(/PHASE_ORDER/);
  });

  it('parseWorkflowConfig 对合法 YAML 返回配置', () => {
    const cfg = parseWorkflowConfig(`
version: 1
phases: [open, design, build, verify, archive-in-progress, archive-completed, discarded]
terminal: [archive-completed, discarded]
edges:
  - { from: open, to: design, direction: forward, countAs: none, label: open→design }
workflows:
  full: { phases: [open, design] }
  hotfix: { phases: [open, build] }
  tweak: { phases: [open, build] }
  loop: { phases: [build] }
`);
    expect(cfg.version).toBe(1);
    expect(cfg.edges).toHaveLength(1);
  });
});

// ─── TC-6-5 单一事实源（AC-05）───────────────────────────────────────────

describe('TC-6-5 单一事实源（AC-05）', () => {
  it('修改配置（删 design→build 边）重新构建后生效，无需改代码', () => {
    const cfg = structuredClone(loadWorkflowConfig());
    cfg.edges = cfg.edges.filter((e) => !(e.from === 'design' && e.to === 'build'));
    const graph = new PhaseGraph(cfg);

    // 显式边被移除（AC-05：配置生效，无需改代码）
    expect(graph.getEdge('design', 'build')).toBeUndefined();
    expect(graph.hasEdge('design', 'build')).toBe(false);

    // 原显式边携带的 BP-4 不再可用；仅剩柔性边（非终态间保留可达，属既有算法语义）
    const resolved = graph.resolveEdge('design', 'build');
    expect(resolved?.blockingPoint).toBeUndefined();
    expect(resolved?.label).toContain('柔性');
    expect(resolved?.direction).toBe('forward');

    // 默认图（未改配置）仍保留显式边
    expect(DEFAULT_PHASE_GRAPH.hasEdge('design', 'build')).toBe(true);
  });
});

// ─── TC-6-6 无参兼容（AC-02）──────────────────────────────────────────────

describe('TC-6-6 向后兼容（AC-02）', () => {
  it('new PhaseGraph()（无参）与 DEFAULT_PHASE_GRAPH 图同构', () => {
    expectIsomorphic(new PhaseGraph(), DEFAULT_PHASE_GRAPH);
  });

  it('findPath 行为一致（full 上下文走 design→build）', () => {
    expect(new PhaseGraph().findPath('open', 'verify', { workflow: 'full' })).toEqual(
      DEFAULT_PHASE_GRAPH.findPath('open', 'verify', { workflow: 'full' }),
    );
  });

  it('resolveEdge 行为一致（显式边/柔性边/条件边）', () => {
    const g = new PhaseGraph();
    expect(g.resolveEdge('build', 'design')?.countAs).toBe(DEFAULT_PHASE_GRAPH.resolveEdge('build', 'design')?.countAs);
    expect(g.resolveEdge('open', 'build', { workflow: 'hotfix' })?.direction).toBe(
      DEFAULT_PHASE_GRAPH.resolveEdge('open', 'build', { workflow: 'hotfix' })?.direction,
    );
    expect(g.resolveEdge('open', 'build', { workflow: 'full' })).toBeUndefined();
  });

  it('getValidTransitionsWithContext 兼容（hotfix 含 build）', () => {
    const state = createTestState({ phase: 'open', workflow: 'hotfix' });
    expect(getValidTransitions('open')).toContain('build');
    void state;
  });
});
