---
scope: src
layer: 2
---

# Technical Design: src (source root)

## SHALL constraints

- index.ts 必须按模块顺序 re-export 所有子模块的公共 API
- 所有源文件必须使用 ESM 语法（import/export），禁止 CommonJS
- MCP Server 必须实现 ListTools 和 CallTool 两种请求处理
- CLI 入口必须支持 Node.js >= 20

## SHALL NOT constraints

- 禁止在子模块之间创建循环依赖
- 禁止在 index.ts 中包含业务逻辑（仅 re-export）
- 禁止使用 require()（仅允许 ESM import）

## Enforcement

- SRC-1: 检查 index.ts 覆盖所有子模块导出
- SRC-2: 检查无循环依赖（通过模块导入图分析）
- SRC-3: 检查 ESM 兼容性（.js 扩展名在 import 路径中）

## 架构决策 (Architecture decisions)

- **分层架构**：core（基础层）← spec/change/guard/knowledge（领域层）← cli/mcp-server（接口层）
- **统一入口**：index.ts 按固定顺序 re-export（core → spec → change → guard → knowledge → rules → install → hooks → eval → i18n → skill-authoring → bundle）
- **CLI 兼容层**：cli.ts 仅一行 `import './cli/index.js'`，保持 package.json bin 入口不变
- **MCP Server**：基于 @modelcontextprotocol/sdk，实现 stdio transport，工具定义在 TOOLS 数组中
- **结构白名单**：`structure-validator.ts` 强制 `.mumuspec/` 目录结构白名单，防止未定义的目录和文件
- **LLM-Wiki 记忆**：`memory.ts` 提供 `_memory.yaml` 索引，`loader.ts` 在加载 spec 上下文时自动注入记忆
- **幂等归并**：`archive.ts` 的 `mergeChangeArtifacts` 使用 Marker 注释确保归档归并操作幂等

## 接口契约 (Interface contracts)

```typescript
// index.ts — re-export all submodules
export * from './core/types.js';
export * from './core/config.js';
// ... (all submodules)

// cli.ts — backward compat
import './cli/index.js';

// mcp-server.ts — MCP protocol
const TOOLS: MCPTool[] = [...];  // spec context, change status, guard check, etc.
```

## 依赖关系 (Dependencies)

- **直接子模块**：core、spec、change、guard、knowledge、rules、install、hooks、eval、i18n、skill-authoring、bundle、feedback、cli
- **外部依赖**：commander（CLI 框架）、yaml（YAML 解析）、@modelcontextprotocol/sdk（MCP 协议）
- **被消费方**：package.json bin 入口、MCP Server 配置、npm 包消费者
