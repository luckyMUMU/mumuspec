---
# === 标识 ===
id: "KP-0035"
title: "grill-me 深度追问机制集成到 Design 阶段"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-08-01T01:00:00Z"
updated_at: "2026-08-01T01:00:00Z"
verified_at: "2026-08-01T01:00:00Z"

# === 来源 ===
source_change: "introduce-grill-me-skill"
source_phase: "archive"
source_artifact: "design.md"

# === 图谱关联 ===
graph_bindings:
  - node: ".mumuspec/bundles/mumuspec-skills/phase-design.md"
    edge: "extends"
  - node: "KP-0007"
    edge: "complements"

# === 索引 ===
tags: ["grill-me", "design-phase", "cognitive-framework", "questioning", "pressure-test"]
related_pages:
  - "KP-0007"
  - "KP-0018"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: ["KP-0007", "KP-0018"]
  confidence: high
---

## 背景

MumuSpec Design 阶段的认知框架（Q1-Q4）通过乔哈里窗变体系统化梳理已知/未知信息，但存在提问深度不足、事实与决策混同、缺乏显式共识门禁等缺口。grill-me 机制由 mattpocock/skills 提出并验证（全网安装量前 3），通过决策树 DFS 追问、每次一问、事实/决策分离、显式共识门禁等原则，有效弥补上述缺口。

## 决策

在 Design 阶段 Step 2（认知框架）和 Step 3（自顶向下设计）之间插入 Step 2.5 grill-me 压力测试步骤。

### 引入位置

```
Cognitive Framework (Q1-Q4) converged
        ↓
  grill-me pressure test (Step 2.5)
        ↓
  Top-down design (Step 3) → Hyperplan (Step 4)
```

### 核心协议

| 规则 | 说明 |
|------|------|
| 决策树 DFS | 沿设计方案的分支结构逐层深入 |
| 每次一问 | 每轮只提 1 个问题，等待回答后再继续 |
| 推荐答案 | 每个问题附带 Agent 推荐选项 + 理由 |
| 事实自查 | Agent 可通过代码库/文档查到的信息不问用户 |
| 显式门禁 | 用户确认"已达成共识"后才能进入下一步 |
| 上限 10 轮 | 防止无限追问导致用户疲劳 |
| 反馈循环 | 深度冲突回退到认知框架增量轮 |

### 与认知框架的关系

认知框架管**结构化认知**，grill-me 管**深度验证**。两者互补而非替代：
- Q1 → grill-me 的事实基础（high-confidence 条目不追问）
- Q3 → 已确认约束跳过
- Q4 → 残留盲区转化为追问
- grill-me 产出 → 新的 Q3 confirmed 条目

### 问题生成模板

| 分支类型 | 问题模板 |
|---------|---------|
| 技术选型 | "基于 [Q1 引用]，推荐 [方案] 因为 [理由]。这是最佳选择吗？" |
| 架构决策 | "设计选择 [方案 A]，因为 [权衡]。你同意吗？" |
| 依赖假设 | "设计依赖 [X]，当前状态 [Y]。假设成立吗？" |
| 边界条件 | "[场景] 下推荐行为 [Z]。符合预期吗？" |

### 退出条件

1. 用户显式确认"已达成共识"
2. 遍历完所有决策分支
3. 达到 10 轮上限（强制退出，未决分支标记 deferred-limit-reached）

## 影响

- Design 阶段增加 1 个阻塞点（BP-4.5: grill-me 共识确认）
- Phase Guard 检查项增加 `grill_me_result.completed` 和 `rounds <= 10`
- cognitive-map.yaml 扩展 `grill_me` schema
- 不影响 hotfix/tweak 预设路径（仅在 full 工作流执行）

## 关联约束

- SHALL: grill-me 步骤 SHALL 在认知框架收敛后执行
- SHALL: grill-me 每次只问 1 个问题
- SHALL: 事实与决策分离 — Agent 可自查信息不问用户
- SHALL: Phase Guard SHALL 检查 grill_me_result
- SHALL NOT: grill-me SHALL NOT 替代认知框架 Q1-Q4
- SHALL NOT: grill-me SHALL NOT 替代 Hyperplan 多维对抗
- SHALL NOT: grill-me SHALL NOT 在 hotfix/tweak 工作流中执行
- SHALL NOT: grill-me SHALL NOT 超过 10 轮仍不退出

## 实施验证

| 检查项 | 状态 |
|--------|------|
| phase-design.md 包含 Step 2.5 | ✅ |
| 双文件同步（bundle + skills） | ✅ |
| Phase Guard 扩展 | ✅ |
| Red Flags 扩展 | ✅ |
| Skill hints 扩展 | ✅ |
| decisions.md 记录 | ✅ |
| 向后兼容（旧变更无字段） | ✅ |
