---
id: "KE-refactor-persistent-spec-qa-summary"
title: "Knowledge extracted from refactor-persistent-spec"
type: decision
status: confirmed
scope: "refactor-persistent-spec"
merged_from:
  - KE-refactor-persistent-spec-369d38ea
  - KE-refactor-persistent-spec-3d7b4815
  - KE-refactor-persistent-spec-60fe620a
  - KE-refactor-persistent-spec-6c872b4c
  - KE-refactor-persistent-spec-bb5075f6
  - KE-refactor-persistent-spec-hyperplan
  - KE-refactor-persistent-spec-patterns
  - KE-refactor-persistent-spec-lessons
  - KE-refactor-persistent-spec-q3-302293ce
  - KE-refactor-persistent-spec-q3-e34bb339
  - KE-refactor-persistent-spec-q4-risk
---

# Knowledge Extracted: refactor-persistent-spec

## Decisions

### Q1: prd.md 和 tech.md 的职责边界如何界定?
prd.md 承载产品视角（WHAT & WHY），tech.md 承载技术视角（HOW）。约束属于技术实现规范，放入 tech.md。

> 注：此决策与 refactor-init-and-archive 变更中 "tech.md 和 prd.md 的职责边界如何界定？"（KE-refactor-init-and-archive-445f7d24）含义相同。已在前者合并文件中保留完整表述，此处仅引用。

### Q2: 分布式变更存储如何实现 per-scope single_active_change?
每个 .mumuspec/changes/ 独立管理活跃变更，不同 scope 之间互不阻塞。getChangesDir 接受 scope 参数决定存储位置。

### Q3: 渐进式披露如何从固定 3 层改为按需加载?
移除 selectLayersToLoad 的固定层数逻辑，改为 AI 按需调用 loadPrd/loadTech/loadScopeIndex。index.yaml 的 summary 字段提供决策依据。

### Q4: 向后兼容策略是什么?
loader 在 prd.md/tech.md 不存在时回退到 spec.md/design.md，确保迁移期间不中断。

### Q5: delta-specs 归档合并如何路由到正确的 scope?
delta-specs 文件名包含 scope 路径（如 src-core-tech.md），归档时按路径路由到对应目录的 tech.md 或 prd.md。

### D1: prd.md vs tech.md 职责划分
- **决策**: prd.md 承载产品视角（WHAT & WHY），tech.md 承载技术视角（HOW，含 SHALL/SHALL NOT/Enforcement）
- **理由**: 产品需求与技术约束关注点不同，分离后各自独立演进，减少耦合
- **确认**: Grill-Me Q1/Q2 用户确认

### D2: 分布式变更存储 + per-scope single_active_change
- **决策**: 变更存储在 scope 目录的 .mumuspec/changes/ 中，每个 scope 独立管理活跃变更
- **理由**: 与分布式 spec 存储理念一致，不同 scope 可并行推进变更互不阻塞
- **确认**: Grill-Me Q3 用户确认

### D3: 按需加载替代固定 3 层
- **决策**: 移除 selectLayersToLoad 的固定层数逻辑，改为 AI 按需加载
- **理由**: 不同任务需要不同深度的上下文，固定层数要么过载要么不足
- **确认**: Grill-Me Q5 用户确认

### D4: delta-specs 拆分为 -tech.md / -prd.md 按 scope 路由
- **决策**: delta-specs 文件名包含 scope 路径，归档时按路径路由到对应目录
- **理由**: 避免所有变更的 delta-specs 都合并到根 spec.md 导致根文件膨胀
- **确认**: Grill-Me Q6 用户确认

### D5: 保留 prohibitions.md 独立
- **决策**: 不合并到 spec.md，保持独立文件
- **理由**: 用户明确选择保留独立
- **确认**: Grill-Me Q7 用户确认

### D6: 覆盖到叶子目录
- **决策**: 所有有 .mumuspec/ 的目录（含 src/cli/commands/）都创建 prd.md + tech.md
- **理由**: 渐进式披露的完整性要求每个层级都有规范文件
- **确认**: Grill-Me Q7 用户确认

### D7: 向后兼容回退
- **决策**: loader 在 prd.md/tech.md 不存在时回退到 spec.md/design.md
- **理由**: 迁移期间确保不中断现有功能
- **风险**: 回退逻辑在所有迁移完成后应移除

### D8: 走 full 变更流程
- **决策**: 本次重构通过完整的 open→design→build→verify→archive 流程管理
- **理由**: 重构涉及规范系统本身和代码改动，需要完整的设计审查和验证
- **确认**: Grill-Me Q8 用户确认

### D9: 实现顺序为 Bottom-Up
- **决策**: 从叶子目录开始创建 prd.md/tech.md，向上推进到根级，最后做代码改动
- **理由**: 符合项目 implementation_strategy: bottom-up 原则；先完成数据层（spec 文件），再改代码层（loader/manager/guard）
- **影响**: 代码改动阶段可以测试已有 spec 文件的加载

