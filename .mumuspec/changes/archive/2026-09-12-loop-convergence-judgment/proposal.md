# Proposal: loop-convergence-judgment

## Why

收敛判据被**三处**同时击穿（E14，self-improvement-loop-remediation-plan v2 §3.7），导致 "
连续 3 轮稳定"这道门从未真正生效，判据实际退化为"某一轮 progress ≥ 0.85"：

1. **稳定性窗口寄存在进程内内存态**：`auto-evaluate.ts:38` 的模块级 `historyMap` 无任何
   持久化/重建路径。`loop evaluate` 每次运行是新进程 → `history.length` 恒为 1（窗口需 3）→
   `isStableConvergence` **恒 false**。
2. **上层用单轮阈值短路了整个窗口**：`loop-engine.ts:295` 的
   `goal_achieved || progress >= CONVERGENCE_THRESHOLD` 使单轮 0.85 即 `converged`。
   因第一层恒 false，若只删 `||`，收敛将**永不可达**——从"假收敛"翻转为"永不收敛"。
3. **hybrid 模式同样不看窗口**：`hybridEvaluate` 直接 `hybridProgress >= threshold` 判
   `goalAchieved`，与 `autoEvaluate` 的三条件判据（progress + allAboveMin + stable）不一致。

附带缺陷 **E16**：`converged` 由 progress 置位而 `goal_achieved` 仍是 false，导致
"已判定收敛却仍然提交"（`:309` `shouldCommit = auto_commit && !goal_achieved`）。

**层级关系（决定修法）**：第 2 层已完全支配判定、第 1 层被掩盖。修第 2 层依赖第 1 层先修。
**故 1、2、3 必须同批提交，不可分批。**

## What

- **P1-2.1** `auto-evaluate.ts`：删除模块级 `historyMap`，历史改为从**持久化事实源**派生——
  `EvaluatorContext.roundHistory`（`loop.rounds[].evaluation.progress`，存于 `.mumuspec.yaml`，
  与 `loop_state.progress_trend` 同源）。`clearHistory` 保留为 deprecated no-op（兼容既有测试）。
- **P1-2.2** `loop-engine.ts:295`：去掉 `|| progress >= CONVERGENCE_THRESHOLD`，`converged`
  只由 `goal_achieved` 驱动（E16 一并修复：收敛即 goal_achieved，不再"已收敛仍提交"）。
  不引入 `provisional_convergence` 快速通道（需人工签收机制，超出本变更范围）。
- **P1-2.3** `hybridEvaluate`：统一判据 = `hybridProgress >= threshold && allAboveMin && stable`，
  与 `autoEvaluate` 同构（复用 `autoResult.metrics` 重算 allAboveMin、`autoResult.history` 判 stable）。
- **附带（配置层）**：`initLoop` 对 `max_rounds < stabilityWindow`（auto/hybrid 模式）告警——
  窗口需 stabilityWindow 条历史才可能收敛，max_rounds 更小则收敛数学上不可达（先 exhausted）。
  默认 `max_rounds=3 >= stabilityWindow=3`，默认配置静默。

## Impact Scope

- `src/core/metrics/auto-evaluate.ts`（P1-2.1 / P1-2.3）
- `src/change/loop-engine.ts`（P1-2.2 / init 告警）
- `tests/core/metrics/auto-evaluate.test.ts`（TC-06 改为 roundHistory 驱动）
- `tests/change/loop-engine-deep.test.ts`（收敛语义更新）
- 新增协议测试（跨进程语义锁定）

## Workflow
hotfix