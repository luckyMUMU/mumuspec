# Test Cases: evaluator-inprocess (Layer 0)

> 对应 delta-spec：`delta-specs/.-tech.md` ｜ 用 `mumuspec test-cases lock-suite` 锁定

## TC-L0-01 buildCheckJsonPayload 契约（positive）

- 前置：tmp 项目含无效 spec（1 个错误）。
- 步骤：`buildCheckJsonPayload`。
- 期望：`compliance.coverage.total > 0`；`compliance.errors` 与 `checkCompliance().errors` 逐 code 一致；`exitCode = passed ? 0 : 1`。

## TC-L0-02 detectDriftInProcess 同源（positive）

- 前置：仓库根。
- 步骤：`detectDriftInProcess` vs `detectDrift`。
- 期望：同一数组引用等效（length 一致）。

## TC-L0-03 评估器 in-process 输出契约（positive）

- 前置：tmp 项目（干净 + 有违规两态）。
- 步骤：`specComplianceEvaluator.evaluate({projectRoot})` 与 `driftScoreEvaluator.evaluate`。
- 期望：value ∈ [0,1]；weight 引用 defaultWeight（0.2）；rawData 字段名不变；子进程未被调用（无副作用断言）。

## TC-L0-04 输出结构与既有语义不变（回归）

- 前置：既有 metrics 测试（fail-open-count 等）不因 imports 变更破坏。
- 步骤：跑 tests/core/metrics 目录。
- 期望：全绿。