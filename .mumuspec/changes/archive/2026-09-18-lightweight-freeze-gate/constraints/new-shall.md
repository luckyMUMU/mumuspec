# New SHALL Constraints

## Requirement: 轻量路径需求冻结与最小可解析单元

- SHALL: 轻量档（tweak/hotfix）变更在 proposal 中声明 `## User Decisions` 段时，其中的 blocking 决策项在进入 build 前须逐项经 decisions.md 签收；全部签收后才可放行 open→build。
- SHALL: 轻量档 delta spec 校验接受「单条 `## Requirement:` + 一条 `- SHALL:`（或 `- SHALL NOT:`）项」为合法最小单元，不得因内容少而拒绝。
- SHALL: 通过 `mumuspec new --no-spec-delta` 声明零行为变更的轻量档变更允许无 delta-specs 通过 open→build，并由 verify 结果约束收口。

Enforcement:

- ENF-1: manual(phase-guard freeze-gate 测试 + validator 最小单元测试 + CLI 选项测试锁定)