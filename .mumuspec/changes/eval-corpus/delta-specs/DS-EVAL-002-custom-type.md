---
id: DS-EVAL-002
layer: 0
scope: .
delta: ADDED
---

## Requirement: custom 场景类型死端消除

### SHALL
- SHALL custom 场景类型仅执行 assertions 断言并返回判定结果，不执行任何引擎动作。

### SHALL NOT
- SHALL NOT custom 场景类型落入未知类型分支输出 warning。

Enforcement: runner custom 分支单测断言（断言通过/失败两态 + 零警告）。
