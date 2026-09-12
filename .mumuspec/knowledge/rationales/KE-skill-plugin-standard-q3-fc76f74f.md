---
id: KE-skill-plugin-standard-q3-fc76f74f
title: "Rationale from skill-plugin-standard: GM-003：skill-drift 是否可以 import src/install？"
type: rationale
status: confirmed
scope: skill-plugin-standard
created_at: 2026-09-12
tags:
  - auto-extracted
  - q3
  - rationale
  - skill-plugin-standard
graph_bindings: []
---
> Auto-extracted from skill-plugin-standard cognitive-map Q3

**Question:** GM-003：skill-drift 是否可以 import src/install？
**Answer:** 不可以。同层反向引用会破坏 I2/I3，使 layer 2 不可并行。 设计为接收已解析路径对的纯函数，由 src/cli 注入。