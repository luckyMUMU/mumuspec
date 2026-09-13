# MumuSpec

> 用自然语言写规范，不写代码。让 AI 把规范变成代码。

[![npm version](https://img.shields.io/npm/v/mumuspec)](https://www.npmjs.com/package/mumuspec) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**MumuSpec 是一门面向 Vibe Coding 的领域特定语言（DSL）。** 你用自然语言编写 Spec（规范），MumuSpec 把它校验为可执行的约束网络，AI 编程工具根据约束自动生成代码。

```
随意的自然语言  →  大模型起草精准 Spec  ⇄  设计缺陷时向人追问补全  →  大模型判定设计完备性（人签收）  →  代码（AI 生成）
```

**核心理念：设计决策权始终在人。** 人不再逐字编写 Spec 全文，只做设计决策与审批签收；Spec 由大模型起草、追问补全、判定完备性后交由 AI 生成代码。Spec 仍是一等源文件（人机合著），代码是衍生品。

当前版本：**0.25.0-alpha.0**（归档 delta 合并 fail-closed E-CHANGE-022、覆盖率清单修复路径提示）。详细状态见 [STATUS.md](docs/STATUS.md)。

---

## Quick Start

```bash
# 1. 安装 MumuSpec
npm install -g mumuspec

# 2. 快速上手（mumuspec onboard quickstart）
mumuspec onboard quickstart

# 3. 编写你的第一条 Spec（用自然语言）
#    在 .mumuspec/spec.md 或 src/api/.mumuspec/tech.md 中写 SHALL / SHALL NOT

# 4. 校验 Spec 格式 + 可验证性
mumuspec validate

# 5. 创建变更，让 AI 按 Spec 生成代码
mumuspec new my-first-change

# 6. AI 走完五阶段 → 归档
mumuspec archive my-first-change
```

> Spec 编写指南见 [docs/overview.md](docs/overview.md)。

---

## 设计理念

### 1. Spec 即一等源文件（Spec-as-Source）

Spec 不是从需求编译来的中间产物，而是**作者直接书写的一等语言**。可读性、可写性与诊断质量是语言设计的一等约束。

### 2. 双向约束（Dual Constraint）

SHALL 指明必达目标，SHALL NOT 划定不可逾越红线。约束关联 Enforcement 条目，通过 Lint / CI / Guard 自动校验。**不可验证的约束等于不存在的约束**（0.20 E-SPEC-015）。

### 3. 树状分布 + 渐进式披露（Tree Progressive）

Spec 按项目目录树分层存放，子层自动继承父层约束（可收紧、不可放宽）。AI 只加载当前工作目录的规范链，而非全量加载，显著降低 token 消耗。

### 4. 持久化 + 代码绑定（Code-Bound）

Spec 存储在 `.mumuspec/` 下，版本化管理，不随代码删除而消失。CI/CD 自动校验代码与规范的一致性，漂移检测覆盖 spec、graph、contract、knowledge 等维度。

### 5. 双维度动态约束强度（Dynamic Constraint Strength）

沿"技术设计 HOW"与"需求目标 WHAT"两条独立轴线组织约束，每轴线独立配置强度：high / medium / low。工作流规则按强度等级渐进式调整。

### 6. 为目标增加限制，但不限制过程（CHG-5）

> Spec 只约束 WHAT（验收标准、红线），不约束 HOW（执行路径）。AI 的执行自由度不被限制，但产出必须通过 Spec 校验。

### 7. 规则-实现分离（KP-0060）

引擎归代码（固定部分由代码实现）、规则归 LLM（仅创建声明式规则）、校验归代码（非法规则拒绝执行）。CLI-first 是其在流程层的特例。

---

## 核心概念：Spec 即 DSL

MumuSpec 的持久化 Spec 不是文档，不是配置，而是一门**领域特定语言**——带有语法、语义和诊断器的可执行语言（详见 [KP-0059 决策页](.mumuspec/knowledge/decisions/global/KP-0059-spec-as-dsl-not-bytecode.md)）。

### 语法面

| 语法元素 | 形态 | 示例 |
|----------|------|------|
| `## Requirement:` 块 | 顶层约束单元 | `## Requirement: 依赖管理` |
| `### SHALL` / `### SHALL NOT` | 极性声明 | `### SHALL NOT` `- 禁止引入未被请求的抽象层` |
| `### Enforcement` | 验证声明 | `- ENF-1: manual(code review 核对)` |
| `manual(原因)` | 人工验证保留字 | `- ENF-2: manual(无法自动验证的业务语义)` |
| frontmatter annotation | 机器可读注解 | `annotation: { type: no-new-dependency, scope: module }` |
| `constraints.yaml` | 结构化约束条目 | `{ id, content, min_strength, enforcement, category }` |
| 树状继承 | 子层可收紧不可放宽 | `layer: 1` 继承 `layer: 0` |

### 语义面

- **极性**：SHALL（必须做）× SHALL NOT（绝不能做）
- **维度**：技术设计 HOW × 需求目标 WHAT
- **强度**：high（block）/ medium（warn）/ low（info）
- **可验证性四分类**（0.20 P0）：
  - `enforced-strong` — annotation → AST 验证
  - `enforced-weak` — 正则兜底可提取
  - `manual` — 人工验证，归档前须有 evidence
  - `unverifiable` — 格式缺陷，SHALL NOT 恒 block

### 诊断面

`E-SPEC-*` 错误码即编译诊断。例如 `E-SPEC-015` = "红线约束未声明验证方式"——相当于类型错误。

---

## 工作流

MumuSpec 采用编排器-阶段 Skill 驱动模式，自动感知当前阶段并分发子命令：

```
Open → Design → Build → Verify → Archive
```

| 阶段 | 核心动作 | 关键产出 |
|------|---------|---------|
| **Open** | 需求探索、影响分析、变更创建 | `proposal.md`、`delta-specs/` |
| **Design** | 认知框架 Q1-Q4、自顶向下设计、测试锁定 | `design.md`、`test-cases/locked` |
| **Build** | 自底向上实现、红绿 TDD、Ponytail 合规 | 全部 green 测试 |
| **Verify** | 规范一致性校验、漂移检测、可验证性覆盖 | `verify.md`、enforcement coverage |
| **Archive** | Git 合并、规范归档、知识提取 | 知识索引更新、变更归档 |

### CLI-first 原则

确定性工作流步骤（阶段转换、guard 校验、hash 锁定、决策登记）必须通过 CLI 命令执行。LLM 只承担复杂决策域：需求澄清、设计创作、对抗审查、偏差接受建议。详见根 spec.md「流程执行载体」块。

### 预设路径

| 预设 | 适用场景 | 触发命令 |
|------|---------|---------|
| **hotfix** | Bug 修复，影响 ≤ 2 文件 | `mumuspec new <name> --workflow hotfix` |
| **tweak** | 小变更（配置微调），≤ 5 文件 | `mumuspec new <name> --workflow tweak` |

预设路径自动检测升级条件——一旦影响范围超出阈值，自动切换到完整工作流。

### 项目级工作流 override（CHG-7）

在 `.mumuspec/workflow.yaml` 中可对内置工作流做项目级覆盖（约束强度、工作流规则、TDD 模式等），未声明字段回落到内置默认。这是"规则归 LLM、校验归代码"在配置层的落地：项目只写声明式差异，引擎不改动。

---

## 核心规则

| # | 规则 | 含义 |
|---|------|------|
| 1 | **Worktree 隔离** | 每个变更在独立 worktree 中工作（配置级推荐，自动 worktree 操作在开发中） |
| 2 | **单一活跃变更** | 同时只允许一个活跃变更（per-scope） |
| 3 | **自顶向下设计，自底向上实现** | 设计从根到叶逐级细化，实现从叶到根逐级集成 |
| 4 | **红绿 TDD** | 测试用例是 Design 阶段的产出，Design 锁定后测试不可变更 |

> 规则 1–4 随约束强度等级动态调整：high 强制执行、medium 推荐 + 可降级、low 关闭。

---

## 安装

### 稳定版（推荐）

```bash
npm install -g mumuspec
```

### 预发布版（含最新功能）

```bash
npm install -g mumuspec@next
```

### 不全局安装，直接 npx

```bash
npx mumuspec init my-project
```

### Node.js 版本要求

Node.js >= 20.0.0。

---

## 快速上手

以下命令序列演示从零开始跑通一个变更的完整路径：

```bash
# 1. 在项目根目录初始化
cd /path/to/your-project
mumuspec init . --name my-app --language typescript

# 2. 查看环境依赖
mumuspec doctor

# 3. 编写 Spec（人工编写，自然语言 + 结构化语法）
#    在 .mumuspec/spec.md 写：
#    ## Requirement: 依赖管理
#    ### SHALL NOT
#    - 禁止引入 `lodash` 等未被请求的第三方依赖
#    ### Enforcement
#    - ENF-1: manual(依赖清单在 code review 逐项核对)

# 4. 校验 Spec 格式 + 可验证性覆盖率
mumuspec validate

# 5. 让 AI 编程工具加载 Spec（二选一）
#    5a. MCP Server（推荐，渐进式披露 + 实时校验）
#    5b. Rules 文件（canonical AGENTS.md + CLAUDE.md 薄壳桥接，自动生成）

# 6. 创建变更
mumuspec new my-first-change --workflow hotfix

# 7. AI 按 /mumuspec Skill 执行五阶段

# 8. 查看变更状态
mumuspec status

# 9. 归档
mumuspec archive my-first-change --confirm
```

---

## 概念简介

| 概念 | 作用 |
|------|------|
| **Spec（规范）** | 人工编写的领域特定语言，描述 SHALL / SHALL NOT 约束 |
| **可验证性四分类** | enforced-strong / enforced-weak / manual / unverifiable |
| **Spec 树** | 按目录分层存放 Spec，子层继承父层、可收紧不可放宽 |
| **渐进式披露** | AI 只加载当前工作目录的规范链，减少 token 消耗 |
| **变更（Change）** | Open → Design → Build → Verify → Archive 五阶段生命周期 |
| **Phase Guard** | 阶段转换时自动执行的阶段守卫校验 |
| **约束强度** | high / medium / low 三档，按团队成熟度动态调整 |
| **Ponytail** | 7 级优先级编码约束阶梯（YAGNI → 复用 → 标准库 → 平台特性 → 已有依赖 → 一行代码 → 最小实现） |
| **Skills** | 阶段编排器，把 AI 工具指引到子 Skill（TDD / Code Review 等） |

---

## AI 编程工具集成

### 方式一：MCP Server（推荐）

在 IDE / AI 工具 MCP 配置中加入：

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": ["-y", "mumuspec"],
      "env": { "MUMUSPEC_ROOT": "${workspaceRoot}" }
    }
  }
}
```

配置完毕后，AI 可以调用以下工具：

**Spec 与规范**

| 工具 | 作用 |
|------|------|
| `get_spec_context` | 获取指定目录的规范上下文（渐进式披露） |
| `search_specs` | 按关键词/范围/类型搜索规范 |
| `get_prohibitions` | 获取某范围的 SHALL NOT 禁止项（含继承） |
| `get_design_context` | 获取某范围的设计文档上下文 |
| `validate_specs` | 校验所有规范文件格式 + 可验证性覆盖率 |

**Guard 与校验**

| 工具 | 作用 |
|------|------|
| `check_compliance` | 代码合规校验（SHALL/SHALL NOT/Ponytail） |
| `detect_drift` | 检测规范与代码的漂移 |
| `guard_check` | 阶段守卫检查 |

**变更管理**

| 工具 | 作用 |
|------|------|
| `get_change_status` | 查看变更状态与状态机信息 |
| `list_changes` | 列出所有活跃变更 |

**知识层**

| 工具 | 作用 |
|------|------|
| `get_knowledge_context` | 获取某代码路径的知识上下文 |
| `search_knowledge` | 搜索知识页面 |
| `get_knowledge_page` | 获取指定 ID 的知识页面 |
| `verify_knowledge` | 验证知识页面新鲜度 |
| `analyze_impact` | 分析变更影响 |
| `generate_onboarding_path` | 生成新手引导学习路线 |
| `get_knowledge_coverage` | 获取知识覆盖率统计 |
| `find_knowledge_gaps` | 发现未覆盖的重要代码节点 |
| `detect_decision_deviation` | 检测代码偏差已确认决策 |
| `query_knowledge` | 知识库问答 |

完整工具清单与参数见 [docs/reference/mcp-tools.md](docs/reference/mcp-tools.md)。

### 方式二：Rules 文件（无 MCP 时的兼容方案）

MumuSpec 自动生成 AI Rules 文件到项目根目录。**AGENTS.md 是唯一 canonical 规则文件**（AAIF 托管事实标准），其余文件为薄壳桥接：

| 文件 | 角色 | IDE |
|------|------|-----|
| `AGENTS.md` | **canonical**（规范链摘要 + Ponytail + CLI + MCP 四节） | OpenCode / Codex / 通用 Agent |
| `CLAUDE.md` | 薄壳桥接（首行 `@AGENTS.md`） | Claude Code |
| `GEMINI.md` | 薄壳桥接（首行 `@AGENTS.md`） | Gemini CLI |

> 遗留格式 `.cursorrules` / `.windsurfrules` 已停止生成（C3 遗留格式禁令）。Cursor / Windsurf 用户请迁移到 AGENTS.md 读取。

Rules 文件包含项目规范、Ponytail 约束、工作流规则、优先级体系和 CLI 命令速查。通过 `mumuspec init` 或 `mumuspec install <agent>` 生成/更新。

### IDE 集成详细配置

- **Claude Code**：MCP JSON 写进 `~/.claude/settings.json` 或项目根 `.mcp.json`；规则读取 CLAUDE.md 薄壳
- **Cursor**：通过 AGENTS.md 或 MCP 加载规则
- **OpenCode / Codex / Gemini / Windsurf / GitHub Copilot**：工程根 `AGENTS.md`（canonical）
- **WorkBuddy / Trae / CatPaw**：`mumuspec install <agent>` 安装工作流 Skill 到对应技能目录

各 Agent 具体配置见 [docs/reference/agent-install-guide.md](docs/reference/agent-install-guide.md)。

---

## CLI 命令速查

**规范与校验**

```bash
mumuspec init [path]                                       # 初始化（项目分析 + 知识脚手架）
mumuspec context <path>                                    # 查看目录规范上下文（渐进式披露）
mumuspec validate                                          # 校验 Spec 格式 + 可验证性覆盖率
mumuspec check                                             # 全量合规校验
mumuspec drift [--change <name>]                              # 漂移检测（可限定变更范围）
mumuspec search <pattern>                                  # 搜索代码与规范节点
```

**变更与知识**

```bash
mumuspec new <name> --workflow hotfix|tweak|full           # 创建变更
mumuspec status [name]                                     # 变更状态
mumuspec list                                              # 列出活跃变更
mumuspec archive <name> --confirm                          # 归档变更
mumuspec discard <name>                                    # 废弃变更
mumuspec guard <change> <phase>                            # 阶段守卫检查
mumuspec state                                             # 状态机管理
mumuspec tasks next <name>                                 # 定位下一个未完成任务（0.20）
mumuspec test-cases lock-suite <name> --layer N            # 逐层套件 hash 锁定（0.20）
mumuspec state layer <name> <N> <status>                   # build_layers 状态更新（0.20）
mumuspec knowledge                                         # 知识库操作（list/search/context）
mumuspec onboard                                           # 新手引导学习路线
mumuspec chat [query]                                      # 知识库问答
```

**高级与管理**

```bash
mumuspec constraints                                       # 动态约束强度
mumuspec feedback                                          # 用户反馈管理
mumuspec install                                           # AI 工具技能与规则安装（10 agent：catpaw/claude/cursor/trae/workbuddy/opencode/codex/windsurf/gemini/copilot）
mumuspec hooks                                             # Git hooks 管理
mumuspec dashboard                                         # 实时状态仪表盘
mumuspec eval                                              # 评估场景运行
mumuspec i18n                                              # 国际化设置
mumuspec skill                                             # Skill 创作与管理
mumuspec bundle                                            # Skill 打包与发布
mumuspec env                                               # 环境检测
mumuspec finalize-archive <change>                         # 归档后清理（幂等，.finalized 防重跑）
mumuspec capability [command] [--json]                     # 命令能力元数据查询
mumuspec doctor                                            # 环境诊断
```

完整命令列表与参数见 [docs/reference/cli-commands.md](docs/reference/cli-commands.md)。

---

## 项目目录规划

初始化后，项目结构如下：

```
my-project/
├── .mumuspec/
│   ├── config.yaml              # 项目配置
│   ├── workflow.yaml            # 项目级工作流 override（可选，CHG-7）
│   ├── spec.md                  # 根层 Spec（Level 0，全局规则）
│   ├── goal.md                  # 产品目标（北极星指标）
│   ├── prd.md                   # 根层产品需求
│   ├── tech.md                  # 根层技术设计
│   ├── prohibitions.md          # SHALL NOT 汇总
│   ├── constraints.yaml         # 动态约束强度
│   ├── index.yaml               # 规范树索引
│   ├── changes/                 # 五阶段变更目录
│   │   └── <change-name>/
│   │       ├── .mumuspec.yaml   # 状态机字段
│   │       ├── proposal.md      # Open 阶段产出
│   │       ├── design.md        # Design 阶段产出
│   │       ├── test-cases/      # 测试用例（锁定后不可变更）
│   │       ├── delta-specs/     # 规范增量
│   │       ├── decisions.md     # 关键决策日志（CLI 管理）
│   │       ├── tasks.md         # 任务清单（机器可读）
│   │       └── verify.md        # Verify 阶段产出
│   ├── knowledge/               # 知识层（WHY + WHERE）
│   └── skills/                  # Skill 目录
├── src/
│   └── api/
│       └── .mumuspec/
│           ├── prd.md           # 子层产品需求
│           └── tech.md          # 子层技术设计
├── CLAUDE.md                    # Claude Code 规则（@AGENTS.md 薄壳，自动生成）
└── AGENTS.md                    # canonical Agent 规则（自动生成）
```

---

## 发布策略

| 通道 | dist-tag | 当前版本 | 安装命令 |
|------|---------|---------|---------|
| 稳定版 | `latest` | 0.19.1 | `npm install -g mumuspec` |
| 预发布版 | `next` | 0.19.2-alpha.11 | `npm install -g mumuspec@next` |

灰度策略见 [docs/reference/release-strategy.md](docs/reference/release-strategy.md)。

---

## 文档导航

| 文档 | 内容 |
|------|------|
| [docs/overview.md](docs/overview.md) | 系统设计总览、核心目标、用户画像 |
| [docs/STATUS.md](docs/STATUS.md) | 设计/实现进度权威数据 |
| [docs/getting-started.md](docs/getting-started.md) | 首次使用完整教程 |
| [docs/getting-started-agent.md](docs/getting-started-agent.md) | AI Agent 从零跑通首个变更 |
| [docs/reference/cli-commands.md](docs/reference/cli-commands.md) | CLI 命令参考 |
| [docs/reference/mcp-tools.md](docs/reference/mcp-tools.md) | MCP 工具参考 |
| [docs/reference/configuration.md](docs/reference/configuration.md) | config.yaml 完整 schema |
| [docs/reference/error-codes.md](docs/reference/error-codes.md) | 错误码参考（自动生成） |
| [docs/reference/packaging-deployment.md](docs/reference/packaging-deployment.md) | 打包、发布、安装 |
| [docs/reference/release-strategy.md](docs/reference/release-strategy.md) | 灰度与回退 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更日志 |
| [LICENSE](LICENSE) | MIT 许可证全文 |
| [demo/](demo/) | 示例项目 |

**更多参考**：

| 分组 | 文档 |
|------|------|
| 设计层（docs/design/） | [spec-layer](docs/design/spec-layer.md) · [change-layer](docs/design/change-layer.md) · [guard-layer](docs/design/guard-layer.md) · [knowledge-layer](docs/design/knowledge-layer.md) · [contract-layer](docs/design/contract-layer.md) · [constraint-strength](docs/design/constraint-strength.md) · [ai-integration](docs/design/ai-integration.md) · [设计总览](docs/design.md) |
| 参考层（docs/reference/ 其余） | [phase-guards](docs/reference/phase-guards.md) · [drift-detection](docs/reference/drift-detection.md) · [cognitive-framework](docs/reference/cognitive-framework.md) · [glossary](docs/reference/glossary.md) · [faq](docs/reference/faq.md) · [skill-ecosystem](docs/reference/skill-ecosystem.md) · [feedback-process](docs/reference/feedback-process.md) · [agent-install-guide](docs/reference/agent-install-guide.md) · [ai-tools-setup](docs/reference/ai-tools-setup.md) |
| 标准提案（docs/standards/） | [mcp-guard-drift-proposal](docs/standards/mcp-guard-drift-proposal.md) — MCP/Guard/Drift 标准化提案 |
| 附录（docs/appendix/） | [directory-structure](docs/appendix/directory-structure.md) · [comparison](docs/appendix/comparison.md) · [competitive-analysis-chapter](docs/appendix/competitive-analysis-chapter.md) · [mumuspec-meta-research-report](docs/appendix/mumuspec-meta-research-report.md) · [swot-strategic-analysis-report](docs/appendix/swot-strategic-analysis-report.md) · [ai-agent-ecosystem-research](docs/appendix/ai-agent-ecosystem-research.md) · [meta-evolution-analysis](docs/appendix/meta-evolution-analysis.md) · [mumuspec-ecosystem-comparison](docs/appendix/mumuspec-ecosystem-comparison.md) · [open-questions](docs/appendix/open-questions.md) |

---

## 参与贡献

1. Fork 仓库
2. 创建 `feature/xxx` 分支
3. 运行 `npm test` 与 `npm run lint` 确保本地化合规
4. 提交 PR，描述变更目的与影响范围

---

## 许可证

[MIT](LICENSE) © MumuSpec Contributors
