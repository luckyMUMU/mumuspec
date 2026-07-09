# MumuSpec 设计文档索引

> **版本**: 0.10.0-draft | **日期**: 2026-07-09 | **状态**: 设计草案

本文档是 MumuSpec 设计文档组的入口索引。原单文件设计已按**渐进式披露**原则拆分为多层文档组，按阅读深度分层组织。

> **新增**: 0.8.0 引入 Contract Layer（契约层）和认知框架（乔哈里窗变体）。0.9.0 引入 Knowledge Layer（知识层）。0.10.0 合并 Code Graph Layer 到 Knowledge Layer 作为持久化知识来源，并引入 Ponytail 作为基础编码约束。

---

## 快速导航

### Level 0 — 全局概览（所有人）

| 文档 | 内容 |
|------|------|
| [概览](overview.md) | 目标用户画像、问题陈述、量化目标、非目标、设计假设、三大设计支柱、四大工作流规则、总体架构图、版本演进 |

### Level 1 — 架构层设计文档（实现者、使用者）

| 文档 | 所属层 | 核心内容 |
|------|--------|---------|
| [规范层](design/spec-layer.md) | Spec Layer | 树状分布双向约束 + Ponytail 基础编码约束、渐进式披露加载、spec.md/design.md/prohibitions.md 格式、继承规则、文档生成引擎 |
| [契约层](design/contract-layer.md) | Contract Layer | 外部服务契约 + 自身对外契约、YAML 格式、约束派生机制、版本管理与兼容性、漂移检测 |
| [变更层](design/change-layer.md) | Change Layer | 五阶段生命周期（Open→Design→Build→Verify→Archive）、认知框架集成、回退机制、预设路径（hotfix/tweak）、错误恢复决策树、边界条件、工件结构 |
| [知识层](design/knowledge-layer.md) | Knowledge Layer | 持久化知识来源：代码图谱（AST 知识图谱 + 规范-代码绑定）+ LLM-Wiki 知识页面模型 + PageIndex 索引系统 + 变更归档知识提取 |
| [校验层](design/guard-layer.md) | Guard Layer | Pre-commit/CI/Phase Guard 三层校验体系、性能指标矩阵、漂移检测类型、安全校验、可观测性、Git Hooks |
| [AI 集成层](design/ai-integration.md) | AI Integration Layer | 原生 Skill 编排器、外部 Skill 生态兼容、Rules 文件生成、MCP Server、CLI |

### Level 2 — 参考文档（操作者、CI 配置）

| 文档 | 内容 |
|------|------|
| [CLI 命令](reference/cli-commands.md) | 全部 CLI 命令参考（规范/变更/诊断引导/图谱/校验/契约/认知框架/知识/文档/测试） |
| [MCP 工具](reference/mcp-tools.md) | MCP Server 配置与工具列表（规范/图谱/校验/变更/测试/文档/契约/认知框架/知识） |
| [配置文件](reference/configuration.md) | 完整 config.yaml 配置项参考 |
| [Phase Guard 规则](reference/phase-guards.md) | 正向转换守卫 + 反向回退守卫 + 废弃/终态守卫（含认知框架和知识提取检查） |
| [漂移检测规则](reference/drift-detection.md) | 规范漂移、图谱漂移、测试不可变性漂移、契约漂移、知识漂移 |
| [认知框架](reference/cognitive-framework.md) | 乔哈里窗变体四象限认知框架（Q1-Q4）、工作流程、输出格式、Phase Guard 衔接 |
| [错误码参考](reference/error-codes.md) | 统一错误码体系（E-DOMAIN-XXX，含 DESIGN 域）、错误信息模板、`--force` 选项说明 |
| [发布与回滚策略](reference/release-strategy.md) | 版本策略、发布流程、灰度策略、回滚方案、兼容性保障 |
| [术语表](reference/glossary.md) | 核心术语中英文映射与定义 |
| [Skill 生态](reference/skill-ecosystem.md) | Skill 矩阵、分发协议、Hyperplan 7 阶段流程、决策记录 |

### Level 3 — 附录（深入了解者）

| 文档 | 内容 |
|------|------|
| [目录结构](appendix/directory-structure.md) | 完整项目目录结构示例 |
| [与参考项目对比](appendix/comparison.md) | 核心差异表、借鉴与增强、技术选型建议 |
| [实施路线图](appendix/roadmap.md) | Phase 1-5 实施计划、P0/P1/P2 优先级标注、DoD 验收标准、项目规划、运营成本评估 |
| [开放问题](appendix/open-questions.md) | 尚未解决的设计问题、Top 3 技术风险验证 Sprint |

---

## 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                    MumuSpec System                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │Spec Layer│◄►│Contract  │  │Change    │                  │
│  │规范层    │  │Layer     │  │Layer     │                  │
│  │SHALL/NOT │  │契约层    │  │变更层    │                  │
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
| 0.2.0 | — | 工作流规则：worktree 隔离、单一活跃变更、自顶向下设计 + 自下向上实现 |
| 0.3.0 | — | 状态机管理变更阶段，支持回退；Archive 增加 git 提交与合并请求 |
| 0.4.0 | — | 外部 Skill 生态兼容层 |
| 0.4.1 | — | 流程连贯性修复（状态机路径补全、回退计数修正、Phase Guard 补强） |
| 0.5.0 | — | 目录级设计文档（design.md）+ 文档生成引擎 |
| 0.6.0 | — | 红绿 TDD 开发规则 + 测试不可变性约束 |
| 0.7.0 | — | Hyperplan 对抗式规划 Skill + Skill 矩阵 + 决策记录（decisions.md） |
| 0.8.0 | 2026-07-09 | Contract Layer 契约层（外部服务契约 + 自身对外契约 + 漂移检测）；认知框架（乔哈里窗变体 Q1-Q4）集成到 Design 阶段；设计文档重构为渐进式披露文档组 |
| 0.9.0 | 2026-07-09 | Knowledge Layer 知识层（LLM-Wiki + PageIndex + 代码图谱集成）；全量审查修复（流程正确性、连贯性、持久化完整性） |
| 0.10.0 | 2026-07-09 | 合并 Code Graph Layer 到 Knowledge Layer 作为持久化知识来源；引入 Ponytail 作为基础编码约束 |
