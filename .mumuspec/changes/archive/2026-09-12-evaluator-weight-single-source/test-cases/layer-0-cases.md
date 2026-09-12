# Test Cases — evaluator-weight-single-source (Layer 0: 单元测试)

## L0-1 test-pass-rate 成功返回 weight 等于其 defaultWeight

- Given: test-pass-rate evaluator，supplied evaluator 成功路径（vitest JSON 可解析）
- When: 调用 `evaluate(ctx)`
- Then: 返回 `weight === defaultWeight(0.3)`，且 `defaultWeight` 之和（排除 0）不变

## L0-2 drift-score 成功返回 weight 等于其 defaultWeight

- Given: drift-score evaluator，成功路径（drift JSON 可解析）
- When: 调用 `evaluate(ctx)`
- Then: 返回 `weight === defaultWeight(0.2)`

## L0-3 spec-compliance 成功返回 weight 等于其 defaultWeight

- Given: spec-compliance evaluator，成功路径（guard JSON 可解析）
- When: 调用 `evaluate(ctx)`
- Then: 返回 `weight === defaultWeight(0.2)`

## L0-4 code-delta 变化/无变化两分支 weight 均等于其 defaultWeight

- Given: code-delta evaluator，`git diff` 有变化与无变化两分支
- When: 调用 `evaluate(ctx)`
- Then: 两分支返回 `weight === defaultWeight(0.1)`

## L0-5 防漂移不变量：defaultWeight 与成功返回 weight 逐项一致

- Given: `registerBuiltInEvaluators()` 注册全部内置 evaluator
- When: 比对各 evaluator 的 `defaultWeight`（排除 0）与成功路径返回的 `weight`
- Then: 逐项相等，且排除 0 权重后 `defaultWeight` 之和为 1（与 freedom-suggestions W1 测试互补，
      后者只查 defaultWeight、查不出返回字面量漂移）