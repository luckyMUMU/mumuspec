# Design: add-priority-field

## 概述

为 Task 模型添加 priority 字段，支持 low/medium/high 三级优先级。

## 认知框架 (Q1-Q4)

### Q1: 已知已知 (Known Knowns)
- Task 接口当前有 id, title, status, createdAt, updatedAt
- validateTask 验证 title 和 status
- storage 层 createTask 接受 { title, status? }
- API 层 POST /tasks 和 PATCH /tasks/:id

### Q2: 已知未知 (Known Unknowns)
- priority 默认值应该是什么？（决策：medium）
- priority 是否应该影响 list 排序？（决策：本次不实现排序，保持最小变更）

### Q3: 未知已知 (Unknown Knowns) → 转为 SHALL
- TypeScript 联合类型天然适合枚举值验证（无需引入 enum 库）
- validateTask 已有验证模式，可直接扩展

### Q4: 未知未知 (Unknown Unknowns)
- 无（这是一个简单的字段添加，不涉及架构变更）

## 技术设计

### Layer 2: src/models/task.ts

```typescript
// 新增类型
export type TaskPriority = 'low' | 'medium' | 'high';

// 修改接口
export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;  // 新增
  createdAt: string;
  updatedAt: string;
}

// 修改验证函数 — 增加 priority 验证
const VALID_PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
// 在 validateTask 中增加 priority 验证逻辑

// 修改 createTaskObject — 支持 priority
export function createTaskObject(data: { title: string; status?: TaskStatus; priority?: TaskPriority }): Task
```

### Layer 2: src/storage/store.ts

```typescript
// 修改 createTask 签名
export function createTask(data: { title: string; status?: TaskStatus; priority?: TaskPriority }): Task
// priority 默认 'medium'
```

### Layer 2: src/api/routes.ts

```typescript
// POST /tasks — 将 priority 传递给 createTask
// PATCH /tasks/:id — 将 priority 传递给 updateTask
// validateTask 调用时传入 priority（如果有）
```

## Ponytail 约束检查

- [x] Level 1 (YAGNI): priority 是明确请求的功能 ✓
- [x] Level 3 (标准库): 使用 TS 联合类型，无新依赖 ✓
- [x] Level 6 (一行代码): priority 验证逻辑可复用现有模式 ✓
- [x] Level 7 (最小实现): 仅添加字段和验证，不过度抽象 ✓

## 测试用例设计

| Case | Input | Expected |
|------|-------|----------|
| 创建带 priority 的 task | { title: "Test", priority: "high" } | task.priority === "high" |
| 创建不带 priority 的 task | { title: "Test" } | task.priority === "medium" (默认) |
| 验证非法 priority | { title: "Test", priority: "urgent" } | valid === false |
| 更新 priority | PATCH { priority: "low" } | task.priority === "low" |
