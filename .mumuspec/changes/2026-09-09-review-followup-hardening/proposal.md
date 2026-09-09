# Proposal: 2026-09-09-review-followup-hardening

## Why

二次审查（2026-09-09）发现三处结构性问题，均源于"双源/多源真相"不一致：

1. **权重双源**：`DEFAULT_EVALUATOR_WEIGHTS`（types.ts）是零消费者导出常量，权威源实为各 evaluator 的 `defaultWeight`。CHG 2026-09-09-completeness-artifacts-freedom-metrics 的 D2 权重签收曾因只改 map 而未生效（已事后修复，但双源结构仍在，未来必然再漂移）。
2. **archive 非幂等**：`archiveChange`（src/change/archive.ts）在 rename 之前执行版本 bump / CHANGELOG / 知识提取等副作用；Windows 下 `renameSync` EPERM 失败后重试，导致版本连跳 4 次、CHANGELOG 重复条目（本次已手工清理）。
3. **模块注册判定双标**：checker 的 index_drift 只要求 `.mumuspec` 存在，而 `rebuildIndexYaml` 只收录有 prd.md/tech.md 的模块——本次 formatter/scanners 两个 BOUNDARY-only 目录因此产生永久性假阳性警告（已按惯例补齐注册消除，但判定标准未统一，随时复发）。

## What

三个工作流（均为小改动，共享"单一真相"主题）：

- **W1 权重单一源**：删除 `DEFAULT_EVALUATOR_WEIGHTS` 导出（确认零消费者），以 evaluator `defaultWeight` 为唯一权威源；新增不变量测试：内置活跃 evaluator 的 defaultWeight 之和 = 1（weight=0 的调节信号除外）。
- **W2 archive 幂等化**：调整 `archiveChange` 步骤顺序——目录 rename 成功后再执行版本 bump / CHANGELOG / 知识提取；`renameSync` 增加 copy+delete 回退（EPERM 降级）；版本 bump 幂等保护（同一变更只 bump 一次，以 audit/标记为准）。
- **W3 注册判定统一**：以"`.mumuspec` 存在且含 prd.md 或 tech.md"为唯一模块判定标准，checker 与 rebuildIndexYaml 对齐（checker 收紧或 builder 放宽，取实现代价小且语义正确者——build 期判定）。

## Impact Scope

- src/core/metrics/types.ts（W1：删除 map）
- src/change/archive.ts（W2：顺序调整 + 回退 + 幂等）
- src/guard/checker.ts 或 src/cli/commands/finalize-archive.ts（W3：对齐判定）
- tests/core/metrics/（W1 不变量测试）、tests/change/（W2 幂等/回退测试）

## Workflow

full
