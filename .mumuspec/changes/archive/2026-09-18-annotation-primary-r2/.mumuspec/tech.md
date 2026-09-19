---
layer: 1
scope: ".changes/annotation-primary-r2"
last_updated: "2026-09-18"
doc_type: tech
change: annotation-primary-r2
parent_tech: ..\..\..\tech.md
phase: design
---

## Requirement: Architecture Constraints

### SHALL
- `specs.legacy_lexical_channel` 新增配置键默认 `true`，`classifyConstraint` 经可选 opts 显式接收；缺省路径行为与现状一致。
- enforced-weak 仅经 `lex:` 前缀或 legacy 兜底（legacy=false 时无注解无前缀 SHALL NOT 回落 unverifiable，E-SPEC-015 出口三分法）。
- `computeEnforcementCoverage` 以追加字段 `legacy_weak` / `actionable_weak` 输出行动项，`unverifiable_items` 语义不变。

### SHALL NOT
- 禁止改变 `legacy_lexical_channel=true` 时的既有 R2 行为（兼容面零变化）。
- 禁止为 annotation 主入口引入新引擎（no-new-engines 契约）。

### Enforcement
- TECH-annotation-primary-r2-1: legacy 两态 + lex: 前缀由 verifier-classify 策略测试锁定
- TECH-annotation-primary-r2-2: 配置接线与覆盖报告追加字段由 guard 测试锁定

## Requirement: Current Code Status

### SHALL
- Module: src/spec/verifier-classify.ts（R2 门控 + 覆盖报告）、src/core/config-io.ts / config.ts / migrations.ts（新键）、src/guard/checker.ts + src/spec/validator.ts（接线）、docs/reference/configuration.md（文档）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/spec/verifier-classify-policy.test.ts、tests/guard/annotation-primary-r2.test.ts（TC-L0-01~06）。