---
scope: src/install
layer: 2
last_updated: '2026-08-04'
---

# Product Requirements: install

## 模块职责 (What this module does)

零依赖包安装器，为多种 AI 编程工具安装技能、MCP 服务器和自定义命令。

- 支持安装目标：CatPaw、Claude、Cursor、Trae、WorkBuddy、OpenCode
- `getManifest()` / `searchPackages()` — 获取和搜索可用包清单
- `resolvePackage()` / `installPackage()` — 解析和安装技能包
- `installCatpawMcp()` — 安装 MCP 服务器配置
- `installCatpawCommand()` — 安装自定义 slash 命令
- 支持 user（全局）和 workspace（项目级）两种安装范围

## 存在理由 (Why it exists)

MumuSpec 的技能、MCP 服务器和自定义命令需要安装到不同的 AI 编程工具中。
install 模块提供统一的安装接口，屏蔽各工具的配置差异，让用户一条命令即可完成安装。

## 用户场景 (User scenarios)

1. **安装技能**：`mumuspec install catpaw browser pdf` 安装浏览器和 PDF 技能
2. **搜索包**：`mumuspec install catpaw --search browser` 搜索可用技能
3. **安装 MCP**：`mumuspec install catpaw mcp <server>` 配置 MCP 服务器
4. **安装命令**：`mumuspec install catpaw command <name>` 安装 slash 命令
5. **多工具支持**：`mumuspec install claude <pkg>` 安装到 Claude Code

## 验收标准 (Acceptance criteria)

- 支持 CatPaw、Claude、Cursor 三种（及以上）AI 工具的技能安装
- 安装过程使用 Node.js 内置模块（child_process 执行 npm/npx）
- 提供包搜索、解析、安装、列表功能
- 支持 user 和 workspace 两种安装目标范围
- 无外部 npm 依赖
