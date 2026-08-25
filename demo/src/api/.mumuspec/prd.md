---
scope: "src/api"
layer: 3
---

# Product Requirements: API 层

## 模块职责

API 层是任务管理系统的 HTTP 入口，负责接收请求、路由分发、调用存储层完成数据操作，
并以统一 JSON 格式返回结果。包含 HTTP 服务器（server.ts）和路由处理（routes.ts）两个文件。

## 存在理由

- 为前端和客户端提供标准 REST API 接口
- 隔离 HTTP 协议细节与业务逻辑，路由层不直接操作存储
- 统一响应格式和错误处理，保证接口一致性
- 演示 Node.js 原生 http 模块在不依赖框架时也能构建完整的 REST 服务

## 用户场景

### 场景 1: 启动服务

开发者通过 `npm run dev` 或 `npm start` 启动服务，服务监听指定端口（默认 3000），
开始接收 HTTP 请求。

### 场景 2: 创建任务

客户端发送 POST /tasks 请求，携带 title 和可选 status 字段。
系统校验输入后创建任务，返回 201 状态码和任务数据（含生成的 id 和时间戳）。

### 场景 3: 查询任务

客户端发送 GET /tasks 获取所有任务列表，或 GET /tasks/:id 获取单个任务详情。
存在时返回 200，不存在时返回 404。

### 场景 4: 更新任务

客户端发送 PATCH /tasks/:id 请求，携带 title 或 status 更新字段。
系统校验后更新任务，返回 200 和最新数据。任务不存在时返回 404。

### 场景 5: 删除任务

客户端发送 DELETE /tasks/:id 请求。删除成功返回 200，不存在时返回 404。

## 验收标准

- AC-1: 支持完整 CRUD 五个端点（GET 列表/详情、POST、PATCH、DELETE）
- AC-2: 所有响应使用 `{ success, data, error }` JSON 格式
- AC-3: 服务器端口可通过环境变量 PORT 配置（默认 3000）
- AC-4: 所有响应设置 Content-Type: application/json
- AC-5: 路由 handler 有 try-catch 包裹，异常返回 500 且不暴露堆栈
- AC-6: 创建和更新操作调用 validateTask 进行数据校验
- AC-7: 非法输入返回 400 和详细错误描述
- AC-8: 不支持的 method/path 组合返回 405