### D10: 使用并行子代理创建 spec 文件
- **决策**: 按 src/ 树、demo/ 树、docs/ 树、其他目录分组，并行创建 prd.md/tech.md
- **理由**: 约 30 个目录需要创建文件，串行创建耗时过长
- **约束**: 每个子代理需要读取现有 spec.md/design.md 内容以提取迁移信息

## Rationales

### Q1: 为什么 knowledge 保持集中存储而非分布式?
知识是跨变更、跨模块的，集中存储便于交叉引用和检索。scope 字段记录来源即可追溯。

### Q2: 为什么保留 prohibitions.md 而非合并到 spec.md?
用户明确选择保留独立。prohibitions.md 作为全局禁止项的快速参考，与 spec.md 的正反规则形成互补。

## Patterns

### 1. 目标架构

#### 1.1 根级 .mumuspec/ 结构

```
.mumuspec/
├── goal.md           <- 项目愿景与北极星指标（NEW）
├── spec.md           <- 全局宪章（重构：仅保留跨模块正反规则）
├── design.md         <- 前端设计风格指南（重构语义）
├── env-spec.md       <- 环境规范（NEW，从 spec.md 提取）
├── prohibitions.md   <- 全局禁止项（保留独立）
├── prd.md            <- 根级产品概览（NEW）
├── tech.md           <- 根级技术概览（原 design.md 六层架构迁入）
├── index.yaml        <- 更新引用名
├── config.yaml       <- 保留
├── audit.log         <- 保留
├── changes/          <- 保留（根级变更仍存储于此）
├── knowledge/        <- 保留（集中存储）
├── contracts/        <- 保留
├── evals/            <- 保留
├── feedback/         <- 保留
├── bundles/          <- 保留
└── (其他保留)
```

#### 1.2 模块级 .mumuspec/ 结构

每个有 `.mumuspec/` 的目录：

```
<dir>/.mumuspec/
├── prd.md            <- 产品视角（NEW，替换 design.md 的产品语义部分）
├── tech.md           <- 技术视角（NEW，替换 spec.md 的约束 + design.md 的技术部分）
└── index.yaml        <- 更新（如有子目录）
```

删除：`spec.md`、`design.md`

#### 1.3 目录覆盖范围（全部叶子节点）

需要创建 prd.md + tech.md 的完整目录树：

```
Root: .mumuspec/         (goal.md, spec.md, design.md, env-spec.md, prohibitions.md, prd.md, tech.md, index.yaml)
├── demo/
│   ├── .mumuspec/      (prd.md, tech.md, index.yaml)
│   └── src/
│       ├── api/.mumuspec/     (prd.md, tech.md)
│       ├── models/.mumuspec/  (prd.md, tech.md)
│       └── storage/.mumuspec/ (prd.md, tech.md)
├── docs/
│   ├── .mumuspec/      (prd.md, tech.md, index.yaml)
│   ├── appendix/.mumuspec/   (prd.md, tech.md)
│   ├── design/.mumuspec/      (prd.md, tech.md)
│   └── reference/
│       ├── .mumuspec/         (prd.md, tech.md, index.yaml)
│       └── skills/.mumuspec/ (prd.md, tech.md)
├── feedback/.mumuspec/         (prd.md, tech.md)
├── scripts/.mumuspec/          (prd.md, tech.md)
├── skills/.mumuspec/           (prd.md, tech.md, index.yaml)
├── src/
│   ├── .mumuspec/      (prd.md, tech.md, index.yaml)
│   ├── bundle/.mumuspec/      (prd.md, tech.md)
│   ├── change/.mumuspec/      (prd.md, tech.md)
│   ├── cli/
│   │   ├── .mumuspec/         (prd.md, tech.md, index.yaml)
... (覆盖所有叶子目录)
```

## Lessons

- prd.md/tech.md 双文件分离有效解耦产品需求与技术约束
- 分布式存储 + per-scope 活跃变更多项目并行推进互不阻塞
- 按需加载替代固定层数，更灵活适应不同任务上下文需求
- delta-specs 按 scope 路由避免根文件膨胀
- 保留 prohibitions.md 独立，作为全局禁止项快速参考
- Bottom-Up 实现顺序确保数据层先于代码层就绪
- 并行子代理大幅提升多目录文件创建效率

## Risks

- **迁移期间现有活跃变更如何处理**: 已存在于根 .mumuspec/changes/ 中的变更应保留原位，迁移完成后验证仍可正常操作。
- **loader.ts 改动是否影响所有依赖 loadSpecContext 的 CLI 命令**: 是。loadSpecContext 被 context、guard、spec 等命令调用。改动需保持函数签名兼容。
- **docs/ 目录当前没有 .mumuspec/，新建是否需要内容填充**: 是。需要从现有 docs/ 文档中提炼 prd 和 tech 内容。docs/ 作为文档目录，prd 描述文档体系的产品目标，tech 描述文档组织规范。

## Hyperplan

Hyperplan adversarial review: executed, no material issues found
