---
scope: "."
layer: 1
---

# Technical Design: task-api

## SHALL constraints

- 编写新代码前必须检查代码库中是否已有可复用的实现；新代码必须是最小可工作实现
- 有意简化必须用 ponytail: 注释标记原因
- 使用 Node.js 原生 http 模块构建服务；分层目录: src/models, src/api, src/storage
- 响应格式统一为 { success, data, error } JSON 结构
- 接口调用失败必须返回对应错误码；异常必须捕获并返回 500（不暴露堆栈）
- 参数校验失败必须返回 400 和详细错误描述；所有输入必须在处理前校验
- 任务标题非空且 <= 200 字符；状态必须为 todo / in-progress / done 之一

## SHALL NOT constraints

- 禁止引入未被请求的抽象层（YAGNI）；禁止用复杂方案替代简单方案
- 禁止在标准库/平台特性已满足需求时引入新依赖
- 禁止引入外部 Web 框架（Express / Fastify / Koa）、ORM（Sequelize / TypeORM）、lodash
- 禁止硬编码密钥或凭证；禁止将错误堆栈返回客户端；禁止未验证直接使用用户输入
- 禁止使用 any 类型（除非用 ponytail: 标记）；禁止 console.log 生产日志
- 禁止创建未使用的导出；禁止忽略 Promise rejection
- 不允许在根级规范中定义具体模块的实现方式

## Enforcement

- PONYTAIL-1~4: lint rule — 检测不必要的抽象/依赖/样板/过度复杂方案
- ARCH-1: 检查 package.json 不含 Web 框架；ARCH-2: 检查目录分层结构
- ERR-1: 检查路由 handler 有 try-catch；ERR-2: 检查 500 响应不含 stack trace
- VAL-1: 检查 validateTask 覆盖所有必填字段；VAL-2: 检查非法输入返回 400

## 架构决策

### D1: 使用 Node.js 原生 http 模块
- **Context**: 需要构建轻量 REST API
- **Decision**: 使用 `node:http` 而非 Express
- **Reasoning**: Ponytail 第 3 级 — 标准库已满足需求
- **Consequences**: 需手动解析 URL 和请求体，但减少依赖和包体积

### D2: 内存存储
- **Context**: Demo 项目，不需要持久化
- **Decision**: 使用 `Map` 在内存中存储数据
- **Reasoning**: Ponytail 第 3 级 — 使用 JS 原生数据结构
- **Consequences**: 重启数据丢失，适合演示场景

### D3: 统一 JSON 响应格式
- **Decision**: `{ success: boolean, data?: T, error?: string }`
- **Reasoning**: 统一格式便于客户端处理，减少约定成本

### 分层架构

```
src/api/routes.ts     → HTTP 路由层（解析请求 → 调用 Storage → 返回 JSON）
src/api/server.ts     → HTTP 服务器（创建 Server + 路由分发）
src/storage/store.ts  → 存储层（内存 Map + CRUD 操作）
src/models/task.ts    → 数据模型层（Task 接口 + 验证逻辑）
```

请求流程: HTTP Request → server.ts → routes.ts → store.ts → models/task.ts → JSON Response

## 接口契约

统一响应格式: `{ success: boolean, data?: T, error?: string }`

| Method | Path | Description |
|--------|------|-------------|
| GET | /tasks | 获取所有任务 |
| GET | /tasks/:id | 获取单个任务 |
| POST | /tasks | 创建任务 |
| PATCH | /tasks/:id | 更新任务 |
| DELETE | /tasks/:id | 删除任务 |

## 依赖关系

- 运行时依赖: 无（仅使用 Node.js 标准库）
- 开发依赖: typescript, tsx, vitest, @types/node
- 模块间依赖: api → storage → models（单向依赖，不反向引用）
