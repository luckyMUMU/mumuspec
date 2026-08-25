/**
 * Mock knowledge entries for QA retrieval.
 * ponytail: 硬编码 6 条，覆盖关键词 ponytail / spec / change / constraint。
 */

import type { KnowledgeItem } from '@/types/qa';

export const mockKnowledge: KnowledgeItem[] = [
  {
    id: 'mk-1',
    title: 'Ponytail 编码约束 7 级阶梯',
    body: 'L1 YAGNI 不写不需要代码；L2 复用已有；L3 标准库优先；L4 平台特性优先；L5 已有依赖优先；L6 能一行写完；L7 最小可工作。',
    tags: ['ponytail', 'constraint', '7-level'],
    relatedNodeId: 'con-ponytail',
  },
  {
    id: 'mk-2',
    title: 'SHALL / SHALL NOT 规范体系',
    body: '规范层通过 SHALL 硬约束和 SHALL NOT 硬禁止，配合渐进式披露加载机制作用于 AI 编码工具。',
    tags: ['spec', 'shall', 'shall-not'],
    relatedNodeId: 'spec-root',
  },
  {
    id: 'mk-3',
    title: 'Change 五阶段工作流',
    body: 'Open → Design → Build → Verify → Archive。每阶段有 Phase Guard 校验，支持 rollback 与 rebuild。',
    tags: ['change', 'workflow', 'phase'],
    relatedNodeId: 'spec-change',
  },
  {
    id: 'mk-4',
    title: 'Understand-Anything 设计借鉴',
    body: '参考 UA 的 7 个 skill（understand-chat/-onboard/-dashboard 等），dashboard 采用 React Flow + CSS Modules。',
    tags: ['understand-anything', 'ua', 'design'],
    relatedNodeId: 'kp-ua-research',
  },
  {
    id: 'mk-5',
    title: 'TDD 红绿重构循环',
    body: '先写失败测试（Red），再写最简实现使测试通过（Green），最后重构（Refactor）但不改测试。',
    tags: ['tdd', 'red-green', 'refactor'],
    relatedNodeId: 'con-tdd',
  },
  {
    id: 'mk-6',
    title: 'Contract Layer 漂移检测',
    body: '6 类漂移：spec/graph/contract/knowledge/design-doc/eval。任何 build 前 drift 修复需用户确认。',
    tags: ['contract', 'drift', 'guard'],
    relatedNodeId: 'spec-contract',
  },
];
