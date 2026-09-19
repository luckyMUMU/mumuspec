---
id: KE-install-trae-agents-patterns
title: Architecture patterns from install-trae-agents
type: pattern
status: confirmed
scope: install-trae-agents
created_at: 2026-09-17
tags:
  - auto-extracted
  - pattern
  - architecture
  - install-trae-agents
graph_bindings: []
---
> Auto-extracted from install-trae-agents/design.md

# Design: install-trae-agents

> 目标：`mumuspec install` 支持 TraeCode / TraeWork 两个 agent，并提供 `--project-only` 参数。

## 决策

- D1: `AgentType` 将 `trae` 重命名为 `traecode`，并新增 `traework`。两者 install 行为一致（技能目录 `.trae/skills/`、AGENTS.md 规则分发相同），仅作为独立安装目标存在。
- D2: 规则分发完全复用现有表驱动机制（`AGENT_RULE_TARGETS` → `renderRuleFiles` 三态策略），不新增生成逻辑；`rulesRideAlong: true` 使 workspace 安装联动生成 AGENTS.md。
- D3: `--project-only` 在 `createAgentInstallSubcommand` 统一解析（所有非 catpaw agent 共享同一实现），强制 workspace 目标 + cwd 路径，与显式 `--target user` 互斥（fail-closed 报错退出）。
- D4: `trae` 旧名移除（用户确认，不保留别名）；迁移通过 CHANGELOG 说明。已装用户级技能文件不受影响（不删除磁盘文件）。
- D5: 用户级全局技能目录本期沿用 `.trae/skills`（国际版约定），`.trae-cn` 区域差异不处理——`--project-only` 已规避该场景。

## 模块改动

| 文件 | 改动 |
|---|---|
| `src/install/installer-registry.ts` | AgentType、`TRAECODE_PACKAGES`/`TRAEWORK_PACKAGES`、`AGENT_MANIFEST`、`AGENT_INSTALL_POLICIES`、`AGENT_RULE_TARGETS` |
| `src/install/installer-ops.ts` | conventions 表（traecode/traework → `.trae/skills`）、`isAgentSupported`/`getSupportedAgents` |
| `src/cli/helpers.ts` | `--project-only` 选项与互斥校验 |
| `src/cli/commands/install.ts` | 子命令注册（traecode/traework）、help 文案 |
| `tests/install/*` | trae 引用迁移 + `--project-only` 新用例 |
| `docs/reference/agent-install-guide.md` 等 | agent 清单与示例同步 |

## 验证要点

- `npm test`、`npm run lint`、`mumuspec validate`、`mumuspec check` 全绿。
- 冒烟：`mumuspec install traecode mumuspec-workflow --project-only` 生成 `.trae/skills/mumuspec-workflow/SKILL.md` 与 AGENTS.md（managed 标记）。
- `rules-generator` 对 traecode/traework 渲染非空 AGENTS.md plan。

<!-- no-open-questions -->
