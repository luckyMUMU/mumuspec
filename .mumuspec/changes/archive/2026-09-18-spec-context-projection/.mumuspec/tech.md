---
layer: 1
scope: ".changes/spec-context-projection"
last_updated: "2026-09-18"
doc_type: tech
change: spec-context-projection
parent_tech: ..\..\..\tech.md
phase: build
---

## Requirement: Architecture Constraints

### SHALL
- spec/tech/prd frontmatter 声明 `disclosure` 后，`loadSpecContext` 主链对 tech/spec/prd 做机械投影（frontmatter + 披露 Requirement 块），`requirements` 与 content 同步收缩。
- 未声明 disclosure 时输出与现状逐字节一致；投影不做语义判断。

### SHALL NOT
- 禁止改变未声明 disclosure 的既有加载行为与 SpecLayerContext 数据结构。

### Enforcement
- TECH-spec-context-projection-1: 投影/回退两态由 loader 测试锁定

## Requirement: Current Code Status

### SHALL
- Module: src/core/types-spec.ts（disclosure 字段）、src/spec/loader.ts（projectToDisclosure + 主链接线）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/spec/spec-context-projection.test.ts（TC-L0-01~03）。