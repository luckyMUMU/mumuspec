# Design: strength-suggested

<!-- no-open-questions -->
<!-- no-assumptions -->

## 方案概述

强度建议值由元数据确定性推导：severity 映射（ERROR→high / WARN→medium / INFO→low）为纯函数；`collectStrengthDeviations` 以 ERROR_CODES 注册表为单一权威源对比当前 config 强度，输出偏差项；`mumuspec doctor` 呈现"建议 vs 实际"（advisory）。全程不写 config、不改求值路径。

## 实现

### 1. 纯函数（src/core/constraint-evaluator.ts）

- `suggestStrengthFor({ severity }): ConstraintStrength` — severity 主导映射，缺省 low。幂等纯函数。
- `collectStrengthDeviations(config: ConstraintStrengthField): StrengthDeviation[]` — 遍历 ERROR_CODES：缺 severity/dimension 跳过；`strengthRank(suggested) > strengthRank(actual)` 时记录 {code, severity, dimension, suggested, actual}。复用既有 `strengthRank`（config.ts 单一权威源）。不写任何状态。

### 2. doctor 接线（src/cli/commands/doctor.ts）

- 输出新增 "Constraint strength:" 块：无偏差 ✓；有偏差 ⚠ 逐条列出（前 10 条 + 总数），明确"仅提示，需人工签收，不自动修改"。

### 3. 约束

- evaluateConstraint 求值路径零改动；config 写入面零改动（签收红线保留）。

## 错误码

- 无新增。

## 不做什么

- 不自动修改 constraint_strength（红线 bp_04 同源）。
- 不把偏差收集接入 check/validate schema（advisory 仅 doctor 人类可读面）。
- 不引入 LLM / 手写指标（纯代码推导）。

## 测试用例

详见 `test-cases/layer-0-cases.md`（TC-L0-01 ~ TC-L0-04），Design 后经 `test-cases lock-suite` 锁定。