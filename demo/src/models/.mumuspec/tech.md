---
scope: "src/models"
layer: 3
---

# Technical Design: 数据模型层

## SHALL constraints

- Task 接口必须包含 id (string)、title (string)、status (TaskStatus) 字段
- Task 接口必须包含 createdAt (string)、updatedAt (string) 时间戳字段
- TaskStatus 类型必须为 'todo' | 'in-progress' | 'done' 联合类型
- 提供 validateTask(data) 函数验证输入数据合法性

## SHALL NOT constraints

- 禁止使用 class 定义 Task 模型（使用 interface + 纯函数）
- 禁止在模型层引入路由相关逻辑
- 禁止在模型层直接读写存储
- 禁止在模型层引入 HTTP 相关逻辑

## Enforcement

- MODEL-1: 检查 Task 使用 interface 定义而非 class
- MODEL-2: 检查 validateTask 返回 { valid: boolean, errors: string[] }

## 架构决策

### 类型定义

```typescript
type TaskStatus = 'todo' | 'in-progress' | 'done';

interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
```

### 验证规则

`validateTask(data: unknown): { valid: boolean; errors: string[] }`

- title: 非空字符串，长度 <= 200
- status: 必须是 'todo' | 'in-progress' | 'done' 之一（可选，默认 todo）

### 设计选择

- 使用 interface + 纯函数而非 class（Ponytail: YAGNI — 不需要实例化）
- 使用 `unknown` 作为 validateTask 入参类型（类型安全，优于 any）

## 接口契约

```typescript
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export interface Task { id: string; title: string; status: TaskStatus; createdAt: string; updatedAt: string; }
export interface ValidationResult { valid: boolean; errors: string[] }
export function validateTask(data: unknown): ValidationResult;
export function createTaskObject(data: { title: string; status?: TaskStatus }): Task;
```

## 依赖关系

- 外部依赖: 无（纯类型和函数定义）
- 被依赖: src/storage/store.ts（引用 Task 类型）、src/api/routes.ts（引用 Task 类型和 validateTask）
- 依赖方向: models 不依赖任何其他模块（最底层模块）
