---
id: KE-eval-corpus-q3-be9a1dce
title: "Rationale from eval-corpus: Q3-002: Q1-004 → 评估器消费 validate 输出应复用 CLI 子进程模式而非内联 API"
type: rationale
status: confirmed
scope: eval-corpus
created_at: 2026-09-17
tags:
  - auto-extracted
  - q3
  - rationale
  - eval-corpus
graph_bindings: []
---
> Auto-extracted from eval-corpus cognitive-map Q3

**Question:** Q3-002: Q1-004 → 评估器消费 validate 输出应复用 CLI 子进程模式而非内联 API
**Answer:** 跟随 drift-score/spec-compliance 既有 spawn 模式（单一权威源），不自建第二解析通道