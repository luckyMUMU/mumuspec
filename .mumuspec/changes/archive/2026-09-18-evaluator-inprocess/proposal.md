# Proposal: evaluator-inprocess

## Why

loop 评估器的 spec-compliance（src/core/metrics/spec-compliance.ts）与 drift-score（src/core/metrics/drift-score.ts）各自 `spawnSync('npx mumuspec …')` 起子进程 + 30s timeout。这些函数（checkCompliance / detectDrift）本就在进程内可用——子进程编排是"轻量为主路径"原则下最重的一环。

## What

1. 在 src/guard/checker.ts 暴露两个 in-process 入口（单一权威源，与 CLI 共用同一函数）：
   - `buildCheckJsonPayload(projectRoot)` → 文档化 `check --json` payload 契约（compliance.errors / coverage.total / exitCode）；
   - `detectDriftInProcess(projectRoot)` → DriftResult[]（drift CLI 序列化的同源集合）。
2. `spec-compliance` / `drift-score` 评估器以 in-process 为主路径（无子进程、无 npx 启动），原有 spawnSync 通道保留为兜底（in-process 失败时回落）。
3. 指标 value / weight / rawData 结构与输出零变化（不动 loop composite 权重与收敛语义）。

## Impact Scope

- .

## User Decisions

- 无阻塞项（指标数值语义与 JSON schema 不变；子进程通道保留）

## Workflow

full