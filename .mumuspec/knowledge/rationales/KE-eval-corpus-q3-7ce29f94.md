---
id: KE-eval-corpus-q3-7ce29f94
title: "Rationale from eval-corpus: GM-001: build_layers 分层结构（report→evaluators→runner 单向依赖）"
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

**Question:** GM-001: build_layers 分层结构（report→evaluators→runner 单向依赖）
**Answer:** 三层：L0 runner 层（corpus 分支 + custom 修复）/ L1 评估器层（verifiable-ratio + fail-open-count + registry）/ L2 消费层（eval --report + .eval-corpus 语料 + 验收单测）