# Verify Report: legacy-cleanup-fix

## 验证结果：pass（hotfix，layer-0 单层验证）

| 检查 | 结果 |
|---|---|
| test-cases verify | 通过（hash 一致） |
| check | All checks passed / drift OK——temp/probe 的 spec_drift 警告清零（扫描面修复生效） |
| validate | 通过；unverifiable=0、declared_ratio 100%（337 约束，夹具退出后口径恢复干净） |
| 新增测试 | tests/guard/affected-scopes-normalize.test.ts（4，TC-01/02/03/05）+ tests/core/utils-find-spec-dirs.test.ts（1，TC-04），全部先红后绿 |

## Enforcement 覆盖（manual 通道验证记录）

- 本变更无 delta-spec / constraints 载入强制面；行为由上述测试锁定。

## 分支处理

- 就地开发（master）：branch_status=handled（既有裁决：平台嵌套 ref 限制）。
