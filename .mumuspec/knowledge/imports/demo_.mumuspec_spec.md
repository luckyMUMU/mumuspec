---
id: "IMPORT-DEMO__MUMUSPEC_SPEC"
title: "spec"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - demo-spec
source: "demo/.mumuspec/spec.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# spec

> **Source**: `demo/.mumuspec/spec.md` | **Type**: demo-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

---
layer: 0
scope: "."
last_updated: "2026-07-10"
---

## Requirement: Ponytail 基础编码约束

### SHALL
- 编写新代码前必须检查代码库中是否已有可复用的实现
- 新代码必须是最小可工作实现（仅写必要的代码）
- 有意简化必须用 ponytail: 注释标记原因

### SHALL NOT
- 禁止引入未被请求的抽象层（YAGNI）
- 禁止在标准库/平台特性已满足需求时引入新依赖
- 禁止生成未被请求的样板代码（boilerplate）
- 禁止用复杂方案替代简单方案（boring over clever）

### SHOULD
- 优先删除而非新增代码（deletion over addition）
- 理解问题后再写代码，而非边写边理解
- 对复杂请求提出质疑而非盲目实现

### Enforcement
- PONYTAIL-1: lint rule: detect unnecessary abstraction patterns (YAGNI check)
- PONYTAIL-2: lint rule: check for unnecessary new dependencies
- PONYTAIL-3: lint rule: detect boilerplate code patterns
- PONYTAIL-4: lint rule: detect overly clever solutions

## Requirement: 项目架构

### SHALL
- 使用 Node.js 原生 http 模块构建服务（不引入 Express 等框架）
- 数据模型定义在 src/models/ 目录下
- 路由处理逻辑定义在 src/api/ 目录下
- 存储逻辑定义在 src/storage/ 目录下
- 响应格式统一为 { success, data, error } JSON 结构

### SHALL NOT
- 禁止引入外部 Web 框架（Express / Fastify / Koa）
- 禁止使用 ORM 框架（Sequelize / TypeORM）
- 不允许在根级规范中定义具体模块的实现方式

### Enforcement
- ARCH-1: 检查 package.json dependencies 不包含 Web 框架
- ARCH-2: 检查目录结构是否符合 src/models, src/api, src/storage 分层

## Requirement: 错误处理

### SHALL
- 接口调用失败必须返回对应错误码
- 服务端异常必须捕获并返回 500 响应（不暴露堆栈）
- 参数校验失败必须返回 400 响应和详细错误描述

### SHALL NOT
- 禁止将未捕获的异常直接返回给客户端
- 禁止忽略 Promise rejection

### Enforcement
- ERR-1: 检查所有路由 handler 有 try-catch 包裹
- ERR-2: 检查 500 响应不包含 stack trace

## Requirement: 数据验证

### SHALL
- 所有接口输入必须在处理前进行校验
- 任务标题必须非空且长度不超过 200 字符
- 任务状态必须为 todo / in-progress / done 之一

### Enforcement
- VAL-1: 检查 validateTask 函数覆盖所有必填字段
- VAL-2: 检查非法输入返回 400 状态码

