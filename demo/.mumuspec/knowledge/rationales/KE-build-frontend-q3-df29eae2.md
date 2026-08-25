---
id: KE-build-frontend-q3-df29eae2
title: "Rationale from build-frontend: 为什么选择 htm tagged template 而非原生 h() 函数？"
type: rationale
status: confirmed
scope: build-frontend
created_at: 2026-08-01
tags:
  - auto-extracted
  - q3
  - rationale
  - build-frontend
graph_bindings: []
---
> Auto-extracted from build-frontend cognitive-map Q3

**Question:** 为什么选择 htm tagged template 而非原生 h() 函数？
**Answer:** Q1（Preact via CDN）+ Q2（htm vs h） → htm 提供类 JSX 标签模板语法，降低上手成本，无需编译步骤