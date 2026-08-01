---
id: KE-portable-exe-packaging-lessons
title: Lessons from portable-exe-packaging decisions
type: lesson
status: confirmed
scope: portable-exe-packaging
created_at: 2026-08-01
tags:
  - auto-extracted
  - lesson
  - decisions
  - portable-exe-packaging
graph_bindings: []
---
> Auto-extracted from portable-exe-packaging/decisions.md

# Decision Log: portable-exe-packaging

## DEC-001: 选择 Node.js SEA 作为打包方案
**Decision**: 使用 Node.js 20+ 的 Single Executable Application (SEA) 功能
**Rationale**: 零外部依赖，符合 Ponytail 约束；官方支持
**Status**: confirmed
**Date**: 2026-08-01

## DEC-002: 启动脚本自动检测依赖
**Decision**: start.mjs 自动检测 node_modules 是否存在
**Rationale**: 用户体验优先，避免手动运行 npm install
**Status**: confirmed
**Date**: 2026-08-01

## DEC-003: 配置和临时文件存放策略
**Decision**: 运行时在 exe 同级目录创建 `.app-data/config` 和 `.app-data/temp`
**Rationale**: 自包含、可移植、不污染系统目录
**Status**: proposed
**Date**: 2026-08-01
