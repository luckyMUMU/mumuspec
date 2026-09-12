# Test Cases — self-improvement-loop-p0 (Layer 0: 单元/集成测试)

## L0-1 guard 校验后落盘相位聚合记录

- Given: 一个存在的变更与目标阶段，运行 `guard <change> <phase>`（不带 --json 提前返回）
- When: 守卫执行完成
- Then: `.mumuspec/evolution/stats.jsonl` 追加一条 `constraintId: 'guard:<phase>'` 的记录，
      且 `passed` 等于守卫结果

## L0-2 `--force` 追加 falsePositive 记录

- Given: 守卫失败且 `--force` 通过（bypass_audit 允许）
- When: 执行 `guard <change> <phase> --force`
- Then: stats.jsonl 追加一条 `constraintId: 'guard:<phase>:force'`、`passed: false`、
      `falsePositive: true` 的记录

## L0-3 落盘根解析到主工作区

- Given: `MUMUSPEC_EVOLUTION_ROOT` 未设置，当前目录是 loop worktree（git-common-dir 指向主仓）
- When: 调用 `resolveEvolutionRoot`
- Then: 返回主仓根（git-common-dir 的父目录），而非 worktree 路径

## L0-4 meta-evolve --analyze 有记录时输出真实评分

- Given: stats.jsonl 存在若干 CheckRecord
- When: 运行 `meta-evolve --analyze`
- Then: 输出逐约束评分行（含 `[low confidence]` 标记当样本 < 5），不再打印
      "No check records accumulated yet."

## L0-5 meta-evolve --analyze 无记录时保持诚实

- Given: stats.jsonl 不存在或为空
- When: 运行 `meta-evolve --analyze`
- Then: 仍打印 "No check records accumulated yet."（空数据集与健康可区分）

## L0-6 知识索引不可得时显式声明

- Given: `.mumuspec/knowledge/_index.yaml` 不存在
- When: 运行 `meta-evolve --analyze`
- Then: 打印 `knowledge index unavailable — skipped`，不出现伪造的演化动作

## L0-7 meta-evolve --apply --confirm fail-closed

- Given: 运行 `meta-evolve --apply --confirm`
- When: 命令执行
- Then: 退出码非 0，stderr 有明确错误文案

## L0-8 提交失败写 audit fail 并中断

- Given: loop evaluate 的 commitRound 因真实原因失败（非 nothing-to-commit）
- When: 执行 evaluateRound
- Then: `audit.log` 出现 `result:'fail'` 条目（含错误详情），且 evaluateRound 抛出错误

## L0-9 experiment init 封存

- Given: 运行 experiment init
- When: 创建实验
- Then: `state.enabled === false`，输出显著警告

## L0-10 adopt 未接通时拒绝

- Given: 实验 `enabled === false`
- When: 执行 adopt
- Then: 明确拒绝并以非 0 退出，文案含 "experiment mode 未接通，不可采纳"，
      而非 "Cherry-pick failed"

## L0-11 experiment info 标注未接通

- Given: 存在封存的实验
- When: 运行 experiment info/status
- Then: 输出含 `experimental (未接通)` 标注
