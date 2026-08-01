---
# === 标识 ===
id: "KP-0004"
title: "Ponytail 编码约束作为 MumuSpec 基础编码约束"
type: decision
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "v0.10.0-ponytail-integration"
source_phase: "design"
source_artifact: "docs/design/spec-layer.md#ponytail"

# === 图谱关联 ===
graph_bindings:
  - src/spec/ponytail.ts
  - src/core/constraint-evaluator.ts
  - src/AGENTS.md

# === 索引 ===
tags: ["ponytail", "yagni", "abstraction", "coding-constraints"]
related_pages:
  - "KP-0001"
  - "KP-0008"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

AI 生成的代码常存在过度抽象、引入不必要的依赖、产生冗余样板代码等问题，违背"懒惰的高级开发者"原则。

## 决策

引入 Ponytail 7级优先级阶梯作为 MumuSpec 基础编码约束：

### Ponytail 7级优先级阶梯

| Level | Question | Action | Type |
|-------|----------|--------|------|
| 1 | 这段代码需要存在吗？ | YAGNI — 不需要则不写 | SHALL NOT |
| 2 | 代码库中已有实现吗？ | 复用 — 找到并使用已有代码 | SHALL |
| 3 | 标准库已经提供了吗？ | 使用标准库 — 不引入外部依赖 | SHALL |
| 4 | 平台原生特性支持吗？ | 使用平台特性 — 不引入 polyfill | SHALL |
| 5 | 已安装的依赖能做吗？ | 使用已有依赖 — 不引入新依赖 | SHALL |
| 6 | 能一行写完吗？ | 一行代码 — 不过度抽象 | SHOULD |
| 7 | 以上都不满足 | 最小可工作代码 — 仅写必要的 | SHALL |

### Hard Constraints

**SHALL NOT:**
- 禁止引入未被请求的抽象层（YAGNI）
- 禁止在标准库/平台特性已满足需求时引入新依赖
- 禁止生成未被请求的样板代码（boilerplate）
- 禁止用复杂方案替代简单方案（boring over clever）

**SHALL:**
- 编写新代码前必须检查代码库中是否已有可复用的实现
- 新代码必须是最小可工作实现（仅写必要的代码）
- 有意简化必须用 `ponytail:` 注释标记原因

### Non-Lazy Domains（必须严谨，不可偷懒）

- 问题理解
- 输入验证
- 错误处理
- 安全性
- 可访问性（a11y）
- 校准与测试
- 明确请求的功能

## 影响

- AI Agent 在生成代码前必须按 7 级阶梯自检
- 违反 Ponytail 约束纳入 P1 漂移检测（CI 阻断合并）
- 有意简化的代码必须用 `// ponytail: <reason>` 注释标记
- Phase Guard（design_to_build）检查 `ponytail_constraints_defined: true`

## 关联约束

- SHALL: 代码评审时 Ponytail 合规性是必要检查项
- SHALL NOT: 过度抽象的代码不得合并到主分支
