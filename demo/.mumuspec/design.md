# Design: task-api

## Architecture Overview

Task API 是一个轻量级任务管理 REST API 服务，使用 Node.js 原生 `http` 模块构建。

### 分层架构

```
┌─────────────────────────────────────┐
│           src/api/routes.ts         │  HTTP 路由层 (Layer 2)
│  解析请求 → 调用 Storage → 返回 JSON  │
├─────────────────────────────────────┤
│           src/api/server.ts         │  HTTP 服务器 (Layer 2)
│  创建 HTTP Server + 路由分发          │
├─────────────────────────────────────┤
│         src/storage/store.ts        │  存储层 (Layer 2)
│  内存存储 + CRUD 操作                 │
├─────────────────────────────────────┤
│          src/models/task.ts         │  数据模型层 (Layer 2)
│  Task 接口定义 + 验证逻辑             │
└─────────────────────────────────────┘
```

### 请求流程

```
HTTP Request
  → server.ts (创建 HTTP Server)
  → routes.ts (路由匹配 + 请求解析)
  → store.ts (内存 CRUD)
  → models/task.ts (数据验证)
  → JSON Response
```

## Key Decisions

### D1: 使用 Node.js 原生 http 模块
- **Context**: 需要构建一个轻量 REST API
- **Decision**: 使用 `node:http` 而非 Express
- **Reasoning**: Ponytail 阶梯第 3 级 — 标准库已满足需求，不引入外部依赖
- **Consequences**: 需要手动解析 URL 和请求体，但减少了依赖和包体积

### D2: 内存存储
- **Context**: Demo 项目，不需要持久化
- **Decision**: 使用 `Map` 在内存中存储数据
- **Reasoning**: Ponytail 阶梯第 3 级 — 使用 JS 原生数据结构
- **Consequences**: 重启数据丢失，适合演示场景

### D3: 统一 JSON 响应格式
- **Context**: 所有 API 端点需要一致的响应结构
- **Decision**: `{ success: boolean, data?: T, error?: string }`
- **Reasoning**: 统一格式便于客户端处理，减少约定成本

---

## Frontend Design (前端设计规范)

详见变更工件：`.mumuspec/changes/build-frontend/design.md`

### 视觉风格概览
- **风格**: 现代极简（Notion/Linear 参考）
- **主色**: Indigo-500 (#6366f1)
- **排版**: 系统字体栈 + 4px 基础间距系统
- **组件**: TaskCard、StatusBadge、Button、Input、FilterBar、SortSelector

### CORS 支持
- API 响应统一添加 `Access-Control-Allow-*` 头以允许前端跨域访问
- 前端运行在 port 3001，API 在 port 3000
