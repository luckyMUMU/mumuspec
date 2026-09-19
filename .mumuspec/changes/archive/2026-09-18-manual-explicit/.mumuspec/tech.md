---
layer: 1
scope: ".changes/manual-explicit"
last_updated: "2026-09-18"
doc_type: tech
change: manual-explicit
parent_tech: ..\..\..\tech.md
phase: design
---

## Requirement: Architecture Constraints

### SHALL
- `implicit-manual` enforcement 由 validator 报 `W-SPEC-017` advisory（不改变分类与阻断）。
- `missingManualEvidence` 结构化证据记录按 constraintId 匹配，无记录回落既有文本锚点（向后兼容，纯函数）。
- `classifyConstraintEntry` 空 enforcement 按 isRegexCheckable 判 enforced-weak，`manual(...)` 判 manual。

### SHALL NOT
- 禁止改变既有 manual 分类结果与 E-SPEC-004/015 阻断语义。
- 禁止改变 check/validate 既有 JSON schema。

### Enforcement
- TECH-manual-explicit-1: W-SPEC-017 发放与显式 manual 无提示由 validator 测试锁定
- TECH-manual-explicit-2: 结构化证据解析/回落与 entry 三分由 verifier-classify 测试锁定

## Requirement: Current Code Status

### SHALL
- Module: src/core/errors.ts（W-SPEC-017）、src/spec/validator.ts（发放）、src/spec/verifier-classify.ts（证据解析 + entry 分类）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/spec/manual-explicit.test.ts（TC-L0-01~05）。