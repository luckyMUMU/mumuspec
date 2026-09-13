# Proposal: delta-channel-gate

## Why

改进计划 A3-part2：变更带入的 delta 约束（constraints/ 与 delta-specs/）在进入 verify 阶段前，没有任何机械检查确认它们具备验证通道——无通道的约束可以默默穿过 verify 并随归档进入主规范强制面。这与"没有验证通道的约束不允许默默通过验证阶段"的目标直接冲突，也是 E-SPEC-015（主规范侧）与变更工件侧之间的检查真空。

## What

1. 新增 src/guard/delta-channels.ts：`collectUnchanneledDeltaConstraints(changeDir)` 扫描 constraints/ 与 delta-specs/ 下非空 .md，按 Requirement 块提取 `- SHALL` / `- SHALL NOT` 条目（兼容 `- SHALL: x` 与 `- SHALL NOT x` 两种书写），按四分类语义判定通道：
   - 块内含 `Enforcement:` 声明（含 manual(...)）→ manual 通道（可）
   - SHALL NOT 文本含反引号词法锚点（复用 isRegexCheckable）→ R2 通道（可）
   - 文本以 `ast:` 前缀 → R1 通道（可）
   - SHALL 无上述通道 → 不可（SHALL 无自动通道）
2. phase-guard 的 build→verify 门禁（checkBuildToVerify）接线：存在不可通道条目 → `E-GUARD-010 DELTA_CONSTRAINT_UNCHANNELABLE`（ERROR，forceable: false；唯一出路与 E-SPEC-015 同构：补 Enforcement 声明 / 改写词法锚点 / ast: 前缀）。
3. W-SPEC-016 同源纪律：新码注册 ERROR_CODES，phase-guards.md 权威清单同步。

## Impact Scope

- src/guard/delta-channels.ts — 新增
- src/guard/phase-guard.ts — checkBuildToVerify 接线
- src/core/errors.ts — E-GUARD-010 注册
- docs/reference/phase-guards.md — 检查项清单同步
- tests/guard/ — 门禁正反例

## Acceptance Criteria

- 变更 constraints 含无通道 SHALL/SHALL NOT → build→verify 门禁报 E-GUARD-010（含文件与条目）
- 块内声明 Enforcement: manual(...) 或词法锚点/ast: 前缀 → 通过
- 无 constraints/delta-specs 的变更（tweak 类）自然通过
- 三件套不回退；tests/guard 相关套件全绿

## Workflow

full
