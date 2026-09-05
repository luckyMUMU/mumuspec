# MumuSpec 设计文档索引

> **版本**: 0.20.0-draft | **日期**: 2026-08-29 | **状态**: 设计草案
>
> **定位**: Spec 即 DSL — 人工编写规范，AI 生成代码。详见 [KP-0059](../.mumuspec/knowledge/decisions/global/KP-0059-spec-as-dsl-not-bytecode.md)。
>
> 详细进度见 [STATUS.md](STATUS.md)。

MumuSpec 的持久化 Spec 不是文档，而是一门**领域特定语言（DSL）**——语法面（结构 schema）、语义面（判定规则）、诊断面（错误码）三件套。本文档是设计文档组的入口索引。

---

## 快速导航

### Level 0 — 全局概览（所有人）

| 文档 | 内容 |
|------|------|
| [概览](overview.md) | 核心目标、Spec 即 DSL 定位、用户画像、设计支柱 |
| [项目状态](STATUS.md) | 单一权威进度源：能力层进度表、Phase 路线图 |
| [上手指南](getting-started.md) | 安装、初始化、首次变更（CLI + AI 工具） |

### Level 1 — 架构层设计文档（实现者、使用者）

| 文档 | 所属层 | 核心内容 |
|------|--------|---------|
| [规范层](design/spec-layer.md) | Spec Layer | 树状双向约束 + Ponytail、渐进式披露、继承规则、可验证性四分类 |
| [约束强度](design/constraint-strength.md) | Constraint Strength | TD/RG 双维度 × high/medium/low；§9.0 可验证性前置判定（P0） |
| [变更层](design/change-layer.md) | Change Layer | 五阶段生命周期、认知框架、回退、预设路径、CLI-first |
| [契约层](design/contract-layer.md) | Contract Layer | 外部/对外契约、约束派生、版本管理、漂移检测 |
| [知识层](design/knowledge-layer.md) | Knowledge Layer | Code Graph + LLM-Wiki + PageIndex |
| [校验层](design/guard-layer.md) | Guard Layer | Pre-commit/CI/Phase Guard、漂移检测分级、enforcement coverage |
| [AI 集成层](design/ai-integration.md) | AI Integration | AIToolAdapter、Skill 编排、Rules 生成、MCP Server |

### Level 2 — 参考文档（操作者、CI 配置）

| 文档 | 内容 |
|------|------|
| [CLI 命令](reference/cli-commands.md) | 全部 CLI 命令参考 |
| [MCP 工具](reference/mcp-tools.md) | MCP Server 配置与工具列表 |
| [配置文件](reference/configuration.md) | 完整 config.yaml 参考 |
| [Phase Guard 规则](reference/phase-guards.md) | 工作流守卫 + 漂移检测 + 回退守卫 |
| [漂移检测规则](reference/drift-detection.md) | 12 种漂移检测 (P0/P1/P2) |
| [认知框架](reference/cognitive-framework.md) | Q1-Q4 乔哈里窗变体 |
| [错误码参考](reference/error-codes.md) | E-DOMAIN-XXX 统一错误码（自动生成） |
| [发布策略](reference/release-strategy.md) | 版本、灰度、回退 |
| [术语表](reference/glossary.md) | 核心术语映射 |
| [Skill 生态](reference/skill-ecosystem.md) | Skill 矩阵 + Hyperplan |
| [反馈流程](reference/feedback-process.md) | 反馈收集与处理 |
| [FAQ](reference/faq.md) | 常见问题 |
| [Agent 安装指南](reference/agent-install-guide.md) | AI 工具适配安装 |
| [AI 工具配置](reference/ai-tools-setup.md) | Cursor / Claude 等配置 |
| [打包部署](reference/packaging-deployment.md) | npm 打包与分发 |

### Level 3 — 附录（研究参考）

> 以下为设计阶段的研究报告和历史分析，**内容反映特定时间点的研究结论**，仅作背景参考。
> 项目当前状态以 [STATUS.md](STATUS.md) 为准。

