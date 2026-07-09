# MumuSpec 设计文档索引

> **版本**: 0.8.0-draft | **日期**: 2026-07-09 | **状态**: 设计草案

本文档是 MumuSpec 设计文档组的入口索引。原单文件设计已按**渐进式披露**原则拆分为多层文档组，按阅读深度分层组织。

> **新增**: 0.8.0 引入 Contract Layer（契约层），管理外部服务契约与自身对外契约。详见 [契约层设计](design/contract-layer.md)。

---

## 快速导航

### Level 0 — 全局概览（所有人）

| 文档 | 内容 |
|------|------|
| [概览](overview.md) | 问题陈述、三大设计支柱、四大工作流规则、总体架构图、版本演进 |

### Level 1 — 架构层设计文档（实现者、使用者）

| 文档 | 所属层 | 核心内容 |
|------|--------|---------|
| [规范层](design/spec-layer.md) | Spec Layer | 树状分布双向约束、渐进式披露加载、spec.md/design.md/prohibitions.md 格式、继承规则、文档生成引擎 |
| [契约层](design/contract-layer.md) | Contract Layer | 外部服务契约 + 自身对外契约、YAML 格式、约束派生机制、版本管理与兼容性、漂移检测 |
| [变更层](design/change-layer.md) | Change Layer | 五阶段生命周期（Open→Design→Build→Verify→Archive）、回退机制、预设路径（hotfix/tweak）、工件结构 |
| [代码图谱层](design/code-graph-layer.md) | Code Graph Layer | 知识图谱 Schema（含 Contract 节点）、MCP 工具、规范-代码绑定规则 |
| [校验层](design/guard-layer.md) | Guard Layer | Pre-commit/CI/Phase Guard 三层校验体系、漂移检测类型、Git Hooks |
| [AI 集成层](design/ai-integration.md) | AI Integration Layer | 原生 Skill 编排器、外部 Skill 生态兼容、Rules 文件生成、MCP Server、CLI |

### Level 2 — 参考文档（操作者、CI 配置）

| 文档 | 内容 |
|------|------|
| [CLI 命令](reference/cli-commands.md) | 全部 CLI 命令参考（规范/变更/图谱/校验/契约/文档/测试） |
| [MCP 工具](reference/mcp-tools.md) | MCP Server 配置与工具列表（规范/图谱/校验/变更/测试/文档/契约） |
| [配置文件](reference/configuration.md) | 完整 config.yaml 配置项参考 |
| [Phase Guard 规则](reference/phase-guards.md) | 正向转换守卫 + 反向回退守卫 + 废弃/终态守卫 |
| [漂移检测规则](reference/drift-detection.md) | 规范漂移、图谱漂移、测试不可变性漂移、契约漂移 |
| [Skill 生态](reference/skill-ecosystem.md) | Skill 矩阵、分发协议、Hyperplan 7 阶段流程、决策记录 |

### Level 3 — 附录（深入了解者）

| 文档 | 内容 |
|------|------|
| [目录结构](appendix/directory-structure.md) | 完整项目目录结构示例 |
| [与参考项目对比](appendix/comparison.md) | 核心差异表、借鉴与增强、技术选型建议 |
| [实施路线图](appendix/roadmap.md) | Phase 1-5 实施计划与版本里程碑对应 |
| [开放问题](appendix/open-questions.md) | 尚未解决的设计问题与当前倾向 |

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    MumuSpec System                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │Spec Layer│◄►│Contract  │  │Change    │  │Code Graph│   │
│  │规范层    │  │Layer     │  │Layer     │  │Layer     │   │
│  │SHALL/NOT │  │契约层    │  │变更层    │  │代码图谱层│   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │              │          │
│       └─────────────┴─────────────┴──────────────┘          │
│                           │                                 │
│                    ┌──────┴──────┐                          │
│                    │Guard Layer  │  CI/CD + CLI + Lint     │
│                    │校验层       │  Phase Guards + Drift    │
│                    └─────────────┘                          │
│                           │                                 │
│                    ┌──────┴──────┐                          │
│                    │AI Integration│  Skills / MCP / Rules   │
│                    │Layer        │  CLI / Hooks             │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 版本变更记录

| 版本 | 日期 | 核心变更 |
|------|------|---------|
| 0.2.0 | — | 工作流规则：worktree 隔离、单一活跃变更、自顶向下设计 + 自下向上实现 |
| 0.3.0 | — | 状态机管理变更阶段，支持回退；Archive 增加 git 提交与合并请求 |
| 0.4.0 | — | 外部 Skill 生态兼容层 |
| 0.4.1 | — | 流程连贯性修复（状态机路径补全、回退计数修正、Phase Guard 补强） |
| 0.5.0 | — | 目录级设计文档（design.md）+ 文档生成引擎 |
| 0.6.0 | — | 红绿 TDD 开发规则 + 测试不可变性约束 |
| 0.7.0 | — | Hyperplan 对抗式规划 Skill + Skill 矩阵 + 决策记录（decisions.md） |
| 0.8.0 | 2026-07-09 | Contract Layer 契约层（外部服务契约 + 自身对外契约 + 漂移检测）；设计文档重构为渐进式披露文档组 |
