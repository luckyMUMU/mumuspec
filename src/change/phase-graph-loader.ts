import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { parse } from 'yaml';
import { readYaml, getMumuSpecDir } from '../core/utils.js';
import type { ChangePhase, Workflow } from '../core/types.js';
import type { WorkflowConfig, WorkflowEdgeSpec, WorkflowConditionSpec } from './phase-graph.js';

/**
 * CHG-6 loader — YAML → WorkflowConfig 的加载与校验。
 * 设计约束：
 * - fail-safe：加载/校验任何异常 → console.warn + 返回 buildFallbackConfig()（不崩溃）
 * - 无运行时循环依赖：本文件对 phase-graph.js 仅做 type-only import；
 *   phase-graph.ts 顶层构造 DEFAULT_PHASE_GRAPH 时调用本模块。
 */

/**
 * Canonical phase order — must stay in sync with PHASE_ORDER in phase-graph.ts.
 * AC-01 图同构测试锁定一致性；此处复制避免 loader ↔ phase-graph 运行时循环。
 */
const CANONICAL_PHASES: ChangePhase[] = [
  'open', 'design', 'build', 'verify',
  'archive-in-progress', 'archive-completed', 'discarded',
];

const WORKFLOW_KEYS: Workflow[] = ['full', 'hotfix', 'tweak', 'loop'];
const DIRECTIONS = ['forward', 'backward', 'skip'] as const;
const COUNTERS = ['rollback', 'rebuild', 'none'] as const;

/** Default YAML path — dev(tsx src) 与 dist 目录结构一致，双环境命中 */
export const DEFAULT_WORKFLOW_YAML_PATH = fileURLToPath(
  new URL('./workflow.default.yaml', import.meta.url),
);

/**
 * Load workflow config from YAML (fail-safe).
 * - filePath 缺省 → 默认包内 YAML
 * - 文件缺失/解析失败/校验失败 → console.warn + buildFallbackConfig()
 */
export function loadWorkflowConfig(filePath?: string): WorkflowConfig {
  const target = filePath ?? DEFAULT_WORKFLOW_YAML_PATH;
  try {
    const raw = readYaml<unknown>(target);
    if (raw === undefined) {
      throw new Error(`workflow.default.yaml not found: ${target}`);
    }
    const errors = collectErrors(raw);
    if (errors.length > 0) {
      throw new Error(`invalid workflow config: ${errors.join('; ')}`);
    }
    return raw as WorkflowConfig;
  } catch (err) {
    console.warn(
      `[phase-graph-loader] ${err instanceof Error ? err.message : String(err)}; ` +
        'falling back to built-in default workflow config',
    );
    return buildFallbackConfig();
  }
}

/**
 * CHG-7 — project-level workflow override load result.
 * - source 'project'：.mumuspec/workflow.yaml 存在且通过校验，config 为用户配置。
 * - source 'default'：无项目级文件 / 解析失败 / 校验失败，config 为内置默认（回退）。
 */
export interface ProjectWorkflowLoadResult {
  config: WorkflowConfig;
  source: 'project' | 'default';
  /** 项目级 workflow.yaml 绝对路径（仅 source === 'project' 时存在）。 */
  projectConfigPath?: string;
}

/** Project-level workflow.yaml path — 与 .mumuspec/config.yaml 同级。 */
export function getProjectWorkflowConfigPath(projectRoot: string): string {
  return join(getMumuSpecDir(projectRoot), 'workflow.yaml');
}

/**
 * CHG-7 — load the project-level workflow override (fail-safe).
 * - 项目级 .mumuspec/workflow.yaml 存在 → 校验加载（source 'project'）
 * - 不存在 → 内置默认（source 'default'，AC-02 向后兼容）
 * - 损坏/非法 → console.warn + 内置默认（source 'default'，AC-03/AC-04 不崩溃）
 * 与 CHG-6 loadWorkflowConfig 的 fail-safe 风格一致（console.warn，不写 audit.log——
 * audit.log 是用户操作审计，配置回退属诊断性警告）。
 */
