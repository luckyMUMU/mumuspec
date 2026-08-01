---
# === 标识 ===
id: "KP-0013"
title: "渐进式规范加载模式"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/design/spec-layer.md#渐进式披露"

# === 图谱关联 ===
graph_bindings:
  - src/spec/loader.ts
  - src/spec/inheritance.ts
  - src/core/config.ts

# === 索引 ===
tags: ["pattern", "progressive-loading", "context-management", "token-saving"]
related_pages:
  - "KP-0001"
  - "KP-0006"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

大型项目中全量加载规范文件会导致 AI 上下文过载，token 消耗巨大。

## 模式

### 渐进式披露三层加载

```
Level 0: 根层 spec.md（全局约束，始终加载）
    ↓
Level 1: 当前层级 spec.md（当前工作目录的约束）
    ↓
Level 2: 子层 spec.md（直接子节点的约束摘要）
```

### 加载规则

1. 从根层开始，沿目录树向下加载
2. 每层最多加载 3 层深度（当前层 + 2 层祖先/子孙）
3. 仅加载 `status: active` 的规范
4. 已加载的规范加入后续对话的上下文缓存

### 量化目标

| 指标 | 目标值 | 度量方式 |
|------|--------|---------|
| 规范加载 token 消耗 | 较全量加载减少 ≥ 60% | 对比渐进式 vs 全量加载的 token 数 |
| Pre-commit 检查耗时 | < 5s（1万文件） | `mumuspec check --benchmark` |
| Phase Guard 耗时 | < 30s | `mumuspec guard --timing` |

## 示例

假设项目结构：
```
.mumuspec/
├── spec.md                    # Level 0: 全局约束
src/
├── spec.md                    # Level 1: src 层约束
api/
│   ├── spec.md                # Level 2: api 层约束
│   └── controllers/
│       └── spec.md            # Level 3: 仅在深入时加载
payment/
│   └── spec.md                # 不加载（无关层级）
```

当 AI Agent 在 `src/api/controllers/` 工作时：
- 加载：`.mumuspec/spec.md` + `src/spec.md` + `src/api/spec.md` + `src/api/controllers/spec.md`
- 不加载：`src/payment/spec.md`（不在祖先链上）

## 影响

- AI Agent 上下文清洁，token 消耗可控
- 大型项目（10万文件）仍可在合理时间内完成约束加载
- `mumuspec context <path>` 命令实现渐进式加载

## 关联约束

- SHALL: `mumuspec context` SHALL 按当前工作目录的祖先链加载规范
- SHALL NOT: 不得全量加载所有层级规范到上下文
