---
id: KE-workflow-tier-hint-patterns
title: Architecture patterns from workflow-tier-hint
type: pattern
status: confirmed
scope: workflow-tier-hint
created_at: 2026-09-13
tags:
  - auto-extracted
  - pattern
  - architecture
  - workflow-tier-hint
graph_bindings: []
---
> Auto-extracted from workflow-tier-hint/design.md

# Design: workflow-tier-hint

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

单点输出增强：`new` 命令尾部在推荐档位与实际档位不一致时显式提示。分档引擎（recommendPath）零改动。

## 实现

change.ts new action 的输出区（`Recommended:` 行附近）：

```ts
if (hasScopeSignals) {
  ... 既有 Recommended 行 ...
  if (rec.path !== state.workflow) {
    console.log(`  ⚠ 规模建议: ${rec.path} —— ${rec.rationale}`);
    console.log(`    如需调整: mumuspec discard ${name} --confirm 后以 --workflow ${rec.path} 重建`);
  } else {
    console.log(`  ✓ 档位匹配: ${state.workflow}`);
  }
}
```

- rec 变量与既有 Recommended 行同源（不二次计算）。
- 只提示不裁决：创建流程与状态机行为零改动。

## 不做什么

- 不做交互式选择（Init/new SHALL NOT 要求交互）。
- 不自动降档/升档（设计决策权在人）。

## 测试用例

1. TC1 信号小变更 + workflow full → 输出含 `⚠ 规模建议: tweak` 与调整指引。
2. TC2 信号小变更 + workflow tweak → 输出含 `✓ 档位匹配`。
3. TC3 无信号 → 两种提示行均不出现。
