---
id: "IMPORT-SRC_CORE__MUMUSPEC_SPEC"
title: "core spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - src-spec
source: "src/core/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# core spec

> **Source**: `src/core/.mumuspec/spec.md` | **Type**: src-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 1
scope: "src/core"
last_updated: "2026-07-30"
---

## Requirement: 核心基础设施

### SHALL
- 所有模块必须通过 `src/index.ts` 统一 re-export，禁止外部直接 import 子模块路径
- 配置加载必须支持 YAML 格式，且提供默认值回退
- 错误码必须遵循 E-<DOMAIN>-<NUMBER> 标准化格式
- 文件路径操作必须通过 `normalizePath` 统一分隔符
- 审计日志必须记录所有关键操作（init、transition、archive）

### SHALL NOT
- 禁止在 core 层引入外部 npm 依赖（yaml 除外）
- 禁止在工具模块中使用 any 绕过静态检查
- 禁止配置加载跳过 schema 校验
- 禁止错误消息泄露敏感信息（密钥、token、绝对路径）

### Enforcement
- CORE-1: 检查 index.ts 包含所有模块的 re-export
- CORE-2: 检查错误码格式符合 E-XXX-NNN
- CORE-3: 检查 isPathSafe 用于所有用户输入路径

