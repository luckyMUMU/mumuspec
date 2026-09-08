---
layer: 2
scope: "src/mcp"
last_updated: "2026-09-08"
doc_type: tech
---

# Technical Design: mcp

## Requirement: Tool Definition & Dispatch

### SHALL
- 工具定义集中在 `TOOLS` 常量数组，分发集中在 `callTool()` 单一 switch
- 工具 handler 只做参数校验与领域函数调用，不含业务分支

### SHALL NOT
- 禁止在 `tools.ts` 中引入 stdio / HTTP 传输相关代码（归属 mcp-server.ts）
- 禁止工具自行读写变更状态文件（应委托 change 领域模块）

### Enforcement
- TECH-MCP-1: 工具定义集中在 TOOLS 数组，分发集中在 callTool 单一入口
- TECH-MCP-2: tools.ts 不出现传输层符号（Server / Transport）

## Requirement: Write Tool Boundary

### SHALL
- 写工具限定为 persist_contract / deprecate_contract / remove_contract / scaffold_boundary 四个
- 写操作必须经 contract 领域模块，不得直接操作 YAML 文件

### SHALL NOT
- 禁止新增未经声明的写工具

### Enforcement
- TECH-MCP-3: 写工具数量上限 4，且均委托 contract/manager.js
- TECH-MCP-4: tools.ts 不出现 fs 写操作（writeFileSync / writeText）

## Requirement: Schema Discipline

### SHALL
- 每个工具必须提供 inputSchema，属性类型与必填性显式声明

### SHALL NOT
- 禁止依赖隐式参数（未出现在 inputSchema 中的参数）

### Enforcement
- TECH-MCP-5: 每个 TOOLS 条目含 inputSchema 字段

## 架构决策

- **薄适配层**：工具层不持有状态，全部委托领域函数——保证 CLI 与 MCP 行为一致，避免双份实现漂移
- **单一分发点**：`callTool` 集中 switch，新增工具只改一处 TOOLS + 一处 case
- **传输/工具分离**：mcp-server.ts 只管 stdio/HTTP/CORS/token，工具定义完全独立，便于单测
- **写工具显式化**：写副作用集中在契约管理域，且在工具名中即以动词明示
