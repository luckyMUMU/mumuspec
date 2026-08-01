---
# === 标识 ===
id: "KP-0014"
title: "变更生命周期模式：五阶段状态机 + 回退机制"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/design/change-layer.md"

# === 图谱关联 ===
graph_bindings:
  - src/change/manager.ts
  - src/change/state-machine.ts
  - src/cli.ts

# === 索引 ===
tags: ["pattern", "change-lifecycle", "state-machine", "rollback"]
related_pages:
  - "KP-0003"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

AI 自由编码时容易跳过关键阶段或无法回退，需要结构化的变更生命周期管理。

## 模式

### 五阶段状态机

```
Open → Design → Build → Verify → Archive
  ↑        ↑        ↑        ↑
  └────────┴────────┴────────┴── Rollback（回退守卫）
```

### 各阶段职责

| 阶段 | 核心产物 | 准入条件 | 退出条件 |
|------|---------|---------|---------|
| **Open** | `proposal.md`、`delta-specs/` | 无 | 用户确认 proposal |
| **Design** | `design.md`、`test-cases/` | proposal approved | test-cases 锁定 |
| **Build** | 代码 + 测试 | test-cases locked | 代码提交 + 构建通过 |
| **Verify** | `verify.md` | 代码已提交 | 验证通过 |
| **Archive** | 合并 + 知识提取 | verification passed | 归档完成 |

### 预设路径

| 工作流 | 跳过阶段 | 适用场景 |
|--------|---------|---------|
| `full` | 无 | 新功能 / 重大变更 |
| `hotfix` | Design | Bug 修复，最短路径 |
| `tweak` | Design | 文案 / 配置 / 文档微调 |

### 回退守卫

| 回退路径 | 限制 | 说明 |
|---------|------|------|
| Build → Design | `rollback_count < rollback_limit`（默认 3） | 仅重置状态，保留代码 |
| Verify → Design | `rollback_count < rollback_limit` | 仅重置状态，保留代码 |
| Verify → Build | `rebuild_count < rebuild_limit`（独立计数） | 仅重置失败的 layer |
| Archive → Build | 仅 archive-in-progress 子状态，CI CRITICAL 失败触发 | archive-completed 不可回退 |

### 回退副作用

回退 Design/Build 时：
1. 保存当前 artifacts 到 `snapshots/`
2. 记录 `rollback_reason` + `rollback_history`
3. `increment rollback_count`
4. 重置 `build_layers` 状态为 pending（保留代码）
5. 清除 `test_cases.design_locked` / `suites_locked`

## 影响

- AI Agent 必须按阶段推进，不可跳过
- 回退次数超限（3次）后强制要求 accept-deviations 或 discard
- 每次变更的效率指标可被审计（rollback_count、阶段耗时）

## 关联约束

- SHALL: 变更 SHALL 按五阶段推进，回退 SHALL 记录原因
- SHALL NOT: 不得跳过 Design 阶段（hotfix/tweak 除外）
- SHALL NOT: `rollback_limit` 超限后不得继续回退
