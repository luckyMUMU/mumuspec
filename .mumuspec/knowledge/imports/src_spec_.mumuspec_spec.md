---
id: "IMPORT-SRC_SPEC__MUMUSPEC_SPEC"
title: "spec spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/spec/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# spec spec

> **Source**: `src/spec/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/spec"
last_updated: "2026-07-30"
---

## Requirement: 规范解析与加载

### SHALL
- spec.md 解析必须支持 YAML frontmatter（layer, scope, last_updated）
- 渐进式加载最多支持 3 层（Layer 0 → 1 → 2）
- 规范校验必须检测 SHALL without Enforcement 违规
- 继承冲突检测必须识别子层放松父层约束的非法行为
- Ponytail 约束注入必须保留原有需求不丢失

### SHALL NOT
- 禁止解析器忽略 frontmatter 格式错误（必须报错）
- 禁止加载器缓存过期 spec（freshness check_on_load 必须执行）
- 禁止继承合并时丢失父层 SHALL NOT 约束
- 不可覆盖手写的需求约束（Ponytail 注入保留用户定义）

### Enforcement
- SPEC-1: 检查 frontmatter 包含 layer/scope/last_updated
- SPEC-2: 检查 SHALL 约束有对应 Enforcement
- SPEC-3: 检查子层不放松父层约束

