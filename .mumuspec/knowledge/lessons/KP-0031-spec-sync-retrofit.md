---
# === 标识 ===
id: "KP-0031"
title: "规范 Retrofit 经验：为已有代码库补写规范的方法论"
type: lesson
status: confirmed
scope: "global"
created_at: "2026-07-30T00:00:00Z"
updated_at: "2026-07-30T00:00:00Z"
verified_at: "2026-07-30T00:0000Z"

# === 来源 ===
source_change: "sync-spec-knowledge-base"
source_phase: "build"
source_artifact: ".mumuspec/changes/sync-spec-knowledge-base"

# === 图谱关联 ===
graph_bindings:
  nodes: ["retrofit", "spec", "existing-code"]
  edges: ["reverse-engineer", "document"]

# === 索引 ===
tags: ["lesson", "retrofit", "spec-creation", "reverse-engineering", "bootstrap"]
related_pages:
  - "KP-0010"
  - "KP-0011"
  - "KP-0029"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q3"
  reasoning_chain: ["已有代码 → 提取接口 → 编写约束"]
  confidence: medium
---

## 背景

当为一个已有代码库引入 MumuSpec 时，需要逆向工程现有代码来编写规范。这是一个" Retrofit"过程，与从零设计规范不同。

## 方法

### 1. 模块扫描阶段

遍历代码目录，对每个模块问：
- 这个模块对外导出了什么函数/类？
- 这些函数的输入/输出是什么类型？
- 模块间依赖关系如何？

### 2. 规范编写阶段

对每个模块编写 spec.md：
- SHALL：从函数签名和文档注释提取职责
- SHALL NOT：从边界条件提取禁止项（如"禁止引入外部依赖"）
- Enforcement：为每个 SHALL 设计至少一个检查规则

### 3. 格式校验阶段

运行 `mumuspec validate` 和 `mumuspec check`：
- 修 SHALL without Enforcement 警告
- 修 frontmatter 格式错误
- 修继承冲突

### 4. 知识沉淀阶段

将 Retrofit 过程中学到的编码模式、架构决策记录为 knowledge pages。

## 常见陷阱

1. **过度抽象** — 不要为每个 helper 函数写 spec，只为核心模块写
2. **空占位符** — "定义本层的正向要求"这种空文本不如不写
3. **Enforcement 缺失** — 每个 SHALL 都需要 Enforcement，否则 AI 无法执行
4. **忘记更新 index.yaml** — 新 spec 必须注册到索引中

## 量化结果

| 指标 | 变更前 | 变更后 |
|------|--------|--------|
| src/ 模块 spec 覆盖率 | 0/27 | 13/27 (layer 1) |
| SHALL without Enforcement | 42 | 0 |
| 知识库 graph_bindings | 0 | 全部填充 |
