---
scope: docs
layer: 1
last_updated: '2026-08-04'
---
# Technical Design: docs

## SHALL
- 文档按渐进式披露分层组织：Level 0（概览/状态）→ Level 1（架构设计）→ Level 2（参考）→ Level 3（附录）
- 每篇文档顶部标注层级标识（如 `> 层级: Level N`）
- 文档间交叉引用必须使用相对路径（如 `design/spec-layer.md`，非绝对 URL）
- 每篇文档末尾必须包含导航链接（上一页/下一页/返回概览）
- STATUS.md 作为项目进度唯一权威来源，其他文档引用而非自行描述进度数据
- 文档版本号必须与项目设计版本同步更新

## SHALL NOT
- 禁止在 Level 0 概览文档中放置实现细节（细节分层到 Level 1+）
- 禁止文档间形成循环引用链
- 禁止使用绝对路径或硬编码 URL 进行内部交叉引用
- 禁止在多个文档中重复描述同一进度数据（统一引用 STATUS.md）

## 架构决策
- **渐进式披露分层**：按读者深度组织文档，避免上下文过载，与 Spec Layer 的加载策略对齐
- **单文件设计文档拆分**：原单文件设计文档按架构层拆分为 design/ 目录下的多文档组
- **导航链接规范**：每篇文档末尾标注导航，支持线性阅读与跳转
- **进度单一来源**：STATUS.md 为进度唯一权威，避免多文档描述不一致

## 依赖关系
- 依赖根 .mumuspec/ 的全局规范（Ponytail 约束、项目结构规范）
- design/ 文档引用 src/ 各模块的实现代码路径
- reference/ 文档引用 CLI 命令实现（src/cli/）与 MCP 工具（src/mcp-server.ts）
- appendix/roadmap.md 引用 STATUS.md 的 Phase 进度数据
- 子目录：appendix/（Level 3 附录）、design/（Level 1 架构设计）、reference/（Level 2 参考）
