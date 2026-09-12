# Proposal: evaluator-weight-single-source

## Why

自改进 Loop 的 6 个 evaluator 中，4 个存在**权重副本**（E15，self-improvement-loop-remediation-plan v2）：
`defaultWeight` 已按 D2 重平衡调整，但 `evaluate()` 成功返回的 `weight` 仍是重平衡前的旧字面量。
`autoEvaluate` 消费的是 `MetricResult.weight`，因此 **D2 重平衡从未影响任何一次评分**。

| evaluator | defaultWeight（设计意图） | 实际返回 weight | 漂移 |
|---|---|---|---|
| test-pass-rate | 0.3 | 0.35 | +0.05 |
| drift-score | 0.2 | 0.25 | +0.05 |
| spec-compliance | 0.2 | 0.25 | +0.05 |
| code-delta | 0.1 | 0.15 | +0.05 |

净效果：test-pass-rate 实际话语权高于设计值，且直接违反项目红线
「同一语义不得存在两条权威源」（`defaultWeight` 与返回字面量）。

## What

- 4 个 evaluator 的 `evaluate()` 成功返回 `weight` 改为**引用自身 `defaultWeight` 常量**，
  不再写字面量——单一权威源（方案 P1-3 选项 a，推荐：改动局部、不改变 `Evaluator` 接口语义）。
- `types.ts` 的 `MetricResult.weight` 注释固化「0 = 不参与 composite」语义（`nullResult` 魔法值）。
- 新增防漂移断言测试：`registerBuiltInEvaluators()` 后，各 evaluator 的 `defaultWeight`
  （排除 0）之和等于其成功返回 `weight` 之和，且归一化前逐项相等。

不做：E17（spec-compliance / drift-score 的 CLI 参数与其输出契约不匹配，需评估器数据源重新
设计，属独立变更）、E14/E16 收敛判据、其它 evaluator 语义。

## Impact Scope

- `src/core/metrics/test-pass-rate.ts`
- `src/core/metrics/drift-score.ts`
- `src/core/metrics/spec-compliance.ts`
- `src/core/metrics/code-delta.ts`
- `src/core/metrics/types.ts`（注释固化）
- `tests/core/metrics/weight-single-source.test.ts`（新增）

## Workflow
hotfix