---
# === 标识 ===
id: "KP-0012"
title: "为什么规范独立于代码：约束应描述行为而非实现"
type: rationale
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "overview.md#0-核心目标"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["rationale", "spec-design", "abstraction", "independent"]
related_pages:
  - "KP-0001"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

规范文件应当描述"做什么/不做什么"的行为准则，而非"具体怎么实现"。

## 理由

### 1. 防止"代码即规范"循环依赖

若规范引用具体代码路径（如"所有 `src/controllers/*.ts` 必须使用 XXX"），则规范与实现强绑定：
- 代码重构时规范必须同步更新
- 规范失效时 AI 无法区分"实现错误"还是"规范过时"
- 无法支持多种实现方式

### 2. 约束的持久化

代码会被删除和重构，但约束应当持久存在：
- "必须实现参数验证"不应绑定到特定函数
- "禁止明文存储密码"应独立于代码实现

### 3. AI 工具的泛化能力

AI 工具需要理解意图而非实现细节：
- "返回统一 JSON 格式"比"使用 `ResponseHelper.format()`"更通用
- "禁止在日志打印敏感信息"比"不得调用 `logger.info(token)`"更稳定

### 4. 漂移检测的有效性

规范与代码解耦后：
- 漂移检测可检测代码是否违反行为约束
- 而非检测代码是否符合过时的实现模板

## 决策

MumuSpec 规范描述"agent 应做 / 不应做"的行为准则，不引用具体代码路径。

### 反例

```markdown
# 错误：规范绑定到代码实现
SHALL: 所有 `src/utils/validator.ts` 中的函数必须使用 `joi` 库
```

### 正例

```markdown
# 正确：规范描述行为
SHALL: 所有 API 入参必须执行验证，验证失败返回 400 错误
```

## 影响

- AI Agent 理解约束的意图，可自主选择实现方式
- Enforcement 检查通过 AST/lint 实现，而非模板匹配
- 规范重构成本降低，实现变化不影响约束有效性

## 关联约束

- SHALL: 规范 SHALL 描述行为准则，不引用具体代码路径
- SHALL NOT: 规范 SHALL NOT 绑定到特定函数名或文件名（除非 Enforcement 要求）
