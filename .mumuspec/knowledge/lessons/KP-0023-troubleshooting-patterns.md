---
# === 标识 ===
id: "KP-0023"
title: "故障排查常见模式与解决方案"
type: lesson
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/reference/faq.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["troubleshooting", "faq", "installation", "configuration"]
related_pages:
  - "KP-0011"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

用户上手 MumuSpec 时遇到的常见问题，汇总以供快速排查。

## 故障模式

### 模式 1: 命令未找到

| 症状 | `mumuspec --version` 报 `command not found` |
|------|---------------------------------------------|
| **原因** | npm 全局 bin 目录不在 PATH 中 |
| **修复** | `npm config set prefix "$env:APPDATA\npm"` + 加入 PATH |

### 模式 2: npm 权限错误

| 症状 | npm install 报 `EACCES` 或 `EPERM` |
|------|------------------------------------|
| **原因** | npm 全局目录需要管理员权限 |
| **修复** | 配置 npm prefix 到用户目录（无需管理员） |

### 模式 3: 规范格式错误

| 症状 | `mumuspec validate` 报 YAML frontmatter 错误 |
|------|----------------------------------------------|
| **原因** | SHALL NOT 条目未按 YAML block 格式书写 |
| **修复** | 确保每个 SHALL NOT 条目带 `-` 前缀 |

### 模式 4: 图谱不可用

| 症状 | Knowledge Layer 知识加载失败 |
|------|------------------------------|
| **原因** | CGC/CBM 服务不可用或 tree-sitter 不支持语言 |
| **修复** | 自动降级到文件级索引（不影响规范层） |

### 模式 5: 单一活跃变更冲突

| 症状 | `mumuspec new` 报 E-CHANGE-001 错误 |
|------|-----------------------------------|
| **原因** | 已有活跃变更，单一变更约束阻断 |
| **修复** | 完成或 Discard 当前变更后再创建新变更 |

### 模式 6: 回退次数超限

| 症状 | `mumuspec rollback` 报 E-CHANGE-002 错误 |
|------|----------------------------------------|
| **原因** | rollback_count ≥ rollback_limit（默认 3） |
| **修复** | 接受偏差（accept-deviations）或废弃变更（discard） |

## 排查决策树

```
                    ┌─ 命令未找到 ──→ 检查 PATH
                    ├─ 权限错误 ────→ 修改 npm prefix
mumuspec 执行错误 ──┤─ 格式错误 ────→ 检查 YAML frontmatter
                    ├─ 变更冲突 ────→ 完成/归档当前变更
                    └─ 回退超限 ────→ 接受偏差/废弃
```

## 影响

- 新用户可快速解决安装配置问题
- 降低社区支持成本
- 提升首次使用体验

## 关联约束

- SHALL: 所有错误信息 SHALL 包含原因说明和修复步骤
- SHALL: 错误码 SHALL 按 E-<DOMAIN>-<NUMBER> 格式标准化
