# MCP 工具参考

> 层级: Level 2 参考文档

---

## MCP Server 配置

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": ["@mumuspec/mcp-server"],
      "env": {
        "MUMUSPEC_ROOT": "${workspaceRoot}"
      }
    }
  }
}
```

## 工具列表

### 规范上下文

| 工具 | 描述 |
|------|------|
| `get_spec_context` | 获取指定目录的树状规范上下文（渐进式披露） |
| `search_specs` | 搜索规范（按 scope、type、keyword） |
| `get_prohibitions` | 获取指定范围的禁止项清单 |
| `get_design_context` | 获取指定目录的设计文档上下文（design.md） |
| `get_design_decisions` | 获取指定层级的架构决策记录（ADR） |

### 代码图谱

| 工具 | 描述 |
|------|------|
| `index_repository` | 构建/更新代码知识图谱 |
| `search_graph` | 搜索代码图谱节点 |
| `trace_path` | 追踪调用链（inbound/outbound/both） |
| `detect_changes` | 检测变更影响 |
| `query_graph` | Cypher 查询 |
| `get_code_snippet` | 获取代码片段 |

### 校验

| 工具 | 描述 |
|------|------|
| `check_compliance` | 检查代码片段是否符合规范 |
| `detect_drift` | 检测规范与代码的漂移 |

### 变更管理

| 工具 | 描述 |
|------|------|
| `get_change_status` | 获取变更状态 |
| `guard_check` | 执行阶段守卫检查 |

### 测试用例（0.6.0 新增）

| 工具 | 描述 |
|------|------|
| `get_test_cases` | 获取变更的测试用例规格（test-cases/） |
| `verify_test_immutability` | 校验测试不可变性（test-cases hash + test-suites hash） |
| `lock_test_cases` | 锁定测试用例（Design 阶段完成时调用） |
| `lock_test_suites` | 锁定指定层级的测试套件（Build 阶段每层完成时调用） |

### 文档生成

| 工具 | 描述 |
|------|------|
| `generate_docs` | 生成对外文档（技术/业务/集成/依赖），支持按层级、类型、格式生成 |
| `list_docs` | 列出所有已生成文档及其状态（fresh/stale） |
| `check_doc_consistency` | 文档一致性校验，检测文档与 spec/design 的漂移 |

### 契约管理（0.8.0 新增）

| 工具 | 描述 |
|------|------|
| `get_contract_context` | 获取指定模块的契约上下文（CONSUMES/EXPOSES 契约及派生约束） |
| `check_contract_compliance` | 检查代码是否符合契约约束（RPC 调用策略、向后兼容性等） |
| `detect_contract_drift` | 检测契约与代码的漂移（暴露未声明、调用未注册、策略不一致） |
| `trace_contract_impact` | 追踪契约变更影响范围（契约 → CONSUMES/EXPOSES 节点 → Spec） |

---

> **导航**: [← CLI 命令](cli-commands.md) | [配置 →](configuration.md) | [返回概览](../overview.md)
