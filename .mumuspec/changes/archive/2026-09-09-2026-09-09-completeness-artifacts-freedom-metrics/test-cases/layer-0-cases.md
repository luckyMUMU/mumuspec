# Test Cases - Layer 0

## Cases

| ID | Source | Assertion |
|---|---|---|
| TC-FM-01 | tests/core/metrics/constraint-density.test.ts | SHALL/SHALL NOT 条目统计正确，归一化 min(1,total/150)，weight=0（D1） |
| TC-FM-02 | tests/core/metrics/constraint-density.test.ts | 变更 state 缺失时退化 scope '.'；affected_scopes 聚合子 scope 继承链 |
| TC-FM-03 | tests/core/metrics/constraint-density.test.ts | 规范链不可用 / 零约束 → nullResult（value 0, weight 0, details 非空） |
| TC-FM-04 | tests/core/metrics/design-build-first-pass.test.ts | archive+active 一次通过占比 = firstPass/total，weight 0.2（D2） |
| TC-FM-05 | tests/core/metrics/design-build-first-pass.test.ts | 以存在 .mumuspec.yaml 为准（AS-1）；缺字段默认 0；discarded 无 state 跳过 |
| TC-FM-06 | tests/core/metrics/design-build-first-pass.test.ts | 不可解析 state 跳过不误计；空集 nullResult；archive 不重复计数 |
| TC-FM-07 | tests/core/metrics/freedom-suggestions.test.ts | 放宽建议含本轮数值与"人工签收"；收紧建议含数值；中性区无建议 |
| TC-FM-08 | tests/core/metrics/freedom-suggestions.test.ts | 指标缺失不产出建议（禁止 stale 引用）；weight-0 不进 composite 但可见 |
| TC-FM-09 | tests/core/metrics/freedom-suggestions.test.ts | 内置注册 6 evaluator；DEFAULT_EVALUATOR_WEIGHTS 和为 1 |
| TC-FM-10 | tests/core/metrics/freedom-suggestions.test.ts | 建议产出零文件写入（config.yaml 字节不变断言） |

## Layers
- layer 0: src/core/metrics/（constraint-density.ts、design-build-first-pass.ts、auto-evaluate.ts、types.ts）
