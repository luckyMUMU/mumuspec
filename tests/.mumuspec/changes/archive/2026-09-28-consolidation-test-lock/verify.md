# Verify: consolidation-test-lock

- vitest 302 文件 / 5372 用例全绿（较 engine-consolidation 基线 +3：TC-L0-001 两例 + TC-L0-002 一例）；仅存 1 个 vitest worker `onTaskUpdate` RPC 超时的基础设施抖动，非用例失败，复跑两轮一致。
- tsc --noEmit 0 错；check/validate exit 0；ci-check 0 error / 52 warning（均为既有 W-SPEC-017 advisory）。
- TC-L0-001：自仓夹具（package.json name=mumuspec）下 agent 行为红线带/不带 `lex:` 前缀均 0 E-GUARD-003（豁免等价）；非自仓同夹具两形态均命中且一致（≥1，豁免非空转）。
- TC-L0-002：`ERROR_CODES['E-GUARD-013']` severity=ERROR、forceable=false、always_enforce=true 断言入册。
- 零生产行为变更：仅 tests/ 两个文件新增用例，--no-spec-delta。

## 过程发现（移交后续变更）

scoped 变更 `new --scope tests` 在根 `.mumuspec/changes/` 残留同名空目录（仅空 feedback/ 子目录，缺 .mumuspec.yaml），触发 E-SPEC-013 使 ci:check 变红；本轮已清除该空目录恢复门禁。同族问题：根目录 `list` 对 scoped 变更静默不显示（change.ts:281 loadChangeState 无 scope）、`status <name>` 误报 Change not found（change.ts:41 同根因）、`new` 输出的 Directory 路径显示为根路径。需独立变更修复 src/change、src/cli/commands/change.ts。
