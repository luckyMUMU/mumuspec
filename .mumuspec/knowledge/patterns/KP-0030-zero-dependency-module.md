---
# === 标识 ===
id: "KP-0030"
title: "零运行时依赖模块设计模式"
type: pattern
status: confirmed
scope: "src/install, src/bundle, src/i18n, src/skill-authoring"
created_at: "2026-07-30T00:00:00Z"
updated_at: "2026-07-30T00:00:00Z"
verified_at: "2026-07-30T00:00:00Z"

# === 来源 ===
source_change: "sync-spec-knowledge-base"
source_phase: "design"
source_artifact: "src/install/installer.ts"

# === 图谱关联 ===
graph_bindings:
  nodes: ["install", "bundle", "i18n", "skill-authoring"]
  edges: ["zero-dependency", "node-only"]

# === 索引 ===
tags: ["pattern", "zero-dependency", "node_modules", "infrastructure", "ponytail"]
related_pages:
  - "KP-0004"
  - "KP-0024"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

基础设施模块（安装器、打包器、国际化、技能协议）如果使用外部依赖，会增加脆弱性和安装体积。通过仅使用 Node.js 内置模块，可以保证这些模块在任何环境下都能运行。

## 模式

### 零依赖约束

只允许 `node:` 前缀的内置模块：
- `node:fs` — 文件系统操作
- `node:path` — 路径处理
- `node:child_process` — 执行外部命令（npm/npx）
- `node:crypto` — 哈希计算
- `node:http` — HTTP 请求（如需）

### 禁止项

- 禁止 `npm install` 安装任何运行时依赖
- 禁止 `require()` / `import ... from '外部包名'`
- 禁止使用 `any` 绕过类型检查

### 折中方案

如果某功能确实需要外部库：
1. 首先评估 Node.js 内置模块是否可实现
2. 如果必须使用外部依赖，将其隔离到独立模块
3. 基础设施模块通过接口调用隔离模块（依赖反转）

## 适用模块

| 模块 | 功能 | 实现方式 |
|------|------|----------|
| installer.ts | 安装 Skills/MCP | child_process 执行 npx |
| packager.ts | 打包技能 | fs + JSON manifest |
| locales.ts | 国际化 | 内联 UI_STRINGS |
| protocol.ts | 技能创作协议 | fs 操作 |

## 影响

- 安装体积减少 ~90%（无依赖树）
- 启动时间减少（无 require 链）
- 长期稳定性（无 breaking changes from dependencies）