| 文档 | 内容 | 日期 |
|------|------|------|
| [SWOT 战略分析](appendix/swot-strategic-analysis-report.md) | 内外部优劣势、战略建议 | 2026-08 |
| [AI Agent 生态调研](appendix/ai-agent-ecosystem-research.md) | Skills 工程化、SDD、记忆层等五大方向 | 2026-08 |
| [生态对标深度报告](appendix/mumuspec-ecosystem-comparison.md) | 8 个对标项目六维度对比 | 2026-08 |
| [竞品分析章节](appendix/competitive-analysis-chapter.md) | 竞品矩阵与技术选型 | 2026-08 |
| [元进化分析](appendix/meta-evolution-analysis.md) | 自进化系统理论脉络 | 2026-08 |
| [MumuSpec 元研究报告](appendix/mumuspec-meta-research-report.md) | 元进化视角下的定位分析 | 2026-08 |
| [目录结构参考](appendix/directory-structure.md) | 项目目录结构示例 | 2026-07 |
| [开放问题](appendix/open-questions.md) | 未解决的设计问题 | 2026-07 |
| [项目对比](appendix/comparison.md) | Superpowers / Comet / OpenSpec 对比 | 2026-07 |

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    MumuSpec System                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │Spec Layer│◄►│Contract  │  │Change    │                  │
│  │DSL       │  │Layer     │  │Layer     │                  │
│  │SHALL/NOT │  │          │  │          │                  │
│  │+Ponytail │  │          │  │          │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │             │             │                         │
│       └─────────────┴─────────────┘                         │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │Knowledge    │  Code Graph (HOW)              │
│              │Layer 知识层 │  LLM-Wiki (WHY)                │
│              │             │  PageIndex (WHERE)             │
│              └─────────────┘                                │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │Guard Layer  │  CI/CD + CLI + Lint            │
│              │校验层       │  Phase Guards + Drift           │
│              │             │  Enforcement Coverage           │
│              └─────────────┘                                │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │AI Integration│  Skills / MCP / Rules          │
│              │Layer        │  CLI / Hooks                    │
│              └─────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

**核心信息流**：人工编写 Spec → Spec 经 Guard 校验 → AI 按 Spec 生成代码 → 代码经 Guard 校验一致性 → 归档提取知识。

---

## 关键设计决策

| 决策 | 日期 | 内容 | 决策页 |
|------|------|------|--------|
| Spec 即 DSL | 2026-08-29 | 持久化 spec 是一门带 verifier 的领域特定语言，不是字节码式中间表示 | [KP-0059](../.mumuspec/knowledge/decisions/global/KP-0059-spec-as-dsl-not-bytecode.md) |
| Verifier 语义收紧 | 2026-08-29 | 可验证性四分类、SHALL NOT 无验证通道恒 block（E-SPEC-015） | `review/proposal-verifier-semantics-2026-08-29.md` |
| CLI-first 流程载体 | 2026-08-29 | 确定性步骤通过 CLI 执行，LLM 只承担决策域 | `review/pipeline-cli-first-analysis-2026-08-29.md` |
| CHG-5 原则 | 2026-08 | 为目标增加限制，但不限制过程（结果约束优先，行为约束 advisory） | `docs/design/constraint-strength.md` §1.3 |

---

## 版本变更记录

| 版本 | 日期 | 核心变更 |
|------|------|---------|
| 0.20.0-dev | 2026-08-29 | Verifier 语义收紧（P0）、CLI-first 三命令、Spec 即 DSL 定位（KP-0059）、可验证性四分类 |
| 0.19.1 | 2026-08-22 | 安全加固（Token 认证、YAML 安全配置）、spec annotate 命令 |
| 0.15.0 | 2026-08-01 | Mode-aware Guard、Spec Scaffolder、Git 封装、Dashboard |
| 0.13.0 | 2026-07-15 | Bundle-based Skill 系统、Env Detector、Init Generator |
| 0.12.0 | 2026-07-27 | 动态约束强度系统、constraints.yaml 树状层级化 |
| 0.10.0 | 2026-07-10 | 初始 MVP：六层架构、树状双向约束、五阶段状态机 |

---

## 文档维护规则

- **进度数据**：唯一权威来源是 [STATUS.md](STATUS.md)，其他文档引用它，不得自描述
- **版本号**：每个设计文档顶部标注设计版本和日期
- **附录**：Level 3 附录文档标注研究日期，仅作背景参考
- **删除文档**：不再维护的文档应当删除而非保留过期内容
- **Spec 即 DSL**：Spec 不是文档也不是配置，是一等源文件；可读性、可写性与诊断质量是语言设计的一等约束
