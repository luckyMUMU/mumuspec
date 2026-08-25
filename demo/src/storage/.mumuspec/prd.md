---
scope: "src/storage"
layer: 3
---

# Product Requirements: 存储层

## 模块职责

存储层提供 Task 数据的持久化操作（CRUD），使用内存 Map 作为存储引擎。
对上层提供 create / read / update / delete / list 五个操作函数，
内部管理唯一 ID 生成和时间戳维护。

## 存在理由

- 隔离数据存储细节，上层不需要关心底层存储实现
- 集中管理数据生命周期（创建、读取、更新、删除）
- 使用内存存储简化 Demo 项目，避免引入数据库依赖
- 演示 Ponytail 原则：使用 JS 原生 Map 而非数据库

## 用户场景

### 场景 1: 创建任务

API 层调用 createTask 传入 title 和 status，存储层生成唯一 ID 和时间戳，
将任务存入 Map 并返回完整 Task 对象。

### 场景 2: 查询任务

API 层调用 getTask(id) 获取单个任务，或调用 listTasks() 获取全部任务列表。
任务存在时返回 Task，不存在时返回 undefined。

### 场景 3: 更新任务

API 层调用 updateTask(id, data) 传入更新字段，存储层合并数据并更新时间戳。
任务存在时返回更新后的 Task，不存在时返回 undefined。

### 场景 4: 删除任务

API 层调用 deleteTask(id)，存储层从 Map 中移除任务。
删除成功返回 true，任务不存在返回 false。

## 验收标准

- AC-1: 提供 create / read / update / delete / list 五个操作函数
- AC-2: create 操作自动生成唯一 ID（使用 crypto.randomUUID()）
- AC-3: create / update 操作自动设置时间戳
- AC-4: 存储函数不涉及 HTTP 概念（不返回状态码）
- AC-5: 存储函数不做输入验证（由 models 层负责）
- AC-6: 使用模块单例，不将 Map 实例暴露为全局变量
- AC-7: 使用 node:crypto 原生模块生成 UUID，不引入第三方库
