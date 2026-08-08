---
scope: src/install
layer: 2
---

# Boundary Document: install

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `installPackage` | `(agent, name, mode) => InstallResult` | installer-ops.ts | 安装技能包 |
| `getManifest` | `(agent) => PackageManifestEntry[]` | installer-registry.ts | 获取可用包清单 |
| `resolvePackage` | `(agent, name) => PackageManifestEntry \| null` | installer-registry.ts | 解析包信息 |
| `searchPackages` | `(agent, keyword) => PackageManifestEntry[]` | installer-registry.ts | 搜索包 |
| `installCatpawMcp` | `(preset, path) => InstallMcpResult` | installer.ts | 安装 CatPaw MCP |
| `listInstalledMcp` | `(path) => McpEntry[]` | installer.ts | 列出已安装 MCP |
| `installCatpawCommand` | `(preset, path) => InstallCommandResult` | installer.ts | 安装 CatPaw 命令 |
| `getMcpPresets` | `() => McpPresetEntry[]` | installer-registry.ts | 获取 MCP 预设列表 |
| `getCommandPresets` | `() => CommandPresetEntry[]` | installer-registry.ts | 获取命令预设列表 |
| `getSupportedAgents` | `() => AgentType[]` | installer.ts | 获取支持的 AI 代理列表 |

### 导出类型

| 类型 | 用途 |
|------|------|
| `AgentType` | AI 代理标识符 |
| `InstallMode` | 安装模式（install / update） |
| `PackageManifestEntry` | 包清单条目 |
| `InstallResult` | 安装结果 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统操作 |
| `node:path` | 路径处理 |
| `node:child_process` | 子进程执行 |
| `../core/utils.js` | 工具函数 |

### 外部依赖

无（仅 Node.js 标准库）

## 数据契约

### 输入

- AI 代理类型（catpaw / claude / cursor / trae / workbuddy / opencode）
- 包名称
- 安装模式

### 输出

- 安装结果（success, message, installed_path）
- 技能文件写入目标工作区

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 初始创建边界文档 | 新目录边界定义 |
