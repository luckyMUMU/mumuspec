---
id: "UA-005"
title: "新增 MCP 知识工具"
scope: "src/mcp-server.ts"
type: "shall"
layer: 0
---

## SHALL

新增以下 MCP 工具，供 AI Agent 调用：

| 工具 | 描述 |
|------|------|
| `analyze_impact` | 分析变更影响范围，关联知识预警 |
| `generate_onboarding_path` | 生成代码学习路径 |
| `get_knowledge_coverage` | 获取知识覆盖率统计 |
| `find_knowledge_gaps` | 查找知识覆盖缺口 |
| `detect_decision_deviation` | 检测代码偏离已有决策 |

### 工具 Schema

遵循现有 MCP 工具定义模式（参考 `McpToolDef` 类型）。

## Reason

AI Agent 在设计/实现阶段需要实时获取知识上下文，MCP 工具提供标准化接口。
