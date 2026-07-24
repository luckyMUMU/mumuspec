# Design: src/api

## Overview

HTTP 服务器和路由分发层。使用 Node.js 原生 `http` 模块，手动解析 URL 和请求体。

## 路由表

| Method | Path           | Handler              | Status |
|--------|----------------|----------------------|--------|
| GET    | /tasks         | listTasks            | 200    |
| GET    | /tasks/:id     | getTask              | 200/404|
| POST   | /tasks         | createTask           | 201/400|
| PATCH  | /tasks/:id     | updateTask           | 200/404/400 |
| DELETE | /tasks/:id     | deleteTask           | 200/404|

## 响应格式

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## 路由解析

使用 `url.parse()` 解析路径，`path.split('/')` 提取参数。
不使用正则或第三方路由库（Ponytail: boring over clever）。
