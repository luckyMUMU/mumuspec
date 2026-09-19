---
id: KE-spec-context-projection-patterns
title: Architecture patterns from spec-context-projection
type: pattern
status: confirmed
scope: spec-context-projection
created_at: 2026-09-18
tags:
  - auto-extracted
  - pattern
  - architecture
  - spec-context-projection
graph_bindings: []
---
> Auto-extracted from spec-context-projection/design.md

# Design: spec-context-projection

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

spec/tech/prd frontmatter 声明 `disclosure` 披露清单后，`loadSpecContext` 对该层做机械投影（仅保留 frontmatter + 清单内 Requirement 块），`requirements` 与 content 同步收缩；未声明时逐字节回退现状。语义判断零参与。

## 实现

### 1. 类型（src/core/types-spec.ts）

- `SpecFrontmatter` 新增可选 `disclosure?: string[]`（披露的 Requirement 名清单）。

### 2. 投影助手（src/spec/loader.ts）

- `projectToDisclosure<T extends { content: string; requirements: Requirement[] }>(parsed: T, disclosure: string[] | undefined): T`：
  - disclosure 缺省/空 → 原样返回（逐字节回退路径）。
  - 否则：`requirements` 过滤为 name ∈ disclosure；`content` 按**机器规则**重建——保留 YAML frontmatter 段（首个 `---` 至第二个 `---`），保留 `## Requirement: <name>` 头部起始至下一个顶层 `##`（或文件尾）的区块，其余顶层 section 丢弃；拼接以原引号/缩进不动。
  - 纯同步纯函数，无 I/O。

### 3. 接线（src/spec/loader.ts loadSpecContext 主链）

- tech（L56）、spec 根（L76）、prd（L92）解析后：`parseFrontmatter<{disclosure?: string[]}>(content)`（沿用 L102 既有工具）读取 disclosure → 若存在则 `layer.tech/spec/prd = projectToDisclosure(parsed, disclosure)`。
- 父层/子层继承路径（L222/L473）不接（YAGNI：主链即 MCP/CLI 消费面；继承层 disclosure 语义留待后续）。

## 错误码

- 无新增。

## 不做什么

- 不做 thesis 语义过滤（仅 heading/区块边界）。
- 不扩展父层/子层继承路径的投影（主链优先）。
- 不改 SpecLayerContext 数据结构与 MCP/CLI schema。

## 测试用例

详见 `test-cases/layer-0-cases.md`（TC-L0-01 ~ TC-L0-03），Design 后经 `test-cases lock-suite` 锁定。