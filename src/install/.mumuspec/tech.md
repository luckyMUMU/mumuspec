---
scope: src/install
layer: 2
---

# Technical Design: install

## SHALL constraints (migrated from spec.md)

- 必须支持 CatPaw、Claude、Cursor 三种 AI 工具的技能安装
- 安装过程必须使用 Node.js 内置模块（child_process 执行 npm/npx）
- 必须提供包搜索、解析、安装、列表功能

## SHALL NOT constraints (migrated from spec.md)

- 禁止引入任何外部 npm 依赖（此模块必须零运行时依赖）
- 禁止使用 require()（仅允许 ESM import）

## Enforcement (migrated from spec.md)

- INST-1: 检查无外部 import（仅 node: 前缀）
- INST-2: 检查支持三种 agent 类型

## 架构决策 (Architecture decisions)

- **Manifest 驱动**：通过内置 PackageManifestEntry 清单定义可用包，避免网络请求
- **child_process 委托**：实际安装通过 `npm install` / `npx` 命令执行，模块仅做编排
- **Agent 抽象**：AgentType 联合类型统一不同工具，createAgentInstallSubcommand 工厂复用逻辑
- **MCP/Command 预设**：McpPresetEntry 和 CommandPresetEntry 提供开箱即用的配置模板
- **ESM 模块**：使用 `import.meta.url` 和 `fileURLToPath` 获取 `__dirname`

## 接口契约 (Interface contracts)

```typescript
type AgentType = 'catpaw' | 'claude' | 'cursor' | 'trae' | 'workbuddy' | 'opencode';
type InstallTarget = 'user' | 'workspace';

function getManifest(agent: AgentType): PackageManifestEntry[];
function searchPackages(agent: AgentType, keyword: string): PackageManifestEntry[];
function resolvePackage(agent: AgentType, name: string): PackageManifestEntry | undefined;
function installPackage(agent: AgentType, name: string, options?: {...}): InstallResult;
function installCatpawMcp(serverName: string, options?: {...}): InstallMcpResult;
function installCatpawCommand(commandName: string, options?: {...}): InstallCommandResult;
```

## 依赖关系 (Dependencies)

- **上游**：仅使用 `node:fs`、`node:path`、`node:child_process`、`node:url` 内置模块
- **下游**：被 `src/cli/commands/install.ts` 和 `src/cli/helpers.ts` 调用
