---
id: "KE-refactor-init-and-archive-qa-summary"
title: "Knowledge extracted from refactor-init-and-archive"
type: decision
status: confirmed
scope: "refactor-init-and-archive"
merged_from:
  - KE-refactor-init-and-archive-445f7d24
  - KE-refactor-init-and-archive-519099a3
  - KE-refactor-init-and-archive-59da985d
  - KE-refactor-init-and-archive-99f43c0a
  - KE-refactor-init-and-archive-d0d3333c
  - KE-refactor-init-and-archive-hyperplan
  - KE-refactor-init-and-archive-patterns
  - KE-refactor-init-and-archive-lessons
  - KE-refactor-init-and-archive-q3-ee64af6b
  - KE-refactor-init-and-archive-q4-risk
  - KE-refactor-persistent-spec-3d7b4815
---

# Knowledge Extracted: refactor-init-and-archive

## Decisions

### Q1: tech.md 和 prd.md 的职责边界如何界定?
tech.md 承载技术视角（HOW：架构、约束、实现规范），prd.md 承载产品视角（WHAT & WHY：用户场景、验收标准）。

> 注：此决策与 refactor-persistent-spec 变更中 "prd.md vs tech.md 职责划分"（KE-refactor-persistent-spec-3d7b4815）完全一致，仅保留一份。

### Q2: init 生成分布式规约的推断来源是什么?
tech.md 从代码结构、import 关系、测试覆盖推断；prd.md 从 README、代码注释、JSDoc 推断。

### Q3: 归档后旧 spec.md/design.md 默认行为是什么?
默认保留（backward compat），用户可选择删除或保留。

### Q4: finalize-archive 如何保证原子性?
使用临时目录备份原始文件，任一步骤失败可回滚。每个子流程独立错误处理，不阻塞后续步骤。

### Q5: init 对已有 prd.md/tech.md 如何处理?
默认跳过，--force 显式覆盖。

### D-001: Separate finalize-archive command (Open Decision)
**Context**: Archive phase has many mechanical operations that should be CLI-assisted rather than agent-driven.
**Decision**: Create a separate `finalize-archive` CLI command that handles all post-archive cleanup operations.
**Consequence**: Cleaner separation of concerns; archive command focuses on state transition, finalize-archive handles file operations.

### D-002: Init generates distributed specs (Open Decision)
**Context**: Current init only generates root-level spec.md + design.md.
**Decision**: Init will auto-generate distributed prd.md (top-down) and tech.md (bottom-up) across all module directories.
**Consequence**: Less manual work for agent; consistent spec structure from the start.

## Rationales

### Q1: 旧版 archive 命令的 delta-specs 合并逻辑是否完整?
现有 mergeDeltaSpecsToMain 仅追加到根 spec.md，需扩展为按 scope 路由到对应 tech.md/prd.md。

## Patterns

### Architecture Overview

本变更重构 `mumuspec init` 命令实现分布式 spec 生成，并新增 `finalize-archive` CLI 命令封装归档固化操作。设计遵循"brainstorming 不可跳过"和 Ponytail 约束，仅添加必要代码，不引入未请求的抽象层。

变更范围:
- src/cli/index.ts — 扩展 init 命令
- src/core/init-generator.ts — 新增分布式生成逻辑
- src/core/spec-scaffolder.ts — 新增（技术推断引擎）
- src/cli/commands/finalize-archive.ts — 新增命令
- src/change/manager.ts — 扩展 archiveChange 支持 finalize
- templates/ — 新增 prd.md/tech.md 模板

### API Contracts

#### init 命令扩展

```typescript
program
  .command('init')
  .description('Initialize MumuSpec with distributed spec generation')
  .argument('[path]', 'project path', '.')
  .option('--name <name>', 'project name')
  .option('--language <lang>', 'primary language', 'typescript')
  .option('--framework <fw>', 'framework')
  .option('--skip-analysis', 'skip project analysis')
  .option('--no-import', 'skip importing existing documents')
  .option('--force', 'overwrite existing prd.md/tech.md')  // NEW
```

生成流程输出：
```
✓ Config:        .mumuspec/config.yaml
✓ Root Spec:     .mumuspec/spec.md
✓ Root Design:   .mumuspec/design.md
✓ Prd (root):    .mumuspec/prd.md         ← NEW
✓ Tech (root):   .mumuspec/tech.md        ← NEW
✓ Prd (src/):    src/.mumuspec/prd.md     ← NEW
✓ Tech (src/):   src/.mumuspec/tech.md    ← NEW
✓ Prohibitions:  .mumuspec/prohibitions.md
✓ Index:         .mumuspec/index.yaml
```

#### finalize-archive 命令

```typescript
program
  .command('finalize-archive')
  .description('Post-archive cleanup: merge specs, update index, clean cache')
  .argument('<change-name>', 'archived change name')
  .option('--delete-old', 'auto-delete old spec.md/design.md without prompt')
  .option('--keep-old', 'auto-keep old spec.md/design.md without prompt')
```

执行序列（原子操作，任一步骤失败可回滚）：
```
B0: 验证变更已归档（archive-completed）
B1: delta-specs 合并到 scope 的 tech.md/prd.md
B2: 更新 prohibitions.md
B3: 重建 index.yaml
```

## Lessons

从 design.md 提取的架构设计经验：
- init 命令扩展通过 --force 标志控制覆盖行为，兼顾安全与便利
- finalize-archive 独立为命令，保持 archive 命令职责单一
- delta-specs 按 scope 路由避免根文件膨胀
- 模板生成需支持分布式输出（prd.md/tech.md 按层级创建）

## Risks

- **向后兼容性风险**: 新命令不影响旧工作流；旧 spec.md/design.md 默认保留。
- **delta-specs 合并可能覆盖用户修改**: 需要注意保护用户手动修改的内容。
- **大型项目初始扫描可能耗时超过 5s**: 需要考虑性能优化或异步处理。

## Hyperplan

Hyperplan adversarial review: executed, no material issues found
