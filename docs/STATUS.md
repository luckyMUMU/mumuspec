# MumuSpec 项目状态

> 本文件是 MumuSpec 项目进度的唯一权威来源。其他文档提及进度时 SHALL 引用本文件,不得自行描述进度数据。

- **最后更新日期**: 2026-09-13
- **设计版本**: 0.20.0-draft
- **当前包版本**: 0.33.0-alpha.0
- **定位**: Spec 即 DSL — Spec 由大模型起草、人做设计决策与审批签收（人机合著），AI 生成代码

---

## 总体状态摘要

| 指标 | 数值 | 说明 |
|------|------|------|
| 设计完备性 | 100% | 六层架构设计已完成 |
| 实现进度 | ~90% | 核心层已实现；缺口主要在 Contract Layer、Worktree isolation、Code-graph 后端 |
| 当前 Phase | Phase 2/3 交叉 | Phase 1 核心已完工，Phase 2/3 部分推进 |
| 0.20 进展 | Verifier P0 已实施 | 可验证性四分类、E-SPEC-015、enforcement coverage 已落地；M2 门控默认 ON |

---

## 0.20 关键变更（2026-09-05 批次，全流程自洽性评审落地）

依据：`review/full-flow-consistency-ecosystem-2026-09-05.md`。定位修正与规则-实现分离见决策页 KP-0059 / KP-0060。

| 变更 | 状态 | 说明 |
|------|------|------|
| 核心目标修正（人机合著） | ✅ | "随意的自然语言 → 大模型起草 Spec ⇄ 追问补全 → 完备性判定（人签收）→ AI 生成代码"；设计决策权始终在人 |
| 规则-实现分离（KP-0060） | ✅ | 引擎归代码、规则归 LLM（声明式）、校验归代码；CLI-first 为流程层特例 |
| Dogfood 迁移（P0） | ✅ | 根部 AGENTS.md 为 canonical，CLAUDE.md 为 `@AGENTS.md` 薄壳；`buildRuleGenContext` 补齐新格式 tech.md 读取 |
| CHG-7 dogfood | ✅ | `.mumuspec/workflow.yaml` 项目级 override 机制落地并在本仓库启用 |
| CLI 去重（非破坏） | ✅ | `drift --change` 提升至主命令（`drift detect` 为隐藏弃用别名）；`knowledge search` 升级为相关性评分引擎（`search2` 为隐藏弃用别名） |
| SKILL.md 开放标准对齐 | ✅ | `skills/mumuspec-workflow/SKILL.md` 按 agentskills.io 标准重写；旧无 frontmatter 版降级为资源文件 |
| E-AGENTS-001 fixHint 更正 | ✅ | 指向 `mumuspec init`（`rules generate` 命令已不存在） |
| DS-005 空壳移除 | ✅ | phase-guard 死代码按 YAGNI 移除 |

## 0.20 关键变更（2026-08-29）

### Verifier 语义收紧（P0，已实施）

| 变更 | 状态 | 文件 |
|------|------|------|
| 可验证性四分类纯函数 | ✅ | `src/spec/verifier-classify.ts` |
| E-SPEC-015（SHALL NOT 不可验证 = 恒 block） | ✅ | `src/core/errors.ts` |
| E-SPEC-004 修订（SHALL 无验证 = 恒可见 warning） | ✅ | `src/spec/validator.ts`、`src/guard/checker.ts` |
| `manual(原因)` 保留字解析 | ✅ | `src/spec/parser.ts` |
| `EnforcementRule.kind` 字段 | ✅ | `src/core/types-spec.ts` |
| enforcement_coverage 五桶计量 | ✅ | `src/guard/checker.ts`、`src/cli/commands/spec.ts` |
| E-VERIFY-003（manual evidence 义务） | ✅ | `src/guard/phase-guard.ts` |
| F8 注解错配修复 | ✅ | `src/spec/annotation.ts` |
| M2 门控默认 ON（enforcement_strict） | ✅ | 用户 2026-08-29 确认翻闸 |
| 测试：T1-T14 + 正交回归（37+ 新用例） | ✅ | `tests/spec/verifier-*.test.ts`、`tests/guard/verify-evidence.test.ts` |

