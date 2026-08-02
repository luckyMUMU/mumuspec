---
scope: docs/design
layer: 2
---
# Product Requirements: design

## 模块职责
design 目录是 MumuSpec 六层架构的设计文档集合（Level 1）。
它为每个架构层提供详细设计文档，涵盖职责边界、核心数据结构、接口定义、
关键决策与约束规则，是实现者理解系统架构的权威参考。

## 存在理由
overview.md 提供高层架构总览但不含实现细节。实现者需要深入理解每个架构层
的设计动机、数据流、边界条件与决策依据，才能正确实现与扩展系统。
design 目录将这些设计文档按架构层拆分，避免单文件过长，支持按需加载。

## 用户场景
1. **实现 Spec Layer**：阅读 spec-layer.md 理解树状规范解析、渐进式披露、继承规则
2. **实现 Change Layer**：阅读 change-layer.md 理解五阶段生命周期、回退机制、预设路径
3. **实现 Guard Layer**：阅读 guard-layer.md 理解三层校验体系与漂移检测分级
4. **理解约束强度**：阅读 constraint-strength.md 理解双维度三档强度系统与工作流联动
5. **集成 AI 工具**：阅读 ai-integration.md 理解适配层、Skill Bridge、Rules 生成
6. **设计契约层**：阅读 contract-layer.md 理解外部/对外契约与约束派生机制
7. **设计知识层**：阅读 knowledge-layer.md 理解代码图谱、LLM-Wiki、PageIndex

## 验收标准
- 六层架构每层有独立设计文档（spec/contract/change/knowledge/guard/ai-integration）
- constraint-strength.md 覆盖双维度强度矩阵与工作流规则联动
- 每篇设计文档包含架构概览、核心组件、关键决策、与其他层的交互
- 设计文档与 src/ 实现代码保持一致（设计完备性 100%）
