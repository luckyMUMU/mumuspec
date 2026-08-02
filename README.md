# MumuSpec

> 树状双向约束规范系统，用"做什么"和"不做什么"两条轴线，约束 AI 编程的工作边界。

[![npm version](https://img.shields.io/npm/v/mumuspec)](https://www.npmjs.com/package/mumuspec) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

MumuSpec 通过 SHALL（必须做）与 MUST NOT（绝不能做）两套规范树，让 AI 编程工具（Claude Code / Cursor / Codex 等）在项目架构与需求的边界内工作，减少人工审查成本，提升 AI 生成代码的合规性。

当前版本：**0.15.0-beta.0**（`next` 通道），稳定版 **0.10.0**（`latest`）。设计进度 100%，实现进度约 87%。详细路线图见 [STATUS.md](docs/STATUS.md)。

---

## 设计理念

MumuSpec 围绕四大设计支柱构建，将"AI 该做什么"与"绝不该做什么"编织成可执行的约束网络：

### 1. 双向约束（Dual Constraint）

通过 SHALL（必须做）与 SHALL NOT（绝不能做）两套规范树，定义 AI 工作的正负边界。正向约束指明必达目标，反向约束划定不可逾越的红线。每条规范均关联可执行的 Enforcement 条目，通过 Lint / CI / Guard 自动校验，杜绝"摆设文档"。

### 2. 树状分布 + 渐进式披露（Tree Progressive）

规范按项目目录树分层存放，子层自动继承父层约束（可收紧、不可放宽）。AI 只加载当前工作目录的规范链，而非全量加载，token 消耗较全量减少 60% 以上。冲突时高层级优先，保证全局一致性。

### 3. 持久化 + 代码绑定（Code-Bound）

规范存储在 `.mumuspec/` 下，版本化管理，不随代码删除而消失。CI/CD 自动校验代码与规范的一致性，漂移检测覆盖 spec、graph、contract、knowledge 等维度。Phase Guard 在每次阶段转换时强制执行门禁检查。

### 4. 双维度动态约束强度（Dynamic Constraint Strength）

沿"技术设计（HOW）"与"需求目标（WHAT）"两条独立轴线组织规范，每轴线独立配置约束强度：high（强制 block）、medium（推荐 warn）、low（关闭 info）。工作流规则按强度等级渐进式调整，适应不同团队成熟度与项目阶段。

---

## 核心规则

MumuSpec 的四条工作流规则按约束强度等级求值，贯穿变更生命周期的所有阶段：

| # | 规则 | 含义 |
|---|------|------|
| 1 | **Worktree 隔离** | 每个变更在独立 worktree 中工作，物理隔离主分支，支持零上下文恢复 |
| 2 | **单一活跃变更** | 同时只允许一个活跃变更，强制单一任务专注；并行须在跨 scope 目录 |
| 3 | **自顶向下设计，自底向上实现** | 设计从根到叶逐级细化，实现从叶到根逐级集成 |
| 4 | **红绿 TDD** | 测试用例是 Design 阶段的产出，Design 锁定后测试不可变更 |

> 规则 1–4 随约束强度等级动态调整：high 强制执行、medium 推荐 + 可降级、low 关闭。团队也可通过 `.mumuspec/config.yaml` 显式覆盖。

---

## 整体工作流程

MumuSpec 采用编排器-阶段 Skill 驱动模式（`/mumuspec` 入口），自动感知当前阶段并分发子命令：

```
Open → Design → Build → Verify → Archive
```

### 五阶段详解

| 阶段 | 核心动作 | 关键产出 |
|------|---------|---------|
| **Open** | 需求探索、worktree 隔离、影响分析、变更创建 | `proposal.md`、`delta-specs/`、`impact-analysis.json` |
| **Design** | 认知框架 Q1-Q4、自顶向下逐层设计、Hyperplan 对抗审查、测试锁定 | `design.md`、`test-cases/locked` |
| **Build** | 自底向上逐层实现、红绿 TDD、Ponytail 合规检查、Phase Guard | 全部 green 测试、`delta-specs/` 增量规范 |
| **Verify** | 规范一致性校验、漂移检测、测试不可变性、分支选择 | `verify-report.md`、无 critical drift |
| **Archive** | Git 合并、规范归档、知识提取、worktree 清理 | 知识索引更新、变更归档至 `archive/` |

### 预设路径

MumuSpec 提供两条快速预设，可跳过 Design 阶段以加速简单变更：

| 预设 | 适用场景 | 触发命令 |
|------|---------|---------|
| **hotfix** | Bug 修复，影响 ≤ 2 文件，不涉及架构变更 | `mumuspec new <name> --workflow hotfix` |
| **tweak** | 小变更（配置微调、简单增删），≤ 5 文件 | `mumuspec new <name> --workflow tweak` |

预设路径在阶段结束前自动检测**升级条件**——一旦影响范围超出预设阈值（如涉及多文件、架构变更、新增 API 等），自动切换到完整工作流。

### 编排机制

用户调用 `/mumuspec`（或 `mumuspec skill`）后，编排器自动：

1. 检测是否存在活跃变更，若无则路由至 `phase-open`
2. 若有活跃变更，按当前 `phase` 字段分发至对应阶段 Skill
3. 各阶段 Skill 内通过 Phase Guard 门禁校验，通过后方可推进至下一阶段
4. 同时检测预设条件，满足 hotfix/tweak 则走快速路径

社区 Skill（如 Brainstorming、Hyperplan、TDD）通过 Skill Bridge 挂入各阶段，形成完整的 AI 编程流水线。

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

# 2. 查看环境依赖是否具备
mumuspec doctor

# 3. 创建第一条规范（正向 + 反向约束）
mumuspec add-spec src/api --type shall
mumuspec add-spec src/api --type shall-not

# 4. 校验规范格式
mumuspec validate

# 5. 让 AI 编程工具自动加载规范（二选一）
#    5a. MCP Server（推荐，支持渐进式披露与实时校验）
#        安装 mumuspec 后, MCP 工具自动可用（见上方"MCP Server 配置"）
#    5b. Rules 文件（兼容无 MCP 的 IDE）
#        init 时自动生成 CLAUDE.md / .cursorrules / AGENTS.md

# 6. 创建首个变更
mumuspec new my-first-change --workflow hotfix

# 7. 让 AI 按 /mumuspec-hotfix Skill 执行（会自动分发子步骤）

# 8. 查看变更状态
mumuspec status

# 9. 归档并提交
mumuspec archive my-first-change
```

三步走则：`init` → `add-spec` → `new` → 让 AI 走完五阶段 → `archive`。完整的"首个 hotfix 演练"见 [docs/tutorial.md](docs/tutorial.md)。

---

## 概念简介

| 概念 | 作用 |
|------|------|
| **规范（Spec）** | SHALL / SHALL NOT 描述 AI 必须做和绝不能做的行为 |
| **规范树** | 按目录分层存放规范，子层继承父层、可收紧不可放宽 |
| **渐进式披露** | AI 只加载当前工作目录的规范链，减少 token 消耗 |
| **变更（Change）** | Open → Design → Build → Verify → Archive 五阶段生命周期 |
| **Phase Guard** | 阶段转换时自动执行的校验门禁 |
| **约束强度** | high / medium / low 三档，按团队成熟度动态调整工作流严格度 |
| **Ponytail** | 7 级优先级编码约束阶梯（YAGNI → 复用 → 标准库 → 平台特性 → 已有依赖 → 一行代码 → 最小实现） |
| **Skills** | 阶段编排器，把 AI 工具指引到外部子 Skill（TDD / Code Review / Brainstorming 等） |

详细说明见 [docs/overview.md](docs/overview.md)。

---

## AI 编程工具集成

### 方式一：MCP Server（推荐，渐进式披露 + 实时校验）

在你的 IDE / AI 工具 MCP 配置中加入：

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": ["-y", "mumuspec@next"],
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
| `validate_specs` | 校验所有规范文件格式 |

**Guard 与校验**

| 工具 | 作用 |
|------|------|
| `check_compliance` | 代码合规校验（SHALL/SHALL NOT/Ponytail） |
| `detect_drift` | 检测规范与代码的漂移 |
| `guard_check` | 阶段门禁检查 |

**变更管理**

| 工具 | 作用 |
|------|------|
| `get_change_status` | 查看变更状态与状态机信息 |
| `list_changes` | 列出所有活跃变更 |

**知识层**

| 工具 | 作用 |
|------|------|
| `get_knowledge_context` | 获取某代码路径的知识上下文（渐进式加载） |
| `search_knowledge` | 搜索知识页面 |
| `get_knowledge_page` | 获取指定 ID 的知识页面 |
| `verify_knowledge` | 验证知识页面新鲜度 |
| `analyze_impact` | 分析变更影响（UA 风格） |
| `generate_onboarding_path` | 生成新手引导学习路线 |
| `get_knowledge_coverage` | 获取知识覆盖率统计 |
| `find_knowledge_gaps` | 发现未覆盖的重要代码节点 |
| `detect_decision_deviation` | 检测代码偏差已确认决策 |
| `query_knowledge` | 知识库问答 |

完整工具清单与参数见 [docs/reference/mcp-tools.md](docs/reference/mcp-tools.md)。

### 方式二：Rules 文件（无 MCP 时的兼容方案）

MumuSpec 自动生成 AI Rules 文件到项目根目录：

| 文件 | IDE |
|------|-----|
| `CLAUDE.md` | Claude Code |
| `.cursorrules` | Cursor |
| `AGENTS.md` | OpenCode / 通用 Agent |

Rules 文件包含项目规范、Ponytail 约束、工作流规则、优先级体系和 CLI 命令速查。IDE 自动加载后，AI 即可遵循约束产出代码。

### IDE 集成详细配置

- **Claude Code**：把 MCP JSON 写进 `~/.claude/settings.json` 或项目根 `.mcp.json`
- **Cursor**：工程根放 `.cursorrules`，Cursor 全自动加载
- **OpenCode**：工程根放 `AGENTS.md`
- **Codex**：工程根放 `AGENTS.md`，配合环境变量传入 MCP

各 IDE 具体配置见 [docs/getting-started-agent.md](docs/getting-started-agent.md)。

---

## CLI 命令速查

**规范与校验**

```bash
mumuspec init [path]                                       # 初始化（项目分析 + 知识架脚手架）
mumuspec context <path>                                    # 查看目录规范上下文（渐进式披露）
mumuspec add-spec <scope> --type shall|shall-not          # 添加规范
mumuspec validate                                          # 校验所有规范格式
mumuspec check                                             # 全量合规校验
mumuspec drift                                             # 漂移检测
mumuspec search <pattern>                                  # 搜索代码与规范节点
```

**变更与知识**

```bash
mumuspec new <name> --workflow hotfix|tweak|full           # 创建变更
mumuspec status [name]                                     # 变更状态
mumuspec list                                              # 列出活跃变更
mumuspec archive <name>                                    # 归档变更
mumuspec discard <name>                                    # 废弃变更
mumuspec guard <change> <phase>                            # 阶段门禁检查
mumuspec state                                             # 状态机管理
mumuspec test-cases                                        # 测试用例管理
mumuspec knowledge                                         # 知识库操作（list/search/context）
mumuspec impact                                            # 变更影响分析（UA 风格）
mumuspec onboard                                           # 新手引导学习路线
mumuspec chat [query]                                      # 知识库问答
```

**高级与管理**

```bash
mumuspec constraints                                       # 动态约束强度（0.12.1+）
mumuspec feedback                                          # 用户反馈管理
mumuspec install                                           # AI 工具技能安装
mumuspec hooks                                             # Git hooks 管理
mumuspec dashboard                                         # 实时状态仪表盘
mumuspec eval                                              # 评估场景运行
mumuspec i18n                                              # 国际化设置
mumuspec skill                                             # Skill 创作与管理
mumuspec bundle                                            # Skill 打包与发布
mumuspec env                                               # 环境检测
mumuspec finalize-archive <change>                         # 归档后清理
mumuspec doctor                                            # 环境诊断
```

完整命令列表与参数见 [docs/reference/cli-commands.md](docs/reference/cli-commands.md)。

---

## 项目目录规划

初始化后，项目结构如下：

```
my-project/
├── .mumuspec/
│   ├── config.yaml              # 项目配置（规范路径/约束强度等）
│   ├── spec.md                  # 根层规范（Level 0）
│   ├── design.md                # 根层设计文档
│   ├── constraints.yaml         # 动态约束强度（可选）
│   ├── index.yaml               # 规范树索引
│   ├── changes/                 # 五阶段变更目录
│   │   └── <change-name>/
│   │       ├── .mumuspec.yaml   # 状态机字段
│   │       ├── proposal.md      # Open 阶段产出
│   │       ├── design.md        # Design 阶段产出
│   │       ├── test-cases/      # Design 阶段产出（锁定后不可变更）
│   │       ├── delta-specs/     # Open 阶段规范增量
│   │       ├── decisions.md     # 关键决策日志
│   │       └── verify.md        # Verify 阶段产出
│   ├── knowledge/               # 知识层（LLM-Wiki）
│   └── skills/                  # Skill 目录
├── src/
│   └── api/
│       └── .mumuspec/
│           ├── spec.md         # 子层规范
│           └── design.md       # 子层设计
├── CLAUDE.md                    # Claude Code 规则（自动生成）
├── .cursorrules                 # Cursor 规则（自动生成）
└── AGENTS.md                    # 通用 Agent 规则（自动生成）
```

---

## 发布策略

| 通道 | dist-tag | 当前版本 | 安装命令 |
|------|---------|---------|---------|
| 稳定版 | `latest` | 0.10.0 | `npm install -g mumuspec` |
| 预发布版 | `next` | 0.15.0-beta.0 | `npm install -g mumuspec@next` |
| 指定版本 | —— | —— | `npm install -g mumuspec@0.15.0-beta.0` |

灰度策略（Canary → Beta → RC → Stable）见 [docs/reference/release-strategy.md](docs/reference/release-strategy.md)。

---

## 文档导航

| 文档 | 内容 |
|------|------|
| [docs/overview.md](docs/overview.md) | 系统设计总览、四大支柱、用户画像 |
| [docs/getting-started.md](docs/getting-started.md) | 首次使用完整教程（终端用户） |
| [docs/getting-started-agent.md](docs/getting-started-agent.md) | AI Agent 从零跑通首个变更 |
| [docs/tutorial.md](docs/tutorial.md) | Demo 项目分步演练 |
| [docs/reference/cli-commands.md](docs/reference/cli-commands.md) | CLI 命令参考 |
| [docs/reference/mcp-tools.md](docs/reference/mcp-tools.md) | MCP 工具参考 |
| [docs/reference/configuration.md](docs/reference/configuration.md) | config.yaml 完整 schema |
| [docs/reference/packaging-deployment.md](docs/reference/packaging-deployment.md) | 打包、发布、安装 |
| [docs/reference/release-strategy.md](docs/reference/release-strategy.md) | 灰度与回滚 |
| [docs/STATUS.md](docs/STATUS.md) | 设计/实现进度权威数据 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更日志 |
| [LICENSE](LICENSE) | MIT 许可证全文 |
| [demo/](demo/) | Task API 示例项目 |

---

## 参与贡献

1. Fork 仓库
2. 创建 `feature/xxx` 分支
3. 运行 `npm test` 与 `npm run lint` 确保本地化合规
4. 提交 PR，描述变更目的与影响范围

---

## 许可证

[MIT](LICENSE) © MumuSpec Contributors
