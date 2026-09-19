---
id: KE-annotation-primary-r2-lessons
title: Lessons from annotation-primary-r2 decisions
type: lesson
status: confirmed
scope: annotation-primary-r2
created_at: 2026-09-18
tags:
  - auto-extracted
  - lesson
  - decisions
  - annotation-primary-r2
graph_bindings: []
---
> Auto-extracted from annotation-primary-r2/decisions.md

# Decision Log: annotation-primary-r2


## [open] 2026-09-18T14:26:57.355Z

新配置键 specs.legacy_lexical_channel 默认 true（存量无注解约束的词法兜底行为首版不变，兼容面与现状逐字节一致）；翻转时机由项目配置决定，本变更不自动翻转。
