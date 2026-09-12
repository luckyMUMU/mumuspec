# Test Cases — loop-convergence-judgment (Layer 0: 单元/协议测试)

## L0-1 单轮高分不再收敛（auto 模式）

- Given: `roundHistory` 不足 stabilityWindow(3) 条历史，当前轮全部 evaluator ≥ threshold
- When: 调用 `autoEvaluate(ctx)`
- Then: `goalAchieved === false`（窗口不足，不再有 progress 短路）

## L0-2 连续 3 轮达标才收敛（跨进程语义）

- Given: `roundHistory` 含 2 轮 evaluation.progress ≥ 0.85（模拟上个进程持久化的轮次）
- When: 当前进程 `autoEvaluate(ctx)` 且当前轮 ≥ 0.85、全指标 ≥ minAcceptable
- Then: `goalAchieved === true`（历史来自持久化 roundHistory，而非进程内 Map）

## L0-3 历史含低分轮则稳定窗口不通过

- Given: `roundHistory` 含 2 轮（其中 1 轮 < threshold）
- When: 当前轮高分
- Then: `goalAchieved === false`（窗口"连续达标"不成立）

## L0-4 hybrid 与 auto 判据统一

- Given: auto 侧稳定窗口满足、全指标 ≥ minAcceptable，但 hybridProgress < threshold
- When: 调用 `hybridEvaluate(ctx, manualProgress)`
- Then: `goalAchieved === false`（与 auto 同构，不再只看 hybridProgress 单值）

## L0-5 单轮高分不再触发 loop converged（E16 修复）

- Given: `evaluateRound` 收到 `{progress: 0.9, goal_achieved: false}`
- When: 执行 evaluateRound
- Then: `loop.phase` 不置 `converged`（回退 plan/exhausted），且 `should_commit` 不受"伪收敛"影响

## L0-6 goal_achieved 才收敛且不提交

- Given: `evaluateRound` 收到 `{progress: 0.85, goal_achieved: true}`（auto_commit=true）
- When: 执行 evaluateRound
- Then: `loop.phase === 'converged'` 且 `should_commit === false`

## L0-7 initLoop 对 max_rounds < stabilityWindow 告警（auto/hybrid）

- Given: `initLoop` 以 `evaluate_mode: 'auto'`、`max_rounds: 2`（stabilityWindow=3）初始化
- When: 调用 initLoop
- Then: 输出 WARN（收敛不可达提示）；默认 max_rounds=3 时无告警