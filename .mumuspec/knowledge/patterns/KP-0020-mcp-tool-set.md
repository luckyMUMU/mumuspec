---
# === 标识 ===
id: "KP-0020"
title: "MCP Server 工具集设计模式"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/reference/mcp-tools.md"

# === 图谱关联 ===
graph_bindings:
  - src/mcp-server.ts
  - src/knowledge/manager.ts
  - src/spec/loader.ts

# === 索引 ===
tags: ["mcp", "server", "tools", "search-graph", "contract"]
related_pages:
  - "KP-0002"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

AI 工具需要通过标准化协议访问 MumuSpec 的规范、知识、校验能力。

## 模式

### MCP Server 配置

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": ["@mumumpec/mcp-server"],
      "env": {
        "MUMUSPEC_ROOT": "${workspaceRoot}"
      }
    }
  }
}
```

### 工具集分类

| 类别 | 工具 | 功能 |
|------|------|------|
| **规范上下文** | `get_spec_context` | 获取指定目录的树状规范上下文（渐进式披露） |
| | `search_specs` | 搜索规范（按 scope、type、keyword） |
| | `get_prohibitions` | 获取指定范围的禁止项清单 |
| | `get_design_context` | 获取设计文档上下文 |
| | `get_design_decisions` | 获取架构决策记录 |
| **代码图谱** | `index_repository` | 构建/更新代码知识图谱 |
| | `search_graph` | 搜索代码图谱节点 |
| | `trace_path` | 追踪调用链 |
| | `detect_changes` | 检测变更影响 |
| | `query_graph` | Cypher 查询 |
| | `get_code_snippet` | 获取代码片段 |
| **校验** | `check_compliance` | 检查代码片段是否符合规范 |
| | `detect_drift` | 检测规范与代码的漂移 |
| **变更管理** | `get_change_status` | 获取变更状态 |
| | `guard_check` | 执行阶段守卫检查 |
| **测试用例** | `get_test_cases` | 获取变更的测试用例规格 |
| | `verify_test_immutability` | 校验测试不可变性 |
| | `lock_test_cases` | 锁定测试用例 |
| | `lock_test_suites` | 锁定测试套件 |
| **文档生成** | `generate_docs` | 生成对外文档 |
| | `list_docs` | 列出所有已生成文档 |
| | `check_doc_consistency` | 文档一致性校验 |
| **契约管理** | `get_contract` | 获取契约详情 |
| | `list_contracts` | 列出所有契约 |
| | `check_contract_compat` | 向后兼容性检查 |
| | `derive_constraints` | 派生约束 |
| **认知框架** | `init_cognitive_map` | 初始化认知地图 |
| | `update_cognitive_quadrant` | 更新象限状态 |
| | `get_cognitive_convergence` | 获取认知收敛状态 |
| **知识层** | `search_knowledge` | 搜索知识页面 |
| | `get_knowledge_page` | 获取知识页面详情 |
| | `extract_knowledge` | 提取知识 |
| **约束强度** | `constraints.check` | 约束求值 |
| | `constraints.resolve` | 树状约束解析 |
| | `constraints.strength` | 获取当前强度配置 |

## 影响

- AI 工具通过标准 MCP 协议访问 MumuSpec 能力
- 新增功能只需添加工具定义，无需修改 AI 工具配置
- MCP Server 可作为独立 npm 包分发

## 关联约束

- SHALL: MCP Server SHALL 严格遵循 Model Context Protocol 规范
- SHALL NOT: MCP Server SHALL NOT 在未授权状态下修改项目代码
