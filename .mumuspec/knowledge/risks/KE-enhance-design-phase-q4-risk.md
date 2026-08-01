---
id: KE-enhance-design-phase-q4-risk
title: Residual risks from enhance-design-phase
type: risk
status: confirmed
scope: enhance-design-phase
created_at: 2026-08-01
tags:
  - auto-extracted
  - q4
  - risk
  - enhance-design-phase
graph_bindings: []
---
> Auto-extracted from enhance-design-phase cognitive-map Q4

- **AI 自审可能产生误报导致开发者频繁忽略警告?**: 需要分级机制（CRITICAL/MAJOR/MINOR），只有 CRITICAL 阻塞
- **一致性检查在大型项目中性能如何?**: 纯文本匹配复杂度 O(n*m)，可接受；未来可增量检查