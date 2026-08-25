---
id: KE-build-frontend-q3-5cf25798
title: "Rationale from build-frontend: 为什么前端文件服务不引入 serve 等第三方库？"
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

**Question:** 为什么前端文件服务不引入 serve 等第三方库？
**Answer:** Ponytail 阶梯第 3 级 → 使用 node:fs + node:http 自行实现静态文件服务，零npm依赖