---
# === 标识 ===
id: "KP-0003"
title: "MumuSpec 四大工作流规则决策"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "overview.md#3-四大工作流规则"

# === 图谱关联 ===
graph_bindings:
  - src/change/manager.ts
  - src/change/state-machine.ts
  - src/guard/checker.ts
  - src/guard/phase-guard.ts

# === 索引 ===
tags: ["workflow", "tdd", "worktree", "design-order", "single-change"]
related_pages:
  - "KP-0001"
  - "KP-0008"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

AI 自由编码时容易违反项目约束、修改不应修改的代码、忘记写测试、或同时推进多个变更导致冲突。

## 决策

MumuSpec 定义四大工作流规则，按约束强度等级求值（可配置）：

### 规则 1：默认 Worktree 隔离

- 物理隔离主分支（git worktree）
- 支持零上下文恢复
- 维度归属：RG（需求目标）

### 规则 2：单一活跃变更

- 同时只允许一个活跃变更
- 强制单一任务专注
- 维度归属：RG（需求目标）

### 规则 3：自顶向下设计 + 自下向上实现

- 设计顺序：根 → 模块 → 叶子
- 实现顺序：叶子 → 模块 → 根
- 维度归属：TD（技术设计）

### 规则 4：默认红绿 TDD

- 测试用例是 Design 阶段的产出
- Design 完成后锁定不可变更（design_content_hash）
- tdd_mode 固定不可关闭
- 维度归属：TD（技术设计）

## 强度等级联动

| 工作流规则 | 维度 | high | medium | low |
|-----------|------|------|--------|-----|
| `worktree_isolation` | RG | 强制 block | warn（允许 branch 降级） | info（关闭） |
| `single_active_change` | RG | 强制 1 个 | warn ≤3 并行 | info（无上限） |
| `top_down_design` | TD | 强制 Level 0→N | warn（允许跳跃） | info（关闭） |
| `tdd_enforced` | TD | 强制 Red→Green→Refactor | warn（测试存在即可） | info（关闭） |

## 影响

- `.mumuspec.yaml` 的 `workflow.*` 配置项可显式覆盖强度等级
- 团队成熟度提升后可降低强度，逐步放开限制
- Phase Guard 检查按当前强度等级动态求值

## 关联约束

- SHALL: 变更必须按五阶段生命周期推进
- SHALL NOT: 不得跳过 Design 阶段进入 Build（hotfix/tweak 除外）
