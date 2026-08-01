---
# === 标识 ===
id: "KP-0007"
title: "认知框架（乔哈里窗变体 Q1-Q4）集成到 Design 阶段"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.8.0-cognitive-framework"
source_phase: "design"
source_artifact: "docs/reference/cognitive-framework.md"

# === 图谱关联 ===
graph_bindings:
  - src/eval/scorer.ts
  - src/eval/quadrant.ts
  - src/knowledge/loader.ts

# === 索引 ===
tags: ["cognitive-framework", "johari-window", "q1-q4", "design-phase", "goal"]
related_pages:
  - "KP-0002"
  - "KP-0006"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

设计认知过程不系统，缺乏对已知信息、未知盲区的结构化梳理，导致设计决策基于不完整或不准确的信息地基。

## 决策

引入基于"乔哈里窗"变体的四象限认知框架，作为 AI Agent 辅助技术设计的系统化认知方法。

### 四象限定义

```
                    ┌─────────────────────┬─────────────────────┐
                    │   用户知道           │   用户不知道          │
    ┌───────────────┼─────────────────────┼─────────────────────┤
    │  Agent 知道    │  Q1 已知的已知       │  Q3 未知的已知       │
    │               │  → 锚定推理地基      │  → 推理链让用户确认   │
    ├───────────────┼─────────────────────┼─────────────────────┤
    │  Agent 不知道  │  Q2 已知的未知       │  Q4 未知的未知       │
    │               │  → 提问补全（含选项）│  → 盲区扫描 + 兜底    │
    └───────────────┴─────────────────────┴─────────────────────┘
```

### Q1：已知的已知 — 锚定

Agent 和用户共同掌握的信息，是设计的推理地基。来源包括：
- `proposal.md`：变更目标、影响范围、delta-specs
- 既有 `spec.md`：当前层级的 SHALL / SHALL NOT 约束
- `code-graph/impact-analysis.json`：影响分析结果
- 既有 `design.md`：现有架构决策和技术选型

### Q2：已知的未知 — 提问补全

Agent 明确知道自己缺失的信息，需通过提问从用户获取。规则：
- 必须提供 2-4 个选项（含"不确定"选项）
- 选项基于 Q1 推导
- 单轮最多 5 个问题

### Q3：未知的已知 — 推理链确认

Agent 通过 Q1 推导出的隐性需求或约束。规则：
- 推理链格式：`Q1[编号] + Q1[编号] → Q3: 推导结论`
- 需用户显式确认（confirmed / rejected / modified）
- 每轮不超过 3 条

### Q4：未知的未知 — 盲区扫描

Agent 和用户都未意识到的盲区。扫描维度（8个）：
1. 隐藏耦合
2. 并发安全
3. 契约兼容性
4. 规范继承冲突
5. 依赖链风险
6. 合规盲区
7. 性能盲区
8. 测试盲区

### 兜底策略

| 策略 | 说明 |
|------|------|
| 监控兜底 | 标注 `risk: unresolvable-blind-spot`，建议添加监控告警 |
| 测试兜底 | 添加防御性测试用例 |
| 回退兜底 | 记录"若此盲区暴露，回退到 Design" |
| 降级兜底 | 定义降级方案（feature flag / fallback path） |

## 影响

- Design 阶段的产出增加 `cognitive-map.yaml`
- 认知框架仅在 `workflow == "full"` 时启用
- hotfix/tweak 工作流跳过 Design，不执行认知框架
- Phase Guard（design_to_build）检查认知框架完成状态

## 关联约束

- SHALL: Q4 盲区扫描是 Design 阶段的必要步骤，不可跳过
- SHALL NOT: Q3 推导不可基于 Q2（未回答的问题不能作为推导前提）
