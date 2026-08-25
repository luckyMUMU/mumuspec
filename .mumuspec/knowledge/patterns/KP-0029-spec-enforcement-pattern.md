---
# === 标识 ===
id: "KP-0029"
title: "Spec Enforcement 模式：每个 Requirement 必须有内联 Enforcement"
type: pattern
status: confirmed
scope: "global"
created_at: "2026-07-30T00:00:00Z"
updated_at: "2026-07-30T00:00:00Z"
verified_at: "2026-07-30T00:00:00Z"

# === 来源 ===
source_change: "sync-spec-knowledge-base"
source_phase: "build"
source_artifact: ".mumuspec/spec.md"

# === 图谱关联 ===
graph_bindings:
  nodes: ["spec.md", "Requirement", "Enforcement"]
  edges: ["requires", "validates"]

# === 索引 ===
tags: ["pattern", "spec", "enforcement", "validation", "E-SPEC-004"]
related_pages:
  - "KP-0001"
  - "KP-0012"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q1"
  reasoning_chain: []
  confidence: high
---

## 背景

MumuSpec 校验器（E-SPEC-004）要求每个包含 SHALL/SHALL NOT 的 Requirement 必须有其对应的 Enforcement 机制。Enforcement 不是可选的装饰，而是规范可执行的保障。

## 模式

### Enforcement 必须内联于 Requirement

```markdown
## Requirement: 模块功能

### SHALL
- 必须做 X

### SHALL NOT
- 禁止做 Y

### Enforcement
- ENF-1: 检查 X 的实现
- ENF-2: 检查 Y 的禁止
```

### 反模式：全局 Enforcement 区块

```markdown
## Req 1
### SHALL ... 
（无 Enforcement）

## Req 2
### SHALL ... 
（无 Enforcement）

## Enforcement  ← 解析器不识别！
- ENF-1: ...
```

解析器按 Requirement 块解析，全局 Enforcement 不属于任何 Requirement。

### Enforcement ID 命名规范

- 前缀与模块相关：`IMG-UPLOAD-`、`CORE-`、`CHANGE-`、`GUARD-`
- 编号从 1 开始递增
- 描述使用"检查/验证/禁止"动词开头

## 量化目标

| 指标 | 目标值 |
|------|--------|
| SHALL without Enforcement | 0（strict 模式下 block） |
| 每个 Requirement Enforcement 覆盖率 | 100% |

## 影响

- AI 工具加载 spec 时可直接提取可执行的校验规则
- lint 绑定 Enforcement ID 可提供精确的违规定位
- 新人通过 Enforcement 理解规范的"如何做"层面

## 关联约束

- SHALL: 每个有 SHALL/SHALL NOT 的 Requirement 必须有 ### Enforcement 子节
- SHALL NOT: 不得在 Requirement 块外放置 Enforcement
