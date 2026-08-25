---
layer: 1
scope: ".changes/workflow-freedom-improvement"
last_updated: "2026-08-02"
doc_type: tech
change: workflow-freedom-improvement
parent_tech: ../../../tech.md
phase: design
---

## Requirement: Path Recommender Implementation

### SHALL
- 实现 `estimateScope(intent, projectContext)` → `{ files, modules, apiChanges, newDeps, riskLevel }`
- 实现 `recommendPath(scope)` → `{ path, confidence, rationale }`
- 推荐结果嵌入 proposal.md 模板
- 支持三路径：`full` / `tweak` / `hotfix`

### SHALL NOT
- 不得绕过用户的最终确认（L1 模式）
- 不得修改现有的 workflow.yaml 中的 phase 定义数据结构

### Enforcement
- TECH-WF-01: `recommendPath` 返回类型必须匹配 PathRecommendationSchema
- TECH-WF-02: 推荐结果的 confidence 量化在 [0, 1] 区间

## Requirement: Blocking Point Advisor Framework

### SHALL
- 实现 `BPAdvisor` 接口（bp_id, analyze, suggest, autoResolve?）
- 每个已有 BP (BP-1 ~ BP-18) 注册一个 Advisor
- Advisor 的 `suggest()` 返回 2-3 个 BPResolution 选项
- 推荐选项标记 `recommended: true`（有且仅有一个）

### SHALL NOT
- 不得移除现有 Guard 检查逻辑
- 不得允许 BP Advisor 绕过用户确认直接标记阻塞点为通过

### Enforcement
- TECH-WF-03: BPAdvisor 接口通过 TypeScript 类型校验
- TECH-WF-04: `suggest()` 返回数组长度 ∈ [2, 3]

## Requirement: Phase Compressor

### SHALL
- 实现 `canCompress(changeState)` → `{ allowed: boolean, reason: string }`
- 压缩条件定义在 `workflow.yaml` 的 `compression_rules` 字段
- 触发压缩时写入 `.mumuspec.yaml` 的 `auto_decisions`

### SHALL NOT
- NEVER 压缩条件以外的变更不得自主压缩
- 压缩决策不得写入 spec.md / 删除 spec 内容

### Safety FENCE (硬编码)
```
NEVER_COMPRESS_IF:
  - cross_module == true
  - new_public_api == true  
  - new_external_dep == true
  - data_migration == true
```

### Enforcement
- TECH-WF-05: 安全围栏为硬编码不可被 YAML 配置覆盖
- TECH-WF-06: 所有自主压缩决策包含 timestamp 和 approved_by 字段

## Requirement: Skill Auto-Loader

### SHALL
- 实现 `computeSkillSet(taskCharacteristics)` → `SkillEntry[]`
- Skill 映射表定义在 `SKILL_RULES.yaml`（新增文件）
- 默认加载 workflow.yaml 中声明的 required_skills
- 动态加载的 Skill 合并到执行上下文

### SHALL NOT
- 不得跳过 workflow.yaml 中的 `required_skills`
- 不得导致 Required Skill 的 on_exit 钩子被绕过

### Enforcement
- TECH-WF-07: required_skills ⊆ computed_skill_set（子集关系校验）
- TECH-WF-08: SKILL_RULES.yaml 格式通过 JSON Schema 验证

## Requirement: Decision Audit Trail

### SHALL
- 所有自主决策（L2+）写入 `.mumuspec.yaml` 的 `auto_decisions: []`
- 每个决策包含：timestamp、phase、decision、rationale、confidence、approved_by
- 决策在 mumuspec archive 操作时转移到 audit.log

### SHALL NOT
- LLM 不得修改/删除已写入的 auto_decisions 条目
- 用户确认的决策和自主决策必须在 approved_by 字段区分

### Enforcement
- TECH-WF-09: auto_decisions 为 append-only 数组
- TECH-WF-10: 非 archive 阶段不允许清空 auto_decisions

## Appendix: File Change Map

| File | Change |
|------|--------|
| `src/core/workflow-recommender.ts` | 新增：路径推荐引擎 |
| `src/core/bp-advisor.ts` | 新增：阻塞点建议框架 |
| `src/core/phase-compressor.ts` | 新增：阶段压缩逻辑 |
| `src/core/skill-loader.ts` | 新增：Skill 动态加载 |
| `src/core/types-workflow.ts` | 修改：新增 AutoDecision, ScopeEstimation, SkillRule |
| `.mumuspec/bundles/mumuspec-skills/workflow.yaml` | 修改：新增 compression_rules, skill_rules |
| `src/cli/commands/recommend.ts` | 新增：mumuspec recommend 命令 |
| `src/cli/commands/new.ts` | 修改：创建 change 时触发 scope estimation |
| `src/cli/commands/guard.ts` | 修改：BP 触发时调用 advisor |
