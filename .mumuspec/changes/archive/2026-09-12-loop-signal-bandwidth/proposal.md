# Proposal: loop-signal-bandwidth

## Why

自改进 Loop 的 auto/hybrid 模式把 `issues` / `needs_user_input` **硬覆盖为空**（E11，
remediation-plan v2 §3.3）：

```
src/change/loop-engine.ts（P0 前）:246,248   issues: [], needs_user_input: false
```

生产者有（CLI `--issue`/`--needs-user` 已构造进 `LoopEvaluation`）、通道有、**终点被写死**。
后果：

- 下一轮 plan 唯一输入是 `recommendation`（一句模板串）——每轮带宽 = 1 标量 + 1 句模板；
- `blocked` 分支在 auto 模式不可能触发（`needs_user_input` 恒 false）；
- 各 evaluator 的 `details` 被采集却从不进决策通道。

外部对标（GEPA）：**标量指标会使反思退化为盲搜**。这是与主流差距最大的一点。

## What

- **透传**：auto/hybrid 分支的 `issues` / `needs_user_input` 不再写死，透传调用方信号。
- **失败事实采集**：auto 分支内主动运行一次 `runPhaseGuard(projectRoot, change, 'build')`
  （只读采集，失败不影响主流程），将其 `error.code` 以 `[guard:<code>] <message>` 标记拼入
  `issues`（按 code+message 去重）——复用已跑通的 guard 通道，不引新机制。
- manual 模式行为不变（不改写传入 evaluation）。

不做的：drift code / 失败用例名拼入（依赖各自通道，属 P1-5 方向生成范围）；
`next_focus` 结构化（需新类型，YAGNI）。

## Impact Scope

- `src/change/loop-engine.ts`
- `tests/change/loop-evaluation-suggestions.test.ts`（+3 用例）

## Workflow
hotfix