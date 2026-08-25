---
# === 标识 ===
id: "KP-0027"
title: "项目规范实施的最佳实践与变通方案"
type: lesson
status: confirmed
scope: "global"
created_at: "2026-07-10T00:00:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "demo-practice"
source_phase: "design"
source_artifact: "demo/.mumuspec/spec.md + demo image-share patterns"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["convention", "best-practice", "demo", "ponytail", "boring-over-clever"]
related_pages:
  - "KP-0004"
  - "KP-0010"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

通过演示项目（demo/）的实践，总结 MumuSpec 规范落地的最佳实践与常见变通方案。

## 实践记录

### 实践 1: node:http 替代 Express

**决策**: 使用 Node.js 原生 http 模块，不引入 Express（KP-001）

**理由（Ponytail 应用）**:
- Level 3 (标准库): `node:http` 完全满足 REST API 需求
- Level 1 (YAGNI): Express 中间件系统、模板引擎未被请求
- Level 5 (已有依赖): 零依赖，减少包体积和安全攻击面

**代价**: 手动解析 URL 和请求体（约 20 行代码）

**适用范围**: 小型 API 服务（< 20 路由）、学习/演示项目

### 实践 2: 路由解析使用 split 而非正则

**决策**: 使用 `path.split('/')` 进行简单路由解析（KP-005）

**理由（Ponytail 应用）**:
- boring over clever: 简单字符串分割比正则更易读
- Level 3 (标准库): 不引入 path-to-regexp 等第三方库
- Level 1 (YAGNI): Demo 项目路由简单，不需要复杂路由匹配

**限制**: 不支持通配符路由、不支持可选参数

### 实践 3: validateTask 验证模式

**模式**: 使用常量数组 + `Array.includes()` 进行联合类型验证（KP-002）

```typescript
const VALID_STATUSES: TaskStatus[] = ['todo', 'in-progress', 'done'];

if (!VALID_STATUSES.includes(value as TaskStatus)) {
  errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}`);
}
```

**优点**:
- 与 TypeScript 联合类型天然配合
- 无需引入验证库（如 zod、joi）
- 错误信息自动包含合法值列表

### 实践 4: 手写 multipart 解析

**决策**: 手写 multipart 解析，不用第三方库（KD-002）

**理由**:
- Demo 场景功能单一（仅 image upload），不需要完整 multipart 库
- body 解析仅一种格式（Content-Type based）
- 保留社区代码可维护性

## 关键经验

### boring over clever 的实际应用

| 场景 | clever 方案 | boring 方案 | 选择 |
|------|-----------|-----------|------|
| HTTP 框架 | Express/Fastify | node:http | ✅ boring |
| 路由解析 | path-to-regexp | split('/') | ✅ boring |
| 数据验证 | zod/joi | 数组 + includes | ✅ boring |
| 文件上传 | multer/busboy | 手写简单解析 | ✅ boring |

### 何时可以使用 clever 方案

- 项目规模增大（route > 20、validator > 10）
- 已有依赖中已有框架
- 安全敏感操作（需要成熟的库处理边界条件）

## 影响

- 验证了 Ponytail 原则的实际可行性
- 为后续项目提供了可复用的模式参考
- Demo 项目零运行时依赖，启动体积最小

## 关联约束

- SHALL: 优先选择 boring 方案（boring over clever）
- SHALL: 选择 clever 方案时 SHALL 用 `ponytail:` 注释标记理由
- SHALL NOT: 不得为未请求的抽象层引入第三方依赖
