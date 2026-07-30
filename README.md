# MumuSpec

> 树状双向约束规范系统，用"做什么"和"不做什么"两条轴线，约束 AI 编程的工作边界。

[![npm version](https://img.shields.io/npm/v/mumuspec)](https://www.npmjs.com/package/mumuspec) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

MumuSpec 通过 SHALL（必须做）与 MUST NOT（绝不能做）两套规范树，让 AI 编程工具（Claude Code / Cursor / Codex 等）在项目架构与需求的边界内工作，减少人工审查成本，提升 AI 生成代码的合规性。

当前版本：**0.12.1-alpha.0**（`next` 通道），稳定版 **0.10.0**（`latest`）。设计进度 100%，实现进度约 5%。详细路线图见 [STATUS.md](docs/STATUS.md)。

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
mcp                              # 见下方"MCP Server 配置"
#    5b. Rules 文件（兼容无 MCP 的 IDE）
#        运行后 CLAUDE.md / AGENTS.md 会自动生成到项目根目录

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
      "args": ["-y", "mumuspec-mcp"],
      "env": { "MUMUSPEC_ROOT": "${workspaceRoot}" }
    }
  }
}
```

配置完毕后，AI 可以调用以下工具：

| 工具 | 作用 |
|------|------|
| `get_spec_context` | 获取指定目录的规范上下文 |
| `search_specs` | 搜索规范 |
| `check_compliance` | 代码片段合规校验 |
| `detect_drift` | 检测规范与代码的漂移 |
| `get_change_status` | 查看变更状态 |
| `guard_check` | 阶段守卫 |

完整工具清单见 [docs/reference/mcp-tools.md](docs/reference/mcp-tools.md)。

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

```bash
mumuspec init [path]                                       # 初始化
mumuspec context <path>                                    # 查看目录规范上下文
mumuspec spec parse / validate                             # 规范解析 / 校验
mumuspec check                                             # 全量合规校验
mumuspec drift                                             # 漂移检测
mumuspec new <name> --workflow hotfix|tweak|full           # 创建变更
mumuspec status [name]                                     # 变更状态
mumuspec archive <name>                                    # 归档变更
mumuspec wizard                                            # 交互式引导
mumuspec doctor                                            # 环境诊断
```

完整命令列表见 [docs/reference/cli-commands.md](docs/reference/cli-commands.md)。

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

| 通道 | dist-tag | 用途 |
|------|---------|------|
| 稳定版 | `latest` | `npm install -g mumuspec` |
| 预发布版 | `next` | `npm install -g mumuspec@next` |
| 指定版本 | —— | `npm install -g mumuspec@0.12.1-alpha.0` |

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
