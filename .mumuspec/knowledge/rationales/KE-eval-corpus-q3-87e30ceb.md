---
id: KE-eval-corpus-q3-87e30ceb
title: "Rationale from eval-corpus: GM-002: corpus fixture 的 expected 声明形态"
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

**Question:** GM-002: corpus fixture 的 expected 声明形态
**Answer:** 每 fixture 目录内 expected.yaml 声明 mustContain/mustNotContain 码清单与 kill 期望；runner 读取后与实跑信号 diff，不在共享配置集中声明