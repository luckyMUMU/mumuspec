---
id: KE-build-frontend-q3-44aeba74
title: "Rationale from build-frontend: 为什么需要在 API 中添加 CORS 头？"
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

**Question:** 为什么需要在 API 中添加 CORS 头？
**Answer:** Q1 + Q2 → 前后端分离运行在不同端口，API 必须添加 Access-Control-Allow-* 头以支持跨域前端请求