# MumuSpec 设计文档索引

> **版本**: 0.15.0-draft | **日期**: 2026-08-05 | **状态**: 设计草案
>
> **设计完备性**: 100% | **实现进度**: ~87% | 详见 [STATUS.md](STATUS.md)

本文档是 MumuSpec 设计文档组的入口索引。按**渐进式披露**原则拆分为多层文档组。

---

## 快速导航

### Level 0 — 全局概览（所有人）

| 文档 | 内容 |
|------|------|
| [概览](overview.md) | 目标用户画像、核心目标、三大设计支柱、MVP 范围、版本演进 |
| [项目状态](STATUS.md) | 单一权威进度源：能力层进度表、Phase 路线图、运行时状态 |
| [上手指南](getting-started.md) | 安装、初始化、首个变更（CLI + AI 工具） |

### Level 1 — 架构层设计文档（实现者、使用者）

| 文档 | 所属层 | 核心内容 |
|------|--------|---------|
| [规范层](design/spec-layer.md) | Spec Layer | 树状双向约束 + Ponytail、渐进式披露、继承规则 |
| [契约层](design/contract-layer.md) | Contract Layer | 外部/对外契约、约束派生、版本管理、漂移检测 |
| [变更层](design/change-layer.md) | Change Layer | 五阶段生命周期、认知框架、回退、预设路径 |
| [知识层](design/knowledge-layer.md) | Knowledge Layer | 可插拔图谱后端 + LLM-Wiki + PageIndex + 知识提取 |
| [校验层](design/guard-layer.md) | Guard Layer | Pre-commit/CI/Phase Guard、漂移检测分级 |
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
| [错误码参考](reference/error-codes.md) | E-DOMAIN-XXX 统一错误码 |
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
│  │SHALL/NOT │  │Layer     │  │Layer     │                  │
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
│              └─────────────┘                                │
│                     │                                       │
│              ┌──────┴──────┐                                │
│              │AI Integration│  Skills / MCP / Rules          │
│              │Layer        │  CLI / Hooks                    │
│              └─────────────┘                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 版本变更记录

| 版本 | 日期 | 核心变更 |
|------|------|---------|
| 0.8.0 | 2026-07-09 | Contract Layer、认知框架 Q1-Q4、文档组重构 |
| 0.9.0 | 2026-07-09 | Knowledge Layer（LLM-Wiki + PageIndex + 图谱） |
| 0.10.0 | 2026-07-09 | Code Graph 合并到 Knowledge Layer、Ponytail 引入 |
| 0.11.0 | 2026-07-24 | 可插拔图谱后端、MVP 收敛、Skill Bridge |
| 0.12.0 | 2026-07-27 | 动态约束强度系统 |
| 0.12.1 | 2026-07-27 | constraints.yaml 树状层级化 |
| 0.12.2 | 2026-07-29 | Skill 驱动工作流编排 |
| 0.13.0 | 2026-08-02 | sync 命令、BOUNDARY.md 自动化 |
| 0.14.0 | 2026-08-04 | review 命令、D8 维度评分 |
| 0.15.0 | 2026-08-05 | Loop 模式、roadmap 机制、feedback 完善 |

---

## 文档维护规则

- **进度数据**：唯一权威来源是 [STATUS.md](STATUS.md)，其他文档引用它，不得自描述
- **版本号**：每个设计文档顶部标注设计版本和日期
- **附录**：Level 3 附录文档标注研究日期，仅作背景参考
- **删除文档**：不再维护的文档应当删除而非保留过期内容
