# New SHALL NOT Constraints

## Requirement: 轻量路径需求冻结与最小可解析单元

- SHALL NOT: 禁止在 proposal 未声明 blocking 用户决策时为轻量档新增任何硬性阶段门禁（保持 CHG-5「只增不改」，默认行为与现状完全一致）。
- SHALL NOT: 禁止将最小可解析单元规则或 `skip_specs` 语义扩大到 full workflow（full 的守卫与校验行为必须零变化）。
- SHALL NOT: 禁止以 `--no-spec-delta` 作为绕过 verify 结果约束的旁路（verify 测试绿 + 漂移检查为最终收口，不可豁免）。

Enforcement:

- ENF-1: manual(回归测试：TC-L0-01/06 锁定无声明与 full 行为不变)