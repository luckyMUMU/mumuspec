---
id: "IMPORT-SRC_EVAL__MUMUSPEC_SPEC"
title: "eval spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/eval/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# eval spec

> **Source**: `src/eval/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/eval"
last_updated: "2026-07-30"
---

## Requirement: 评估场景运行

### SHALL
- 必须支持 3 种场景类型：compliance、drift、phase-guard
- 场景文件必须使用 YAML 格式
- 断言必须支持 JS 表达式动态求值

### SHALL NOT
- 禁止执行未经验证的断言表达式
- 禁止场景文件缺少 name 或 type 字段

### Enforcement
- EVAL-1: 检查场景文件格式正确
- EVAL-2: 检查断言表达式安全执行

