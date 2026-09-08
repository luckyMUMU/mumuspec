# Verify: p0-calibration-hardening

> 阶段：verify · 日期：2026-09-07 · 验证目标：4 项 P0 缺口已收敛，且无回归。

## 1. 总体结果

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 类型检查 | `tsc --noEmit` / `npm run build` | ✓ 0 错误 |
| 全量测试 | `npx vitest run` | ✓ **243 文件 / 4893 用例全绿**（exit 0） |
| 合规检查 | `mumuspec check` | ✓ All checks passed |
| 漂移检测 | `mumuspec drift` | ✓ No drift detected |
| 规范校验 | `mumuspec validate` | ✓ valid（230 约束，unverifiable 0） |

## 2. 逐项 P0 验证证据

### P0-B — loader 层数配置化
- 实现：`src/spec/loader.ts` `selectLayersToLoad(chain, maxDepth)` 已导出并使用配置值，非法配置回退默认 5；`_maxDepth` 未使用参数已消除。
- 证据：`tests/spec/loader-layers.test.ts` 6 用例（全量返回 / 降载保 root+target / depth=3 等价旧行为 / depth=2 / 非法回退 / 边界）。
- 契约更新：`tests/spec/loader.test.ts` 由 "max 3 layers" 改为 "respects specs.max_layer_depth"（默认 4 层全返；限 3 时降载且保 root 与 target）。

### P0-C — Rules 32KiB 容量断言
- 实现：`MAX_RULES_BYTES = 32 * 1024` + `assertRulesWithinBudget()`，在 `renderRuleFiles` 落盘点 fail-closed；新增错误码 **E-RULES-001**（文档已再生：83 码 / 17 域）。
- 证据：`tests/install/rules-budget.test.ts` 5 用例（常量 / 正常通过 / 超限抛错 / renderRuleFiles 拒绝产出 / 恰好等于上限通过）。

### P0-A — CommandMetadata + capability（最小版）
- 实现：新增 `src/cli/capability.ts`（类型 + 注册表 + 回落默认）与 `src/cli/commands/capability.ts`（`mumuspec capability [command] [--json]`）；注册进 `src/cli/index.ts`。
- 证据：`tests/cli/capability.test.ts` 5 用例 + 门禁 `check-json.test.ts`（registered/boundaryListed 33→34，BOUNDARY.md 已同步）。
- 实测：`capability archive` → dedicated/high/confirmRequired=true；`capability context` → general 回落。

### P0-D — finalize-archive 四项缺口
- ① code-graph snapshot：由占位空实现改为复用 `getCachedCodeGraph`，落盘 `.mumuspec/temp/codegraph.snapshot.json`（含 nodeCount/nodes）；失败降级非致命 warning。
- ② cache 陈旧项：由"仅计数"改为 `rmSync` 实际删除（>30 天），失败保持非致命。
- ③ 防重跑：新增 `.finalized` 标记（含时间戳），重复运行幂等跳过，`--force` 可覆盖。
- ④ 原子性：关键写盘走既有 `writeText`/`writeYaml`（Phase 2.3 已原子化）。
- 证据：`tests/change/finalize-archive-idempotency.test.ts` 4 用例 + `finalize-archive-extra2.test.ts` 更新（新增成功/失败双路径用例）。

## 3. 回归与已知噪声

- 全量测试过程中曾出现 `onTaskUpdate` RPC 超时与失败数波动（16→5→0）。经对失败文件单独复跑确认：`env-cli.test.ts` 等为**并行负载抖动**（历史已知，forks + maxForks:6 下仍残留），非本次改动引入。
- 最终一轮全量 `exit=0`，243/243 绿。

## 4. manual 约束验证（E-VERIFY-003）

| 约束 | 验证方式 | 结论 |
|------|---------|------|
| 新增命令须同步 BOUNDARY.md + 计数断言 | `check-json.test.ts` L3 门禁自动校验 | ✓ 通过 |
| 错误码须登记并再生文档 | `gen-error-codes-doc.mjs` + grep E-RULES-001 | ✓ 已登记（83 码） |
| 32KiB 预算不得静默绕过 | 单测 fail-closed 断言 | ✓ 超限抛 E-RULES-001 |

## 5. 遗留（明确不在本变更范围）

- P0-A 二期：全局 `--dry-run` 框架、不可逆操作的"输入变更名称"二次确认（当前仍为 `--confirm` 标志）。
- 文档树系统性梳理：另行立项新变更（本次仅 p0 收敛）。

**结论**：verify_result = pass，4 项 P0 全部收敛，无回归，可进入归档。
