---
scope: "src/api"
layer: 3
---

# Technical Design: API 层

## SHALL constraints

- 使用 node:http 原生模块创建服务器
- 服务器监听端口必须可通过环境变量 PORT 配置（默认 3000）
- 所有响应必须设置 Content-Type: application/json
- 支持 GET /tasks（列表）、GET /tasks/:id（详情）
- 支持 POST /tasks（创建）、PATCH /tasks/:id（更新）、DELETE /tasks/:id（删除）
- 路由匹配后必须调用 storage 层函数处理数据
- 响应格式必须为 { success: boolean, data?: T, error?: string }

## SHALL NOT constraints

- 禁止引入外部 Web 框架（Express / Fastify / Koa）
- 禁止在 server.ts 中定义路由处理逻辑（委托给 routes.ts）
- 禁止在路由层直接操作 Map 存储
- 禁止在路由层定义数据验证逻辑（调用 models 层）
- 禁止在路由层定义数据模型
- 禁止使用正则匹配路由路径（使用简单的 startsWith / split 分割）

## Enforcement

- SRV-1: 检查使用 createServer 而非第三方框架
- SRV-2: 检查响应头包含 Content-Type: application/json
- RT-1: 检查路由 handler 调用 storage 层函数
- RT-2: 检查路由 handler 调用 validateTask 进行验证
- RT-3: 检查不使用正则表达式做路由匹配

## 架构决策

### 路由表

| Method | Path | Handler | Status |
|--------|------|---------|--------|
| GET | /tasks | listTasks | 200 |
| GET | /tasks/:id | getTask | 200/404 |
| POST | /tasks | createTask | 201/400 |
| PATCH | /tasks/:id | updateTask | 200/404/400 |
| DELETE | /tasks/:id | deleteTask | 200/404 |

### 路由解析

使用 `url.parse()` 解析路径，`path.split('/')` 提取参数。
不使用正则或第三方路由库（Ponytail: boring over clever）。

### 请求流程

```
HTTP Request → server.ts (创建 HTTP Server) → routes.ts (路由匹配 + 请求解析)
→ store.ts (内存 CRUD) → models/task.ts (数据验证) → JSON Response
```

## 接口契约

```typescript
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

- server.ts 导出 `startServer(port?: number): Server`
- routes.ts 导出 `handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void>`

## 依赖关系

- 内部依赖: src/storage/store.ts（CRUD 操作）、src/models/task.ts（数据验证）
- 外部依赖: 无（仅使用 node:http 原生模块）
- 被依赖: 顶层入口直接调用 startServer 启动服务
