# Proposal: consolidation-test-lock

## Why
engine-consolidation 归档后的代码审查（28e45c8..a4dc2d1）发现两个 Important 测试缺口，均是对已锁定测试用例承诺的未兑现：
1. TC-L1-002 第 2 行（agent 行为文本 带/不带前缀 过 isAgentBehaviorConstraint 等价）零覆盖——该入口恰是批1 十五条误报的原始路径。
2. E-GUARD-013 注册元数据（severity/forceable/always_enforce）无测试断言——forceable 被翻为 true 时现有测试不会变红，红线仅存于手写 registry 文档。

## What
仅新增测试断言，零生产行为变更（--no-spec-delta）：
1. 在 strip-channel-marker 端到端用例中补 agent 行为等价场景：带 `lex:` 前缀的 agent 行为类红线（如"禁止以 --force 越过 E-SPEC-015"族）在 src/ 上保持豁免、不带前缀时同判。
2. 在 behavior-gate 测试中补 E-GUARD-013 注册表元数据断言：severity === 'error'、forceable === false、always_enforce === true。

## Impact Scope
- tests

## User Decisions
- 用户已确认处理方式：走微变更立项（2026-09-28 会话内确认），不入 blocking。

## Workflow
tweak
