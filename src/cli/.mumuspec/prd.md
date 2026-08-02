---
scope: src/cli
layer: 2
---

# Product Requirements: cli

## 模块职责 (What this module does)

MumuSpec CLI 的主入口和命令注册器，使用 Commander.js 框架管理所有子命令。

- **index.ts** — CLI 主入口，创建 Commander program，注册所有命令模块
- **helpers.ts** — 共享辅助函数（getCssSummary、executeChat、createAgentInstallSubcommand 等）
- **commands/** — 子目录，包含所有命令模块的实现

## 存在理由 (Why it exists)

CLI 是用户与 MumuSpec 交互的主要界面。将 CLI 逻辑从库核心中分离，
让 index.ts 仅负责命令注册和路由，具体逻辑委托给 commands/ 子目录中的模块。
helpers.ts 提供跨命令复用的辅助函数，避免重复代码。

## 用户场景 (User scenarios)

1. **初始化项目**：`mumuspec init` 分析项目并生成规范文件
2. **变更管理**：`mumuspec new <name>` / `mumuspec status` / `mumuspec archive`
3. **规范操作**：`mumuspec context <path>` / `mumuspec validate` / `mumuspec check`
4. **工具安装**：`mumuspec install catpaw <pkg>` / `mumuspec hooks install`
5. **知识管理**：`mumuspec knowledge list` / `mumuspec knowledge context <scope>`

## 验收标准 (Acceptance criteria)

- CLI 入口支持 `mumuspec --version` 和 `mumuspec --help`
- 所有命令模块通过 register* 函数注册到主 program
- init 命令执行项目分析并生成 spec/design/知识库/规则文件
- 错误信息使用 formatError 格式化，包含错误码和修复建议
- 支持 --json 输出模式（部分命令）
