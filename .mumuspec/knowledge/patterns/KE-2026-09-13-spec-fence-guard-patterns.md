---
id: KE-2026-09-13-spec-fence-guard-patterns
title: Architecture patterns from 2026-09-13-spec-fence-guard
type: pattern
status: confirmed
scope: 2026-09-13-spec-fence-guard
created_at: 2026-09-13
tags:
  - auto-extracted
  - pattern
  - architecture
  - 2026-09-13-spec-fence-guard
graph_bindings: []
---
> Auto-extracted from 2026-09-13-spec-fence-guard/design.md

# Design: spec-fence-guard

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

在 parseRequirements 入口统一剥离 fenced code block，单点修复覆盖全部下游消费者；分类器与块解析器不动。

## 实现

### stripFencedBlocks（src/spec/parser.ts，导出）

```ts
export function stripFencedBlocks(body: string): string {
  // 逐行扫描：进入围栏（``` 或 ~~~ 开头，含 info string）后丢弃内容行；
  // 围栏行自身替换为空行，保持段落间距与行号近似稳定。
  // 未闭合围栏：内容行丢弃直到文本结束（保守——假约束宁漏收不误收）。
}
```

### 接线

- `parseRequirements` 第一行 `body = stripFencedBlocks(body)`，后续 regex 匹配与 block 切分全部基于剥离后文本。
- parseSpecFile 无改动（raw 字段保留原文，供渲染类消费者使用）。

## 决策点

- **围栏行替换为空行而非删除**：保持需求块之间的相对分隔，避免相邻块意外粘连。
- **同时处理 ``` 与 ~~~**：CommonMark 两种围栏语法；info string（```markdown）以 startsWith 判定。
- **未闭合围栏 = 丢弃至结尾**：fail-closed 语义——无法判定的内容不进入约束语料。
- **不处理缩进围栏（4 空格代码块）**：需求块内的 4 空格缩进行不构成 `- ` 列表项，天然无害。

## 测试用例

1. TC1 探针复现用例：围栏内 `## Requirement: 示例` + SHALL NOT → 只解析出真实约束（2→1）。
2. TC2 围栏内 `### SHALL` 段与 `- SHALL:` 列表同样被忽略；围栏外真实约束不受影响。
3. TC3 info string（```markdown）与 ~~~ 围栏正确配对；未闭合围栏内容整体忽略。
4. TC4 存量语料回归：parseRequirements 对本仓库根 spec.md 解析结果与剥离前 requirement 数一致（无围栏假阳性存量）。
