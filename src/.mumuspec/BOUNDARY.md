---
scope: src
layer: 2
---

# src/ 目录边界文档

## 对外接口

### 入口文件

| 文件 | 职责 |
|------|------|
| `src/index.ts` | 库入口，barrel export 所有子模块的公开 API |
| `src/cli.ts` | CLI 入口 shim（7 行），转发至 `src/cli/index.ts`，保证 `package.json` bin 兼容 |
| `src/mcp-server.ts` | MCP Server 入口 + 全部 30+ tool 的实现与分发 |

### barrel export 结构（index.ts）

| 模块域 | 导出来源 |
|--------|----------|
| Core | `types.js`, `errors.js`, `config.js`, `utils.js`, `constraint-evaluator.js`, `constraints-loader.js`, `project-analyzer.js`, `init-generator.js`, `doc-importer.js` |
| Spec Layer | `parser.js`, `loader.js`, `validator.js`, `inheritance.js`, `ponytail.js`, `structure-validator.js` |
| Change Layer | `state-machine.js`, `manager.js` |
| Guard Layer | `checker.js`, `phase-guard.js` |
| Knowledge Layer | `manager.js`, `memory.js` |
| Contract Layer | `index.js`（barrel） |
| Rules | `generator.js` |
| Install | `installer.js` |
| Hooks | `guard.js` |
| Eval | `runner.js` |
| i18n | `locales.js` |
| Skill Authoring | `protocol.js` |
| Bundle | `packager.js` |

### 对外暴露的模块列表

- `core/` — 基础类型、配置、错误、工具函数、项目分析、init 生成
- `spec/` — 规格解析、加载、校验、继承、ponytail 注入
- `change/` — 五阶段变更状态机与管理
- `guard/` — 合规检查与阶段守卫
- `knowledge/` — LLM-Wiki 知识层管理
- `contract/` — 外部契约注册与漂移检测
- `rules/` — AGENTS.md / CLAUDE.md / .cursorrules 生成器
- `install/` — AI 工具 skill 安装
- `hooks/` — Git hooks 管理
- `eval/` — 评估场景运行器
- `i18n/` — 国际化（en + zh）
- `skill-authoring/` — Skill 协议定义
- `bundle/` — Skill 打包器
- `cli/` — Commander CLI 框架 + 32 个命令模块

## 依赖声明

### 运行时依赖（仅 3 个）

| 包名 | 用途 |
|------|------|
| `@modelcontextprotocol/sdk` | MCP Server 通信（stdio + streamable HTTP） |
| `commander` | CLI 命令注册与解析 |
| `yaml` | `.mumuspec/config.yaml` 读写 |

### 构建/测试依赖

Vitest、TypeScript、tsx（均在 `devDependencies`）

## 数据契约

### 子模块 barrel export 规则

每个子模块（如 `spec/`、`change/`、`core/`）必须提供 `index.ts` 或直接用 barrel 文件对外导出本模块所有公开 API。跨模块引用始终通过 barrel 路径（如 `../core/types.js`），禁止直接引用模块内部文件。

### types-*.ts 命名约定

- 位于 `src/core/` 目录
- 命名格式：`types-<domain>.ts`（如 `types-spec.ts`、`types-contract.ts`、`types-knowledge.ts`）
- 一个文件对应一个域的类型定义
- 其他模块通过 `../core/types-<domain>.js` 导入

### import 扩展名

始终使用 `.js` 扩展名（ESM，无运行时 bundler 解析）。

## 变更日志

| 日期 | 变更说明 |
|------|----------|
| 2026-08-29 | **Verifier 语义收紧（P0）**：`mcp-server.ts` `validate_specs`/`check_compliance` 返回体新增可选 `coverage`（`EnforcementCoverage` 五桶计量，纯新增字段向后兼容）；`EnforcementCoverage` 类型定义于 `core/types-workflow.ts` | 
| 2025-07-09 | 首次创建，记录 src/ 对外接口与数据契约 |
| 2026-08-22 | 新增 `structure-validator.js`（Spec Layer）和 `memory.js`（Knowledge Layer）到 barrel export |
