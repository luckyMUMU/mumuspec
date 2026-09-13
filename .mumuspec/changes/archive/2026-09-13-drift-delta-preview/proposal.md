# Proposal: drift-delta-preview

## Why

改进计划 B4（借鉴 openspec show --diff）：`mumuspec drift --change <name>` 只显示漂移发现，不显示**该变更归档时将向主规范并入什么**——评审者须人工翻 constraints/delta-specs 文件拼装"这个变更会不会加严/放宽规范"的结论。diff 级 delta 预览让"规范增删"在归档前可读、可审。

## What

1. delta-channels.ts 抽出导出 `listCarriedConstraintItems(changeDir)`：返回全部携带约束条目（file/requirement/polarity/text）；`collectUnchanneledDeltaConstraints` 重构为在其上过滤通道缺口（单次解析，无重复实现）。
2. `mumuspec drift --change <name>` 在漂移发现之后渲染「Delta 预览（归档将并入主规范）」块：逐条 `+ [polarity] text ← file`；无携带条目时输出 `（无携带约束）`。
3. 漂移发现行前缀 diff 风格化：ERROR `✗`→保留、WARN `⚠`→保留（既有形态已可读，不额外改写）。

## Impact Scope

- src/guard/delta-channels.ts — listCarriedConstraintItems 抽取导出
- src/cli/commands/spec.ts — drift --change 渲染接线
- tests/guard/delta-channels.test.ts — 条目枚举断言

## Acceptance Criteria

- `drift --change` 对含约束的变更输出 Delta 预览块（+ 行含 polarity/text/来源文件）
- 无携带约束的变更输出（无携带约束）
- collectUnchanneledDeltaConstraints 行为不变（回归 303 全绿）
- 三件套不回退

## Workflow

full
