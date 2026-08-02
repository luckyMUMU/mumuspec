# MCP 工具参考

> 层级: Level 2 参考文档

---

## MCP Server 配置

```json
{
  "mcpServers": {
    "mumuspec": {
      "command": "npx",
      "args": ["-y", "mumuspec@next"],
      "env": {
        "MUMUSPEC_ROOT": "${workspaceRoot}"
      }
    }
  }
}
```

仓库根目录必须有 `.mumuspec/config.yaml`（由 `mumuspec init` 生成）。

---

## 工具列表

MumuSpec MCP Server 目前提供 **20 个工具**，覆盖规范、校验、变更、知识四大领域。

### Spec 与规范（5 个）

| 工具 | 描述 | 关键参数 |
|------|------|---------|
| `get_spec_context` | 获取指定目录的树状规范上下文（渐进式披露） | `path` (必填) |
| `search_specs` | 搜索规范（按 scope / type / keyword） | `keyword`, `scope`, `type` (`shall` / `shall-not`) |
| `get_prohibitions` | 获取指定范围的 SHALL NOT 禁止项（含继承） | `path` (必填) |
| `get_design_context` | 获取指定目录的设计文档上下文（design.md） | `path` (必填) |
| `validate_specs` | 校验所有 spec 文件格式 | —— |

### Guard 与校验（3 个）

| 工具 | 描述 | 关键参数 |
|------|------|---------|
| `check_compliance` | 代码合规校验（SHALL / SHALL NOT / Ponytail） | `shall`, `shallNot`, `ponytail` |
| `detect_drift` | 检测规范与代码的漂移 | —— |
| `guard_check` | 执行阶段门禁检查 | `change` (必填), `phase` (必填) |

### 变更管理（2 个）

| 工具 | 描述 | 关键参数 |
|------|------|---------|
| `get_change_status` | 获取变更状态与状态机信息 | `name`（省略则查活跃变更） |
| `list_changes` | 列出所有活跃变更 | —— |

### 知识层（10 个，含 UA 风格分析工具）

| 工具 | 描述 | 关键参数 |
|------|------|---------|
| `get_knowledge_context` | 获取指定代码路径的知识上下文（渐进式加载） | `path` (必填) |
| `search_knowledge` | 搜索知识页面（按标签 / 类型 / 关键词） | `keyword`, `tag`, `type` |
| `get_knowledge_page` | 获取指定 ID 的知识页面全文 | `id` (必填) |
| `verify_knowledge` | 验证知识页面新鲜度 | `id`, `all` |
| `analyze_impact` | 分析变更影响（UA 风格，含知识关联警告） | `diff_range`, `scope`, `include_knowledge_warnings` |
| `generate_onboarding_path` | 生成代码范围的新手引导学习路线 | `scope` (必填), `role` (`junior` / `mid` / `senior` / `pm`) |
| `get_knowledge_coverage` | 获取知识覆盖率统计 | `scope` |
| `find_knowledge_gaps` | 发现未覆盖知识的重要代码节点 | `scope`, `min_importance` |
| `detect_decision_deviation` | 检测代码变更是否偏离已确认决策 | `changed_files` (必填) |
| `query_knowledge` | 知识库问答 | `query` (必填) |

---

## 调用示例

```
# 获取 src/api 目录的规范上下文
-> get_spec_context({ path: "src/api" })

# 检查合规
-> check_compliance({ shall: true, shallNot: true, ponytail: true })

# 分析最近 3 次提交的影响
-> analyze_impact({ diff_range: "HEAD~3..HEAD", include_knowledge_warnings: true })

# 知识库问答
-> query_knowledge({ query: "为什么选择 node:http 而非 Express?" })
```

---

> **导航**: [← CLI 命令](cli-commands.md) | [配置 →](configuration.md) | [返回概览](../overview.md)
