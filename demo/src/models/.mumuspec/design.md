# Design: src/models

## Overview

数据模型层定义 Task 相关的类型和验证逻辑，是纯函数层，不依赖 HTTP 或存储。

## Types

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

## Validation

`validateTask(data: unknown): { valid: boolean; errors: string[] }` 

验证规则：
- title: 非空字符串，长度 ≤ 200
- status: 必须是 'todo' | 'in-progress' | 'done' 之一
