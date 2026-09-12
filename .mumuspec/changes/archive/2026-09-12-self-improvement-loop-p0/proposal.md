# Proposal: self-improvement-loop-p0

## Why

自改进 Loop（层 C 元层自改进 + 层 B 收敛判定）存在一批已坐实的代码级缺陷（详见
`review/self-improvement-loop-analysis-2026-09-12.md` 与
`review/self-improvement-loop-remediation-plan-2026-09-12.md` v2）。本变更实施其中的 P0 项——
接通度量回路、消除 fail-open、封存无采纳对象的实验环。核心症状：

1. `recordCheck` 全仓库零调用方，`meta-evolve --analyze` 永远对空数据集宣告健康（E5/E6）。
2. `loop experiment` 的 arm 不产生任何 commit，adopt 用 base commit 做 cherry-pick，
   采纳无对象、cleanup 用 `--force` 让改动蒸发（E4）；arm 差异仅一行注释、度量退化为文件
   存在性检查（E1/E2/E3）。
3. `loop-engine` 用裸 `catch {}` 吞掉真实提交失败（E10），与红线「失败必须中断并留 audit 记录」冲突。
4. `guard` 每次运行产出一组判定，但从不落盘；`--force` 绕过也不记为 falsePositive（E12/E13）。

## What

- **P0-1**：`guard` 每次校验后向 `.mumuspec/evolution/stats.jsonl` 落盘相位聚合 `CheckRecord`
  （`constraintId: 'guard:<phase>'`）；`--force` 分支追加一条 `falsePositive: true`。落盘根解析到
  主工作区（`git rev-parse --git-common-dir` 或 `MUMUSPEC_EVOLUTION_ROOT` 覆盖），避免随 worktree
  删除丢失。失败 code 不参与 passRate 分母（只记相位聚合，逐约束枚举推迟到 P1）。
- **P0-2**：`meta-evolve --analyze` / `--propose` 改读真实 `CheckRecord`；知识索引不可得时显式打印
  `knowledge index unavailable — skipped`，不再传空数组冒充"无动作"。
- **P0-3**：`meta-evolve --apply --confirm` 未实现即 fail-closed（exit 1），不再占位 exit 0。
- **P0-4**：消除 `loop-engine` 的裸 `catch {}`；提交失败写 audit `result:'fail'` 并中断。
- **P0-5**：`loop experiment` 定性封存——`init` 显著警告并置 `enabled=false`，`adopt` 在未接通时
  明确拒绝并 exit 1，`info` 标注 `experimental (未接通)`。不补 commit（arm 差异是噪声，补 commit
  等于让噪声获得可采纳通道）。

## Impact Scope

- `src/cli/commands/guard.ts`（P0-1 落盘 + E13 falsePositive）
- `src/cli/commands/meta-evolve.ts`（P0-2 真实数据 / P0-3 fail-closed）
- `src/meta-evolution/stats.ts`（主仓根解析辅助）
- `src/change/loop-engine.ts`（P0-4 audit + 中断）
- `src/eval/experiment-engine.ts`（P0-5 封存）
- 对应测试文件（新增/更新）

## Workflow
full
