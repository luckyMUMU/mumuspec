# Test Cases — evaluator-data-source-fix (Layer 0: 单元测试)

## L0-1 spec-compliance 从 check --json 计算合规率

- Given: `check --json` 输出多行美化 JSON `{compliance:{errors:[...],coverage:{total:N}}}`
- When: 调用 `specComplianceEvaluator.evaluate(ctx)`（成功路径）
- Then: 返回 `value = 1 - errors.length/N`、`weight = defaultWeight`

## L0-2 check status 非 0 但含 payload 时照常计算（低分不是跳过）

- Given: `check --json` 输出含 3 条 compliance error 的 payload，进程 exit 1
- When: 调用 evaluate
- Then: 返回低分（非 nullResult）——把"有违规"如实报成低分，而非谎报"跳过"

## L0-3 spec-compliance coverage 缺失时诚实跳过

- Given: `check --json` 输出不含 `coverage`（或 total=0）
- When: 调用 evaluate
- Then: 返回 nullResult（weight 0，不进 composite）

## L0-4 drift-score 从 drift --json 数组归一化

- Given: `drift --json` 输出数组 `[…]`（多行），共 k 条
- When: 调用 `driftScoreEvaluator.evaluate(ctx)`
- Then: `value = 1 - min(1, k / 10)`、`weight = defaultWeight`；空数组 → 1.0

## L0-5 spawn 无法启动时诚实跳过（win32 shell 语义）

- Given: `spawnSync` 返回 `result.error`（如 npx.cmd 无法解析）
- When: 调用任一 evaluator
- Then: 返回 nullResult（weight 0）——不得静默假满分

## L0-6 成功路径 weight 恒等于 defaultWeight（防漂移延续）

- Given: 两个 evaluator 成功路径
- When: 调用 evaluate
- Then: `weight === defaultWeight`（与 weight-single-source 不变量一致）