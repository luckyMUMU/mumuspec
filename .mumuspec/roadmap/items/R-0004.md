---
id: "R-0004"
title: "LLM 自由度工作流增强 — 动态 Phase 决策"
status: planned
priority: P2
scope: "src/cli/, src/core/workflow-recommender.ts"
created_at: "2026-08-05"
target_date: "2026-09-30"
owner: ""
depends_on: ["R-0003"]
mutex_with: []
excludes: []
capacity_cost: 4
---

# R-0004: LLM 自由度工作流

## 背景

> 设计文档 `llm-freedom-analysis.md` 描述了当前工作流的 3 个核心局限：
> Phase 顺序硬编码、LLM 不参与流程决策、阻塞点静态预定义。
> 目标：借鉴 Claude Code Dynamic Workflows 的理念。

来源: `.mumuspec/designs/llm-freedom-analysis.md`

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | workflow.yaml 支持条件分支 | schema 验证 |
| 2 | LLM 可参与 Phase 跳转建议 | advisor 模块测试 |
| 3 | 阻塞点可动态注册 | runtime BP 注册 API |

