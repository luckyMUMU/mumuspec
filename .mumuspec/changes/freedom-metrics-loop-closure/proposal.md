# Proposal: freedom-metrics-loop-closure

## Why

2026-09-10 中间层定位复评（`review/middleware-positioning-evaluation-2026-09-10.md`）核实：自由度度量已在
`2026-09-09-completeness-artifacts-freedom-metrics` 变更中落地（constraint-density / design-build-first-pass /
buildSuggestions），但**回路末端断裂**——度量产出无法抵达任何消费者，四项缺口：

- **G1 建议产出是 dead-end**：`autoEvaluate()` 返回 `suggestions`，但 `src/change/loop-engine.ts` 的
  `LoopEvaluation` 转换层只映射 progress / goal_achieved / recommendation，`suggestions` 既未进入
  `LoopEvaluation`，也未写入 `MetricsSnapshot`（仅 name/value/details），因此 `loop evaluate` 不打印、decisions.md 无条目。
  这使前一变更的假设 AS-3（"建议仅进入 AutoEvaluateResult.suggestions 与既有 JSON/文本输出通道"）**在实现期未被兑现**，
  并违反该变更 ENF-3 明文要求（"建议仅以 advisory 文本进入报告与 decisions 建议条目"）。
- **G2 度量口径窄于指标口径**：`autoEvaluate` 的唯一调用点是 loop-engine（`mumuspec loop evaluate`），
  而 `default_workflow: full` 的变更完全不计算这两个指标；goal.md 北极星"Design→Build 一次通过率 ≥ 80%"的样本因此只覆盖 loop 模式变更。
- **G3 信号未进入 agent 契约面**：skills/ 中 `freedom` / `自由度` 零命中，AGENTS.md 仅以一条 SHALL NOT
  提及约束密度；agent 无任何可读入口查询本轮自由度信号。
- **G4 中间层自身事实源漂移**：`docs/STATUS.md` 自称"唯一权威进度来源"却停在 `0.19.2-alpha.11 / 2026-09-06`
  （package.json 已 `0.21.0-alpha.0`）；`.mumuspec/config.yaml` 仍写 `version: 0.16.0-beta.0` 且
  `ai.rules_files` 含 `.cursorrules`（靠 `src/rules/generator.ts` 硬过滤兜底，而非事实源自身干净）。

## What

把已建成的自由度度量回路接通至消费者，并顺手收口元数据漂移：

1. **接通建议出口（G1）**：`LoopEvaluation` 保留 `suggestions`；`MetricsSnapshot` 记录 `suggestions`；
   `mumuspec loop evaluate` 打印建议段；建议经 CLI 落 decisions.md advisory 条目。
2. **扩大度量口径（G2）**：新增只读命令 `mumuspec metrics [change] [--json]`，在任意工作流（含 full）下
   复用既有 `Evaluator` 与 `evaluator-registry` 计算并展示指标与建议，不另建度量实现。
3. **信号进入契约面（G3）**：`--json` 输出结构化指标与建议供 agent 解析；AGENTS.md 速查经命令注册表
   自动带上该入口（渐进式披露，不内联指标数据）。
4. **收口元数据漂移（G4）**：STATUS.md 当前包版本与 package.json 对齐；清理 config.yaml 遗留目标；
   以单元测试锁定两条一致性断言，防止再次漂移。

## Impact Scope

- src/change（loop-engine 转换层、types-loop）
- src/cli（新 metrics 命令注册、loop evaluate 输出）
- src/core/metrics（types：suggestions 透传）
- src/install（速查静态默认值与注册表注入一致性，如涉及）
- docs/STATUS.md、.mumuspec/config.yaml（元数据事实源）
- tests/（新增自由度回路断言）

## Workflow

full
