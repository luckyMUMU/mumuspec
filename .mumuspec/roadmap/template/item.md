---
id: "R-XXXX"
title: "（简明描述 <= 60 字符）"
status: planning
priority: P1
scope: "."
created_at: "2026-08-04"
target_date: "2026-08-31"
owner: ""
depends_on: []
mutex_with: []
excludes: []
capacity_cost: 1
---

# R-XXXX: （标题）

## 背景

> 为什么需要这个目标？当前痛点是什么？不做的后果？

（2-5 句话即可）

## 范围

### 包含（Includes）
- ...

### 不包含（Excludes）
- ...

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | ... | ... |
| 2 | ... | ... |

## 工作量预估

`capacity_cost`: （数字，默认 1 单位 ≈ 2-3 人天）

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| ... | 高/中/低 | 高/中/低 | ... |

<!-- 仅当 mutex_with 非空时保留以下 section -->
## 互斥理由（Mutex Rationale）

> 为什么不能与以下 Item 同时进行？技术风险是什么？

- `R-YYYY`: ...

---

> **关联**: depends_on [R-YYYY, ...] | mutex_with [R-YYYY, ...] | excludes [范围, ...]
