---
scope: src
layer: 2
---

# Product Requirements: src (source root)

## 模块职责 (What this module does)

MumuSpec 源代码根目录，包含所有功能模块的入口文件和子模块。

- **index.ts** — 库的主入口，re-export 所有子模块的公共 API
- **cli.ts** — CLI 向后兼容入口（re-export 到 src/cli/index.ts）
- **mcp-server.ts** — MCP Server 实现，通过 Model Context Protocol 提供 AI 工具接口
- 子模块：core、spec、change、guard、knowledge、rules、install、hooks、eval、i18n、skill-authoring、bundle、feedback、cli

## 存在理由 (Why it exists)

`src/` 是整个 MumuSpec 系统的源代码根。它组织了所有功能模块，
通过 `index.ts` 对外暴露统一 API，通过 `cli.ts` 提供命令行入口，
通过 `mcp-server.ts` 提供 MCP 协议接口。模块间依赖关系在此层级协调。

## 用户场景 (User scenarios)

1. **库使用**：其他项目通过 `import { ... } from 'mumuspec'` 使用 MumuSpec API
2. **CLI 执行**：`npx mumuspec <command>` 通过 cli.ts 入口执行命令
3. **MCP 集成**：AI 编程工具通过 MCP Server 调用 MumuSpec 的工具接口
4. **模块开发**：开发者在 src/ 下的子模块中添加功能

## 验收标准 (Acceptance criteria)

- index.ts re-export 所有子模块的公共 API
- cli.ts 作为向后兼容入口指向 src/cli/index.ts
- mcp-server.ts 实现 MCP 协议的工具列表和调用接口
- 子模块按职责划分，依赖方向清晰（core ← spec/change/guard ← cli）
- 所有模块使用 ESM（import/export），不使用 CommonJS
