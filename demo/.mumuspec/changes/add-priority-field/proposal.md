# Proposal: add-priority-field

## Why
当前 Task 模型只有 status 字段表示任务状态，缺少优先级信息。用户需要按优先级排序和管理任务，以便区分紧急和常规任务。

## What
为 Task 模型添加 `priority` 字段：
- 新增 `TaskPriority` 类型：`'low' | 'medium' | 'high'`
- Task 接口增加 `priority: TaskPriority` 字段
- validateTask 增加 priority 验证逻辑
- storage 层 createTask 支持优先级参数
- API 层支持创建/更新时传入 priority

## Impact Scope
- src/models — 修改 Task 接口和验证逻辑
- src/storage — 修改 createTask 接受 priority 参数
- src/api — 修改 POST/PATCH 路由传递 priority

## Workflow
full

## Ponytail 约束检查
- **Level 1 (YAGNI)**: priority 字段是用户明确请求的功能，不违反 YAGNI
- **Level 3 (标准库)**: 使用 TypeScript 联合类型，无需引入新依赖
- **Level 7 (最小实现)**: 仅添加一个字段和相关验证，不过度抽象
