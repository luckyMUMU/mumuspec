# Proposal: enforcement-coverage

## Why

SDD 生态对比（review/2026-09-13-sdd-ecosystem-comparison.md）显示 enforcement/verification 是品类最大缺口，MumuSpec 的差异化护城河在于机械校验。但引擎自身仍存在两处"执行了动作却没留下可判定事实"的 fail-open 缺陷：

1. `mergeDeltaSpecsToMain()`（src/change/archive.ts）在 delta-spec 无法解析目标（target 缺失）时静默 `continue`，且整个函数被 `catch { /* Non-fatal */ }` 包裹——delta 内容被静默丢弃，归档仍报成功。这正是 OpenSpec v1.13 修复的同类缺陷（apply 报告"无 delta"静默成功），MumuSpec 应比它更严：fail-closed。
2. `mumuspec validate` 的 Enforcement Coverage 报告已输出 unverifiable 迁移清单（327 条约束 / declared_ratio 100%），但清单项缺少 E-SPEC-015 出口三分法的逐条修复路径（补注解 / 改写为词法可提取 / 声明 manual），修复动作不可直接执行。

## What

1. **Delta 合并 fail-closed**：`mergeDeltaSpecsToMain()` 返回合并结果（merged / unresolved 及原因）；目标无法解析或读写失败时不再静默跳过，而是收集为 unresolved；归档调用方发现 unresolved 时抛出 `E-CHANGE-022 DELTA_MERGE_INCOMPLETE`（注册 ERROR_CODES，forceable: false），中断归档并留 audit 记录。已合并幂等跳过（marker 命中）不算 unresolved。
2. **覆盖率清单修复路径**：validate 的 unverifiable 清单项按极性给出可执行修复提示——SHALL NOT：`mumuspec annotate` 补注解 / 改写文本含反引号词法锚点 / Enforcement 声明 manual；SHALL：Enforcement 声明 manual（SHALL 当前无自动通道）。

## Impact Scope

- `src/change/archive.ts` — mergeDeltaSpecsToMain 签名与 fail-closed 语义
- `src/core/errors.ts` — 新增 E-CHANGE-022
- `src/cli/commands/spec.ts` — validate 输出修复路径提示
- `tests/` — fail-closed 行为与修复提示的回归测试

## Acceptance Criteria

- delta-spec 目标缺失或读写失败时，archive 报 E-CHANGE-022 并中断，不再静默成功
- 幂等重跑（marker 已存在）不触发 E-CHANGE-022
- `mumuspec validate` 的 unverifiable 清单逐条附修复路径提示
- 新错误码注册 ERROR_CODES，文档生成器可见；`mumuspec check` / `validate` / `ci:check` 全绿

## Workflow

full
