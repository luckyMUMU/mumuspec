---
id: "IMPORT-DEMO__MUMUSPEC_PROHIBITIONS"
title: "Global Prohibitions"
type: pattern
status: confirmed
scope: "imported"
tags:
  - imported
  - demo-spec
source: "demo/.mumuspec/prohibitions.md"
created_at: "2026-07-31T16:19:01.701Z"
verified_at: "2026-07-31T16:19:01.701Z"
freshness: fresh
---

# Global Prohibitions

> **Source**: `demo/.mumuspec/prohibitions.md` | **Type**: demo-spec | **Imported**: 2026-07-31

## Summary

_No summary extracted._

## Original Content

# Global Prohibitions

## All Modules

### 依赖管理
- 禁止引入 Express / Fastify / Koa 等 HTTP 框架
- 禁止引入 ORM 框架（Sequelize / TypeORM / Prisma）
- 禁止引入 lodash（使用 JS 原生方法替代）

### 安全性
- 禁止在代码中硬编码密钥或凭证
- 禁止将服务器内部错误堆栈返回给客户端
- 禁止未经验证直接使用用户输入

### 代码风格
- 禁止使用 any 类型（除非用 ponytail: 注释标记理由）
- 禁止使用 console.log 进行生产日志（使用统一的错误处理）
- 禁止创建未使用的导出函数/类

## src/api

### 路由处理
- 禁止在路由层直接操作存储（必须通过 storage 层）
- 禁止在路由层定义数据模型

## src/models

### 数据模型
- 禁止在模型层引入 HTTP 相关逻辑
- 禁止使用 class 定义纯数据模型（使用 interface）

## src/storage

### 存储
- 禁止在存储层引入 HTTP 状态码概念
- 禁止在存储层做输入验证（由 models 层负责）