export function loadProjectWorkflowConfig(projectRoot: string): ProjectWorkflowLoadResult {
  const path = getProjectWorkflowConfigPath(projectRoot);
  try {
    const raw = readYaml<unknown>(path);
    if (raw === undefined) {
      // 无项目级文件 → 内置默认
      return { config: buildFallbackConfig(), source: 'default' };
    }
    const errors = collectErrors(raw);
    if (errors.length > 0) {
      console.warn(
        `[phase-graph-loader] project workflow config invalid at ${path}: ${errors.join('; ')}; ` +
          'falling back to built-in default workflow config',
      );
      return { config: buildFallbackConfig(), source: 'default' };
    }
    return { config: raw as WorkflowConfig, source: 'project', projectConfigPath: path };
  } catch (err) {
    console.warn(
      `[phase-graph-loader] failed to load project workflow config at ${path}: ` +
        `${err instanceof Error ? err.message : String(err)}; falling back to built-in default workflow config`,
    );
    return { config: buildFallbackConfig(), source: 'default' };
  }
}

/**
 * Parse a YAML string into WorkflowConfig.
 * Pure parse + validate — throws on any schema violation (for error-path tests).
 */
export function parseWorkflowConfig(yamlString: string): WorkflowConfig {
  const raw: unknown = parse(yamlString);
  const errors = collectErrors(raw);
  if (errors.length > 0) {
    throw new Error(`Invalid workflow config: ${errors.join('; ')}`);
  }
  return raw as WorkflowConfig;
}

/** Type guard — true iff cfg satisfies the WorkflowConfig schema. */
export function validateWorkflowConfig(cfg: unknown): cfg is WorkflowConfig {
  return collectErrors(cfg).length === 0;
}

/** Collect schema violation messages (empty array = valid). */
function collectErrors(cfg: unknown): string[] {
  const errors: string[] = [];
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) {
    return ['root must be an object'];
  }
  const c = cfg as Record<string, unknown>;

  // version
  if (c.version !== 1) errors.push('version must be 1');

  // phases — canonical order
  if (!isArrayOf(c.phases, (p) => typeof p === 'string')) {
    errors.push('phases must be a string array');
  } else if (!samePhases(c.phases as string[], CANONICAL_PHASES)) {
    errors.push('phases must equal canonical PHASE_ORDER (open→discarded)');
  }

  // terminal ⊆ phases
  if (!isArrayOf(c.terminal, (t) => typeof t === 'string')) {
    errors.push('terminal must be a string array');
  } else {
    for (const t of c.terminal as string[]) {
      if (!CANONICAL_PHASES.includes(t as ChangePhase)) {
        errors.push(`terminal contains unknown phase '${t}'`);
      }
    }
  }

  // edges
  if (!Array.isArray(c.edges)) {
    errors.push('edges must be an array');
  } else {
    for (const [i, edge] of c.edges.entries()) {
      collectEdgeErrors(errors, edge, i);
    }
  }

  // workflows — exactly full/hotfix/tweak/loop
  if (c.workflows === null || typeof c.workflows !== 'object' || Array.isArray(c.workflows)) {
    errors.push('workflows must be an object');
  } else {
    const wf = c.workflows as Record<string, unknown>;
    for (const key of WORKFLOW_KEYS) {
      if (!(key in wf)) {
        errors.push(`workflows missing key '${key}'`);
        continue;
      }
      const entry = wf[key];
      if (entry === null || typeof entry !== 'object') {
        errors.push(`workflows.${key} must be an object`);
        continue;
      }
      const phases = (entry as Record<string, unknown>).phases;
      if (!isArrayOf(phases, (p) => typeof p === 'string')) {
        errors.push(`workflows.${key}.phases must be a string array`);
      } else {
        for (const p of phases as string[]) {
          if (!CANONICAL_PHASES.includes(p as ChangePhase)) {
            errors.push(`workflows.${key}.phases contains unknown phase '${p}'`);
          }
        }
      }
      // BP id 唯一性按单个 workflow 作用域——同一 BP 可被多个 workflow 复用
      // （如 BP-3 同时属于 full.open 与 hotfix.open），这是设计使然。
      collectPhaseBpsErrors(errors, `workflows.${key}.phase_bps`, (entry as Record<string, unknown>).phase_bps, key);
    }
    for (const key of Object.keys(wf)) {
      if (!WORKFLOW_KEYS.includes(key as Workflow)) {
        errors.push(`workflows contains unknown key '${key}'`);
      }
    }
  }

  return errors;
}

