/**
 * Mock onboard steps — 3 role branches, each ≥3 steps, terminal step marked.
 * ponytail: 不引入 JSON schema 校验，手写常量。
 */

import type { OnboardStep } from '@/types/onboard';

export const mockOnboardSteps: OnboardStep[] = [
  // ── shared entry ( role = null ) ──
  {
    id: 'welcome',
    role: null,
    prompt: '👋 欢迎来到 MumuSpec Dashboard！请先告诉我你的角色。',
    options: [
      { label: '新成员', next: 'new-member-step-1' },
      { label: 'Tech Lead', next: 'lead-step-1' },
      { label: '单人开发者', next: 'solo-step-1' },
    ],
  },

  // ── new-member branch ──
  {
    id: 'new-member-step-1',
    role: 'new-member',
    prompt: '作为新成员，建议先了解规范层根节点。要我带你看看 Spec Layer 结构吗？',
    options: [
      { label: '好的', next: 'new-member-step-2', focusNodeId: 'spec-root' },
      { label: '跳过', next: 'new-member-step-3' },
    ],
  },
  {
    id: 'new-member-step-2',
    role: 'new-member',
    prompt: 'Spec Layer 是树状规范 + SHALL/SHALL NOT + 渐进式披露的核心。详情已展示在右侧面板。还想了解 Constraint 吗？',
    options: [
      { label: '了解 Ponytail', next: 'new-member-step-3', focusNodeId: 'con-ponytail' },
      { label: '好了', next: 'finish' },
    ],
  },
  {
    id: 'new-member-step-3',
    role: 'new-member',
    prompt: '最后一站是 Change 工作流。今日活跃变更多少个？试试在底部 QA 搜索 "change"。',
    options: [{ label: '完成引导', next: 'finish' }],
  },

  // ── lead branch ──
  {
    id: 'lead-step-1',
    role: 'lead',
    prompt: 'Tech Lead 视角：需要查看 dashboard-onboard-chat 变更详情吗？',
    options: [
      { label: '查看', next: 'lead-step-2', focusNodeId: 'change-onboard' },
      { label: '跳过', next: 'lead-step-3' },
    ],
  },
  {
    id: 'lead-step-2',
    role: 'lead',
    prompt: '当前变更处于 build 阶段，已通过 Design 认知框架 1 轮收敛。是否查看本次契约边界？',
    options: [
      { label: '查看契约', next: 'lead-step-3', focusNodeId: 'spec-contract' },
      { label: '好了', next: 'finish' },
    ],
  },
  {
    id: 'lead-step-3',
    role: 'lead',
    prompt: '了解团队知识库进度，可打开 QA 搜索 "drift" 或 "knowledge"。',
    options: [{ label: '完成引导', next: 'finish' }],
  },

  // ── solo branch ──
  {
    id: 'solo-step-1',
    role: 'solo',
    prompt: '单人开发者：建议先看 Ponytail + TDD 约束，这会直接影响编码效率。',
    options: [
      { label: '了解约束', next: 'solo-step-2', focusNodeId: 'con-ponytail' },
      { label: '跳过', next: 'solo-step-3' },
    ],
  },
  {
    id: 'solo-step-2',
    role: 'solo',
    prompt: 'Ponytail 7 级阶梯已展示右侧。接下来看看 TDD 流程？',
    options: [
      { label: '看看', next: 'solo-step-3', focusNodeId: 'con-tdd' },
      { label: '好了', next: 'finish' },
    ],
  },
  {
    id: 'solo-step-3',
    role: 'solo',
    prompt: '最后可以试试提交一次 change：在真实项目里跑 mumuspec new。有问题随时在 QA 里提问。',
    options: [{ label: '完成引导', next: 'finish' }],
  },

  // ── shared terminal ──
  {
    id: 'finish',
    role: null,
    prompt: '🎉 引导结束！随时点击左上角角色切换重新开始，或在 QA 框里提问。',
    terminal: true,
  },
];
