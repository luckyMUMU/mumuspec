---
scope: docs/appendix
layer: 2
---
# Technical Design: appendix

## SHALL
- 附录文档标注 `> 层级: Level 3 附录`
- roadmap.md 的 Phase 进度数据必须引用自 ../STATUS.md，不得自行描述进度
- comparison.md 速查表与 mumuspec-ecosystem-comparison.md 深度报告之间必须有交叉引用链接
- 工作量估算以 implementation-plan.md 为基准来源，其他文档引用此基准

## SHALL NOT
- 禁止在附录中描述已实现功能的操作步骤（操作内容属于 reference/）
- 禁止在多个附录文档中重复描述同一进度数据（统一引用 STATUS.md）

## 架构决策
- **Level 3 定位**：附录作为深度补充材料，面向深入了解者，与日常使用文档分层
- **调研与对比分离**：comparison.md 为速查表，mumuspec-ecosystem-comparison.md 为深度报告，
  ai-agent-ecosystem-research.md 为生态调研，各司其职避免冗余
- **进度引用规范**：路线图进度统一引用 STATUS.md，确保单一权威来源

## 依赖关系
- 引用 ../STATUS.md 的进度数据（Phase 路线图进度、能力层进度表）
- 引用 ../implementation-plan.md 的工作量估算基准
- 引用 ../overview.md 的设计支柱与架构图
- comparison.md 引用 reference/ 各文档中的 CLI/MCP 工具列表
