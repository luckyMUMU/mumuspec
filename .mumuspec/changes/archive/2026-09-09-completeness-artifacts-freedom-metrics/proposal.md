# Proposal: 2026-09-09-completeness-artifacts-freedom-metrics

## Why

中间层定位评价（review/middleware-positioning-evaluation-2026-09-09.md）指出"自由度缺度量"（T2）缺口。经代码核实：

- 原评价 T1（完备性工件未落 CLI + 校验器）为过时结论——门禁 v1 已随归档变更 2026-09-05-goal-p0-dispatch-gate 落地（artifact-validator.ts schema 校验 + phase-guard.ts 双签门禁），本变更不再覆盖 T1；
- T2 缺口属实：`src/core/metrics/` auto-evaluate 框架已有 test-pass-rate / drift-score / spec-compliance / code-delta 四个 evaluator，但缺少：
  1. 约束密度度量（constraint density）——"给予 agent 多少自由度"目前是定性承诺，capability tier 度量的是工具风险而非实现自由度；
  2. Design→Build 一次通过率追踪——goal.md 北极星指标"一次通过率 ≥ 80%"无采集通道；
  3. 反哺机制——度量结果不回流到约束强度调节，无法形成"自由度可调参数"。

## What

在现有 auto-evaluate 框架内新增两个 evaluator 并补最小反哺（advisory）：

1. **constraint-density evaluator**：统计活跃变更影响域规范链的 SHALL + SHALL NOT 条目密度，归一化 [0,1]，作为自由度的代理指标；
2. **design-build-first-pass evaluator**：从归档与活跃变更的 state 工件（rollback_count / rebuild_count）推导一次通过率，禁止 LLM 手写该指标；
3. **反哺建议**：auto-evaluate 汇总时输出约束强度调整建议（advisory，仅建议，不自动修改 constraint_strength 配置——无人工签收不放行）。

## Impact Scope

- `src/core/metrics/`：新增 constraint-density.ts、design-build-first-pass.ts；types.ts 权重注册；index.ts 导出
- `src/core/metrics/auto-evaluate.ts`：汇总建议输出（advisory 段）
- 不改 phase-guard / 状态机 / 现有四个 evaluator 语义 / CLI 命令面（度量经既有 loop 命令触发）

## Workflow

full
