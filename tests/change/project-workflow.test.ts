import { describe, it, expect, afterEach, vi } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stringify } from 'yaml';
import { PhaseGraph, DEFAULT_PHASE_GRAPH } from '../../src/change/phase-graph.js';
import {
  loadWorkflowConfig,
  buildFallbackConfig,
  loadProjectWorkflowConfig,
  getProjectWorkflowConfigPath,
} from '../../src/change/phase-graph-loader.js';
import {
  executeTransition,
  requiresUserConfirmation,
  getValidTransitions,
  getPhaseGraph,
  setActivePhaseGraph,
  activateProjectWorkflow,
} from '../../src/change/state-machine.js';
import type { ChangeState, ChangePhase } from '../../src/core/types.js';

// ─── helpers ──────────────────────────────────────────────────────────────

/** 工作区内临时目录（避免写系统 /tmp 触发沙箱拦截），afterEach 清理 */
const TMP_BASE = fileURLToPath(new URL('.chg7-tmp', import.meta.url));
const activeDirs: string[] = [];

function makeProjectRoot(files: Record<string, string> = {}): string {
  const dir = join(TMP_BASE, `proj-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(dir, '.mumuspec'), { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, content, 'utf8');
  }
  activeDirs.push(dir);
  return dir;
}

function createTestState(phase: ChangePhase, workflow: ChangeState['workflow'] = 'full'): ChangeState {
  return {
    name: 'test-change',
    phase,
    workflow,
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
  };
}

/** 基于内置默认生成"整体替换"项目级 YAML（可再删边） */
function projectYaml(removeEdge?: { from: ChangePhase; to: ChangePhase }): string {
  const cfg = structuredClone(loadWorkflowConfig());
  if (removeEdge) {
    cfg.edges = cfg.edges.filter((e) => !(e.from === removeEdge.from && e.to === removeEdge.to));
  }
  return stringify(cfg, { indent: 2 });
}

afterEach(() => {
  setActivePhaseGraph(undefined);
  vi.restoreAllMocks();
  for (const dir of activeDirs.splice(0)) {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

// ─── TC-7-1 项目级生效（AC-01）────────────────────────────────────────────

describe('TC-7-1 项目级生效（AC-01）', () => {
  it('移除 design→build 显式边：项目级配置接管转换决策（BP-4 不再拦截）', () => {
    const root = makeProjectRoot({ '.mumuspec/workflow.yaml': projectYaml({ from: 'design', to: 'build' }) });

    const result = loadProjectWorkflowConfig(root);
    expect(result.source).toBe('project');
    expect(result.projectConfigPath).toBe(getProjectWorkflowConfigPath(root));

    // 项目级图不包含 design→build 显式边
    const g = new PhaseGraph(result.config);
    expect(g.getEdge('design', 'build')).toBeUndefined();
    expect(g.hasEdge('design', 'build')).toBe(false);

    // 激活后状态机使用项目级图：显式边消失、BP-4 不再要求确认
    const activated = activateProjectWorkflow(root);
    expect(activated.source).toBe('project');
    expect(getPhaseGraph().getEdge('design', 'build')).toBeUndefined();
    expect(requiresUserConfirmation('design', 'build').required).toBe(false);
    expect(requiresUserConfirmation('design', 'build').bp).toBe('');

    // 转换仍可达（柔性边语义：显式边移除后降级为无 BP 的柔性边）——项目级配置生效的证据
    const res = executeTransition(createTestState('design'), 'build');
    expect(res.success).toBe(true);
    expect(res.state.phase).toBe('build');
  });

  it('移除指向终态的边 → 转换真正被禁（E-CHANGE-006）', () => {
    const root = makeProjectRoot({
      '.mumuspec/workflow.yaml': projectYaml({ from: 'archive-in-progress', to: 'archive-completed' }),
    });
    const result = loadProjectWorkflowConfig(root);
    expect(result.source).toBe('project');
    expect(new PhaseGraph(result.config).resolveEdge('archive-in-progress', 'archive-completed')).toBeUndefined();

    activateProjectWorkflow(root);
    // 终态目标无柔性边兜底 → 转换被禁
    expect(getValidTransitions('archive-in-progress')).not.toContain('archive-completed');
    const res = executeTransition(createTestState('archive-in-progress'), 'archive-completed');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/E-CHANGE-006/);
  });
});

// ─── TC-7-2 无项目级 → 内置一致（AC-02）──────────────────────────────────

describe('TC-7-2 无项目级 → 内置一致（AC-02）', () => {
  it('无 .mumuspec/workflow.yaml → source default，配置等于内置默认', () => {
    const root = makeProjectRoot();
    expect(existsSync(getProjectWorkflowConfigPath(root))).toBe(false);

    const result = loadProjectWorkflowConfig(root);
    expect(result.source).toBe('default');
    expect(result.projectConfigPath).toBeUndefined();
    expect(result.config).toEqual(buildFallbackConfig());
  });

  it('激活后不注入 → 状态机仍为内置默认图（design→build 存在、BP-4 生效）', () => {
    const root = makeProjectRoot();
    const activated = activateProjectWorkflow(root);
    expect(activated.source).toBe('default');

    // 未注入 → 有效图 = DEFAULT_PHASE_GRAPH（与 0.19.1 完全一致）
    expect(getPhaseGraph()).toBe(DEFAULT_PHASE_GRAPH);
    expect(getPhaseGraph().hasEdge('design', 'build')).toBe(true);
    expect(requiresUserConfirmation('design', 'build').required).toBe(true);
    expect(requiresUserConfirmation('design', 'build').bp).toBe('BP-4');
  });
});

// ─── TC-7-3 损坏 YAML → WARN + 回退（AC-03）───────────────────────────────

describe('TC-7-3 损坏 YAML → WARN + 回退（AC-03）', () => {
  it('YAML 解析失败 → console.warn + 内置默认，不崩溃', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = makeProjectRoot({ '.mumuspec/workflow.yaml': 'invalid: [' });

    const result = loadProjectWorkflowConfig(root);
    expect(result.source).toBe('default');
    expect(result.config).toEqual(buildFallbackConfig());
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.join(' ')).toMatch(/project workflow config/);
    expect(warn.mock.calls.join(' ')).toMatch(/falling back to built-in default/);

    // 激活路径同样不崩溃，且回退内置
    const activated = activateProjectWorkflow(root);
    expect(activated.source).toBe('default');
    expect(getPhaseGraph()).toBe(DEFAULT_PHASE_GRAPH);
  });
});

// ─── TC-7-4 非法配置 → 回退（AC-04）──────────────────────────────────────

describe('TC-7-4 非法配置 → 回退（AC-04）', () => {
  it('schema 校验失败（未知 phase）→ WARN 注明原因 + 内置默认', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bad = structuredClone(loadWorkflowConfig());
    bad.edges = [{ from: 'open', to: 'nirvana', direction: 'forward', countAs: 'none', label: 'bad' }];
    const root = makeProjectRoot({ '.mumuspec/workflow.yaml': stringify(bad) });

    const result = loadProjectWorkflowConfig(root);
    expect(result.source).toBe('default');
    expect(result.config).toEqual(buildFallbackConfig());
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls.join(' ')).toMatch(/known phase/);

    // 缺 workflows 键等结构性非法同样回退
    const root2 = makeProjectRoot({ '.mumuspec/workflow.yaml': 'version: 1\nphases: [open]\nterminal: []\nedges: []\n' });
    const result2 = loadProjectWorkflowConfig(root2);
    expect(result2.source).toBe('default');
    expect(result2.config).toEqual(buildFallbackConfig());

    // 激活不崩溃
    activateProjectWorkflow(root);
    expect(getPhaseGraph()).toBe(DEFAULT_PHASE_GRAPH);
  });
});

// ─── TC-7-5 注入复位（供回归 + 单测隔离）─────────────────────────────────

describe('TC-7-5 注入复位', () => {
  it('setActivePhaseGraph(undefined) 恢复内置默认图', () => {
    setActivePhaseGraph(new PhaseGraph(buildFallbackConfig()));
    expect(getPhaseGraph()).not.toBe(DEFAULT_PHASE_GRAPH);
    setActivePhaseGraph(undefined);
    expect(getPhaseGraph()).toBe(DEFAULT_PHASE_GRAPH);
  });
});
