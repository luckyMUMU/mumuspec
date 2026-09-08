# Agent 安装指南

> 层级: Level 2 参考文档 | 关联: [packaging-deployment.md](packaging-deployment.md), [cli-commands.md](cli-commands.md)

---

## 1. 设计理念

MumuSpec 采用 **全局 1 份 Skill + 多 Agent 分发** 的架构:

```
┌──────────────────────────────────────────────────────────────────────┐
│  npm install -g mumuspec                                             │
│  (全局安装 CLI + skills/ 资源目录)                                    │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                  mumuspec install <agent>
                               │
   ┌────────┬────────┬───────┼───────┬───────────┬────────┬─────────┬─────────┬─────────┐
   ▼        ▼        ▼       ▼       ▼           ▼        ▼         ▼         ▼
 CatPaw  Claude   Cursor   Trae  WorkBuddy  OpenCode   Codex   Windsurf  Gemini  Copilot
                                                          └──── 4 个新 agent（canonical AGENTS.md + 目录式 SKILL.md）────┘
```

**原则**:
- **单一事实源**: skills 目录仅存在于全局 npm 包中 (`node_modules/mumuspec/skills/`)
- **按需分发**: 通过 `mumuspec install <agent>` 将 skill 安装到目标 Agent
- **无冗余副本**: 项目根不再携带 `.mumuspec/skills/`,避免同步负担

---

## 2. 前置条件

```bash
# 安装 mumuspec CLI (全局)
npm install -g mumuspec

# 验证安装
mumuspec --version
mumuspec doctor
```

---

## 3. 各 Agent 安装指南

### 3.1 CatPaw

CatPaw 通过 `paw skills` 生态安装 Skill  Marketplace 上的技能,并通过 mumuspec 编排器使用工作流.

**安装 mumuspec 工作流编排器**:
```bash
# 安装 mumuspec-workflow skill (全局)
mumuspec install catpaw mumuspec-workflow

# 查看所有可用 CatPaw 技能
mumuspec install catpaw --list

# 搜索技能
mumuspec install catpaw --search workflow

# 验证已安装技能
mumuspec install catpaw --installed
```

**安装 MCP Server**:
```bash
# 在当前工作区安装 MumuSpec MCP Server
mumuspec install mcp mumuspec --workspace-path .
```

**安装后配置**:
- CatPaw 中 `/mumuspec` 命令自动触发工作流编排器
- MCP Server 重启 CatPaw 后激活

---

### 3.2 Claude Code

Claude Code 使用 `~/.claude/commands/` 下的 Markdown 文件作为自定义 slash 命令.

**安装**:
```bash
# 全局安装 (用户级)
mumuspec install claude mumuspec-workflow

# 工作区安装 (项目级)
mumuspec install claude mumuspec-workflow --target workspace --workspace-path .
```

**安装后位置**:
- 用户级: `~/.claude/commands/mumuspec.md`
- 工作区级: `<project>/.claude/commands/mumuspec.md`

**使用方式**: 在 Claude Code 中输入 `/mumuspec` 触发工作流.

**可用包**:
```bash
mumuspec install claude --list
```

---

### 3.3 Cursor IDE

Cursor IDE 使用 `.cursor/commands/` 下的 Markdown 文件作为自定义命令.

**安装**:
```bash
# 全局安装 (用户级)
mumuspec install cursor mumuspec-workflow

# 工作区安装 (项目级)
mumuspec install cursor mumuspec-workflow --target workspace --workspace-path .
```

**安装后位置**:
- 用户级: `~/.cursor/commands/mumuspec.md`
- 工作区级: `<project>/.cursor/commands/mumuspec.md`

**使用方式**: 在 Cursor 命令面板中使用 MumuSpec 工作流.

---

### 3.4 Trae

Trae AI 使用 `~/.trae/skills/<skill>/SKILL.md` 格式.

**安装**:
```bash
# 全局安装
mumuspec install trae mumuspec-workflow

# 工作区安装
mumuspec install trae mumuspec-workflow --target workspace --workspace-path .
```

**安装后位置**:
- 用户级: `~/.trae/skills/mumuspec-workflow/SKILL.md`
- 工作区级: `<project>/.trae/skills/mumuspec-workflow/SKILL.md`

---

### 3.5 WorkBuddy

WorkBuddy 使用 `~/.workbuddy/skills/<skill>/SKILL.md` 格式（目录式 SKILL.md）。

**安装**:
```bash
# 安装工作流编排器
mumuspec install workbuddy mumuspec-workflow

# 安装全部 7 个包（编排器 + 五阶段 + 预设）
mumuspec install workbuddy mumuspec-workflow phase-open phase-design phase-build phase-verify phase-archive workflow-presets

# 工作区安装
mumuspec install workbuddy mumuspec-workflow --target workspace --workspace-path .
```

