---
id: "KL-0007"
title: "Agent QuickStart — 让 AI 跑通你的第一个 MumuSpec 变更"
type: lesson
status: confirmed
scope: "imported"
tags:
  - imported
  - docs
  - tutorial
  - getting-started
source: "docs/getting-started-agent.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# Agent QuickStart — 让 AI 跑通你的第一个 MumuSpec 变更

> **Source**: `docs/getting-started-agent.md` | **Type**: docs | **Imported**: 2026-07-31

## Summary

> 本文面向使用 AI 编程工具（Claude Code / Cursor / Codex / OpenCode 等）的开发者。目标：从安装 CLI 到完成第一个真实 hotfix，全程可复制。

## Original Content

# Agent QuickStart — 让 AI 跑通你的第一个 MumuSpec 变更

> 本文面向使用 AI 编程工具（Claude Code / Cursor / Codex / OpenCode 等）的开发者。目标：从安装 CLI 到完成第一个真实 hotfix，全程可复制。

预计耗时：**15–30 分钟**。完成后，你的 AI 将自动按规范树加载约束、在五阶段工作流内推进变更、并实时校验代码是否符合 SHALL / SHALL NOT。

---

## 你想要达成什么

一个完整的闭环体验：

1. 在项目中启用 MumuSpec
2. 让 AI 工具感知项目规范（SHALL / SHALL NOT / Ponytail）
3. 让 AI 在五阶段工作流内自主完成一次 hotfix
4. 实时校验 AI 产出的代码没有违反约束

本教程采用** hotfix 预设路径**（最短路径），适合第一次跑通完整旅程。

---

## 前提条件

- Node.js >= 20
- Git 仓库（MumuSpec 强制依赖 Git）
- 任意 AI 编程工具（本教程以 Claude Code 为主，Cursor / OpenCode 的差异会在对应小节给出）

---

## 安装 MumuSpec CLI 与 MCP Server

打开终端，执行：

```bash
# 全局安装 CLI
npm install -g mumuspec

# 验证安装
mumuspec --version            # 应输出 0.12.1-alpha.0 或更新
mumuspec-mcp --version        # 应输出相同版本
```

> 只想在单个项目中用？把 `-g` 去掉，改用 `npm install --save-dev mumuspec`。后续命令改用 `npx mumuspec`。

---

## 在你的项目中启用 MumuSpec

```bash
# 进入项目目录
cd /path/to/your-project

# 初始化 MumuSpec（会自动创建 .mumuspec/ 目录结构）
mumuspec init . --name my-app --language typescript

# 验证环境依赖
mumuspec doctor
```

初始化完成后，`.mumuspec/` 下会出现 `config.yaml`、`index.yaml`、空 `spec.md`、`design.md`、`prohibitions.md`。这是规范树的根。

---

## 写第一条规范

为了让 AI 有所约束，先写两条最简单的规范：

**正向约束（SHALL）**：在 `.mumuspec/spec.md` 里写：

```markdown
# 项目规范

## SHALL

- API 端点返回统一 JSON 格式 `{ code, data, message }`
- 写入操作必须做参数验证

## SHALL NOT

- 禁止在处理函数内部直接访问数据库（必须走 storage 层）
```

保存后运行：

```bash
mumuspec validate
```

看到 `✓ 规范格式正确` 即表示校验通过。

---

## 把规范暴露给 AI 工具（两条路径二选一）

### 方式 A：MCP Server（推荐，渐进式披露 + 实时校验）

