---
id: "IMPORT-SRC_RULES__MUMUSPEC_SPEC"
title: "rules spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/rules/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# rules spec

> **Source**: `src/rules/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/rules"
last_updated: "2026-07-30"
---

## Requirement: AI 规则文件生成

### SHALL
- 必须生成三种规则文件：CLAUDE.md、.cursorrules、AGENTS.md
- 规则内容必须包含项目概述、工作流规则、Ponytail 约束、CLI 命令参考
- 生成前必须加载 spec 上下文（如果存在）

### SHALL NOT
- 禁止覆盖用户手动编辑的规则文件（除非指定 --force）
- 禁止规则文件缺少项目名称与约束信息

### Enforcement
- RULE-1: 检查规则文件包含项目信息
- RULE-2: 检查 Ponytail 约束正确嵌入
- RULE-3: 检查 CLI 命令参考完整

