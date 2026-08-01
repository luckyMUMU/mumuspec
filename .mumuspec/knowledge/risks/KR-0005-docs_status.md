---
id: "KR-0005"
title: "MumuSpec 项目状态"
type: risk
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - project-status
  - risk
source: "docs/STATUS.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# MumuSpec 项目状态

> **Source**: `docs/STATUS.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

> 本文件是 MumuSpec 项目进度的唯一权威来源。其他文档提及进度时 SHALL 引用本文件,不得自行描述进度数据。

## Original Content

# MumuSpec 项目状态

> 本文件是 MumuSpec 项目进度的唯一权威来源。其他文档提及进度时 SHALL 引用本文件,不得自行描述进度数据。

- **最后更新日期**: 2026-07-28
- **设计版本**: 0.12.1-draft
- **当前包版本**: 0.12.1-alpha.0 (next 通道)
- **发布通道**: `latest` → 0.10.0 | `next` → 0.12.1-alpha.0

---

## 总体状态摘要

| 指标 | 数值 | 说明 |
|------|------|------|
| 设计完备性 | 100% | 六层架构设计已完成 |
| 实现进度 | ~5% | Phase 1 MVP 未开始;constraint-strength 基础设施已落地 (见下方"已实现 scaffolding") |
| 工作量估算 | 80-85 人天 | 基准来源: implementation-plan.md |
| 当前 Phase | Phase 1 MVP | 准备阶段 |

### 已实现 scaffolding (0.12.0+ 动态约束强度系统)

> 以下代码已实现并通过 `tsc + vitest`。下方"Top 改进项"在本次修复后全部转为 `done`。

| 模块 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 类型层 | [src/core/types.ts](../src/core/types.ts) | `ConstraintStrength` / `ConstraintDimension` / `ConstraintEntry` / `ConstraintsFile` / `ConstraintTreeNode` / `ConstraintConflict` / `ConstraintTreeResolution` / `ConstraintEvalResult` | ✅ 完整 |
| 配置层 | [src/core/config.ts](../src/core/config.ts) | `ConstraintStrengthField` / `WorkflowConfig` / `WorkflowOverride` / `CapabilityOverride` 类型;`BUILTIN_CONSTRAINT_EXCEPTIONS` (9项) / `STRENGTH_ACTION_MAP` / `WORKFLOW_RULE_DIMENSION` / `WORKFLOW_STRENGTH_MATRIX` / `CONSTRAINT_TREE_POLICY` 常量;`getDefaultConfig()` 默认 high/high | ✅ 完整 |
| 算法层 | [src/core/config.ts](../src/core/config.ts) `resolveConstraintTree()` | 纯函数,树状约束解析:跳层继承 / 收紧校验 / 冲突审计 (highest_layer_wins / manual_review) | ✅ 完整,200+ 行 |
| 辅助函数 | [src/core/config.ts](../src/core/config.ts) | `strengthRank()` / `isValidStrength()` / `normalizeScope()` / `isTightening()` | ✅ 完整 |
| 求值器 | [src/core/constraint-evaluator.ts](../src/core/constraint-evaluator.ts) | `evaluateConstraint()` 实现 §9.2 求值逻辑 | ✅ 完整 |
| 加载器 | [src/core/constraints-loader.ts](../src/core/constraints-loader.ts) | `loadConstraintsFile()` / `loadAllConstraints()` 从磁盘加载 `.mumuspec/constraints.yaml` | ✅ 完整 |
| 测试 | [tests/constraint-strength.test.ts](../tests/constraint-strength.test.ts) | `resolveConstraintTree` + `evaluateConstraint` + `loadConstraintsFile` 单元测试 | ✅ 完整 |
| Guard 集成 | [src/guard/checker.ts](../src/guard/checker.ts) / [phase-guard.ts](../src/guard/phase-guard.ts) | 读取 `constraint_strength` 配置,按 high/medium/low 求值 block/warn/info | ✅ 已集成 |
| CLI 命令 | [src/cli.ts](../src/cli.ts) | `mumuspec constraints strength` / `list` / `resolve` / `check` / `preset` | ✅ 已实现 |
| MCP 工具 | [src/mcp-server.ts](../src/mcp-server.ts) | `constraints.check` / `constraints.resolve` / `constraints.strength` | ✅ 已实现 |

---

## 能力层进度表

| 能力层 | 设计完备性 | 实现进度 | Phase 归属 | 备注 |
|-------|-----------|---------|-----------|------|
| Spec Layer | 100% | 0% | Phase 1 MVP | 不含 Ponytail(Ponytail 在 Phase 2) |
| Change Layer | 100% | 0% | Phase 1 MVP | 不含 TDD 强制(Phase 2,可配置) |
| Guard Layer | 100% | 0% | Phase 1 MVP | 仅 P0 漂移(spec_drift + shall_not_violation) |
| AI Integration | 100% | 0% | Phase 1 MVP | 仅 Rules 文件生成 + AI 工具适配层 |
| Knowledge Layer | 100% | 0% | Phase 3 | 可插拔图谱后端(CBM/CGC/内置) |
| Contract Layer | 100% | 0% | Phase 3 | 推迟 |
| 认知框架 Q1-Q4 | 100% | 0% | Phase 2 | 默认关闭,用户显式开启 |
| Ponytail | 100% | 0% | Phase 2 | 推迟 |

---

## Phase 路线图进度

| Phase | 实现进度 | 范围 |
|-------|---------|------|
| Phase 1 MVP | 0% | Spec(不含 Ponytail) + Change(不含 TDD 强制) + Guard(P0 漂移) + Rules 生成 + AI 工具适配层 |
| Phase 2 | 0% | Ponytail + TDD(可配置) + 认知框架(可选) + 状态机回退增强 + 软假设降级方案 |
| Phase 3 | 0% | Knowledge 图谱(可插拔后端) + 知识价值评估 + 契约层 + Skill Bridge |
| Phase 4 | 0% | CI/CD + 全漂移检测 + 知识提取 + 文档生成 |
| Phase 5 | 0% | 自建 Skill 编排器 + Hyperplan + 生态分发 |

---

## 运行时状态字段

> 以下字段供 `mumuspec status` 命令参考。当前实现进度为 0%,所有运行时状态均为默认/未实现值。

| 字段 | 当前值 | 说明 |
|------|--------|------|
| 图谱后端降级状态 | 无(未实现) | Knowledge Layer 尚未实现,无降级状态 |
| 高级特性启用状态 | 全部关闭(未实现) | 认知框架 Q1-Q4、Ponytail、TDD 等均默认关闭 |
| 工作流规则配置 | 默认值(未实现) | Change Layer 规则配置尚未实现,使用默认值 |

---

## 反馈汇总

> 数据来源: `feedback/user/` + `feedback/sessions/`,月度更新。
> 反馈流程详见 [docs/reference/feedback-process.md](reference/feedback-process.md)。

| 指标 | 本月 (2026-07) | 累计 |
|------|---------------|------|
| 用户反馈 - critical | 0 | 0 |
| 用户反馈 - major | 0 | 0 |
| 用户反馈 - minor | 0 | 0 |
| Session 摘要 | 0 | 0 |
| 已关闭 | 0 | 0 |
| 平均关闭时长 | — | — |

### Top 改进项 (本季度)

| 改进项 | 来源 | 优先级 | 目标版本 | 状态 |
|--------|------|--------|---------|------|
| ConstraintEvaluator 实现 | 设计 (constraint-strength.md §9.2) | high | 0.12.1-alpha.0 | ✅ done |
| loadConstraintsFile 实现 | 设计 (constraint-strength.md §5.6) | high | 0.12.1-alpha.0 | ✅ done |
| src/guard/checker.ts 集成约束强度 | 设计 (constraint-strength.md §10.2) | high | 0.12.1-alpha.0 | ✅ done |
| 新增 CLI `mumuspec constraints` 子命令 | 设计 (constraint-strength.md §8.2) | medium | 0.12.1-alpha.0 | ✅ done |
| 为 resolveConstraintTree 补单元测试 | 一致性核查 | high | 0.12.1-alpha.0 | ✅ done |
| MCP `constraints.check` 工具 | 设计 (constraint-strength.md §10.4) | medium | 0.12.1-alpha.0 | ✅ done |
| 配置字段去重 (changes.* legacy 标记 @deprecated) | 一致性核查 | high | 0.12.1-alpha.0 | ✅ done |
| 修正设计文档 §11.1 默认强度 (high/high) | 一致性核查 | low | 0.12.1-alpha.0 | ✅ done |

### 反馈 → 迭代闭环

```
用户/Agent 提交反馈 (feedback/user/ | feedback/sessions/)
    ↓
月度聚合 (feedback/monthly/YYYY-MM.md)
    ↓
进入本表 Top 改进项
    ↓
下一轮 prerelease (release:next) 修复
    ↓
STATUS.md 同步状态
```

---

## 引用约定

其他文档引用本文件时:
- `roadmap.md`: Phase 进度百分比引用本文件 §Phase 路线图进度
- `ecosystem-comparison.md`: 实现进度引用本文件 §能力层进度表
- `implementation-plan.md`: 工作量估算以本文件为基准(80-85 人天)
- `packaging-deployment.md`: 发布通道与当前包版本引用本文件 §顶部元信息
- `feedback-process.md`: 反馈汇总数据引用本文件 §反馈汇总

更新本文件时:
- 每次实现进度变更后更新"最后更新日期"
- 设计完备性变更需同步更新设计文档版本号
- 每次发布 (任意通道) 后更新"当前包版本"与"发布通道"
- 每月 1 号更新 §反馈汇总表 (从 `feedback/` 目录聚合)

