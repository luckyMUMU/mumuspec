# Test Cases — loop-signal-bandwidth (Layer 0: 单元测试)

## L0-1 auto 模式透传调用方 issues

- Given: `evaluateRound(..., {issues: ['pre-existing issue']}, {mode:'auto'})`
- When: 执行 evaluateRound（autoEvaluate mock）
- Then: 记录的 `LoopEvaluation.issues` 包含 `'pre-existing issue'`（不再硬编码空数组）

## L0-2 auto 模式透传 needs_user_input

- Given: `evaluateRound(..., {needs_user_input: true, block_reason: '...'}, {mode:'auto'})`
- When: 执行 evaluateRound
- Then: 记录的 `needs_user_input === true`（不再硬编码 false）

## L0-3 guard 失败 code 采集进 issues（去重 + 标记）

- Given: `runPhaseGuard` 返回 errors `[{code:'E-GUARD-001', message:'proposal.md 不存在'} ×2]`
- When: 执行 evaluateRound（mode auto）
- Then: `issues` 含 1 条 `[guard:E-GUARD-001] proposal.md 不存在`（按 code+message 去重）

## L0-4 manual 模式行为不变

- Given: `evaluateRound(..., evaluation, {mode:'manual'})`
- When: 执行
- Then: 不改写传入 evaluation（suggestions 不注入、issues 不被 guard 污染）