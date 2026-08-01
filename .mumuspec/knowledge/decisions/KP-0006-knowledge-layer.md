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
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

设计知识是变更级的，归档后即丢失，每次新变更从零开始理解"为什么现有代码是这样设计的"。AI Agent 既缺少"代码是怎么组织的"（HOW），又缺少"为什么这样设计"（WHY）。

## 决策

引入 Knowledge Layer，统一三个子组件：

### 1. Code Graph（代码图谱）— HOW

基于 AST 构建的代码结构知识图谱，提供"代码怎么组织的"事实基础。

**图谱后端可插拔**：
- 优先复用生态中已有的生产级工具：
  - **CGC**（CodeGraphContext, 35k Stars, 23+ 语言, 5 种图数据库）
  - **CBM**（codebase-memory-mcp, 8k Stars, 158 语言, 纯 C 极致性能）
  - **内置 fallback adapter**（tree-sitter + SQLite，用于无外部依赖场景）

**降级策略**：
- 不支持的语言降级为文件级索引
- SQLite 不可用时降级为内存图（小型项目）

### 2. LLM-Wiki — WHY

为 LLM 优化的结构化设计知识库，知识页面类型包括：
- `decision`：架构决策记录
- `pattern`：设计模式和实践
- `risk`：已知风险和兜底策略
- `rationale`：设计理由
- `lesson`：经验教训

### 3. PageIndex — WHERE

页面级索引系统，支持按代码路径/图谱节点渐进式加载相关知识：
- 按 `scope` 字段匹配当前工作目录的祖先链
- 每层最多加载 5 个 `status: confirmed` 且 `freshness: fresh` 的知识页面
- `stale` 页面仅加载标题和摘要（1 行）

### 知识生命周期

```
proposed → confirmed → superseded → deprecated
              ↓
            stale → confirmed / deprecated
```

### 新鲜度管理

| 新鲜度状态 | 条件 | 处理 |
|-----------|------|------|
| `fresh` | `verified_at` ≥ 关联代码节点最后修改时间 | 正常加载 |
| `stale` | `verified_at` < 关联代码节点最后修改时间 | 标记 WARN，仅加载摘要 |
| `unverified` | `verified_at` 为空或关联代码节点已删除 | 标记 ERROR，提示重新验证 |

## 影响

- 代码图谱后端可按项目规模与需求灵活选择
- AI Agent 在设计阶段可获取历史决策和理由
- 知识页面通过 `graph_bindings` 与代码节点双向关联
- 知识漂移检测纳入 P2 漂移检测（知识过期、代码节点删除）

## 关联约束

- SHALL: 变更归档时 SHALL 提取有价值的知识到 LLM-Wiki
- SHALL NOT: 知识页面不得以草稿状态保留超过 30 天
