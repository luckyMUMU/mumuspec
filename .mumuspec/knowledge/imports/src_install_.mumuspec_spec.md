---
id: "IMPORT-SRC_INSTALL__MUMUSPEC_SPEC"
title: "install spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/install/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# install spec

> **Source**: `src/install/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/install"
last_updated: "2026-07-30"
---

## Requirement: 零依赖包安装器

### SHALL
- 必须支持 CatPaw、Claude、Cursor 三种 AI 工具的技能安装
- 安装过程必须使用 Node.js 内置模块（child_process 执行 npm/npx）
- 必须提供包搜索、解析、安装、列表功能

### SHALL NOT
- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止使用 require()（仅允许 ESM import）

### Enforcement
- INST-1: 检查无外部 import（仅 node: 前缀）
- INST-2: 检查支持三种 agent 类型

