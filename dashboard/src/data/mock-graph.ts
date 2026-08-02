/**
 * Mock graph data — shape aligns with src/core/types conventions.
 * ponytail: 硬编码常量（最小可工作 mock），不加序列化库。
 */

import type { GraphData, GraphNode, GraphEdge } from '@/types/graph';

const nodes: GraphNode[] = [
  {
    id: 'spec-root',
    kind: 'SpecModule',
    label: 'Spec Layer 根',
    summary: '树状规范的顶层模块，包含 SHALL / SHALL NOT 声明。',
    metadata: { level: 'L0', ruleCount: '8' },
  },
  {
    id: 'spec-change',
    kind: 'SpecModule',
    label: 'Change 工作流',
    summary: '五阶段变更流程：open / design / build / verify / archive。',
    metadata: { level: 'L1', phases: '5' },
  },
  {
    id: 'spec-knowledge',
    kind: 'SpecModule',
    label: 'Knowledge Layer',
    summary: '知识页面、LLM-Wiki、PageIndex 三件套。',
    metadata: { level: 'L1' },
  },
  {
    id: 'spec-contract',
    kind: 'SpecModule',
    label: 'Contract Layer',
    summary: '外部契约 + 对外契约 + 派生约束 + 漂移检测。',
    metadata: { level: 'L1' },
  },
  {
    id: 'con-ponytail',
    kind: 'Constraint',
    label: 'Ponytail 编码约束',
    summary: '7 级优先级阶梯：YAGNI → 复用 → 标准库 → 平台特性 → 已有依赖 → 一行 → 最小可工作。',
    metadata: { priority: '7-level' },
  },
  {
    id: 'con-tdd',
    kind: 'Constraint',
    label: 'TDD 强制',
    summary: 'Red-Green-Refactor 红绿循环，测试锁定后不可变。',
    metadata: { mode: 'tdd' },
  },
  {
    id: 'con-shall-not',
    kind: 'Constraint',
    label: 'SHALL NOT 约束',
    summary: '未被请求的抽象层、标准库可满足时引入新依赖等硬禁止。',
    metadata: { scope: 'all' },
  },
  {
    id: 'change-onboard',
    kind: 'Change',
    label: 'dashboard-onboard-chat',
    summary: '本次变更：新增 React + Vite Dashboard（Onboard Chat）。',
    metadata: { phase: 'build', workflow: 'full' },
    changeEvents: [
      { id: 'ev-1', changeName: 'dashboard-onboard-chat', timestamp: '2026-08-02T09:40:30Z', type: 'created' },
      { id: 'ev-2', changeName: 'dashboard-onboard-chat', timestamp: '2026-08-02T10:01:00Z', type: 'phased' },
    ],
  },
  {
    id: 'change-spec-sync',
    kind: 'Change',
    label: 'sync-spec-knowledge-base',
    summary: '同步 spec 与 knowledge base 内容。',
    metadata: { phase: 'archived' },
    changeEvents: [
      { id: 'ev-3', changeName: 'sync-spec-knowledge-base', timestamp: '2026-07-30T10:00:00Z', type: 'created' },
      { id: 'ev-4', changeName: 'sync-spec-knowledge-base', timestamp: '2026-07-31T10:00:00Z', type: 'archived' },
    ],
  },
  {
    id: 'change-env-spec',
    kind: 'Change',
    label: 'add-env-spec',
    summary: '新增 env-spec.md 模板与校验。',
    metadata: { phase: 'archived' },
    changeEvents: [
      { id: 'ev-5', changeName: 'add-env-spec', timestamp: '2026-08-01T08:00:00Z', type: 'created' },
      { id: 'ev-6', changeName: 'add-env-spec', timestamp: '2026-08-01T12:00:00Z', type: 'archived' },
    ],
  },
  {
    id: 'kp-ponytail-ref',
    kind: 'Knowledge',
    label: 'Ponytail 实施模式',
    summary: 'Pattern：ponytail_constraints_defined 用注释标记有意简化。',
    metadata: { patternId: 'KP-0030' },
  },
  {
    id: 'kp-ua-research',
    kind: 'Knowledge',
    label: 'Understand-Anything 设计借鉴',
    summary: '参考 UA 的 dashboard skill、onboard chat 与结构图谱模式。',
    metadata: { patternId: 'KP-0032' },
  },
];

const edges: GraphEdge[] = [
  { id: 'e-1', source: 'spec-root', target: 'spec-change', kind: 'GOVERNED_BY' },
  { id: 'e-2', source: 'spec-root', target: 'spec-knowledge', kind: 'GOVERNED_BY' },
  { id: 'e-3', source: 'spec-root', target: 'spec-contract', kind: 'GOVERNED_BY' },
  { id: 'e-4', source: 'spec-root', target: 'con-ponytail', kind: 'GOVERNED_BY' },
  { id: 'e-5', source: 'spec-root', target: 'con-tdd', kind: 'GOVERNED_BY' },
  { id: 'e-6', source: 'change-onboard', target: 'spec-change', kind: 'DERIVED_FROM' },
  { id: 'e-7', source: 'change-onboard', target: 'con-ponytail', kind: 'GOVERNED_BY' },
  { id: 'e-8', source: 'change-onboard', target: 'con-tdd', kind: 'GOVERNED_BY' },
  { id: 'e-9', source: 'spec-change', target: 'change-spec-sync', kind: 'DERIVED_FROM' },
  { id: 'e-10', source: 'spec-change', target: 'change-env-spec', kind: 'DERIVED_FROM' },
  { id: 'e-11', source: 'kp-ponytail-ref', target: 'con-ponytail', kind: 'DEPENDS_ON' },
  { id: 'e-12', source: 'kp-ua-research', target: 'change-onboard', kind: 'DEPENDS_ON' },
  { id: 'e-13', source: 'con-shall-not', target: 'con-ponytail', kind: 'DERIVED_FROM' },
];

export const mockGraphData: GraphData = { nodes, edges };
