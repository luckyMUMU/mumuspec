---
title: AI Self-Review Protocol
id: DS-003
scope: src/guard/design-reviewer.ts (new)
status: proposed
priority: P1
---

# Delta Spec: AI 自审协议

## Current Behavior
设计文档生成后直接可进入 build，无质量检查。

## New Behavior
新增 `mumuspec review <change-name>` 命令：
1. 读取 design.md + proposal.md + cognitive-map.yaml
2. 按 6 个维度逐项检查
3. 生成 design-review.md
4. CRITICAL 问题阻塞 build（guard 检查）

## Review Dimensions
- 完整性: design 覆盖 proposal 所有 FR（CRITICAL）
- 一致性: Architecture 与 Layers 描述一致（CRITICAL）
- 接口匹配: API Contracts 与 FR 用户交互对应（MAJOR）
- 风险闭环: Q4 risk 都有 mitigation（MAJOR）
- 约束可行: Performance/Security 可实现（MINOR）
- 测试可执行: Test Strategy 有量化验收标准（MAJOR）

## Guard Integration
- review_result 存储在 state 中
- 存在 CRITICAL 问题时 checkDesignToBuild 返回 E-DESIGN-011
