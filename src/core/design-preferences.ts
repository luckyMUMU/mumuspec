/**
 * Architecture preference packs and design skeleton rendering
 * (core-consolidation L2, R-0015).
 *
 * The skeleton is produced by code, the *choice* is made by a human at Design
 * time: init stays fully automatic (a red line — initialization never prompts),
 * so this module renders a selection table whose unresolved rows are explicit
 * rather than silently defaulted. A decision without alternatives cannot be
 * reviewed, so a selected row with no alternatives and no reason counts as
 * missing, not as done.
 *
 * Pure functions, no I/O.
 */

import type { ProjectAnalysis } from './project-analyzer.js';

/** Sentinel option: "not decided yet" is a legal, visible state. */
export const UNCONSTRAINED = 'unconstrained';

export interface PreferenceOption {
  readonly id: string;
  readonly label: string;
  /** What is given up by choosing this — the cost a reviewer needs to see. */
  readonly tradeoff: string;
}

export interface PreferencePack {
  readonly topic: string;
  readonly options: readonly PreferenceOption[];
  /** Which detected facts the default inference may lean on. */
  readonly defaultBasis: string;
}

export const ARCH_PREFERENCE_PACKS: readonly PreferencePack[] = [
  {
    topic: '分层策略',
    defaultBasis: '既有目录树与依赖方向',
    options: [
      { id: 'layered', label: '分层架构', tradeoff: '跨层调用需额外约束才不失控' },
      { id: 'hexagonal', label: '六边形', tradeoff: '端口与适配器带来样板成本' },
      { id: 'modular-monolith', label: '模块化单体', tradeoff: '模块边界靠规范而非部署强制' },
      { id: UNCONSTRAINED, label: '暂不约束', tradeoff: '下游实现自行决定边界' },
    ],
  },
  {
    topic: '数据流',
    defaultBasis: '既有入口与调用面',
    options: [
      { id: 'request-response', label: '单向请求-响应', tradeoff: '扇出场景需自行编排' },
      { id: 'event-driven', label: '事件驱动', tradeoff: '时序与幂等成本上升' },
      { id: 'mixed', label: '混合', tradeoff: '两条路径的一致性需人工把关' },
      { id: UNCONSTRAINED, label: '暂不约束', tradeoff: '异步与同步混用无边界依据' },
    ],
  },
  {
    topic: '状态与持久化',
    defaultBasis: '依赖扫描结果',
    options: [
      { id: 'orm', label: 'ORM', tradeoff: '迁移冲突与连接池治理' },
      { id: 'query-builder', label: '查询构造器', tradeoff: 'SQL 手写面变大' },
      { id: 'file-store', label: '文件存储', tradeoff: '并发写与一致性自担' },
      { id: UNCONSTRAINED, label: '暂不约束', tradeoff: '存储选型散落到各模块' },
    ],
  },
  {
    topic: '边界与契约',
    defaultBasis: '契约注册表现状',
    options: [
      { id: 'frozen-contracts', label: '显式契约冻结', tradeoff: '变更需走契约流程' },
      { id: 'convention', label: '约定式', tradeoff: '漂移只能在事后发现' },
      { id: UNCONSTRAINED, label: '暂不约束', tradeoff: '跨模块依赖无承诺' },
    ],
  },
  {
    topic: '模块组织',
    defaultBasis: '源目录聚合度',
    options: [
      { id: 'by-feature', label: '按特性', tradeoff: '公共技术层复用成本' },
      { id: 'by-layer', label: '按技术层', tradeoff: '特性改动需横切多目录' },
      { id: 'hybrid', label: '混合', tradeoff: '归属判定规则必须显式' },
      { id: UNCONSTRAINED, label: '暂不约束', tradeoff: '新代码落点无依据' },
    ],
  },
];

export interface PreferencePick {
  /** Option id from the pack's option set. */
  readonly option: string;
  /** Why this option, and what the unchosen ones would have cost. */
  readonly reason: string;
}