### CLI-first 三命令（0.20，已实现）

| 命令 | 替代的手工步骤 | 位置 |
|------|---------------|------|
| `mumuspec tasks next <name>` | grep tasks.md 定位未完成任务 | `src/change/lifecycle.ts` |
| `mumuspec test-cases lock-suite <name> --layer N` | 手写 suite-map.yaml | `src/change/lifecycle.ts` |
| `mumuspec state layer <name> <N> <status>` | 手编 .mumuspec.yaml build_layers | `src/cli/commands/state.ts` |

### 定位修正

| 原定位 | 新定位 | 决策页 |
|--------|--------|--------|
| 自然语言字节码（中间表示） | **领域特定语言（DSL）** | [KP-0059](../.mumuspec/knowledge/decisions/global/KP-0059-spec-as-dsl-not-bytecode.md) |

---

## 已实现基础设施

### 约束强度系统（0.12.0+ → 0.13.0 全面落地）

| 模块 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 类型层 | `src/core/types.ts` | ConstraintStrength / ConstraintDimension / ConstraintEntry / ConstraintsFile | ✅ 完整 |
| 配置层 | `src/core/config.ts` | ConstraintStrengthField / WorkflowConfig / BUILTIN_CONSTRAINT_EXCEPTIONS | ✅ 完整 |
| 算法层 | `src/core/config.ts` | resolveConstraintTree() 纯函数，树状约束解析 | ✅ 完整 |
| 求值器 | `src/core/constraint-evaluator.ts` | evaluateConstraint() §9.2 求值逻辑 | ✅ 完整 |
| 加载器 | `src/core/constraints-loader.ts` | loadConstraintsFile() / loadAllConstraints() | ✅ 完整 |
| Guard 集成 | `src/guard/checker.ts` / `phase-guard.ts` | 按 high/medium/low 求值 block/warn/info | ✅ 已集成 |
| CLI 命令 | `src/cli.ts` | `mumuspec constraints strength/list/resolve/preset` | ✅ 已实现 |
| MCP 工具 | `src/mcp-server.ts` | `constraints.check/resolve/strength` | ✅ 已实现 |

### 可验证性系统（0.20 P0，已落地）

| 模块 | 文件 | 内容 | 状态 |
|------|------|------|------|
| 分类器 | `src/spec/verifier-classify.ts` | 四分类纯函数（enforced-strong/weak/manual/unverifiable） | ✅ 完整 |
| 错误码 | `src/core/errors.ts` | E-SPEC-015（恒 block）、E-VERIFY-003（evidence 义务） | ✅ 完整 |
| 门控 | `src/core/config.ts` | `enforcement_strict`（默认 ON） | ✅ 完整 |
| 解析 | `src/spec/parser.ts` | `manual(...)` 保留字 + round-trip | ✅ 完整 |
| 计量 | `src/guard/checker.ts` | enforcement_coverage 五桶 + 迁移清单 | ✅ 完整 |
| 测试 | `tests/spec/verifier-*.test.ts` | T1-T14 + 正交回归 37+ 用例 | ✅ 完整 |

---

## 能力层进度表

