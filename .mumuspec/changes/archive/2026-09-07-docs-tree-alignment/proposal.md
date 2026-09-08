# Proposal: docs-tree-alignment

## Why

0.19.2-alpha.10 发布后（p0-calibration-hardening 归档），文档树与实现出现多处漂移（2026-09-07 审计，17 条发现）：
命令参考含幻影命令（config/wizard/rollback/snapshot/worktree/layer/design/doc/test-suites/test-immutability/cognitive-map/index 均不在 CLI 顶层）、新命令 `capability`/`finalize-archive` 未记录、`install claude/cursor` 仍标 "coming soon"（已支持）、MCP 工具数声称 20（实际 35）、CONTRIBUTING 测试数过时（实际 244 文件）、附录报告版本基准 0.17.0 未标注快照属性。

## What

以 0.19.2-alpha.10 实际 CLI/代码为基准，从文档根（README）到叶子（docs/reference、docs/appendix）逐层修订：
1. cli-commands.md：删除幻影命令章节，补 capability/finalize-archive/state 子命令/test-cases hash，修正 coming soon。
2. README.md：命令速查补 capability。
3. mcp-tools.md：20 → 35 工具口径刷新。
4. CONTRIBUTING.md：测试规模数字刷新。
5. directory-structure.md / skill-ecosystem.md：.cursorrules 遗留口径对齐 C3 红线。
6. 附录研究报告：版本基准标注"撰写时快照"。
7. getting-started-agent.md 等版本引用对齐 0.19.2-alpha.10。

## Impact Scope

- docs/**（reference、appendix、getting-started）
- README.md、CONTRIBUTING.md
- 不涉及 src/ 代码变更

## Workflow

tweak
