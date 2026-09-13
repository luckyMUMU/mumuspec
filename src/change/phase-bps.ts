/**
 * CHG-8 — phase_bps 查询与 skill 侧声明对比。
 *
 * phase_bps 是 workflow 配置中 workflows.<wf>.phase_bps 的运行时形态：
 * phase → 该阶段人工决策点（BP id）列表。本模块提供纯函数查询与对比逻辑，
 * 供 `graph verify` 报告与一致性检查消费；不承载任何状态写入。
 */
import type { ChangePhase, Workflow } from '../core/types.js';
import type { WorkflowConfig } from './phase-graph.js';

/** 某 workflow 的 phase → BP id 列表（无声明返回空对象）。 */
export function collectWorkflowBps(
  config: WorkflowConfig,
  workflow: Workflow,
): Partial<Record<ChangePhase, string[]>> {
  const entry = config.workflows[workflow];
  return entry?.phase_bps ?? {};
}

/** 某 workflow 的全部 BP id（去重）。 */
export function collectWorkflowBpIds(config: WorkflowConfig, workflow: Workflow): string[] {
  const bps = collectWorkflowBps(config, workflow);
  const ids = new Set<string>();
  for (const list of Object.values(bps)) {
    if (!list) continue;
    for (const id of list) ids.add(id);
  }
  return [...ids];
}

/** 全部 workflow 的 BP id 并集（去重）。 */
export function unionBps(config: WorkflowConfig): string[] {
  const ids = new Set<string>();
  for (const wf of Object.keys(config.workflows) as Workflow[]) {
    for (const id of collectWorkflowBpIds(config, wf)) ids.add(id);
  }
  return [...ids].sort();
}

/**
 * 从 skill 侧 workflow.yaml 对象提取 BP id 声明集合：
 * phases.<phase>.blocking_points 与 presets.<preset>.blocking_points 的条目键
 * （条目形态为 `- BP-1: 描述` 的单键映射）。
 */
export function collectSkillBps(skill: unknown): string[] {
  const ids = new Set<string>();
  const collect = (sections: unknown): void => {
    if (sections === null || typeof sections !== 'object') return;
    for (const section of Object.values(sections as Record<string, unknown>)) {
      if (section === null || typeof section !== 'object') continue;
      const bps = (section as Record<string, unknown>).blocking_points;
      if (!Array.isArray(bps)) continue;
      for (const entry of bps) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
        for (const key of Object.keys(entry)) {
          if (/^BP-\d+(\.\d+)?$/.test(key)) ids.add(key);
        }
      }
    }
  };
  if (skill !== null && typeof skill === 'object') {
    const s = skill as Record<string, unknown>;
    // skill 侧文件把 phases/presets 嵌套在顶层 workflow: 之下（预存形态），
    // 也兼容未来扁平化的形态。
    const root = (s.workflow && typeof s.workflow === 'object' ? s.workflow : s) as Record<
      string,
      unknown
    >;
    collect(root.phases);
    collect(root.presets);
  }
  return [...ids].sort();
}

/** 引擎 vs skill 侧差异。missing = 引擎有 skill 无；extra = skill 有引擎无。 */
export function compareBps(
  engineIds: string[],
  skillIds: string[],
): { missing: string[]; extra: string[] } {
  const engine = new Set(engineIds);
  const skill = new Set(skillIds);
  const missing = engineIds.filter((id) => !skill.has(id));
  const extra = skillIds.filter((id) => !engine.has(id));
  return { missing, extra };
}
