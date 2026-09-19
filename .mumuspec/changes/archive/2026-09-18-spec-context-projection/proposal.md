# Proposal: spec-context-projection

## Why

`loadSpecContext` 按层**整文件**进 context（src/spec/loader.ts L43-114）：目标范围只需少量 Requirement，却把整份 tech/prd 的 prose 与无关要求全量披露——稀释 LLM 判断、浪费 token，与"渐进式披露""Rules 32KiB 预算"纪律相悖。

## What

1. spec 前端声明披露清单：frontmatter 新增 `disclosure: [Requirement 名...]`（可选键）。
2. `loadSpecContext` 对声明了 `disclosure` 的层做**机械投影**：仅保留 frontmatter + 清单内 `## Requirement:` 块（heading/区块边界过滤，无语义判断）；`requirements` 数组同步过滤。
3. 未声明 `disclosure` 的层输出与现状**逐字节一致**（向后兼容）；MCP `get_spec_context` / CLI `context` 消费投影后的 SpecLayerContext。

## Impact Scope

- .

## User Decisions

- 无阻塞项（可选键，缺省行为零变化）

## Workflow

full