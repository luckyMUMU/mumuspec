# IDE 与 AI 工具集成配置

> 本文列出主流 AI 编程工具的 MumuSpec 集成配置，复制粘贴即可使用。

---

## 1. Claude Code

**推荐方式**：MCP Server + Rules 文件双通道

### 1.1 MCP Server（项目级）

在项目根目录创建 `.mcp.json`：

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

或用户级 `~/.claude/settings.json`（对所有项目生效）：

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

修改配置后重启 Claude Code，对话中输入 `/mcp` 查看工具是否加载成功。

### 1.2 Rules 文件（CLAUDE.md）

Claude Code 会自动加载项目根目录的 `CLAUDE.md`。生成方式：

```bash
mumuspec init . --generate-rules
```

### 1.3 使用 Skill 自动化

Claude Code 原生支持 Slash Skills。将 `docs/reference/skills/` 下 9 份文件放入项目 `.claude/skills/mumuspec/`，启动对话时输入 `/mumuspec-hotfix` 即可触发。

```bash
mkdir -p .claude/skills/mumuspec
cp ../../docs/reference/skills/*.md .claude/skills/mumuspec/
```

---

## 2. Cursor

### 2.1 Rules 文件（.cursorrules）

Cursor 自动加载项目根 `.cursorrules`。生成方式：

```bash
mumuspec init . --generate-rules
```

如果你希望多层级规则，创建 `.cursorrules` 指向子目录（留空时 Cursor 自动向上查找）。

### 2.2 MCP Server（Cursor 0.45+）

在项目根 `.cursor/mcp.json` 添加：

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

Cursor 重启 MCP 后，在 Composer / Chat 中可以调用 `get_spec_context` 等工具。

---

## 3. OpenCode / Windsurf / 通用 Agent

### 3.1 Rules 文件（AGENTS.md）

这些工具通常读取 `AGENTS.md` 作为系统指令。生成方式同 CLI：

```bash
mumuspec init . --generate-rules
```

`AGENTS.md` 与 `demo/AGENTS.md` 内容同构：规范、Ponytail 约束、四条工作流、优先级、知识加载命令。

---

## 4. Codex (OpenAI)

Codex 当前以 AGENTS.md + 环境变量为主。

### 4.1 Rules 文件

项目根放 `AGENTS.md`，Codex 启动时自动加载。

### 4.2 MCP 环境变量（可选）

Codex Remote Agent/Web 可传入环境变量：

```bash
export MUMUSPEC_ROOT=$(pwd)
# 在 Codex 启动时自动 npx mumuspec-mcp
```

---

## 5. VS Code (GitHub Copilot)

VS Code 内置 GitHub Copilot，可以通过 `.github/copilot-instructions.md` 注入系统指令：

```bash
# 生成 copilot-instructions.md
cp .github/copilot-instructions.md 2>/dev/null || \
  cp CLAUDE.md .github/copilot-instructions.md 2>/dev/null || \
  cp AGENTS.md .github/copilot-instructions.md
```

---

## 验证集成是否成功

### 验证 CLI 已安装

```bash
mumuspec --version    # 应输出 0.x.x
```

### 验证 MCP 工具可调用

AI 工具内输入"列出你可用工具"，应看到 `get_spec_context` / `detect_drift` 等。

### 验证 Rules 文件已加载

AI 工具内输入"MumuSpec 项目有哪些 SHALL 约束？"。正确响应会提到 SHORT / SHALL NOT / Ponytail 等术语而非"我不了解"

---

## 常见问题

### Q: 为什么 Claude Code 不调用 MCP 工具？

- 重启 Claude Code（配置变更需要重启）
- 切换到项目目录再启动
- `/mcp` 命令查看 Server 状态，确认 `mumuspec` 已启动
- 检查 `.mcp.json` 是否位于项目根目录或被 `.gitignore` 屏蔽

### Q: Cursor 按 .cursorrules 工作的边界在哪里？

Cursor 仅在对话上下文读取 `.cursorrules`。如果你用的是 Cursor Composer、它仅加载前一次对话；新起对话时重新加载。配置文件开 **Cursor Settings → Rules** 添加全局规则，可跨项目生效。

### Q: 多个 AI 工具同时运行，Rules 文件冲突吗？

不冲突。`CLAUDE.md` / `.cursorrules` / `AGENTS.md` 三份文件内容相近但按工具名隔离。它们共享同一个规范源；MumuSpec 是单一真相。

> **导航**: [← MCP 工具](mcp-tools.md)|[配置 →](configuration.md)
