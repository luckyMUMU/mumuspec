# Test Cases: strength-suggested (Layer 0)

> 对应 delta-spec：`delta-specs/.-tech.md` ｜ 用 `mumuspec test-cases lock-suite` 锁定

## TC-L0-01 suggestStrengthFor 映射（positive）

- 前置：severity ERROR / WARN / INFO / 缺省。
- 步骤：`suggestStrengthFor`。
- 期望：high / medium / low / low（缺省兜底）；幂等。

## TC-L0-02 collectStrengthDeviations 偏差（positive）

- 前置：constraint_strength `{technical_design:'medium', requirement_goals:'high'}`；注册表存在 ERROR 级 def。
- 步骤：`collectStrengthDeviations`。
- 期望：每条偏差含 code/severity/dimension/suggested=high/actual；无缺陷维度不产生偏差。

## TC-L0-03 无偏差（positive / 回归）

- 前置：全部维度 high。
- 步骤：同上。
- 期望：空数组。

## TC-L0-04 doctor 输出（positive）

- 前置：仓库根。
- 步骤：`mumuspec doctor`。
- 期望：输出含 "Constraint strength:"；不产生 config 写入（config.yaml mtime 不变）。