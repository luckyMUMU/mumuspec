---
id: KE-freedom-metrics-loop-closure-patterns
title: Architecture patterns from freedom-metrics-loop-closure
type: pattern
status: confirmed
scope: freedom-metrics-loop-closure
created_at: 2026-09-10
tags:
  - auto-extracted
  - pattern
  - architecture
  - freedom-metrics-loop-closure
graph_bindings: []
---
> Auto-extracted from freedom-metrics-loop-closure/design.md

# Design: 自由度度量回路接通

设计策略：自上而下。四层：采集层（建议透传 + 只读采集）→ 变更层（snapshot 持久化）→ 输出层（loop 打印 + metrics 命令）→ 元数据层（事实源对齐）。

## 1. 决策层（关键语义裁决）

### D1: 建议出口采用"三消费点纯透传"，不引入新机制

前一变更把建议放在 `AutoEvaluateResult.suggestions` 并假设"既有 JSON/文本输出通道"会携带（AS-3），
但 `loop-engine.ts` 的 `LoopEvaluation` 转换层是显式字段映射（只取 progress / goal_achieved / recommendation），
该假设在实现期被证伪。裁决：不新建建议管道，而是补齐三个消费点——

| 消费点 | 载体 | 目的 |
|---|---|---|
| 会话内可见 | `LoopEvaluation.suggestions` | `loop evaluate` 可打印 |
| 历史可追溯 | `MetricsSnapshot.suggestions` | 轮次历史留存 |
| 审计可查 | decisions.md advisory 条目 | 经 `decisions append` 落地，人不漏看 |

### D2: 新增只读命令 `mumuspec metrics [change] [--json]`（明确反转前一变更 §6 的"不新增 CLI 命令"）

前一变更的不做清单含"不新增 CLI 命令（度量经既有 loop 命令触发）"。该决定建立在 AS-3 之上，而 AS-3 已被证伪：
loop 通道既未输出建议，也天然排除 `full` 工作流的变更。故本次反转，理由有三：

1. **口径**：goal.md 北极星"一次通过率 ≥ 80%"是全项目的，`design-build-first-pass` 也扫描全量变更目录——
   语义上是项目级报告，而非单变更状态，塞进 `status` 会污染其输出。
2. **只读性**：`autoEvaluate` 内含 `recordProgress` 写状态副作用，不可直接用于只读命令；
   故新增纯采集函数 `collectMetrics(ctx)`（只调 evaluator，不记 progress、不判收敛）。
3. **YAGNI 边界**：命令为零参数可用（默认活跃变更），输出复用既有 `MetricResult` / `buildSuggestions`，不引入新抽象。

命令能力层级：不登记 → 回落 `general`（纯只读、可组合、无需确认），符合 `capability` 默认语义，无需改注册表。

### D3: 契约面 = 结构化输出 + 自动速查，不内联数据

agent 侧可读性由两点构成：`metrics --json` 输出 `{ metrics[], suggestions[] }` 结构化字段；
AGENTS.md 速查由命令注册表注入（单一事实源），新增命令自动出现。
不在 Rules 文件内联指标数值——渐进式披露职责归命令，Rules 文件受 32KiB 预算约束。

### D4: 元数据对齐用单元测试锁定，不新建运行时校验器

G4 的病灶正是"产出物无消费者"。若为 STATUS.md 版本对齐新建一个运行时校验器，等于再造一个无消费面的产出物。
故裁决：以单元测试作为一致性校验器（ENF-7 / ENF-8），成本最低且真实防回归。

## 2. 采集层（src/core/metrics）

- `types.ts`：`LoopEvaluation` 侧不新增类型；`MetricsSnapshot` 增 `suggestions?: string[]`（向后兼容，旧快照可缺省）。
- `auto-evaluate.ts`：新增并导出 `collectMetrics(ctx): Promise<MetricResult[]>`——遍历 `getActiveEvaluators()` 调
  `evaluate(ctx)`，**不**调用 `recordProgress` / `isStableConvergence`，无任何文件写入。`autoEvaluate` 内部改为复用该函数采集后再走收敛判断（消除重复循环）。
- `buildSuggestions` 复用不变（纯函数，已测）。

## 3. 变更层（src/change）

- `types-loop.ts`：`LoopEvaluation` 增 `suggestions: string[]`。
- `loop-engi