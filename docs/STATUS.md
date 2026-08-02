# MumuSpec 项目状态

> 本文件是 MumuSpec 项目进度的唯一权威来源。其他文档提及进度时 SHALL 引用本文件,不得自行描述进度数据。

- **最后更新日期**: 2026-08-01
- **设计版本**: 0.15.0-draft
- **当前包版本**: 0.15.0-beta.0 (next 通道)
- **发布通道**: `latest` → 0.10.0 | `next` → 0.15.0-beta.0

---

## 总体状态摘要

| 指标 | 数值 | 说明 |
|------|------|------|
| 设计完备性 | 100% | 六层架构设计已完成 |
| 实现进度 | ~87% | 六层架构基本实现,详见下方能力层进度表;缺口主要在 Contract Layer(Phase 3)、Worktree isolation、Code-graph 后端、AST 级合规分析 |
| 工作量估算 | 15-20 人天 | 完成剩余缺口(Contract Layer + Code-graph + AST 级分析 + Ponytail lint 集成) |
| 当前 Phase | Phase 2/3 交叉 | Phase 1 核心已完工,Phase 2(Ponytail/TDD/认知框架)/Phase 3(Knowledge 图谱)部分推进 |

### 已实现基础设施 (0.12.0+ 动态约束强度系统 → 0.13.0 全面落地)

> 以下代码已实现并通过 `tsc + vitest`。约束强度系统已在 0.12.1 全部落地，0.13.0 扩展至全六层架构。

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
| Spec Layer | 100% | **92%** | Phase 1 MVP (✅ 完成) | parser/loader/validator/inheritance/ponytail 完整;缺 AST 级冲突检测(Phase 2) |
| Change Layer | 100% | **75%** | Phase 1 MVP (✅ 基本完成) | CRUD/状态机/归档/版本管理完整;缺 Worktree isolation(Phase 1 目标未完成)、TDD 运行时强制(Phase 2) |
| Guard Layer | 100% | **90%** | Phase 1 MVP (✅ 完成) | compliance/drift/phase-guard 完整;Ponytail lint 规则为占位符(Phase 2);缺 AST 级代码分析(Phase 2) |
| AI Integration | 100% | **90%** | Phase 1 MVP (✅ 完成) | CLAUDE.md/.cursorrules/AGENTS.md 生成 + MCP Server(15+ 工具)完整;缺各工具格式深度定制 |
| Knowledge Layer | 100% | **85%** | Phase 3 (推进中) | CRUD/PageIndex/反向索引/UA 分析(onboarding/coverage/impact/chat)完整;缺 Code-graph 后端(SQLite, Phase 3) |
| Contract Layer | 100% | 0% | Phase 3 | 配置已定义,contracts 目录结构已就位,实体现在未开始 |
| 认知框架 Q1-Q4 | 100% | **80%** | Phase 2 | 配置完整,guard 集成已就位;默认关闭,需用户显式开启 |
| Ponytail | 100% | **90%** | Phase 2 (基本完成) | 7 级优先阶梯/约束注入/标记解析完整;缺 lint 规则集成(PONYTAIL-1~4 占位符) |

---

## Phase 路线图进度

| Phase | 实现进度 | 范围 |
|-------|---------|------|
| Phase 1 MVP | **90%** | Spec(✅) + Change(✅,缺 Worktree isolation) + Guard(✅,缺 lint 集成) + Rules 生成(✅) + AI 工具适配层(✅) |
| Phase 2 | **55%** | Ponytail(✅ 核心,缺 lint 集成) + TDD(配置就位,缺运行时强制) + 认知框架(✅ 配置+guard,缺 CLI 体验) + 状态机回退增强(✅) + AST 级分析(未开始) |
| Phase 3 | **30%** | Knowledge CRUD/PageIndex/UA 分析(✅) + Code-graph 后端(未开始) + Contract Layer(未开始) + Skill Bridge(未开始) |
| Phase 4 | 0% | CI/CD + 全漂移检测 + 知识提取 + 文档生成 |
| Phase 5 | 0% | 自建 Skill 编排器 + Hyperplan + 生态分发 |

---

## 运行时状态字段

> 以下字段供 `mumuspec status` 命令参考。

| 字段 | 当前值 | 说明 |
|------|--------|------|
| 图谱后端降级状态 | 内置(未启用 Code-graph) | Knowledge Layer 使用内置 PageIndex + 反向索引;SQLite Code-graph 后端计划 Phase 3 |
| 高级特性启用状态 | 认知框架/Ponytail 可用, TDD/Contract 未实现 | 认知框架 Q1-Q4 配置+guard 已就位(默认关闭),Ponytail 核心完成 |
| 工作流规则配置 | 完整(high/high 默认) | 双维度约束强度(技术设计/需求目标) + 完整 worktree/single_active/top_down/tdd 规则 |
| CLI 命令 | 40+ 命令可用 | init/spec/change/guard/constraints/knowledge/install/hooks/eval/i18n/env/bundle/feedback/skill-authoring/status/doctor |
| MCP Server 工具 | 25+ 工具可用 | 覆盖 spec/design/compliance/drift/guard/change/knowledge/constraints 全领域 |

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
