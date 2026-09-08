# Design: docs-tree-alignment

## 概述

以 0.19.2-alpha.10 实际 CLI/代码为基准，对文档树（根 README → docs/reference → docs/appendix）做一致性对齐。源起 2026-09-07 审计（17 条发现），承载于 review/release-0.19.2-alpha.10-2026-09-07.md 流程。

## 实现层（自下而上）

- L0 版本引用刷新：getting-started-agent、feedback-process 示例、appendix 报告快照标注、packaging-deployment 通用占位
- L1 数字/口径刷新：mcp-tools 工具数 20→35、CONTRIBUTING 测试规模、.cursorrules 遗留口径 ×2（C3 红线）
- L2 结构修订：cli-commands.md 删 9 个幻影命令章节、补 capability/finalize-archive/state 子命令/test-cases hash、install claude/cursor "coming soon" 更正
- L3 导航补全：README 增"更多参考"四组（design/reference 其余/standards/appendix），孤儿文档 mcp-guard-drift-proposal 入链

## 关键决策

- D1：附录研究报告（0.17.0 基准）标注"撰写时快照"而非重写——历史文档保持历史真实性
- D2：feedback-process 历史反馈表中的 0.12.1-beta.0 属历史事实，保留不改
- D3：packaging-deployment 通道版本用通用占位 0.x.y-{alpha,beta,rc}.N，避免每次发版都漂移

## 测试策略

- README 导航链接完整性脚本校验（40 链接 0 断裂）
- `mumuspec check` / `drift` 全过
- 纯文档变更，不涉及代码；无新增单测

## 风险

- 幻影命令可能仍被其它文档引用（本次以审计清单为准，未全库扫描残留）→ 后续可在 drift/governance 变更中补
