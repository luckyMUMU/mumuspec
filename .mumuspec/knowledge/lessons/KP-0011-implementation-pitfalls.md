---
# === 标识 ===
id: "KP-0011"
title: "项目实施常见陷阱与避坑指南"
type: lesson
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/appendix/roadmap.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["pitfall", "lesson", "implementation", "best-practice"]
related_pages:
  - "KP-0009"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

AI 辅助编程项目实施中常见的陷阱和错误模式，记录以供后续变更参考。

## 常见陷阱

### 1. 范围蔓延（Scope Creep）

**症状**：Phase 1 实现超出 MVP 范围，加入不必要的特性。

**避坑**：
- 严格遵循 Phase 1 MVP 范围定义
- 新功能请求推迟到后续 Phase
- DoD 验收时检查是否超出范围

### 2. 规范过载（Spec Overload）

**症状**：一次性编写大量规范文件，AI 上下文过载。

**避坑**：
- 遵循渐进式披露原则
- 仅加载当前工作层级 + 祖先链的规范
- 每层最多加载 5 个 confirmed 且 fresh 的知识页面

### 3. 约束死锁（Constraint Deadlock）

**症状**：子层 SHALL 与父层 SHALL NOT 矛盾，AI 无法决策。

**避坑**：
- 约束冲突时按 `highest_layer_wins` 原则解决
- 子层可收紧但不可放宽父层约束
- 矛盾约束上报 `manual_review`，不允许自动决策

### 4. 知识遗忘（Knowledge Amnesia）

**症状**：变更归档后设计知识丢失，新变更从零开始。

**避坑**：
- 归档阶段强制提取知识到 LLM-Wiki
- 知识页面与代码图谱节点双向绑定
- P2 漂移检测监控知识过期

### 5. 测试不可变性破坏

**症状**：AI 在设计锁定后修改测试用例，TDD 失效。

**避坑**：
- Design 完成后 `test_cases.design_locked: true`
- 计算并校验 `design_content_hash`
- 篡改测试用例立即阻断（P1 漂移，CI 阻断合并）

### 6. 契约漂移

**症状**：外部服务 API 变更未同步到契约文件。

**避坑**：
- 所有外部调用必须有对应契约声明
- P2 漂移检测：声明了未使用的端点 / 代码调用了无契约的服务
- stable 端点的字段删除和类型变更自动阻断

## 影响

- 每个变更的 decisions.md 应记录遇到的陷阱
- 归档时提取的 lesson 知识页面纳入 .mumuspec/knowledge/lessons/
- 新变更设计阶段可参考已有 lessons

## 关联约束

- SHALL: 变更 SHALL 记录遇到的问题和解决方案
- SHALL NOT: 不得重复已知陷阱（参考已有 lessons）
