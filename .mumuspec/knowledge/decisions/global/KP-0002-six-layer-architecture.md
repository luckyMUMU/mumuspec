---
# === 标识 ===
id: "KP-0002"
title: "MumuSpec 六层架构决策"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "overview.md#4-总体架构"

# === 图谱关联 ===
graph_bindings:
  - src/core/types.ts
  - src/spec/loader.ts
  - src/knowledge/manager.ts

# === 索引 ===
tags: ["architecture", "six-layers", "design", "vision"]
related_pages:
  - "KP-0001"
  - "KP-0005"
  - "KP-0006"
  - "KP-0007"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

MumuSpec 需要为 AI Agent 提供全方位的规范与知识支持，单一层次无法覆盖所有职责。

## 决策

采用六层架构，每层职责清晰、边界明确：

| 层 | 缩写 | 职责 | 核心产出 |
|----|------|------|---------|
| **Spec Layer** | SL | 树状分布的双向约束规范 + Ponytail 基础编码约束 | `spec.md` / `design.md` / `prohibitions.md` |
| **Contract Layer** | CTL | 外部服务契约 + 自身对外契约，自动派生约束 | `contracts/external/` / `contracts/outbound/` |
| **Change Layer** | CL | 变更驱动的规范生命周期管理 | 五阶段状态机 + 回退机制 |
| **Knowledge Layer** | KL | 持久化知识来源：代码图谱(HOW) + LLM-Wiki(WHY) + PageIndex(WHERE) | `.mumuspec/knowledge/` |
| **Guard Layer** | GL | 自动化校验规范与代码一致性 | Pre-commit + CI + Phase Guards |
| **AI Integration Layer** | AIL | 与 AI 编程工具的集成接口 | Skills / MCP / Rules / CLI |

### 层间关系

```
SL ←→ CL (规范 ←→ 变更)
SL ←→ KL (规范 ←→ 知识)
CTL ←→ SL (契约派生规范)
CTL ←→ KL (契约 ←→ 知识)
CL → KL (归档提取知识)
SL → GL (规范校验)
CL → GL (变更校验)
KL → GL (知识漂移)
CTL → GL (契约漂移)
```

## 影响

- 实现者可以按层独立开发与测试
- 每层有独立的入口文档（docs/design/xxx-layer.md）
- 层间通过明确定义的接口交互
- 未来可按需扩展或替换某层（如 Knowledge Layer 可插拔后端）

## 关联约束

- SHALL: 每层设计文档 SHALL 描述本层职责、与其他层的关系、核心接口
- SHALL NOT: 单层不得跨越职责边界（如 Guard Layer 不得定义规范）
- SHALL SHALL NOT: 层间依赖不得成环（当前 CTL→SL→GL 单向）
