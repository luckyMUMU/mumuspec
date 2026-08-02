---
scope: docs/reference/skills
layer: 3
---
# Technical Design: skills reference

## SHALL
- 每个 Skill 设计文档包含设计原则、Skill 文件清单、统一结构模板章节
- 统一结构模板定义 10 个必选章节（Frontmatter → 领域 Skill 提示）
- 阻塞点使用统一编号（BP-N）并标注所在阶段与适用工作流
- 状态机字段参考与 src/change/state-machine.ts 实现保持一致

## SHALL NOT
- 禁止在参考文档中放置 Skill 执行逻辑（执行逻辑在 skills/ 目录的 .md 文件中）
- 禁止阻塞点编号重复或缺失

## 架构决策
- **三大参考体系借鉴**：从 Comet 借鉴决策核心/阻塞点/幂等性，从 OpenSpec 借鉴工件驱动/CLI 集成，
  从 Superpowers 借鉴技能优先级/红旗自检
- **统一结构模板**：所有 Skill 遵循 10 章节统一结构，保证一致性与可维护性
- **MumuSpec 独有增强**：双向约束守卫、认知框架集成、知识层加载、Ponytail 约束等
  在参考体系基础上的增量设计

## 依赖关系
- 引用 ../../design/ai-integration.md 的 AI 集成层设计
- 引用 ../../design/change-layer.md 的五阶段生命周期设计
- 引用 skills/ 目录中的原生 Skill 执行文件（.md）
- 引用 ../phase-guards.md 的 Phase Guard 规则
