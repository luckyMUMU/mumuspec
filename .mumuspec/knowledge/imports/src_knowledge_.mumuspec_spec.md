---
id: "IMPORT-SRC_KNOWLEDGE__MUMUSPEC_SPEC"
title: "knowledge spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/knowledge/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# knowledge spec

> **Source**: `src/knowledge/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/knowledge"
last_updated: "2026-07-30"
---

## Requirement: 知识库管理

### SHALL
- 知识页必须支持 5 种类型：decision, pattern, risk, rationale, lesson
- PageIndex 必须在知识页创建/更新时自动重建
- 渐进式加载每层最多加载 max_pages_per_layer（默认 5）条
- 新鲜度校验必须检查 warn_after_days（90）和 error_after_days（180）

### SHALL NOT
- 禁止使用无 ID 的知识页（ID 格式：KP-NNNN-<slug>）
- 禁止知识页 frontmatter 缺少 type 或 status
- 禁止 stale 知识页（超过 error_after_days）被加载到上下文

### Enforcement
- KNOW-1: 检查知识页 ID 格式正确
- KNOW-2: 检查 frontmatter 包含必需字段
- KNOW-3: 检查新鲜度不超阈值

