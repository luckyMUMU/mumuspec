---
id: KE-self-improvement-loop-p0-patterns
title: Architecture patterns from self-improvement-loop-p0
type: pattern
status: confirmed
scope: self-improvement-loop-p0
created_at: 2026-09-12
tags:
  - auto-extracted
  - pattern
  - architecture
  - self-improvement-loop-p0
graph_bindings: []
---
> Auto-extracted from self-improvement-loop-p0/design.md

# Design: 自改进 Loop P0 接通与 fail-closed

设计策略：自上而下。五条 P0 修复按「先改判据（fail-open → fail-closed）、再接线（数据落盘与读取）、后封存（无采纳对象的实验环）」排序。全部改点已在
`review/self-improvement-loop-remediation-plan-2026-09-12.md` v2 中定位到 file:line，本设计将其裁决为可执行规格。

## 1. 决策层（关键语义裁决）

### D1: P0-1 粒度 = 相位聚合，不扩展 CheckRecord（最小可行版本）

`GuardResult` 只枚举失败（`errors: GuardError[]`），**没有"通过约束"清单**。逐 `error.code` 记
`passed:false` 并据此算 passRate，会让每条失败约束的 passRate 恒为 0/1=0，得到"所有约束都失效"的
**镜像谎言**（与"空数据集宣告健康"同一 bug 的两面）。裁决：

- 每次 guard 运行落一条相位聚合记录 `{constraintId: 'guard:<phase>', passed: result.passed}`，参与 passRate 分母。
- 失败 code 的逐约束归因记录（含独立 `failedCodes` 字段）推迟到 P1，本轮不扩展 `CheckRecord` 类型。
- `GuardResult.coverage`（静态注解覆盖率）不可当 passRate 分母——语义是 `enforced_strong/manual/unverifiable/declared_ratio`，非运行时逐条通过失败。

### D2: P0-1 落盘根解析到主工作区

`.mumuspec/evolution/` **未列入 `.gitignore`**，在 loop worktree 中表现为未跟踪文件 → 必随
`worktree remove --force` 丢失。裁决：

- 优先 `MUMUSPEC_EVOLUTION_ROOT` 环境变量覆盖；
- 否则 `git rev-parse --git-common-dir` 推导主仓根（main worktree 返回 `.git`，linked worktree 返回主仓 `.git` 路径，取其父目录）；
- 非 git 环境回退 `findProjectRoot()` 结果。

### D3: P0-2 空索引必须显式声明，不得传空数组冒充"无动作"

`analyzeAllFreshness([])` 的现状把"索引不可得"伪装成"知识层无动作"。裁决：知识索引文件不可得时打印
`knowledge index unavailable — skipped` 并跳过该段；空数据集与健康必须可区分。

### D4: P0-4 区分"副作用失败"与"只读采集失败"

- 提交（commitRound，副作用）：失败写 audit `result:'fail'`（详情入 `error` 字段）并**中断**——
  对应红线「SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录）」。
- auto-eval 失败（只读采集）：保留既有的"回退 manual"设计（`collectMetrics` 语义即允许全部 evaluator 失败），
  但补一条 audit `result:'fail'`，使降级可追溯，不再仅 console.warn。
- `AuditLogEntry.result` 类型为 `'success' | 'fail'`（非 `'error'`），错误详情必须放 `error` 字段。

### D5: P0-5 定性封存，不补 commit

arm 间差异只是**一行注释**、方向来自静态启发式、度量是文件存在性检查。在此质量下补 commit，
会让噪声获得可采纳通道，比继续空转更危险。裁决：`experiment init` 显著警告并置 `state.enabled=false`；
`adopt` 在未接通时明确拒绝并 exit 1（文案"experiment mode 未接通，不可采纳"），不把结构缺失伪装成
"Cherry-pick failed"；`experiment info` 标注 `experimental (未接通)`；`simulateChangeExecution` /
`compute*Score` 标注为 simulated，防止"看起来像度量"的产物被下游误用。

## 2. 接线层（P0-