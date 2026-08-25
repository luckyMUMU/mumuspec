---
id: KE-build-frontend-q4-risk
title: Residual risks from build-frontend
type: risk
status: confirmed
scope: build-frontend
created_at: 2026-08-01
tags:
  - auto-extracted
  - q4
  - risk
  - build-frontend
graph_bindings: []
---
> Auto-extracted from build-frontend cognitive-map Q4

- **并发安全有何风险？**: 内存存储 Map 非线程安全，但 Node.js 单线程事件循环下无并发问题
- **契约兼容性如何？**: 前端新增跨域请求不改变现有 API 契约，向后兼容
- **错误处理盲区？**: 需处理 API 500 错误和网络断开两种场景，前端已做 try/catch 和错误提示
- **性能盲区？**: 任务列表可能无限增长，当前 demo 项目数据量小不做分页；设计预留接口
- **安全盲区（XSS）？**: 任务标题通过 Preact 的 h() 函数自动转义，但用户输入验证依赖后端 validateTask，前端仅做非空检查