---
workflow: full
phase: build
status: in-progress
created: 2026-08-08
title: "安全加固与工程质量整改"
---

# 变更提案：安全加固与工程质量整改

## 背景

基于三方独立审查（初评、harness review、二次分析 + 三方审计），发现 MumuSpec 存在以下必须修复的缺陷：

- P0：4 项安全/工程质量缺陷（命令注入、路径穿越、空捕获、MCP 无校验）
- P1：5 项性能/可观测性/类型安全缺陷

当前总分 74/100，整改后预期 80/100。

## 目标

修复全部 P0 缺陷 + 关键 P1 缺陷，使工具达到生产就绪状态。

## 受影响范围

| Scope | 变更类型 | 风险 |
|-------|---------|------|
| src/core/utils.ts | 添加 `validateChangeName`、强化 `isPathSafe` | 低 |
| src/core/logger.ts | 新建日志模块 | 低 |
| src/core/loop-engine.ts | 修复 $() 命令注入 | 中 |
| src/cli/commands/knowledge-git.ts | 修复 shell:true 注入 | 中 |
| src/change/paths.ts | 路径穿越防护 | 中 |
| src/mcp-server.ts | MCP isPathSafe 校验 | 中 |
| src/cli/commands/change.ts | discard/archive 确认机制 | 低 |
| src/guard/checker.ts | IO 扫描合并 + 日志注入 | 中 |
| cli/index.ts | 动态 import 冷启动优化 | 中 |
| 全局 catch 块 | 100+ 处替换为 Logger | 高（广泛） |

## 验收标准

- `npm run build` 通过
- `npm run test` 全部通过
- 无新增 shell:true / execSync 字符串拼接
- MCP handleToolCall 全部经过 isPathSafe 校验
- 静态 `import` 在 cli/index.ts 中改为动态 `import()`
