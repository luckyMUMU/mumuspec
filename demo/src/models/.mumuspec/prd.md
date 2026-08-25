---
scope: "src/models"
layer: 3
---

# Product Requirements: 数据模型层

## 模块职责

数据模型层定义 Task 相关的类型和验证逻辑，是纯函数层，不依赖 HTTP 或存储。
负责定义 Task 接口、TaskStatus 类型，以及输入数据的合法性校验。

## 存在理由

- 为整个系统提供统一的 Task 数据结构定义
- 集中管理数据验证规则，避免验证逻辑分散在各层
- 作为纯函数层，不引入副作用，便于测试和复用
- 演示 Ponytail 原则：使用 interface + 纯函数而非 class

## 用户场景

### 场景 1: 创建任务时验证

API 层接收到 POST 请求后，调用 validateTask 校验 title 和 status 字段。
校验通过后调用存储层创建任务；校验失败返回 400 错误。

### 场景 2: 更新任务时验证

API 层接收到 PATCH 请求后，调用 validateTask 校验更新字段。
仅允许更新 title 和 status 字段。

### 场景 3: 类型引用

存储层和 API 层引用 Task 接口和 TaskStatus 类型，
确保数据结构在系统内一致。

## 验收标准

- AC-1: Task 接口包含 id、title、status、createdAt、updatedAt 五个字段
- AC-2: TaskStatus 类型为 'todo' | 'in-progress' | 'done' 联合类型
- AC-3: validateTask 检查 title 非空且长度不超过 200 字符
- AC-4: validateTask 检查 status 为合法枚举值（可选，默认 todo）
- AC-5: validateTask 返回 { valid: boolean, errors: string[] } 结构
- AC-6: 使用 interface 而非 class 定义数据模型
- AC-7: 模型层不引入 HTTP 或存储相关逻辑
