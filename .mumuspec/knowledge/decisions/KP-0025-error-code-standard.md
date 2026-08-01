---
# === 标识 ===
id: "KP-0025"
title: "错误码标准化体系：E-<DOMAIN>-<NUMBER>"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/reference/error-codes.md"

# === 图谱关联 ===
graph_bindings:
  - src/core/errors.ts
  - src/guard/checker.ts

# === 索引 ===
tags: ["error-code", "standard", "domain", "troubleshooting", "roadmap"]
related_pages:
  - "KP-0023"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

MumuSpec 需要统一的错误码体系，便于 AI Agent 理解错误类型、快速定位问题、执行修复步骤。

## 决策

采用 `E-<DOMAIN>-<NUMBER>` 格式的结构化错误码：

### Domain 定义

| Domain | 范围 | 说明 |
|--------|------|------|
| SPEC | E-SPEC-001 ~ E-SPEC-099 | 规范层错误 |
| CHANGE | E-CHANGE-001 ~ E-CHANGE-099 | 变更层错误 |
| GUARD | E-GUARD-001 ~ E-GUARD-099 | 校验层错误 |
| GRAPH | E-GRAPH-001 ~ E-GRAPH-099 | 代码图谱错误 |
| CONTRACT | E-CONTRACT-001 ~ E-CONTRACT-099 | 契约层错误 |
| DESIGN | E-DESIGN-001 ~ E-DESIGN-099 | 设计层错误（认知框架） |
| KNOWLEDGE | E-KNOWLEDGE-001 ~ E-KNOWLEDGE-099 | 知识层错误 |
| PONYTAIL | E-PONYTAIL-001 ~ E-PONYTAIL-099 | Ponytail 编码约束错误 |
| SECURITY | E-SECURITY-001 ~ E-SECURITY-099 | 安全错误 |

### 错误信息模板

```
Error: <错误码> <错误名称>
触发条件: <什么情况下触发>
原因说明: <为什么出错>
修复步骤:
  1. <步骤 1>
  2. <步骤 2>
  3. <步骤 3>
相关文档: <指向参考文档的链接>
```

### 严重级别

| 级别 | 说明 | 行为 |
|------|------|------|
| ERROR | 阻断性问题 | 阻断当前操作，需修复后才能继续 |
| WARN | 警告性问题 | 不阻断但输出警告，建议修复 |
| INFO | 提示性信息 | 仅输出信息，不阻断 |

### --force 选项

对于 WARN 级别的错误，可通过 `--force` 跳过继续执行：
- `mumuspec <command> --force` 跳过 WARN 继续
- ERROR 级别不可 `--force` 跳过（需修复问题）
- SHALL NOT 违规永远不可跳过（即使 `--force`）

## 影响

- AI Agent 可通过错误码自动识别问题类型
- 用户可快速定位修复步骤
- 文档可追溯（每个错误码关联相关文档章节）

## 关联约束

- SHALL: 所有错误码 SHALL 包含触发条件、原因说明、修复步骤
- SHALL NOT: ERROR 级别错误不得通过 `--force` 跳过
- SHALL: SHALL NOT 违规 SHALL 始终阻断，无论强度等级如何
