---
# === 标识 ===
id: "KP-0010"
title: "参考项目调研总结：OpenSpec / Comet / CGC / CBM / Ponytail"
type: lesson
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.11.0-ecosystem-research"
source_phase: "design"
source_artifact: "docs/appendix/ai-agent-ecosystem-research.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["research", "ecosystem", "openspec", "comet", "cgc", "cbm", "ponytail"]
related_pages:
  - "KP-0004"
  - "KP-0006"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

在设计 MumuSpec 前，需要调研已有开源项目，避免重复造轮子，借鉴最佳实践。

## 调研结果

### OpenSpec

| 维度 | 说明 |
|------|------|
| **核心价值** | 变更驱动的规范生命周期 |
| **借鉴点** | delta spec 语义合并、变更工件流水线 |
| **局限** | 仅覆盖变更层，缺少规范层和知识层 |

### Comet (OpenSpec + Superpowers)

| 维度 | 说明 |
|------|------|
| **核心价值** | 五阶段状态机 + phase guard + hotfix/tweak 预设 |
| **借鉴点** | 变更状态机模型、可配置工作流 |
| **局限** | 仅覆盖变更层，缺少约束规范 |

### CGC (CodeGraphContext)

| 维度 | 说明 |
|------|------|
| **Stars** | 35k |
| **语言覆盖** | 23+ 语言 |
| **图数据库** | 5 种（Neo4j / Memgraph / Kuzu / FalkorDB / TigerGraph） |
| **决策** | 作为 Knowledge Layer 可选后端，不自建 |

### CBM (codebase-memory-mcp)

| 维度 | 说明 |
|------|------|
| **Stars** | 8k |
| **语言覆盖** | 158 语言 |
| **性能** | 纯 C 实现，极致性能 |
| **决策** | 作为 Knowledge Layer 备选后端 |

### Ponytail

| 维度 | 说明 |
|------|------|
| **核心价值** | 懒惰高级开发者编码约束 |
| **借鉴点** | 7级优先级阶梯（YAGNI→复用→标准库→已有依赖→一行代码→最小实现） |
| **决策** | 作为 MumuSpec 基础编码约束 |

## 关键经验

1. **不重复造轮子**：CGC 和 CBM 已是生产级图谱工具，MumuSpec 集成而非自建
2. **渐进式披露**：从 context-engineering 借鉴，避免上下文过载
3. **变更驱动**：从 OpenSpec/Comet 借鉴，约束与变更生命周期绑定
4. **编码约束**：Ponytail 简单有效，直接复用
5. **可插拔架构**：生态工具迭代快，保持集成点可替换

## 影响

- Knowledge Layer 采用可插拔图谱后端（CGC / CBM / 内置）
- Change Layer 采用五阶段状态机（借鉴 Comet）
- Spec Layer 引入 Ponytail 约束（直接复用）

## 关联约束

- SHALL: 优先复用生态工具，不重复造轮子
- SHALL NOT: 不得将 MumuSpec 与特定图谱后端强绑定
