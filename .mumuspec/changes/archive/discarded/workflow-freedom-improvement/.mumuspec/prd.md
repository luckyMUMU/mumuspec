---
layer: 1
scope: ".changes/workflow-freedom-improvement"
last_updated: "2026-08-02"
doc_type: prd
change: workflow-freedom-improvement
parent_prd: ../../../prd.md
---

## Requirement: Workflow Path Intelligence

### SHALL
- 系统在 change 创建时自动估算变更范围（文件数、模块数、接口变更）
- 系统根据估算结果推荐 hotfix / tweak / full 路径并给出置信度和理由
- 用户必须确认推荐的路径后才能进入下一阶段（L1 模式）

### SHALL NOT
- 系统不得在未经用户确认时跳过 Design 阶段（tweak 预设确认的压缩除外）
- 系统不得推荐压缩 cross_module / new_public_api / new_external_dep 变更

### Enforcement
- PRD-WF-01: Path recommender 在每次 Open 阶段结束时输出推荐
- PRD-WF-02: 推荐输出包含 confidence 和 rationale 字段

## Requirement: Blocking Point Resolution

### SHALL
- 阻塞点触发时，系统提供 2-3 个解决选项并推荐默认选项
- 每个选项包含：操作步骤、预期影响、风险等级
- 用户选择结果写入 decisions.md 审计日志

### SHALL NOT
- 系统不得隐藏阻塞点（所有 BP 必须显式出现）
- 系统不得单方面将阻塞点标记为"已解决"

### Enforcement
- PRD-WF-03: 每个 BP 触发的建议模板必须完整（分析+选项+推荐）
- PRD-WF-04: 审计日志不可被 LLM 自身回退修改

## Requirement: Phase Compression

### SHALL
- 变更 ≤ 2 文件 + 无接口变更 + 无新依赖时，系统可自主以 tweak 模式执行
- 纯文档/注释变更自动跳过 TDD 红绿循环
- 纯 bugfix + 根因已确认时直接进入 RED 测试编写

### SHALL NOT
- 跨模块变更不得自主压缩
- 新公共接口变更不得自主压缩
- 新外部依赖变更不得自主压缩
- 数据迁移变更不得自主压缩

### Enforcement
- PRD-WF-05: 压缩条件满足设计文档中 Phase Compressor 的规则表
- PRD-WF-06: 所有自主压缩写入 .mumuspec.yaml auto_decisions

## Requirement: Skill Auto-Loading

### SHALL
- 系统根据任务上下文动态确定需要加载的 Skill 集合
- Skill 加载列表随变更特征变化
- 不影响现有 Skill 的功能完整性

### SHALL NOT
- 系统不得删除 workflow.yaml 中声明的必需 Skill
- 不得因动态加载导致核心 Guard 被跳过

### Enforcement
- PRD-WF-07: 核心 Skill（gitnexus-exploring、brainstorming）始终加载
- PRD-WF-08: 动态加载的 Skill 在 decisions.md 中可查

## Appendix: LLM Freedom Enhancement Map

| Level | Enhancement | Safety Fence |
|-------|-------------|--------------|
| L1 - Suggestion | Path Recommendation + Blocking Point Advisor | User confirmation required |
| L2 - Conditional Auto | Phase Compression + Skill Loading | tweak-scale only, hard fence for complex changes |
| L3 - Dynamic Orchestration | Parallel Explore + Adversarial Verify | Deferred to Phase 2 |
