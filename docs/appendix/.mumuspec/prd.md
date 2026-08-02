---
scope: docs/appendix
layer: 2
---
# Product Requirements: appendix

## 模块职责
appendix 目录是 MumuSpec 文档体系的 Level 3 深度补充材料集合。
它提供生态调研报告、项目对比分析、实施路线图、目录结构参考与开放问题清单，
面向需要深入了解 MumuSpec 设计背景与演进方向的读者。

## 存在理由
核心设计文档（design/）与操作参考（reference/）聚焦"如何用"与"怎么实现"，
而附录回答"为什么这样设计"与"未来走向哪里"。这些材料帮助决策者评估
技术选型、理解与竞品的差异、规划中长期路线，但不属于日常使用必读内容。
将它们放在 Level 3 避免普通用户的上下文过载。

## 用户场景
1. **技术选型决策**：阅读 comparison.md 速查表与 mumuspec-ecosystem-comparison.md 深度报告，
   对比 MumuSpec 与 OpenSpec/Comet/Superpowers 等参考项目的核心差异
2. **规划路线**：阅读 roadmap.md 了解 Phase 1-5 实施计划、DoD 验收标准与工作量估算
3. **理解生态**：阅读 ai-agent-ecosystem-research.md 了解 AI Coding Agent 生态五大方向深度调研
4. **追踪开放问题**：阅读 open-questions.md 了解尚未解决的设计问题与技术风险验证 Sprint
5. **查阅目录结构**：阅读 directory-structure.md 了解完整项目目录布局示例

## 验收标准
- comparison.md 提供三项目（MumuSpec/OpenSpec/Comet）核心差异速查表
- mumuspec-ecosystem-comparison.md 覆盖 8 个对标项目的六维度对比与差距分析
- roadmap.md 的 Phase 进度百分比引用自 STATUS.md，为唯一权威来源
- open-questions.md 列出所有尚未解决的设计问题，标注 Top 3 技术风险
- 每篇附录文档末尾包含导航链接（上一页/下一页/返回概览）
