# Proposal: spec-fence-guard

## Why

parseRequirements 不感知 fenced code block：规范文档中的代码围栏示例（如规范自文档化时展示 `- SHALL NOT ...` 语法样例）会被解析为**真约束**进入语料——探针实测围栏内 `## Requirement: 示例约束` 被解析出 shallNot 条目。后果：假约束污染四分类与 coverage 统计、词法通道对假条目做字面量检索（假阳性来源）、归档合并的示例内容成为活约束。OpenSpec v1.13 修复过同类 fence 感知缺陷。

## What

1. parser.ts 新增导出 `stripFencedBlocks(body)`：按行剔除 ``` 与 ~~~ 围栏内容（围栏行替换为空行保持段落结构）。
2. `parseRequirements` 在匹配前先剥离围栏——parseSpecFile 的全部下游（validate / check / MCP context）自动受益，无需各自处理。
3. 不改动 parseRequirementBlock 与分类器。

## Impact Scope

- src/spec/parser.ts — stripFencedBlocks + parseRequirements 接线
- tests/spec/ — 围栏正反例回归

## Acceptance Criteria

- 围栏内的 `## Requirement:` / `- SHALL` 示例不再被解析（探针用例 2→1）
- 围栏外正常约束解析不受影响（存量语料 coverage 总数不变）
- 围栏配对（开/闭标记、info string）正确处理；未闭合围栏内容整体忽略
- 三件套不回退

## Workflow

full
