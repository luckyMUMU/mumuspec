---
layer: 2
scope: "src/mcp"
last_updated: "2026-09-08"
doc_type: prd
---

# Product Requirements: mcp

## 模块职责 (What this module does)

MumuSpec 的 MCP（Model Context Protocol）工具层，向 AI 编程助手暴露规范上下文与校验能力。

- `TOOLS` — 35 个工具声明（名称、描述、inputSchema），供 MCP `tools/list` 返回
- `callTool(name, args)` — 统一工具分发入口，按名称路由到领域函数
- 工具按域分组：规范上下文（4）、合规与漂移（3）、变更状态（2）、知识层（10）、契约与边界（12）、代码图谱（3）、校验（1）
- 传输层由 `src/mcp-server.ts` 承担（stdio + Streamable HTTP 无状态模式）

## 存在理由 (Why it exists)

AI 助手需要一个标准化的、结构化的方式读取 MumuSpec 的规范状态，而不必解析 CLI 的人类可读输出。
MCP 工具层把 CLI 背后的同一批领域函数包装成 LLM 可直接调用的工具，使「渐进式规范披露」
在对话上下文里真正可用。

## 用户场景 (User scenarios)

1. **上下文中装载规范**：助手调用 `get_spec_context` 拿到当前路径适用的规范链
2. **合规自查**：助手在改代码前调用 `check_compliance` 判断是否违反 SHALL NOT 红线
3. **影响分析**：变更前调用 `analyze_impact` / `analyze_contract_impact` 评估波及范围
4. **知识检索**：助手用 `search_knowledge` / `query_knowledge` 查询沉淀的项目知识
5. **远程无状态部署**：以 Streamable HTTP 模式部署，每个请求自带完整上下文

## Requirement: Tool Surface Parity

### SHALL
- 每个工具必须是对应领域函数的薄适配层，不得在工具层重复实现业务逻辑
- 每个工具必须声明完整的 inputSchema，未声明的参数不得被接受

### SHALL NOT
- 禁止工具层绕过状态机直接写变更工件——变更状态流转只走 CLI / 领域函数

### Enforcement
- MCP-1: 工具层不引入业务分支逻辑（每个 handler 仅参数校验 + 单次领域调用）
- MCP-2: inputSchema 覆盖率 100%

## Requirement: Write Tool Declaration

### SHALL
- 具有写副作用的工具必须在名称与描述中明示（persist / deprecate / remove / scaffold）

### SHALL NOT
- 禁止新增写工具而不在工具描述中标注副作用

### Enforcement
- MCP-3: 写工具集合限于 persist_contract / deprecate_contract / remove_contract / scaffold_boundary

## 验收标准 (Acceptance criteria)

- 35 个工具全部可通过 `callTool` 分发，未注册名称返回明确错误
- 工具声明与领域函数签名保持一致
- 写工具数量不扩散，且均在描述中标注副作用
- 传输层与工具层分离：工具层不含 stdio / HTTP 相关代码