const BP_ID_RE = /^BP-\d+(\.\d+)?$/;

/**
 * CHG-8 — phase_bps 校验：键为已知 phase、值非空 BP id 数组、id 在本 workflow 内唯一。
 * phase_bps 缺失合法（向后兼容）；结构非法时对违规处逐条报错。
 */
function collectPhaseBpsErrors(
  errors: string[],
  path: string,
  bps: unknown,
  workflowKey: string,
): void {
  if (bps === undefined) return;
  if (bps === null || typeof bps !== 'object' || Array.isArray(bps)) {
    errors.push(`${path} must be an object`);
    return;
  }
  const seenBpIds = new Map<string, string>(); // BP id -> 首次出现 phase（workflow 内唯一）
  for (const [phase, ids] of Object.entries(bps as Record<string, unknown>)) {
    if (!CANONICAL_PHASES.includes(phase as ChangePhase)) {
      errors.push(`${path} contains unknown phase '${phase}'`);
      continue;
    }
    if (!isArrayOf(ids, (id) => typeof id === 'string') || (ids as string[]).length === 0) {
      errors.push(`${path}.${phase} must be a non-empty string array`);
      continue;
    }
    for (const id of ids as string[]) {
      if (!BP_ID_RE.test(id)) {
        errors.push(`${path}.${phase} contains malformed BP id '${id}' (expected BP-<num>[.<num>])`);
        continue;
      }
      const first = seenBpIds.get(id);
      if (first) {
        errors.push(`${path}.${phase} duplicates BP id '${id}' (first seen at workflows.${workflowKey}.phase_bps.${first})`);
      } else {
        seenBpIds.set(id, phase);
      }
    }
  }
}

