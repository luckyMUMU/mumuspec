---
id: KE-evaluator-inprocess-patterns
title: Architecture patterns from evaluator-inprocess
type: pattern
status: confirmed
scope: evaluator-inprocess
created_at: 2026-09-18
tags:
  - auto-extracted
  - pattern
  - architecture
  - evaluator-inprocess
graph_bindings: []
---
> Auto-extracted from evaluator-inprocess/design.md

# Design: evaluator-inprocess

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

把 loop 评估器的数据面从子进程切换到 in-process：checkCompliance / detectDrift 本就是进程内函数，评估器直接调用并复用同一 payload 契约，消除 `spawnSync npx` 启动开销与 30s timeout；子进程通道保留为兜底。指标数值语义与输出契约零变化。

## 实现

### 1. in-process 入口（src/guard/checker.ts）

- `buildCheckJsonPayload(projectRoot)`：调用 `checkCompliance(projectRoot, {})`，映射为文档化 payload `{ compliance: { errors: [{code}], coverage: {total} }, exitCode }`（与 `mumuspec check --json` 契约一致）。
- `detectDriftInProcess(projectRoot)`：直接返回 `detectDrift(projectRoot)`（drift CLI 序列化的同源集合）。
- 两入口均为薄封装（无逻辑复刻），类型即契约。

### 2. 评估器切换（src/core/metrics/spec-compliance.ts / drift-score.ts）

- `evaluate()` 先 in-process：try { buildCheckJsonPayload / detectDriftInProcess } catch { 回落 spawnSync 原通道 }。
- 分值计算、weight（defaultWeight 引用）、rawData、details 文案逐字节保留（单一权威源不变量：composite 权重与收敛语义不动）。
- fallback 保留 parseJsonFrom 抽取（DS-EVAL-003 纪律不变）。

### 3. 输出契约

- value ∈ [0,1] 计算式不变；spec-compliance 仍 `1 - failed/total`；drift-score 仍 `1 - violations/DRIFT_SATURATION`。

## 错误码

- 无新增错误码。

## 不做什么

- 不改变 loop composite 权重之和、收敛阈值与稳定窗口。
- 不删除子进程通道（兜底保留；独立 CLI 调用照常）。
- 不重构其他评估器（test-pass-rate / constraint-density 等维持现状，YAGNI）。
- 不给 EvaluatorContext 加开关字段（in-process 失败即兜底，无需配置面）。

## 测试用例

详见 `test-cases/layer-0-cases.md`（TC-L0-01 ~ TC-L0-04），Design 后经 `test-cases lock-suite` 锁定。