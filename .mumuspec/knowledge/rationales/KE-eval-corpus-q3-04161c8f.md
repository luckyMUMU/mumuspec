---
id: KE-eval-corpus-q3-04161c8f
title: "Rationale from eval-corpus: Q3-001: Q1-003 + Q1-001 → 语料位置隔离须由单测锁死（防回归），而非仅靠约定"
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

**Question:** Q3-001: Q1-003 + Q1-001 → 语料位置隔离须由单测锁死（防回归），而非仅靠约定
**Answer:** 新增 fixture-location 断言单测：仓库根 validate 的 coverage.total 不得包含语料条目