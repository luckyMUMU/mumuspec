---
scope: docs/design
layer: 2
---
# Technical Design: design

## SHALL
- 设计文档标注 `> 层级: Level 1 设计文档 | 所属层: <Layer Name>`
- 每篇设计文档包含架构概览、核心组件、关键决策章节
- 设计文档引用 src/ 中的具体实现文件路径
- 版本变更记录与项目版本号同步更新

## SHALL NOT
- 禁止在设计文档中描述 CLI 操作步骤（操作内容属于 reference/）
- 禁止设计文档与实现代码产生矛盾（设计完备性必须保持 100%）

## 架构决策
- **按架构层拆分**：原单文件设计文档拆分为六层独立文档，支持按需加载
- **设计完备性 100%**：设计文档是实现的权威蓝图，必须与代码保持一致
- **Mermaid 图表**：使用 Mermaid 绘制架构图与流程图，支持 Git 版本控制下的 diff 友好

## 依赖关系
- 引用 ../overview.md 的总体架构图与设计支柱
- 引用 ../reference/ 各文档的 CLI 命令、Phase Guard 规则、漂移检测类型
- 引用 ../appendix/constraint-strength.md（若存在独立的约束强度设计文档）
- src/ 各模块的实现代码是设计文档的落地实现
