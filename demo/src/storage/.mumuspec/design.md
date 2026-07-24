# Design: src/storage

## Overview

内存存储层，提供 Task 的 CRUD 操作。使用 Node.js 原生 `crypto.randomUUID()` 生成唯一 ID。

## API

```typescript
// 所有函数直接操作/返回 Task 数据，不涉及 HTTP 概念
createTask(data: { title: string; status: TaskStatus }): Task
getTask(id: string): Task | undefined
updateTask(id: string, data: Partial<Task>): Task | undefined
deleteTask(id: string): boolean
listTasks(): Task[]
```

## Storage Engine

内部使用 `Map<string, Task>` 存储数据，模块级单例，不导出 Map 本身。
