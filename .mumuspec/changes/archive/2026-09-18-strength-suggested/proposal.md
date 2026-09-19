# Proposal: strength-suggested

## Why

约束强度默认值无推导来源：`constraint_strength` 完全手工配置（src/core/config-io.ts L93-96 默认 medium/high），evaluateConstraint 完全由 config 驱动（src/core/constraint-evaluator.ts L146-147）。"调配置"成为常态而非例外；强度建议值（由 severity 等元数据确定性推导）缺失。

## What

1. 纯函数 `suggestStrengthFor({severity})`：ERROR→high / WARN→medium / INFO→low（确定性推导，无 LLM、无 I/O）。
2. `collectStrengthDeviations(config)`：扫描 ERROR_CODES 注册表，报告"建议值 > 当前维度强度"的偏差项（单一权威源：注册表）。
3. `mumuspec doctor` 输出"建议 vs 实际"对照（advisory，有偏差仅提示）；写入 config 仍需人工签收，不自动修改。

## Impact Scope

- .

## User Decisions

- 无阻塞项（advisory 输出，不改写 config，不改变求值路径）

## Workflow

full