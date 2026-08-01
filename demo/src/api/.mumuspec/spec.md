---
layer: 2
scope: "src/api"
last_updated: "2026-07-30"
---

## Requirement: 服务器

### SHALL
- 使用 node:http 原生模块创建服务器
- 服务器监听端口必须可通过环境变量 PORT 配置（默认 3000）
- 所有响应必须设置 Content-Type: application/json

### SHALL NOT
- 禁止引入外部 Web 框架
- 禁止在 server.ts 中定义路由处理逻辑（委托给 routes.ts）

### Enforcement
- SRV-1: 检查使用 createServer 而非第三方框架
- SRV-2: 检查响应头包含 Content-Type: application/json

## Requirement: 路由分发

### SHALL
- 支持 GET /tasks（列表）、GET /tasks/:id（详情）
- 支持 POST /tasks（创建）、PATCH /tasks/:id（更新）、DELETE /tasks/:id（删除）
- 路由匹配后必须调用 storage 层函数处理数据
- 响应格式必须为 { success: boolean, data?: T, error?: string }

### SHALL NOT
- 禁止在路由层直接操作 Map 存储
- 禁止在路由层定义数据验证逻辑（调用 models 层）
- 禁止使用正则匹配路由路径（使用简单的 startsWith / split 分割）

### Enforcement
- RT-1: 检查路由 handler 调用 storage 层函数
- RT-2: 检查路由 handler 调用 validateTask 进行验证
- RT-3: 检查不使用正则表达式做路由匹配
