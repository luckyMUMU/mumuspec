---
id: KE-skill-plugin-standard-q3-8bfe112d
title: "Rationale from skill-plugin-standard: GM-002：漂移比对是否需要剥离版本行？"
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

**Question:** GM-002：漂移比对是否需要剥离版本行？
**Answer:** 需要。stampSkillVersion() 使两侧版本必然不同；纳入比对会让告警恒亮， 而恒亮告警会训练读者忽略整条告警通道。