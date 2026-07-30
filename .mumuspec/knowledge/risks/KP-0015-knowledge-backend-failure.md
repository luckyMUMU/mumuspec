---
# === 标识 ===
id: "KP-0015"
title: "Knowledge Layer 后端故障风险与降级策略"
type: risk
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.11.0-pluggable-backend"
source_phase: "design"
source_artifact: "docs/design/knowledge-layer.md#6-可插拔后端架构"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["risk", "knowledge-layer", "graph-backend", "degradation", "mitigation"]
related_pages:
  - "KP-0006"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q4"
  reasoning_chain: []
  confidence: medium
---

## 背景

Knowledge Layer 的代码图谱依赖外部后端（CGC / CBM / 内置(tree-sitter+SQLite)），任一后端故障将影响知识层的可用性。

## 风险识别

| 风险 | 概率 | 影响 | 级别 |
|------|------|------|------|
| **CGC 不可用**（网络/认证） | 中 | 知识图谱查询失败 | HIGH |
| **CBM 不可用**（服务宕机） | 中 | 代码记忆访问失败 | HIGH |
| **SQLite 锁定**（并发写入） | 低 | 内置图谱写入失败 | LOW |
| **tree-sitter 不支持项目语言** | 中 | 图谱降级为文件级索引 | HIGH |
| **图谱与代码漂移**（增量索引失败） | 中 | AI 获取过时代码结构信息 | HIGH |

## 降级策略

### 层级降级

```
CGC/CBM 不可用 → 尝试另一个生态后端
     ↓
生态后端均不可用 → 内置 tree-sitter + SQLite adapter
     ↓
tree-sitter 不支持语言 → 文件级索引（无 AST 解析）
     ↓
SQLite 不可用 → 内存图（小型项目，重启丢失）
     ↓
全不可用 → Spec Layer 独立运行（仅规范约束，无代码图谱）
```

### 各故障场景处理

| 故障场景 | 处理 | 用户感知 |
|---------|------|---------|
| CGC 认证失败 | 自动切换到 CBM 或内置 | WARN 日志 |
| CBM 服务宕机 | 切换到 CGC 或内置 | WARN 日志 |
| tree-sitter 无法解析 | 降级为文件级索引（仅按文件聚合） | INFO 日志 |
| SQLite 锁定失败 | 重试 3 次后降级为内存图 | WARN 日志 |

## 影响评估

- AI Agent 在设计阶段可能缺少代码结构信息（降级场景）
- Spec Layer 和 Change Layer **不依赖** Knowledge Layer，核心功能不受影响
- 知识漂移检测在降级期间暂停

## 监控建议

- 知识层健康检查端点（`/api/health/knowledge`）
- 日志记录降级事件
- 定期验证图谱与代码一致性（`mumuspec drift --type=graph`）

## 关联约束

- SHALL: 知识层降级 SHALL 保证 Spec Layer 和 Change Layer 正常运行
- SHALL NOT: 图谱不可用时 SHALL NOT 阻断变更流程
