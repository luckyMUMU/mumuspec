---
layer: 2
scope: "src/models"
last_updated: "2026-07-10"
---

## Requirement: Task 数据模型

### SHALL
- Task 接口必须包含 id (string)、title (string)、status (TaskStatus) 字段
- Task 接口必须包含 createdAt (string)、updatedAt (string) 时间戳字段
- TaskStatus 类型必须为 'todo' | 'in-progress' | 'done' 联合类型
- 提供 validateTask(data) 函数验证输入数据合法性

### SHALL NOT
- 禁止使用 class 定义 Task 模型（使用 interface + 纯函数）
- 禁止在模型层引入路由相关逻辑
- 禁止在模型层直接读写存储

### Enforcement
- MODEL-1: 检查 Task 使用 interface 定义而非 class
- MODEL-2: 检查 validateTask 返回 { valid: boolean, errors: string[] }
