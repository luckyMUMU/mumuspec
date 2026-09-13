---
id: KE-bp-into-graph-q3-85745154
title: "Rationale from bp-into-graph: phase_bps 挂在哪一层？"
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

**Question:** phase_bps 挂在哪一层？
**Answer:** 挂 workflows.<wf> 层（非独立顶段）；可选键，缺省合法——向后兼容由 AC 锁定。