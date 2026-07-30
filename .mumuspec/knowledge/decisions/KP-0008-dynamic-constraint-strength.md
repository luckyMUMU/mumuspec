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
  nodes: []
  edges: []

# === 索引 ===
tags: ["constraint-strength", "dynamic", "dual-dimension", "progressive"]
related_pages:
  - "KP-0001"
  - "KP-0003"
  - "KP-0009"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

不同团队成熟度、项目阶段、变更类型需要不同的约束严格程度。单一强制约束无法适配所有场景。

## 决策

引入双维度动态约束强度系统：

### 双维度

| 维度 | 缩写 | 含义 | 适用工作流规则 |
|------|------|------|---------------|
| **技术设计** | TOP-DOWN DESIGN + TDD | 自顶向下设计、TDD 红绿循环 |

### 三档强度

| 强度 | 行为 | 适用场景 |
|------|------|---------|
| `high` | 强制 block | 新项目、新团队、核心模块 |
| `medium` | 推荐 warn（允许降级） | 成熟团队、非核心模块 |
| `low` | 关闭 info | 紧急修复、内部工具 |

### 工作流限制渐进式放开

| 工作流规则 | 维度 | high | medium | low |
|-----------|------|------|--------|-----|
| `worktree_isolation` | RG | 强制 block | warn（允许 branch 降级） | info（关闭） |
| `single_active_change` | RG | 强制 1 个 | warn ≤3 并行 | info（无上限） |
| `top_down_design` | TD | 强制 Level 0→N | warn（允许跳跃） | info（关闭） |
| `tdd_enforced` | TD | 强制 Red→Green→Refactor | warn（测试存在即可） | info（关闭） |

### 求值优先级

1. `.mumuspec.yaml` 中 `workflow.*` 显式设置 — 直接生效
2. `constraint_strength.overrides.workflow.*` — 覆盖强度等级
3. `constraint_strength.<dimension>` 强度等级 — 按维度联动
4. 默认值（high → 强制）

### 例外清单

以下约束无论强度等级如何始终阻断：
- SHALL NOT 违规（CI 阶段）
- 测试不可变性漂移

## 影响

- 团队可按需调整工作流限制严格程度
- 紧急 hotfix 可设 `constraint_strength` 为 low 加速推进
- 架构关键模块保持 high 强度强制约束
- 动态求值器 `resolveConstraintTree()` 支持树状层级约束

## 关联约束

- SHALL: 约束强度 SHALL 按"显式配置 > 强度等级联动 > 默认值"优先级求值
- SHALL NOT: SHALL NOT 违规不论强度等级始终阻断（CI 阶段）
