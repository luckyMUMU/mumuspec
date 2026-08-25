---
scope: "src/storage"
layer: 3
---

# Technical Design: 存储层

## SHALL constraints

- 使用 Map<string, Task> 作为存储引擎
- 提供 create / read / update / delete / list 五个操作函数
- create 操作必须自动生成唯一 id（使用 crypto.randomUUID()）
- create / update 操作必须自动设置时间戳

## SHALL NOT constraints

- 禁止在存储层做输入验证（由 models 层负责）
- 禁止在存储层引入响应码概念
- 禁止在存储层引入 HTTP 状态码概念
- 禁止将存储实例暴露为全局变量（使用模块单例导出）

## Enforcement

- STORE-1: 检查使用 crypto.randomUUID() 而非第三方 uuid 库
- STORE-2: 检查存储函数不返回响应码

## 架构决策

### 存储引擎

内部使用 `Map<string, Task>` 存储数据，模块级单例，不导出 Map 本身。
所有操作函数直接操作/返回 Task 数据，不涉及 HTTP 概念。

### ID 生成

使用 `node:crypto` 的 `randomUUID()` 生成唯一 ID，不引入第三方 uuid 库
（Ponytail 阶梯第 3 级 — 标准库已满足需求）。

### 时间戳

create 操作同时设置 createdAt 和 updatedAt；update 操作仅更新 updatedAt。

## 接口契约

```typescript
createTask(data: { title: string; status?: TaskStatus }): Task;
getTask(id: string): Task | undefined;
updateTask(id: string, data: Partial<Pick<Task, 'title' | 'status'>>): Task | undefined;
deleteTask(id: string): boolean;
listTasks(): Task[];
```

所有函数直接操作/返回 Task 数据，不涉及 HTTP 概念。

## 依赖关系

- 内部依赖: src/models/task.ts（引用 Task 和 TaskStatus 类型）
- 外部依赖: node:crypto（randomUUID）
- 被依赖: src/api/routes.ts（调用 CRUD 函数）
- 依赖方向: storage → models（单向依赖）
