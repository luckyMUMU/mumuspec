# Verify: enforcement-coverage

## verify_result

pass

## 测试证据

- 目标回归：`vitest run tests/change/archive-branches.test.ts tests/change/archive.test.ts tests/change/manager-deep.test.ts` → 3 files / **98 tests passed**（含新增 E-CHANGE-022 fail-closed 五态测试：目录不可读 / 目标缺失 / 写失败 / 幂等 skip / 空目录）。
- 全量套件：`vitest run` → 除已知环境性失败（tests/git、tests/cli git-hooks e2e、tests/env-cli、tests/hooks 的 git-PATH 依赖用例；本会话 shell 无 git/coreutils，与 2026-09-13 基线记录一致，非回归）外全部通过；`tests/cli/cli-smoke.test.ts` 复跑 **5/5 passed**。
- 自检三件套：`mumuspec check` exit 0（regen-rules 后 drift OK）；`mumuspec validate` ✓ All specs are valid（327 约束，declared_ratio 100%，unverifiable 0）；`npm run ci:check` ✅ 0 error 0 warning。

## 人工验证证据（MRGT-01）

MRGT-01（SHALL NOT 静默丢弃 delta 的负向断言）已由以下自动化测试覆盖并人工复核：

- `mergeDeltaSpecsToMain — fail-closed (E-CHANGE-022)` 五个用例逐条对应 design.md TC1–TC5，断言 unresolved/skippedIdempotent/merged 三态与 writeText 未被调用（无静默丢弃路径）。
- 人工复核归档调用点（archive.ts archiveChange）：unresolved 非空 → appendAuditLog（result: failed）+ 抛 E-CHANGE-022 中断归档；finalize-archive.ts 调用点同步将 unresolved 降级为显式 warning（不折叠进绿色 merged 行）。
- 实跑核验：修复前制造 temp 备份目录污染场景曾复现 validate 报错（walker 扫描），本变更未触及该路径；coverage 输出在 327 约束实库上验证 remediation 提示链路无回归（当前 unverifiable=0，提示分支由单测覆盖）。

## 验收标准对照（proposal Acceptance Criteria）

1. delta 目标缺失/读写失败 → E-CHANGE-022 中断归档 ✓（TC1/TC2 + 调用点实现）
2. marker 幂等重跑不触发 E-CHANGE-022 ✓（TC3 skippedIdempotent）
3. validate unverifiable 清单逐条修复路径提示 ✓（spec.ts validate 文本 + JSON remediation 字段）
4. E-CHANGE-022 注册 ERROR_CODES ✓（docs/reference/error-codes.md 已再生，110 码 / 20 域；check/validate/ci:check 全绿）