export type PreferencePicks = Readonly<Record<string, PreferencePick>>;

const PENDING = '【待定】';

function labelOf(pack: PreferencePack, id: string): string {
  return pack.options.find((o) => o.id === id)?.label ?? id;
}

/** Alternative labels, always excluding the chosen one so the cost is visible. */
function alternativesOf(pack: PreferencePack, chosenId?: string): string {
  const rest = pack.options.filter((o) => o.id !== chosenId).map((o) => o.label);
  return rest.join(' / ');
}

function overviewLines(analysis: ProjectAnalysis): string[] {
  const lines: string[] = [];
  lines.push(`${analysis.packageName} 是 ${analysis.projectType} 项目，语言 ${analysis.language}。`);
  if (analysis.framework && analysis.framework !== 'none') {
    lines.push(`框架：${analysis.framework}。`);
  }
  if (analysis.sourceDirs.length > 0) {
    lines.push(`源码目录：${analysis.sourceDirs.join(', ')}。`);
  }
  return lines;
}

/**
 * Render the design.md skeleton. Unpicked topics render an explicit pending row
 * (so the completeness gate can see them); picked topics must carry both the
 * alternative set and a reason, otherwise they render as pending too.
 */
export function renderDesignSkeleton(analysis: ProjectAnalysis, picks: PreferencePicks = {}): string {
  const lines: string[] = [];
  lines.push(`# Design: ${analysis.packageName}`);
  lines.push('');
  lines.push('## Architecture Overview 架构总览');
  lines.push('');
  lines.push(overviewLines(analysis).join(' '));
  lines.push('');
  lines.push('## Key Decisions 选型表');
  lines.push('');
  for (const pack of ARCH_PREFERENCE_PACKS) {
    const pick = picks[pack.topic];
    const known = pick && pack.options.some((o) => o.id === pick.option);
    const decided = known && pick.reason.trim().length > 0;
    lines.push(`### ${pack.topic}`);
    lines.push('');
    lines.push(`- 选定: ${decided ? labelOf(pack, pick!.option) : PENDING}`);
    lines.push(`- 备选: ${decided ? alternativesOf(pack, pick!.option) : PENDING}`);
    lines.push(`- 理由（含未选代价）: ${decided ? pick.reason.trim() : PENDING}`);
    lines.push(`- 推断依据: ${pack.defaultBasis}`);
    lines.push('');
  }
  lines.push('## Implementation Layers 实现分层');
  lines.push('');
  lines.push(PENDING);
  lines.push('');
  lines.push('## Module Inventory 模块清单');
  lines.push('');
  lines.push(analysis.sourceDirs.length > 0 ? analysis.sourceDirs.join(', ') : PENDING);
  lines.push('');
  return lines.join('\n');
}

/** Fields that make a selection reviewable: a decision without alternatives or
 *  reasoning cannot be re-checked downstream. */
const DECISION_FIELDS: readonly string[] = ['选定', '备选', '理由'];

/**
 * Topics whose selection row is not yet a decision: it either still carries a
 * pending marker or it lost one of the three decision fields (hand-edited).
 * A `###` block that carries none of those field labels is not a selection row,
 * so unrelated sections are never reported.
 */
export function findIncompleteSelections(designContent: string): string[] {
  const incomplete: string[] = [];
  const blocks = designContent.split(/^### /m).slice(1);
  for (const raw of blocks) {
    // A `## ` heading ends the topic's block — otherwise the last topic swallows
    // every later section and a pending marker elsewhere reads as an undecided
    // selection.
    const block = raw.split(/^## /m)[0];
    const topic = block.split('\n', 1)[0].trim();
    if (!topic) continue;
    const present = DECISION_FIELDS.filter((f) => block.includes(`- ${f}`));
    if (present.length === 0) continue;
    if (block.includes(PENDING)) {
      incomplete.push(topic);
      continue;
    }
    if (DECISION_FIELDS.length > present.length) incomplete.push(topic);
  }
  return incomplete.sort();
}
