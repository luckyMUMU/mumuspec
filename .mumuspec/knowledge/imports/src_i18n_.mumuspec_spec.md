---
id: "IMPORT-SRC_I18N__MUMUSPEC_SPEC"
title: "i18n spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/i18n/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# i18n spec

> **Source**: `src/i18n/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/i18n"
last_updated: "2026-07-30"
---

## Requirement: 国际化支持

### SHALL
- 必须支持 zh（中文）和 en（英文）两种语言
- UI 字符串必须通过 uiString() 函数获取（支持插值）
- 技能文件路径解析必须支持 locale fallback（zh → en）

### SHALL NOT
- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止硬编码 UI 字符串（必须通过 UI_STRINGS 常量）

### Enforcement
- I18N-1: 检查无外部 import（仅 node: 前缀）
- I18N-2: 检查 UI_STRINGS 包含所有必需键

