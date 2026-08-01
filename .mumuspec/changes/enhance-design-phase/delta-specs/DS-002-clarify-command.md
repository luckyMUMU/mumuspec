---
title: Clarification Loop Command
id: DS-002
scope: src/cli.ts, src/change/clarify.ts (new)
status: proposed
priority: P0
---

# Delta Spec: 澄清循环命令

## Current Behavior
无澄清功能，AI 直接生成 design.md。

## New Behavior
新增 `mumuspec clarify <change-name>` 命令：
1. 读取 proposal.md
2. 分析模糊描述、缺失信息、矛盾点
3. 生成最多 5 个澄清问题
4. 交互式提问（使用 AskQuestion 工具）
5. 答案写入 clarification-log.md
6. 提示 AI 将答案整合到 design.md

## CLI Interface
```
mumuspec clarify <change-name> [--max-questions 5]
```

## Output Files
- clarification-log.md — 记录问答内容

## Question Detection Rules
触发澄清的条件：
- proposal 中包含 "等"、"等等"、"类似" 等模糊限定词
- FR 的验收标准不可量化（缺少数字、百分比）
- 技术方案有多个可选路径但没有说明选择理由
- 影响范围不明确（影响哪些模块/接口）
