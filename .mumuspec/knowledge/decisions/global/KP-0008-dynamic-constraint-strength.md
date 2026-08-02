---
# === 标识 ===
id: "KP-0008"
title: "动态约束强度系统设计决策"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-27T00:00:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.12.0-dynamic-constraint-strength"
source_phase: "design"
source_artifact: "docs/design/constraint-strength.md"

# === 图谱关联 ===
graph_bindings:
  - src/core/constraint-strength.ts
  - src/core/types.ts
  - src/cli.ts

# === 索引 ===
tags: ["constraint-strength", "dynamic", "dual-dimension", "progressive", "vision"]
related_pages:
  - "KP-0001"
  - "KP-0003"
  - "KP-0009"
  - "KD-0019"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

不同团队成熟度、项目阶段、变更类型需要不同的约束严格程度。0.11.0 的工作流规则仅有 on/off 二元态，缺少中间档位；且所有约束单维度混合，无法区分"技术设计严谨度"与"需求目标完整度"。

## 核心决策

引入双维度动态约束强度系统：

### 双维度

| 维度 | 缩写 | 含义 | 适用工作流规则 |
|------|------|------|---------------|
| **技术设计** | TD (Technical Design) | 自顶向下设计、TDD 红绿循环 |
| **需求目标** | RG (Requirement Goals) | 自顶向下设计完成度、完整性 |

### 三档强度

| 强度 | 行为 | 适用场景 |
|------|------|---------|
| `high` | 强制 block | 新项目、新团队、核心模块 |
| `medium` | 推荐 warn（允许降级） | 成熟团队、非核心模块 |
| `low` | 关闭 info | 紧急修复、内部工具 |

### 求值优先级

1. `.mumuspec.yaml` 中 `workflow.*` 显式设置 — 直接生效
2. `constraint_strength.overrides.workflow.*` — 覆盖强度等级
3. `constraint_strength.<dimension>` 强度等级 — 按维度联动
4. 默认值（high -> 强制）

### 例外清单（始终阻断）

- SHALL NOT 违规（CI 阶段）
- 测试不可变性漂移
- 终态守卫 (`archive-completed`)
- 用户确认门禁（BP-3 / BP-4 / BP-14 / BP-17）

## 遗留影响

- 团队可按需调整工作流限制严格程度
- 紧急 hotfix 可设 `constraint_strength` 为 low 加速推进
- 架构关键模块保持 high 强度强制约束
- 动态求值器 `resolveConstraintTree()` 支持树状层级约束（0.12.1+）

## 遗留约束

- SHALL: 约束强度 SHALL 按"显式配置 > 强度等级联动 > 默认值"优先级求值
- SHALL NOT: SHALL NOT 违规不论强度等级始终阻断（CI 阶段）

## 详细文档

双维度约束模型、强度映射矩阵（TD/RG 两维共 18 项约束分级）、持久化 constraints.yaml 文件、树状层级继承、阻断点 BP-1~BP-18、Phase Guard 检查项分级、Skill 联动、CLI 命令完整设计见 [KD-0019 — Constraint Strength 动态约束强度系统](KD-0019-docs_design_constraint-strength.md)
