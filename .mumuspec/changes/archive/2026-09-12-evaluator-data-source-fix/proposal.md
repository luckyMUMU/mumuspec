# Proposal: evaluator-data-source-fix

## Why

自改进 Loop 的 `spec-compliance` 与 `drift-score` 两个 evaluator 的数据源**从未真正连通**（E17，
remediation-plan v2）。实测三个断层叠加：

| 断层 | spec-compliance | drift-score |
|---|---|---|
| CLI 参数非法 | `guard <change> build --format json`——guard 只定义 `--json`，无 `--format` | `drift detect --format json`——drift 无 `--format` 选项 |
| 输出契约不匹配 | guard `--json` 输出 `{passed: boolean}`（布尔），被解析为 `passed ?? 0` → 恒 1.0 假满分 | `drift --json` 输出数组 `DriftResult[]`，`report.totalViolations` 取不到 → NaN |
| Windows 无法启动 | `spawnSync('npx', ...)` 不设 `shell`，win32 上 `npx.cmd` 不解析 → `result.error` → 恒 nullResult(weight 0) |

净效果：这两个权重各 0.2 的指标**在 composite 中永远缺席**（P1-3 修的是"成功时返回正确 weight"，
但这两个永远走不到成功分支）。P1-2 修完收敛判据后，若这两个指标继续缺席，收敛将基于残缺指标集。

## What（数据源重新设计，均沿用 constraint-density 已确立的 CLI-first 纪律与 win32 shell 修复模式）

- **spec-compliance** → `npx mumuspec check --json`
  - 解析 `{compliance: {errors: GuardError[], coverage?: {total}}}`
  - `total = coverage.total`（fullCheck 时的运行时约束总数），`failed = compliance.errors.length`
  - `complianceRate = 1 - failed/total`（运行时真实合规率，非静态注解覆盖率——coverage 只取 total 作分母，不取 declared_ratio）
  - `coverage` 缺失（非 full）/ total 为 0 → nullResult（诚实跳过）
- **drift-score** → `npx mumuspec drift --json`
  - 解析顶层数组 `DriftResult[]`；`violations = 数组长度`
  - `score = 1 - min(1, violations / DRIFT_SATURATION)`，`DRIFT_SATURATION = 10`（内部常量，
    有界归一化——不再虚构不存在的 `totalChecks` 分母）
- **两者统一**：
  - `shell: process.platform === 'win32'`（修 E17 第三层）
  - stdout 从首个 `{` 切片解析（多行美化 JSON，constraint-density 模式）
  - 只对 `result.error`（进程无法启动）nullResult；`status !== 0` 但 stdout 可解析时**照常计算**——
    check/drift 报问题恰恰意味着低分，拒绝解析会把低分谎报为"跳过"

## Impact Scope

- `src/core/metrics/spec-compliance.ts`
- `src/core/metrics/drift-score.ts`
- `tests/core/metrics/weight-single-source.test.ts`（mock 契更新）
- `tests/core/metrics/data-source-contract.test.ts`（新增：多行 JSON / status 治理 / capping）

## Workflow
hotfix