# Proposal: install-trae-agents

## Why

`mumuspec install trae` 未按 Trae 产品线拆分：TraeCode 与 TraeWork 是两个独立产品，但 install 只暴露单一 `trae` agent。且存在三处约定错位：

1. **规则分发缺失**：`trae` 不在 `AGENT_RULE_TARGETS` 且 `rulesRideAlong: false`，`mumuspec install trae` 不生成项目根 AGENTS.md——而 TraeCode 与 TraeWork 桌面版都支持读取项目根 AGENTS.md（TraeWork 需在设置开启"将 AGENTS.md 包含在上下文中"）。
2. **无"仅装当前项目"入口**：现有安装需显式 `--target workspace --workspace-path <dir>`，缺少一个默认指向当前目录、且不会误写用户级目录的便捷参数。
3. **命名过时**：`trae` 是改名前的旧称，官方现名区分 TraeCode / TraeWork。

## What

1. `AgentType` 将 `trae` 重命名为 `traecode`，并新增 `traework`。两者均配置：
   - `AGENT_INSTALL_POLICIES`: `{ kind: 'generic', rulesRideAlong: true, layout: 'skill-dir' }`（workspace 安装时联动生成 AGENTS.md，与 codex/windsurf/gemini 同语义）。
   - `AGENT_RULE_TARGETS`: `{ rulesFile: 'AGENTS.md', bridges: {}, skillsDir: '.trae/skills', marksManaged: true }`。
   - 技能目录约定 `.trae/skills/` + `SKILL.md`（getAgentSkillDir conventions 表）。
2. 新增 `--project-only` 参数（createAgentInstallSubcommand）：强制 workspace 目标、路径取 `process.cwd()`，与显式 `--target user` 互斥（冲突报错退出）。
3. 测试与文档同步：tests/install 全部 `trae` 引用迁移，新增 `--project-only` 用例；docs/reference/agent-install-guide.md 等更新。
4. 版本号 `0.35.0-alpha.0` → `0.36.0-alpha.0`；CHANGELOG 记录 `trae` 子命令移除迁移说明。

## Impact Scope

- `src/install/installer-registry.ts`：AgentType、manifest、policies、rule targets
- `src/install/installer-ops.ts`：conventions 表、isAgentSupported/getSupportedAgents
- `src/cli/helpers.ts`：`--project-only`
- `src/cli/commands/install.ts`：子命令注册与 help 文案
- `tests/install/*.test.ts`：trae 引用迁移 + 新用例
- `docs/reference/agent-install-guide.md`、`docs/reference/cli-commands.md`、`docs/getting-started-agent.md`
- `package.json` / `CHANGELOG.md` / `docs/STATUS.md`（版本）

## Non-goals

- 不改 `install mcp` 的 `.mcp.json` 写入路径（Trae 约定为 `.trae/mcp.json`，另行处理）。
- 不改全局技能目录 `.trae` vs `.trae-cn` 区域差异（`--project-only` 已规避；user 目标沿用 `.trae/skills`）。
- 不做 TraeWork 原生项目规则目录 `.trae/rules/`（非 AGENTS.md 形式）。

## Acceptance Scenarios

1. `mumuspec install traecode mumuspec-workflow --project-only` 在当前目录生成 `.trae/skills/mumuspec-workflow/SKILL.md` 与项目根 `AGENTS.md`（含 managed 标记）；`traework` 同。
2. `mumuspec install traecode <pkg> --project-only --target user` 报互斥错误，exit 1。
3. `mumuspec install trae` 不再存在（子命令移除），`traecode` / `traework` 可用。
4. `mumuspec install traecode --list` / `--installed` 正常；`rules-generator` 对 traecode/traework 渲染非空 AGENTS.md plan。
5. `npm test`、`npm run lint`、`mumuspec validate`、`mumuspec check` 全绿。

## Workflow

full
