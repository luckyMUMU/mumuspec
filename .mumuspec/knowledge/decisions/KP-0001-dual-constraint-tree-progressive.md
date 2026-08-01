---
# === 标识 ===
id: "KP-0001"
title: "MumuSpec 核心设计决策：双约束 + 树状分层 + 渐进式披露 + 动态强度"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "overview.md"

# === 图谱关联 ===
graph_bindings:
  - src/core/types.ts
  - src/core/config.ts
  - src/spec/loader.ts
  - src/knowledge/manager.ts

# === 索引 ===
tags: ["dual-constraint", "tree-progressive", "core-design", "architecture", "goal"]
related_pages:
  - "KP-0002"
  - "KP-0003"
  - "KP-0004"
  - "KP-0009"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

AI 编程辅助工具面临的核心挑战是：只有正向要求（"做什么"），缺少反向禁止（"绝不能做什么"），AI 在边界场景失控；或笼统全量加载规范，造成上下文过载。

## 决策

MumuSpec 采用四大核心设计支柱：

### 1. 正向设计 + 反向禁止（Dual Constraint）

- **SHALL / MUST**：正向指明必达目标
- **SHALL NOT / MUST NOT**：反向划定不可逾越红线（硬性禁止）
- 禁止项 = 可执行检查（lint / AST / test 级别 enforcement）
- SHALL NOT 违规在 CI 阶段始终阻断，不受约束强度影响

### 2. 树状分布 + 渐进式披露（Tree Progressive）

- 按目录树分层存放规范
- 每层含本层 + 子层信息
- 按切入层级加载，避免上下文过载
- 规范加载 token 消耗较全量加载减少 ≥ 60%

### 3. 持久化 + 代码一致（Code-Bound）

- 约束定义存储在 `.mumuspec/` 下，版本化管理
- CI/CD 自动校验代码是否遵守规范
- 测试即契约（TDD 红绿循环）
- 代码图谱绑定，漂移检测 + 告警

### 4. 双维度动态约束强度（Dynamic Constraint Strength）

- **技术设计维度 (HOW)**：自顶向下设计、TDD 红绿循环
- **需求目标维度 (RG)**：worktree 隔离、单一活跃变更
- **三档强度**：high（强制 block）/ medium（推荐 warn）/ low（关闭 info）
- **工作流限制渐进式放开**：按约束强度等级求值

## 影响

- AI Agent 必须在理解双维度约束的前提下推进变更
- SHALL NOT 违规始终阻断（P0），不受强度等级影响
- 团队成熟度提升后可降低强度，逐步放开工作流限制
- 规范变更通过 Git 版本控制管理

## 关联约束

- SHALL: 所有 API 返回统一 JSON 格式 `{ code, data, message }`
- SHALL NOT: 业务错误禁止直接 throw Error
- SHALL NOT: 禁止在生产日志中打印敏感信息