function collectEdgeErrors(errors: string[], edge: unknown, i: number): void {
  const prefix = `edges[${i}]`;
  if (edge === null || typeof edge !== 'object' || Array.isArray(edge)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  const e = edge as Record<string, unknown>;

  if (typeof e.from !== 'string' || !CANONICAL_PHASES.includes(e.from as ChangePhase)) {
    errors.push(`${prefix}.from must be a known phase`);
  }
  if (typeof e.to !== 'string' || !CANONICAL_PHASES.includes(e.to as ChangePhase)) {
    errors.push(`${prefix}.to must be a known phase`);
  }
  if (typeof e.direction !== 'string' || !DIRECTIONS.includes(e.direction as never)) {
    errors.push(`${prefix}.direction must be one of forward|backward|skip`);
  }
  if (typeof e.countAs !== 'string' || !COUNTERS.includes(e.countAs as never)) {
    errors.push(`${prefix}.countAs must be one of rollback|rebuild|none`);
  }
  if (typeof e.label !== 'string' || e.label.length === 0) {
    errors.push(`${prefix}.label must be a non-empty string`);
  }

  // bp (optional)
  if (e.bp !== undefined) {
    const bp = e.bp;
    if (bp === null || typeof bp !== 'object' || Array.isArray(bp)) {
      errors.push(`${prefix}.bp must be an object`);
    } else {
      const b = bp as Record<string, unknown>;
      if (typeof b.id !== 'string' || b.id.length === 0) errors.push(`${prefix}.bp.id must be a non-empty string`);
      if (typeof b.description !== 'string') errors.push(`${prefix}.bp.description must be a string`);
      if (typeof b.required !== 'boolean') errors.push(`${prefix}.bp.required must be a boolean`);
    }
  }

  // condition (optional) — 本期仅支持 workflow_in
  if (e.condition !== undefined) {
    const cond = e.condition;
    if (cond === null || typeof cond !== 'object' || Array.isArray(cond)) {
      errors.push(`${prefix}.condition must be an object`);
      return;
    }
    const wi = (cond as Record<string, unknown>).workflow_in;
    if (!isArrayOf(wi, (w) => typeof w === 'string')) {
      errors.push(`${prefix}.condition.workflow_in must be a string array`);
    } else if ((wi as string[]).length === 0) {
      errors.push(`${prefix}.condition.workflow_in must not be empty`);
    } else {
      for (const w of wi as string[]) {
        if (!WORKFLOW_KEYS.includes(w as Workflow)) {
          errors.push(`${prefix}.condition.workflow_in contains unknown workflow '${w}'`);
        }
      }
    }
  }
}

function isArrayOf(value: unknown, pred: (v: unknown) => boolean): value is unknown[] {
  return Array.isArray(value) && value.every(pred);
}

function samePhases(a: string[], b: ChangePhase[]): boolean {
  return a.length === b.length && a.every((p, i) => p === b[i]);
}

/**
 * Built-in fallback — pure data, isomorphic to the historical hardcoded graph
 * (0.19.1 phase-graph.ts buildDefaultEdges L84-210). Acts as AC-01 baseline and
 * fail-safe default when the YAML is missing/corrupt.
 */
export function buildFallbackConfig(): WorkflowConfig {
  return {
    version: 1,
    phases: [...CANONICAL_PHASES],
    terminal: ['archive-completed', 'discarded'],
    edges: [
      // forward ×5
      edge('open', 'design', 'forward', 'none', 'open→design（完整工作流）', { id: 'BP-3', description: '工件审查与确认', required: true }),
      edge('design', 'build', 'forward', 'none', 'design→build', { id: 'BP-4', description: '设计方案确认', required: true }),
      edge('build', 'verify', 'forward', 'none', 'build→verify'),
      edge('verify', 'archive-in-progress', 'forward', 'none', 'verify→archive-in-progress', { id: 'BP-17', description: '归档最终确认', required: true }),
      edge('archive-in-progress', 'archive-completed', 'forward', 'none', 'archive→completed'),
      // skip 条件边 ×1
      {
        ...edge('open', 'build', 'skip', 'none', 'open→build（hotfix/tweak 跳过 design）', { id: 'BP-3', description: '工件审查与确认（预设路径）', required: true }),
        condition: { workflow_in: ['hotfix', 'tweak'] } satisfies WorkflowConditionSpec,
      },
      // backward ×4
      edge('build', 'design', 'backward', 'rollback', 'build→design（回退重设）'),
      edge('verify', 'design', 'backward', 'rollback', 'verify→design（设计层面重做）'),
      edge('verify', 'build', 'backward', 'rebuild', 'verify→build（仅修复/重建）'),
      edge('archive-in-progress', 'build', 'backward', 'rollback', 'archive→build（CI 失败回退）'),
      // terminal skip ×5
      edge('open', 'discarded', 'skip', 'none', 'open→discarded（废弃变更）'),
      edge('design', 'discarded', 'skip', 'none', 'design→discarded（废弃变更）'),
      edge('build', 'discarded', 'skip', 'none', 'build→discarded（废弃变更）'),
      edge('verify', 'discarded', 'skip', 'none', 'verify→discarded（废弃变更）'),
      edge('archive-in-progress', 'discarded', 'skip', 'none', 'archive→discarded（废弃变更）'),
    ],
    workflows: {
      full: { phases: ['open', 'design', 'build', 'verify', 'archive-in-progress', 'archive-completed'] },
      hotfix: { phases: ['open', 'build', 'verify', 'archive-in-progress', 'archive-completed'], skip_design: true },
      tweak: { phases: ['open', 'build', 'verify', 'archive-in-progress', 'archive-completed'], skip_design: true },
      loop: { phases: ['build', 'verify', 'archive-in-progress', 'archive-completed'] },
    },
  };
}

function edge(
  from: ChangePhase,
  to: ChangePhase,
  direction: WorkflowEdgeSpec['direction'],
  countAs: WorkflowEdgeSpec['countAs'],
  label: string,
  bp?: { id: string; description: string; required: boolean },
): WorkflowEdgeSpec {
  return bp ? { from, to, direction, countAs, label, bp } : { from, to, direction, countAs, label };
}