**可用包**: `mumuspec-workflow`、`phase-open`、`phase-design`、`phase-build`、`phase-verify`、`phase-archive`、`workflow-presets`。

**安装后位置**:
- 用户级: `~/.workbuddy/skills/<skill>/SKILL.md`
- 工作区级: `<project>/.workbuddy/skills/<skill>/SKILL.md`

---

### 3.6 OpenCode

OpenCode 使用 `~/.opencode/skills/<skill>/SKILL.md` 格式.

**安装**:
```bash
# 全局安装
mumuspec install opencode mumuspec-workflow

# 工作区安装
mumuspec install opencode mumuspec-workflow --target workspace --workspace-path .
```

**安装后位置**:
- 用户级: `~/.opencode/skills/mumuspec-workflow/SKILL.md`
- 工作区级: `<project>/.opencode/skills/mumuspec-workflow/SKILL.md`

---

### 3.7 Codex / Windsurf / Gemini / GitHub Copilot（新 agent）

四个新 agent 采用 **canonical AGENTS.md 规则 + 目录式 SKILL.md** 分发（goal-p0-dispatch-gate）：

| Agent | Rules 文件 | 桥接 | Skills 目录 |
|-------|-----------|------|------------|
| Codex | `AGENTS.md`（canonical） | — | `.codex/skills/` |
| Windsurf | `AGENTS.md`（canonical） | — | `.windsurf/skills/` |
| Gemini | `AGENTS.md`（canonical） | `GEMINI.md` 薄壳（`@AGENTS.md`） | `.gemini/skills/` |
| Copilot | `AGENTS.md`（canonical） | — | 无（TC-A1x：不写 `.github`） |

**安装**（以 Codex 为例，其余同理）:
```bash
# 用户级安装 skills + canonical 规则
mumuspec install codex mumuspec-workflow

# 工作区安装
mumuspec install codex mumuspec-workflow --target workspace --workspace-path .
```

**可用包**: 每个 agent 均含 `mumuspec-workflow` + 五阶段 + 预设（Copilot 仅规则分发，用 `mumuspec install copilot --list` 确认）。

> **遗留格式禁令（C3）**: `.cursorrules` / `.windsurfrules` 属遗留格式，MumuSpec 已停止生成。Cursor / Windsurf 用户请以 canonical `AGENTS.md` 为规则来源。生成文件带 MumuSpec managed 标记，重装用 `--force` 覆盖。

---

## 4. Scope 说明

| Scope | 说明 | 适用场景 |
|-------|------|---------|
| `user` | 安装到用户主目录 (`~/.agent/...`) | 全局生效,所有项目可用 |
| `workspace` | 安装到项目目录 (`<project>/.agent/...`) | 仅当前项目可用,团队共享 |

---

## 5. 常用命令速查

```bash
# 列出某 Agent 可用包
mumuspec install <agent> --list

# 搜索包
mumuspec install <agent> --search <keyword>

# 安装包到用户全局
mumuspec install <agent> mumuspec-workflow

# 安装包到工作区
mumuspec install <agent> mumuspec-workflow --target workspace --workspace-path .

# 查看 CatPaw 已安装
mumuspec install catpaw --installed

# 安装 MCP Server 配置
mumuspec install mcp mumuspec --workspace-path .
```

---

## 6. 故障排查

| 问题 | 原因 | 解决 |
|------|------|------|
| `Skill source not found` | npm 包中 skills 未包含 | 更新 mumuspec 到最新版: `npm install -g mumuspec` |
| `Package not found for agent` | Agent 不支持该包 | 运行 `mumuspec install <agent> --list` 查看可用包 |
| Claude/Cursor 命令不生效 | 需要重新加载 | 重启 Claude Code / Cursor IDE |
| `paw` 命令不存在 | CatPaw 未安装或不在 PATH | 确保 CatPaw 已安装并配置 PATH |
| MCP Server 未激活 | CatPaw 未重启 | 重启 CatPaw 或执行 reload workspace |

---

## 7. 卸载与重新安装

```bash
# 手动删除 Claude 命令
rm ~/.claude/commands/mumuspec.md

# 手动删除 Cursor 命令
rm ~/.cursor/commands/mumuspec.md

# 手动删除 Trae skill
rm -rf ~/.trae/skills/mumuspec-workflow

# 手动删除 WorkBuddy skill
rm -rf ~/.workbuddy/skills/mumuspec-workflow

# 手动删除 OpenCode skill
rm -rf ~/.opencode/skills/mumuspec-workflow

# 重新安装
mumuspec install <agent> mumuspec-workflow
```
