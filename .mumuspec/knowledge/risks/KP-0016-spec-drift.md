---
# === 标识 ===
id: "KP-0016"
title: "规范漂移风险与防控策略"
type: risk
status: confirmed
scope: "global"
created_at: "2026-07-09T10:30:00Z"
updated_at: "2026-07-29T00:00:00Z"
verified_at: "2026-07-29T00:00:00Z"

# === 来源 ===
source_change: "initial-design"
source_phase: "design"
source_artifact: "docs/reference/drift-detection.md"

# === 图谱关联 ===
graph_bindings:
  nodes: []
  edges: []

# === 索引 ===
tags: ["risk", "spec-drift", "code-drift", "enforcement", "blocking"]
related_pages:
  - "KP-0001"
backward_refs: []

# === 认知框架溯源 ===
cognitive_origin:
  quadrant: "Q4"
  reasoning_chain: []
  confidence: high
---

## 背景

规范描述的约束与代码实际行为可能不一致，这种漂移会逐渐侵蚀规范的权威性。

## 漂移类型与级别

| 漂移类型 | 级别 | 阻断行为 |
|---------|------|---------|
| **规范漂移**（spec_drift） | P0 | Pre-commit 阻断 |
| **SHALL NOT 违规**（shall_not_violation） | P0 | Pre-commit 阻断 |
| **图谱漂移**（graph_drift） | P1 | CI 阻断合并 |
| **测试不可变性漂移**（test_immutability_drift） | P1 | CI 阻断合并 |
| **Ponytail 漂移**（ponytail_drift） | P1 | CI 阻断合并 |
| **契约漂移**（contract_drift） | P2 | 仅报告 |
| **知识漂移**（knowledge_drift） | P2 | 仅报告 |
| **设计文档漂移**（design_doc_drift） | P2 | 仅报告 |

### P0 漂移（Pre-commit）

规范约束与代码不一致时，立即阻断 git commit：
- spec_drift：`SHALL use @RestController` 但代码有 `@Controller`
- shall_not_violation：`SHALL NOT use console.log` 但代码有 `console.log`

### P1 漂移（CI）

更多维度的不一致检测，PR 合并前阻断：
- graph_drift：函数在图谱中但代码已删除
- test_immutability_drift：测试用例被篡改（hash 不匹配）
- ponytail_drift：引入了未声明的新依赖或过度抽象

### P2 漂移（报告）

仅生成报告，不阻断：
- contract_drift：契约声明了未使用的端点
- knowledge_drift：知识页面过期
- design_doc_drift：设计文档与代码图谱不一致

## 防控策略

### 1. 自动化检测

```bash
# Pre-commit hook
mumuspec drift --level=P0

# CI pipeline
mumuspec drift --level=P0,P1

# 定期报告
mumuspec drift --all
```

### 2. 漂移修复

| 漂移类型 | 自动修复 | 手动修复 |
|---------|---------|---------|
| spec_drift | 否（需修改代码） | 是（AI 辅助重构） |
| graph_drift | 是（重新索引） | 否 |
| test_immutability_drift | 否 | 是（回退到 Design） |
| knowledge_drift | 否（需重新验证） | 是（更新 knowledge page） |

### 3. 例外清单

以下不论强度等级始终阻断：
- SHALL NOT 违规（CI 阶段）
- 测试不可变性漂移

## 影响

- 规范权威性与代码一致性可被量化监控
- CI 阶段阻断漂移，避免"破窗效应"
- P2 漂移报告提供改进参考，不阻塞快速迭代

## 关联约束

- SHALL: SHALL NOT 违规 SHALL 在 CI 始终阻断，不受强度等级影响
- SHALL NOT: 测试用例不得在设计锁定后修改
