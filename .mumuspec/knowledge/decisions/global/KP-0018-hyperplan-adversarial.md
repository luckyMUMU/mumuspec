---
# === 标识 ===
id: "KP-0018"
title: "Hyperplan 对抗式规划 Skill 设计决策"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.7.0-hyperplan-introduction"
source_phase: "design"
source_artifact: "docs/reference/skill-ecosystem.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["hyperplan", "adversarial", "design-review", "multi-role"]
related_pages:
  - "KP-0007"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

单一 AI 视角容易产生设计盲区，需要多角色对抗审查机制提高设计质量。

## 决策

引入 Hyperplan 对抗式规划 Skill（Phase 5 实现），作为可选的 Design 阶段增强审查机制。

### 触发条件

| 条件 | 说明 |
|------|------|
| `complexity` | 变更涉及 3+ 模块或新 API 层 |
| `risk_level` | 涉及数据迁移、安全敏感操作 |
| `user_request` | 用户显式要求 Hyperplan |

### 多角色审查机制

| 角色 | 职责 |
|------|------|
| **Security Reviewer** | 识别安全盲区、注入风险、权限漏洞 |
| **Performance Guardian** | 识别 N+1 查询、大对象序列化、冷启动瓶颈 |
| **Compatibility Auditor** | 向后兼容性、下游消费方影响 |
| **Test Coverage Auditor** | 边界条件、异常路径、幂等性 |
| **Architecture Guardian** | 约束继承冲突、职责边界、过度抽象 |

### 流程

```
design-approve → hyperplan-trigger? → multi-round-adversarial →
  hard_constraints → merge to design.md SHALL/SHALL NOT →
  open_questions → resolve → design-approved
```

### 产出

- `hyperplan_result.hard_constraints`：必须合并到 design.md 的约束
- `hyperplan_result.open_questions`：需用户决策的争议点
- `hyperplan_result.surviving_insights`："幸存"的设计洞察

## 影响

- 仅复杂变更触发简单变更跳过（YAGNI）
- Hyperplan 硬约束必须合并到 design.md 才能进入 Build 阶段
- 开放问题未解决前 Phase Guard（design_to_build）阻断
- 推迟到 Phase 5 实现（当前使用脑暴 + 用户确认作为 MVP 替代）

## 关联约束

- SHALL: Hyperplan 硬约束 SHALL 合并到 design.md 后才能进入 Build 阶段
- SHALL: Hyperplan 开放问题 SHALL 全部解决后才能通过 Phase Guard
- SHALL NOT: 简单 hotfix 不得强制 Hyperplan（遵循 YAGNI）
