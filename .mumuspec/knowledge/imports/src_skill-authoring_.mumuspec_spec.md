---
id: "IMPORT-SRC_SKILL_AUTHORING__MUMUSPEC_SPEC"
title: "skill-authoring spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/skill-authoring/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# skill-authoring spec

> **Source**: `src/skill-authoring/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/skill-authoring"
last_updated: "2026-07-30"
---

## Requirement: 技能创作协议

### SHALL
- 必须提供技能验证功能（validateSkill）
- 必须提供技能脚手架生成（scaffoldSkill）
- 创作协议必须包含 version、schema、subagents、templates 字段

### SHALL NOT
- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止创建不符合 AUTHORING_PROTOCOL 的技能

### Enforcement
- SKAUTH-1: 检查无外部 import（仅 node: 前缀）
- SKAUTH-2: 检查技能符合协议 schema

