---
id: KE-bp-into-graph-q3-da2b261f
title: "Rationale from bp-into-graph: BP-18（预设升级触发）归属哪个 phase？"
type: rationale
status: confirmed
scope: bp-into-graph
created_at: 2026-09-13
tags:
  - auto-extracted
  - q3
  - rationale
  - bp-into-graph
graph_bindings: []
---
> Auto-extracted from bp-into-graph cognitive-map Q3

**Question:** BP-18（预设升级触发）归属哪个 phase？
**Answer:** hotfix/tweak 的 build 阶段（升级条件在预设执行中最常于 build 触发）；full 不含 BP-18，18 个 BP 由全 workflow 并集覆盖。