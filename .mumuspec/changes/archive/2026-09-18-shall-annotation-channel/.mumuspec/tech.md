---
layer: 1
scope: ".changes/shall-annotation-channel"
last_updated: "2026-09-18"
doc_type: tech
change: shall-annotation-channel
parent_tech: ..\..\..\tech.md
phase: design
---

## Requirement: Architecture Constraints

### SHALL
- R1 判定（注解/`ast:` → enforced-strong）对 polarity 中立，`classifyConstraint` 单通道单语义（R2 词法兜底仅限 SHALL NOT）。
- `checkShall` 对 `enforced-strong` + `shall` 条目执行既有 `checkAstViolation` 链路，命中报 E-GUARD-012。
- `typeToConstraint` 映射提取为模块级共享常量（checker 内单一权威源）。
- 测试执行语义沿用 checkShallNot：跳过测试文件、agent-behavior 豁免、isFileInScope 范围过滤。

### SHALL NOT
- 禁止为 SHALL 另立检查逻辑或词法 weak 层（no-new-engines 契约）。
- 禁止修改 checkShallNot 的既有通道与 E-SPEC-004/015 判定。

### Enforcement
- TECH-shall-annotation-channel-1: 分类对称由 verifier-classify 单测锁定
- TECH-shall-annotation-channel-2: E-GUARD-012 执行与豁免语义由 checker 单测锁定

## Requirement: Current Code Status

### SHALL
- Module: src/spec/verifier-classify.ts（分类）、src/guard/checker.ts（执行）、src/core/errors.ts（E-GUARD-012）为本变更落点，能力随基线同步维护。

## Appendix: Test Coverage & Metrics

- 新增：tests/guard/shall-annotation-channel.test.ts、tests/spec/verifier-classify-shall.test.ts（TC-L0-01~06）。