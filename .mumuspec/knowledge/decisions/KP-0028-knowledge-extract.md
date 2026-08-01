---
# === 标识 ===
id: "KP-0028"
title: "Archive 阶段知识提取流程设计"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.9.0-knowledge-extraction"
source_phase: "design"
source_artifact: "docs/appendix/open-questions.md#知识提取的准确性"

# === 图谱关联 ===
graph_bindings:
  - src/knowledge/extractor.ts
  - src/change/manager.ts

# === 索引 ===
tags: ["knowledge-extraction", "archive", "design-knowledge", "auto-extract", "goal"]
related_pages:
  - "KP-0006"
  - "KP-0010"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

变更归档时，需要将变更过程中产生的设计知识提取到全局知识库（LLM-Wiki），实现知识跨变更复用。

## 决策

Archive 阶段自动触发知识提取子流程（D1-D8），提取规则如下：

### 提取来源 → 知识类型映射

| 来源 | 知识类型 | 状态 | 说明 |
|------|---------|------|------|
| Q1 持久性条目 | `decision` | proposed | 长期有效的架构决策 |
| Q3 confirmed 推理 | `rationale` | proposed | 推导出的设计理由 |
| Q4 残留风险 | `risk` | proposed | 未消除的盲区 |
| Hyperplan 幸存洞察 | `decision` | proposed | 多角色对抗审查产出 |
| 关键 DEC 条目（decisions.md） | `lesson` | proposed | 回退/失败经验 |
| design.md 中的架构选择 | `pattern` | confirmed | 可直接复用的模式（用户确认后） |

### 过滤策略

**排除项**（不提取到知识库）：
- 变更特定的临时信息（如"本次新增支付接口"）
- 已标记为 rejected 的 Q3 推导
- 短期决策（预计 < 30 天过时）
- hotfix/tweak 变更（跳过 Design 阶段，无实质知识产出）

### 知识质量评估指标

| 指标 | 计算方式 | 用途 |
|------|---------|------|
| **引用次数** | 其他页面 related_pages 引用数 | 知识价值 |
| **冲突检出率** | 发现代码偏离该决策的次数 | 知识重要性 |
| **新鲜度验证通过率** | verified_at ≥ 代码修改时间的比例 | 知识时效性 |
| **用户确认率** | 用户 confirmed / proposed 总数 | 知识准确性 |

### 知识冲突检测

当新提取的知识与已有 confirmed 知识矛盾时：
- 基于图谱节点的 DECIDED_BY 边检测（同一代码节点指向矛盾决策）
- 基于 tag + scope 的内容对比
- 冲突时标记为 `proposed`，需用户确认后转为 `confirmed`
- MVP 阶段采用规则匹配 + 人工确认

## 影响

- AI Agent 在设计阶段可获取历史变更的决策和理由
- 知识积累降低重复设计成本
- 低价值知识自动标记 deprecated（引用少、冲突检出率低）

## 关联约束

- SHALL: Archive 阶段 SHALL 自动触发知识提取子流程
- SHALL: 知识提取后 SHALL 标记为 `proposed`，需用户确认
- SHALL NOT: hotfix/tweak 变更 SHALL NOT 提取知识（无 Design 阶段产出）
- SHALL NOT: 已标记 deprecated 的知识 SHALL 被自动清理（30天后）
