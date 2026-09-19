# Proposal: spec-conformance-fix

## Why

对仓库自身规范面的合规审计（2026-09-17）结论是：四道硬门禁（`validate` / `check` / `npm run ci:check` / `npm run enforce`）全部通过，但规范文本与引擎实现之间存在两处实质不一致，其中一处被检查器 fail-open 掩盖。

1. **根 spec.md 的 TEMP-4 白名单与校验器实际白名单双向不符。** TEMP-4 只声明 `designs-archive/` 一个目录，而 `structure-validator.ts` 的 `DEFINED_DIRECTORIES` 允许 12 个目录——缺失 `changes/`、`knowledge/`、`contracts/`、`feedback/`、`roadmap/`、`adr/`、`skills/`、`templates/`、`temp/`、`evolution/`、`evals/`。文件面另缺 `cognitive-map.yaml` 与 `BOUNDARY.md`。后果不止于漏登记：TEMP-4 若按字面执行，将禁止同一份 spec.md 在 TEMP-1 与「变更管理」章中明确要求的 `temp/`、`changes/`、`knowledge/`。同一事实在两处维护且互不一致。

2. **discard 的状态写回路径错误，且配对的检查器存在 fail-open 盲区。** `lifecycle.ts` 把变更目录 `renameSync` 进 `changes/archive/discarded/` 之后，仍调用按名推导的 `saveChangeState()`，把状态写回刚被移走的路径，重建出只含 `.mumuspec.yaml` 的空壳目录。`archive.ts` 的同位置用的是正确写法 `saveChangeStateInDir(archivedDir, state)`，**discard 是唯一漏改点**。配套的 `archive-consistency.ts` 又以 `entry === 'discarded'` 跳过 `archive/discarded/` 子树，使 ARCH-001（活跃区残留）对废弃变更**恒不触发**。实证：本仓库现存两处该残留（`changes/prd-alignment-agent-integration/`、`changes/tier-probe/`），而 `check` 报 `[drift] OK`。

另有仓库卫生项：根目录遗留 `.cursorrules`（遗留规则格式，doctor 已明示应迁移后手工删除）、两个残留 tgz、以及 eval-corpus 归档后未并入 master。

## What

1. TEMP-4 由「内联枚举白名单」改为「声明唯一权威源为 structure-validator 的 DEFINED_* 集合」，消除同一事实的双份维护（B1）。
2. discard 状态写回改写入废弃目标目录；归档一致性检查覆盖 `archive/discarded/` 子树的阶段判定与活跃区残留判定（B2）。
3. 删除根 `.cursorrules`（B3）。
4. 清理两处 discard 残留目录（B4）。
5. 删除根目录两个残留 tgz（B5）。
6. eval-corpus 并入 master（B7，已完成）。

## Impact Scope

- `.mumuspec/spec.md`：TEMP-4 条目改写
- `src/change/lifecycle.ts`：discard 状态写回目标
- `src/change/archive-consistency.ts`：归档名收集与阶段判定覆盖 discarded 子树
- `tests/`：discard 残留与检查器覆盖的红绿回归测试
- 仓库根：`.cursorrules`（删除）、`mumuspec-0.19.2-alpha.10.tgz` / `mumuspec-0.35.0-alpha.0.tgz`（删除）
- `.mumuspec/changes/`：两处残留目录（删除）
- 版本号：`package.json` bump（`src/cli/index.ts` 运行时读取，单一权威源）

## Non-goals

- 不改 TEMP-1 / TEMP-2 / TEMP-3 的语义。
- 不改 `DEFINED_DIRECTORIES` / `DEFINED_FILES` 的成员集合——只改规范文本，使文本引用校验器而非复写它。
- 不修 `mergeDeltaSpecsToMain` 的 Enforcement 形态鸿沟（delta 行首 `Enforcement:` 合法但并入主 spec 后主 parser 只认 `### Enforcement` 标题形态）——另立变更处理。
- 不扩展 ARCH-002 / ARCH-003 的判定语义，仅使其覆盖范围补上 discarded 子树。
- 不删除已并入 master 的陈旧分支 `mumuspec/eval-corpus`、`mumuspec/freedom-metrics-loop-closure`（另议）。
- 不纳入 `src/team` 的 BOUNDARY.md（审计误报已撤回：该文件存在于模块根目录，非缺失）。

## Acceptance Scenarios

1. TEMP-4 正文不再内联目录/文件清单，改以 structure-validator 为唯一权威源；`mumuspec validate` 仍 exit 0。
2. 新增回归测试复现「discard 后活跃区残留」：修复前失败，修复后 `changes/<name>/` 不再被重建；`archive/discarded/<name>/` 状态为 discarded。
3. 新增回归测试复现「`archive/discarded/` 子树不参与归档名收集」：修复前该子树内的变更名不进 `archivedNames`，修复后被纳入，ARCH-001 可命中；本仓库两处现存残留在修复后由 `mumuspec check` 报出。
4. 清理后仓库根不再有 `.cursorrules` 与两个 tgz；`mumuspec doctor` 不再报遗留规则文件。
5. `mumuspec check`、`mumuspec validate`、`npm run ci:check` 全绿；既有全量测试回归通过。
6. `master` 包含 eval-corpus 的全部 15 个提交（B7）。

## Workflow

full