| 能力层 | 设计完备性 | 实现进度 | Phase 归属 | 备注 |
|-------|-----------|---------|-----------|------|
| Spec Layer | 100% | **95%** | Phase 1 (✅ 完成) | parser/loader/validator/inheritance/ponytail/可验证性四分类完整；缺多语言 AST |
| Change Layer | 100% | **80%** | Phase 1 (✅ 基本完成) | CRUD/状态机/归档/CLI-first 三命令完整；缺 Worktree isolation |
| Guard Layer | 100% | **93%** | Phase 1 (✅ 完成) | compliance/drift/phase-guard/enforcement coverage 完整；缺多语言 AST |
| AI Integration | 100% | **92%** | Phase 1 (✅ 完成) | canonical AGENTS.md + CLAUDE.md 薄壳桥接生成 + MCP Server 完整；10 agent Skill 分发完整 |
| Knowledge Layer | 100% | **85%** | Phase 3 (推进中) | CRUD/PageIndex/UA 分析完整；缺 Code-graph 后端(SQLite) |
| Contract Layer | 100% | 0% | Phase 3 | 配置已定义，实体未开始 |
| 认知框架 Q1-Q4 | 100% | **80%** | Phase 2 | 配置完整，guard 集成已就位；默认关闭 |
| Ponytail | 100% | **90%** | Phase 2 (基本完成) | 7 级阶梯/约束注入完整；缺 lint 规则集成 |
| 可验证性系统 | 100% | **100%** | Phase 2 (✅ 完成) | 四分类/E-SPEC-015/coverage/M2门控全部落地 |

---

## Phase 路线图进度

| Phase | 实现进度 | 范围 |
|-------|---------|------|
| Phase 1 MVP | **93%** | Spec(✅) + Change(✅,缺 Worktree isolation) + Guard(✅) + Rules 生成(✅) + AI 适配层(✅) |
| Phase 2 | **70%** | Ponytail(✅ 核心) + TDD(配置就位) + 认知框架(✅ 配置) + 可验证性系统(✅ 0.20) + CLI-first(✅ 0.20) |
| Phase 3 | **30%** | Knowledge CRUD/PageIndex/UA 分析(✅) + Code-graph(未开始) + Contract Layer(未开始) |
| Phase 4 | 0% | CI/CD + 全漂移检测 + 知识提取 + 文档生成 |
| Phase 5 | 0% | Skill 编排器 + Hyperplan + 生态分发 |

---

## 运行时状态字段

| 字段 | 当前值 | 说明 |
|------|--------|------|
| 可验证性门控 | enforcement_strict = true（默认 ON） | E-SPEC-015 默认阻断；opt-out 设 false 退回观察态 |
| dogfooding coverage | declared_ratio 100%（180 条约束） | 170 manual + 10 enforced-weak + 0 strong + 0 unverifiable |
| 图谱后端降级状态 | 内置（未启用 Code-graph） | 使用 PageIndex + 反向索引；SQLite 后端计划 Phase 3 |
| 高级特性启用状态 | 认知框架/Ponytail/可验证性 可用 | 认知框架默认关闭，Ponytail 核心完成，可验证性 M2 已翻闸 |
| CLI 命令 | 43+ 命令可用 | 新增 tasks next / lock-suite / state layer（0.20） |
| MCP Server 工具 | 25+ 工具可用 | 覆盖 spec/design/compliance/drift/guard/change/knowledge/constraints |

---

## 反馈汇总

> 数据来源: `feedback/user/` + `feedback/sessions/`,月度更新。
> 反馈流程详见 [docs/reference/feedback-process.md](reference/feedback-process.md)。

| 指标 | 本月 (2026-08) | 累计 |
|------|---------------|------|
| 用户反馈 - critical | 0 | 0 |
| 用户反馈 - major | 0 | 0 |
| 用户反馈 - minor | 0 | 0 |
| Session 摘要 | 0 | 0 |

---

## 引用约定

其他文档引用本文件时:
- `overview.md`: Phase 进度百分比引用本文件 §Phase 路线图进度
- `design.md`: 版本号引用本文件 §顶部元信息
- `packaging-deployment.md`: 发布通道与当前包版本引用本文件 §顶部元信息

更新本文件时:
- 每次实现进度变更后更新"最后更新日期"
- 设计完备性变更需同步更新设计文档版本号
- 每次发布 (任意通道) 后更新"当前包版本"与"发布通道"
- 每月 1 号更新 §反馈汇总表 (从 `feedback/` 目录聚合)
