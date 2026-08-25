---
# === 标识 ===
id: "KP-0024"
title: "设计哲学：内部强制、外部兼容"
type: rationale
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/design/change-layer.md#设计哲学边界"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["philosophy", "boundary", "internal", "external", "compatible"]
related_pages:
  - "KP-0001"
  - "KP-0021"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

MumuSpec 需要在使用自身管理的项目中保持权威性，同时与外部 Skill 生态保持兼容。

## 设计哲学

### 内部强制

对使用 MumuSpec 管理的项目，工作流规则、SHALL/SHALL NOT 约束、漂移检测按配置的约束强度等级强制执行：

| 内部强制的内容 | 说明 |
|--------------|------|
| **阶段推进** | 必须按 Open→Design→Build→Verify→Archive 顺序推进 |
| **规范遵守** | AI Agent 生成的代码必须满足 SHALL/SHALL NOT |
| **SHALL NOT 不可逾越** | 反向禁止不论强度等级如何始终阻断（CI 阶段） |
| **测试不可变性** | Design 锁定后测试用例不可修改 |
| **决策记录** | 各阶段的关键决策必须记录到 decisions.md |

### 外部兼容

通过 Skill Bridge 与外部 Skill 生态互操作时，不强制外部 Skill 遵循 MumuSpec 工作流：

| 外部兼容的内容 | 说明 |
|--------------|------|
| **Skill 自主执行** | Superpowers/Comet 等可按自己的工作流执行 |
| **约束守卫兜底** | Skill 产出最终需通过 MumuSpec 约束校验 |
| **渐进式披露** | 规范按需提供，不强制加载全部 |
| **可选分发** | 编排器推荐 Skill 但不强制使用 |

### 强度可调

内部强制的程度从二值变为三档（high/medium/low），按双维度独立配置：

| 配置 | 效果 |
|------|------|
| `high` | 强制执行（block） |
| `medium` | 推荐执行（warn，允许降级） |
| `low` | 关闭（info） |

## 决策

MumuSpec 遵循"内部强制、外部兼容"的设计哲学边界：

1. **内部强制**：变更生命周期、规范遵守、漂移检测
2. **外部兼容**：Skill 生态互操作、可选分发
3. **强度可调**：三档强度按双维度独立配置

## 影响

- MumuSpec 管理的项目保持高质量标准
- 外部 Skill 可以渐进式接入，不要求完全重构
- 团队成熟度提升后可降低约束强度

## 关联约束

- SHALL: 内部强制项目 SHALL 执行当前强度等级对应的约束
- SHALL: 外部 Skill 产出 SHALL 通过 SHALL NOT 兜底校验
- SHALL NOT: 不得以"外部兼容"为由绕过 SHALL NOT 约束
