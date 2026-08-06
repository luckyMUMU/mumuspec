---
id: "R-0006"
title: "Graph 编排引擎：基于契约的多 Agent 并行变更"
status: planning
priority: P0
scope: "src/core/graph, src/cli/commands"
created_at: "2026-08-06"
target_date: "2026-10-31"
owner: ""
depends_on: ["R-0001", "R-0002"]
mutex_with: []
excludes: []
capacity_cost: 6
---

# R-0006: Graph 编排引擎

## 背景

> 当前 MumuSpec 处于五层能力栈的 L4（Loop Engineering），L5（Graph Engineering）为空白。
> 竞品 BMad-Method（9 sub-agent）、OmO（11 Agent）、AutoGen 已实现多 Agent 协同编排。
> 当变更涉及多个需要并行验证的子系统时（API + DB + 前端 + CI），顺序串行执行效率极低。
> 调研结论：Graph 层缺失是最大架构盲区，应在 6 个月内补齐。

## 范围

### 包含（Includes）
- 基于 BOUNDARY.md 节点 + Contract Registry 边的 DAG 自动生成
- 无依赖模块的并行变更编排（每个模块分配独立 worktree + agent context）
- 依赖感知的串行调度（拓扑序执行）
- Graph 执行状态面板（CLI Dashboard 输出）
- 与现有 Loop Engine 的集成层

### 不包含（Excludes）
- Graph 可视化前端（VS Code 扩展留作后续）
- 多模型混合编排（每个 Agent 独立选模型）
- 跨仓库分布式 Graph（仅单仓库多模块）

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | 输入 scope 集合自动生成 DAG | 给定 3 模块+依赖关系，生成正确拓扑序 |
| 2 | 无依赖模块并行执行 | 2 个独立模块同时 worktree + 评估 |
| 3 | 有依赖模块按拓扑序串行执行 | 依赖模块完成后才启动下游模块 |
| 4 | Graph 执行状态实时可观测 | CLI Dashboard 输出每模块状态 |
| 5 | 单点失败不影响其他独立模块 | 模块 A 失败时，无依赖的模块 C 继续执行 |
| 6 | 至少 5 个单元测试覆盖核心调度逻辑 | vitest 测试通过 |

## 工作量预估

`capacity_cost`: 6（≈ 12-18 人天）

| 子任务 | 预估（人天） |
|--------|-------------|
| DAG 生成算法 | 3 |
| 并行执行调度器 | 4 |
| 状态面板 | 2 |
| Loop Engine 集成 | 3 |
| 测试 + 文档 | 4 |

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Worktree 资源耗尽（大规模 Graph） | 中 | 高 | 限制并行度 + 串行 fallback |
| 循环依赖检测遗漏 | 低 | 高 | DAG 生成时严格拓扑排序校验 |
| Agent 上下文污染 | 中 | 中 | 严格隔离每个模块的 context scope |
| 与现有 Loop 流程不兼容 | 低 | 高 | 先保留 Loop 模式，Graph 作为 opt-in |

## 互斥理由（Mutex Rationale）

- `R-0010`（Meta-Spec Evolution）：Graph 编排涉及 runtime 架构大改，Meta-Spec Evolution 涉及 Guard Layer 语义升级，同时进行会分散架构注意力。建议 R-0006 完成后再启动 R-0010。

---

> **关联**: depends_on [R-0001, R-0002] | mutex_with [] | excludes [VS Code 可视化, 跨仓库编排]