在项目根目录创建 `.mcp.json`（项目级）或 `~/.claude/settings.json`（用户级）：

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": [-y, "mumuspec-mcp"],
      "env": { "MUMUSPEC_ROOT": "${workspaceRoot}" }
    }
  }
}
```

重新加载 AI 工具后，AI 即可通过 MCP 调用 `get_spec_context`、`check_compliance`、`detect_drift` 等工具，实时感知规范树。

> Claude Code：把上述 JSON 粘贴进 `~/.claude/settings.json` 即可；Cursor：在项目根 `.cursor/mcp.json` 中添加；OpenCode：参考 IDE 集成文档。

### 方式 B：Rules 文件（无 MCP 的 IDE 可用）

让 MumuSpec 自动生成：

```bash
mumuspec init . --generate-rules
```

随后项目根会出现：

- `CLAUDE.md` — Claude Code 专用（会自动加载）
- `.cursorrules` — Cursor 专用
- `AGENTS.md` — 通用 Agent 规则

这些文件包含项目规范、Ponytail 约束、工作流规则与命令速查。把 AI 工具指向项目根目录即可自动加载。

> 如果你已经执行过 `mumuspec init`，这三个文件应该已经存在；否则用 `--generate-rules` 参数强制重新生成。

---

## 让 AI 完成第一个 hotfix

现在万事俱备。打开 AI 工具，向 AI 发送：

> "用 MumuSpec 帮我处理一个 bug：创建任务接口没有验证 title 为空的情况，请按 /mumuspec-hotfix 流程处理。"

**如果你使用 MCP Server**，AI 会自动调用 `get_spec_context` 拿到当前规范，然后按 hotfix Skill 路径推进：需求澄清 → 影响分析 → 代码修复 → 验证 → 归档。

**如果你使用 Rules 文件**，AI 读到 CLAUDE.md 里的工作流说明后，主动运行 `mumuspec new add-title-validation --workflow hotfix` 启动变更。

期间你可以用以下命令观察进度：

```bash
mumuspec status                       # 查看当前变更状态
mumuspec context src/api              # 查看 AI 当前路径加载的规范
mumuspec check --shall                # 校验 SHALL 合规
mumuspec check --shall-not            # 校验 SHALL NOT 合规
```

当 AI 完成热修复后，执行归档：

```bash
mumuspec archive add-title-validation
```

归档会触发最终漂移检测、合并提交、提取知识到 `knowledge/`、清理 worktree。至此，第一个完整 hotfix 结束。

---

## 关键命令速查

| 场景 | 命令 |
|------|------|
| 初始化 | `mumuspec init .` |
| 诊断环境 | `mumuspec doctor` |
| 新建变更 | `mumuspec new <name> --workflow hotfix` |
| 查看状态 | `mumuspec status` |
| 校验规范 | `mumuspec validate` |
| 合规检查 | `mumuspec check` |
| 漂移检测 | `mumuspec drift` |
| 归档变更 | `mumuspec archive <name>` |
| 废弃变更 | `mumuspec discard <name>` |
| 交互式引导 | `mumuspec wizard` |
| 渐进式披露查看 | `mumuspec context <path>` |

完整命令文档：[reference/cli-commands.md](reference/cli-commands.md)

---

## 让 AI 遵守 Ponytail 编码规范

MumuSpec 默认把 Ponytail 7 级阶梯写入规范，AI 编码时会按优先级判断：

1. 这段代码（方法）需要存在吗？——不需要则不写（YAGNI）
2. 代码库已经有可复用实现吗？——有则复用
3. 标准库已经提供吗？——有则用标准库
4. 平台原生特性支持吗？——有则用平台特性
5. 已安装的依赖能完成吗？——有则用已有依赖
6. 能一行写完吗？——有则不过度抽象
7. 以上都不满足？——写最小可工作代码

AI 代码完成后的 `ponytail:` 注释是它"有意简化"的标记，便于人工复核。

---

## 进阶配置（可选）

### 调整约束强度

对于老练团队或维护期项目，可以降低工作流严格度：

```yaml
# .mumuspec.yaml
constraint_strength:
  technical_design: medium
  requirement_goals: low
```

三档含义：`high` = AI 严格遵循（block），`medium` = 推荐遵循（warn,可跳过），`low` = 关闭（info）。
详见 [design/constraint-strength.md](design/constraint-strength.md)。

### 分层规范

对于大型项目，按目录拆解规范，子目录自动继承父层规范、可收紧不可放宽：

```bash
# 在子目录创建规范（Level 2）
mumuspec add-spec src/api --type shall
```

MumuSpec 按"渐进式披露"原则，只在 AI 处理 `src/api/` 路径时加载对应规范链，减少 token 消耗。

### 启用高级特性

```bash
mumuspec config enable ponytail             # 启用 Ponytail 编码约束
mumuspec config enable cognitive-framework  # 启用认知框架 Q1-Q4
mumuspec config enable contract-layer       # 启用契约层
```

特性默认渐进式开启，首次使用建议只开 `ponytail`。

---

## 常见问题

### AI 没有按 Skill 流程工作？

- 检查 MCP Server 是否已重新启动（JSON 配置变更后需要重启 IDE）
- 运行 `mumuspec doctor` 验证节点与 Git 环境
- 确认 `CLAUDE.md` / `AGENTS.md` 在项目根目录且内容非空
- 直接告诉 AI "使用 /mumuspec-hotfix skill"，Skill 文件位于 `docs/reference/skills/mumuspec-hotfix.md`

### 校验报错后如何处理？

- `mumuspec check --shall` 列出所有 SHALL 违规项，AI 会自动修复
- `mumuspec check --shall-not` 反向禁止项违规会阻断下一步流程，必须人工确认
- 报错信息中会显示具体文件/行号，便于定位

### 不想让 AI 自动执行某些阻塞点（Blocking Points）？

BP-1 ~ BP-18 清单定义了"必须用户显式确认"的节点（如设计方案确认、归档确认）。这些节点 AI 不会自动跳过，会等待你输入。完整清单见 [reference/skills/README.md](reference/skills/README.md) §"阻塞点全局清单"。

---

## 下一步

- 完整 CLI 命令：[reference/cli-commands.md](reference/cli-commands.md)
- MCP 工具参考：[reference/mcp-tools.md](reference/mcp-tools.md)
- 配置 schema：[reference/configuration.md](reference/configuration.md)
- 约束强度设计：[design/constraint-strength.md](design/constraint-strength.md)
- Skill 设计全貌：[reference/skills/README.md](reference/skills/README.md)
- 项目总览：[overview.md](overview.md)

> **导航**: [← 概览](overview.md) | [CLI 命令参考 →](reference/cli-commands.md)

