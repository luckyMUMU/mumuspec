# Proposal: doc-governance-decisions

## Why
文档体系整合（review/doc-system-integration-2026-09-06.md）产出 7 项待决策事项，逐项裁决后其中 2 项需要落地代码/规范修复：

1. TEMP 规范自相矛盾：spec 要求 temp/ 必须存在且结构校验器不认 temp 目录（存在即 E-SPEC-013）；TEMP-4 白名单缺 3 个实际合法的功能性状态文件（constraints.yaml / audit.log / agents-hash.json）；temp/ 子目录分类含 design-archive/designs-archive 但设计归档已裁决为版本化目录（designs-archive 留在 .mumuspec/ 根级，校验器已支持）。
2. GLOSSARY-1 路径错位：glossary-checker 存在性检查指向 docs/reference/glossary.md（现为薄入口），术语权威为 .mumuspec/glossary.md（spec 定义）。

## What
- src/spec/structure-validator.ts：DEFINED_DIRECTORIES 增加 'temp'
- src/guard/glossary-checker.ts：GLOSSARY_MD_REL 改为 .mumuspec/glossary.md
- tests/glossary-checker.test.ts：fixture 路径同步
- .mumuspec/spec.md：TEMP 块修订（TEMP-1 按需创建、TEMP-4 白名单补 3 文件、移除 design-archive/designs-archive 子目录分类、根文件清单补 constraints.yaml、designs-archive 定位为版本化归档）
- package.json：版本 0.19.2-alpha.7 → 0.19.2-alpha.8

## Impact Scope
- src/spec/structure-validator.ts
- src/guard/glossary-checker.ts
- tests/glossary-checker.test.ts
- .mumuspec/spec.md
- package.json

## Workflow
tweak
