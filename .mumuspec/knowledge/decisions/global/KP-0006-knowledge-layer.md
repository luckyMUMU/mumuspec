---
# === 标识 ===
id: "KP-0006"
title: "Knowledge Layer 知识层设计决策：可插拔图谱后端 + LLM-Wiki + PageIndex"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.9.0-knowledge-layer"
source_phase: "design"
source_artifact: "docs/design/knowledge-layer.md"

# === 图谱关联 ===
graph_bindings:
  - src/knowledge/manager.ts
  - src/knowledge/loader.ts
  - src/knowledge/index.ts

# === 索引 ===
tags: ["knowledge", "code-graph", "llm-wiki", "page-index", "graph-backend", "vision"]
related_pages:
  - "KP-0002"
  - "KP-0005"
  - "KP-0007"
  - "KD-0022"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 知识层核心设计决策

AI Agent 既缺少"代码是怎么组织的"（HOW），又缺少"为什么这样设计"（WHY）。当前 MumuSpec 的信息持久化存在两个结构性缺口：代码结构不可知、设计知识失忆。Knowledge Layer 统一解决这两个问题。

## 三大子组件

### 1. Code Graph（代码图谱）— HOW

基于 AST 构建的代码结构知识图谱，提供"代码怎么组织的"事实基础。

- **图谱后端可插拔**：优先复用生态生产级工具
  - **CBM**（codebase-memory-mcp）：158 语言，纯 C 极致性能（默认推荐）
  - **CGC**（CodeGraphContext）：23+ 语言，5 种图数据库
  - **内置 fallback adapter**（tree-sitter + SQLite，无外部依赖）
- **降级策略**：不支持的语言降级为文件级索引；SQLite 不可用时降级为内存图

### 2. LLM-Wiki — WHY

为 LLM 优化的结构化设计知识库，知识页面类型包括 `decision`、`pattern`、`risk`、`rationale`、`lesson`。

### 3. PageIndex — WHERE

页面级索引系统，支持按 `scope` 字段匹配当前工作目录的祖先链渐进式加载。每层最多加载 5 个 confirmed 且 fresh 的知识页面。

## 核心设计原则

- 代码图谱后端可按项目规模与需求灵活选择
- 知识页面通过 `graph_bindings` 与代码图谱节点双向关联
- 知识变更纳入 P2 漂移检测（知识过期、代码节点删除）
- MumuSpec 自身不重复实现 AST 解析 / 图谱存储 / 语言服务器集成

## 遗留约束

- SHALL: 变更归档时提取有价值的知识到 LLM-Wiki
- SHALL NOT: 知识页面不得以草稿状态保留超过 30 天

## 详细文档

完整设计文档见 [KD-0022 — Knowledge Layer 持久化知识来源（代码图谱 + LLM-Wiki +PageIndex）](KD-0022-docs_design_knowledge-layer.md)
