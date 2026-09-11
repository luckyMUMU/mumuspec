# 自改进 Loop 改进方案（代码级）v2

> **v2 修订说明**：本版经独立 subagent（不同模型）逐条回代码复核。修正 **2 处硬伤**、软化 **1 处措辞**、
> 新增 **4 条缺陷**（E15–E18）。评审方法与逐条判定见 **附录 A**。
> 定位（现状 / 缺口 / 对标）见 `review/self-improvement-loop-analysis-2026-09-12.md`。
>
> **结论：所有 P0/P1 主张方向不变，但 P0-1 的粒度设计必须改（见 §3.1），P1-2 必须两层同批改（见 §3.7）。**

---

## 一、已坐实的缺陷

### E4 `loop experiment` 的 adopt 无对象 —— 结构可穷举验证

对 `src/eval/experiment-engine.ts` 全文检索 `commit` / `git add` / `cherry-pick` 等动作动词，
结果只有：`:314`(注释) `:321`(throw) `:885`(注释) `:898`(取 sha) `:899`(cherry-pick) `:906`(错误分支)。

**整个文件不存在任何一处 `git commit`。** 全链路只有 `worktree add -b` / `branch -D` /
`worktree remove --force` / `git log` / `cherry-pick`。故：

1. `spawnArms` → `applyDirectionPatch` 往 worktree 写一行注释，**不提交**；
2. `runArm` 跑评测与"模拟执行"，**不提交**；
3. `adoptImprovements` 取 `git log <arm.branch> -1` → 必然是 `state.baseCommit`；
4. 用 base commit 去 cherry-pick 已位于 base 的主干 → 空提交（git 非 0 退出）；
5. `cleanupExperiment` 用 `worktree remove --force` → 未提交改动**直接蒸发**。

独立复核确认成立，且**无别处代其提交**。不需要实跑——"文件内不存在提交动作"是可穷举的结构事实。

### E11 信号在最后一跳被丢弃

`issue` / `needs-user` 选项**早已存在**且已正确构造进 `LoopEvaluation`：

```
src/cli/commands/loop.ts:238-239   .option('--issue'...) / .option('--needs-user')
src/cli/commands/loop.ts:271,273   issues: options.issue || [], needs_user_input: ...
```

但在 auto / hybrid 分支被硬覆盖：

```
src/change/loop-engine.ts:246   issues: [],
src/change/loop-engine.ts:248   needs_user_input: false,
```

不是"缺生产者"，是"生产者有、通道有、终点被写死"。

### E5 / E6 / E10 死端与 fail-open

- `src/meta-evolution/stats.ts:33` `recordCheck` —— grep 整个 `src/` 仅 1 处出现（自身定义），**零调用方**。
- `src/cli/commands/meta-evolve.ts:138-147` `runApply` —— 占位实现却正常 exit 0。
- `src/change/loop-engine.ts:304-306` —— 裸 `catch {}` 吞掉真实提交失败（同类：`:269-273` auto-eval 失败仅 `console.warn`）。

### E12 `[已软化]` guard 的判定是 `CheckRecord` 的**可机械映射源**，但从未落盘

**v1 措辞"直接同构"不准确，已更正。** 实际两类型字段不同、需显式映射：

```
src/core/types-workflow.ts:167,201   GuardResult { passed: boolean; errors: GuardError[]; warnings: GuardWarning[]; coverage? }
                                     GuardError  { code; message; detail? }
src/meta-evolution/types.ts:69       CheckRecord { timestamp; constraintId; passed; falsePositive }
```

映射需补 `timestamp`（调用时生成）与 `falsePositive`（默认 false，由 `--force` 填 true，
见 E13），并把 `error.code` → `constraintId`。**这不影响结论**：guard 每次运行都已产出一组判定，
链条（`spec-compliance.ts:20-23` spawn guard + 解析 JSON）也已存在，只是每环都把数据丢掉。

### E13 `--force` 是 `falsePositive` 的唯一天然采样点

`src/cli/commands/guard.ts:74-79` 绕过时只写 audit（`result: 'bypassed'`），不写 stats。
`CheckRecord.falsePositive`（`types.ts:77`）在所有路径上无生产者，`falsePositiveRate` 永远半盲。

### E14 收敛判据被**三处**同时击穿 `[已强化]`

**第一层：稳定性窗口寄存在进程内内存态。**

```
src/core/metrics/auto-evaluate.ts:38   const historyMap = new Map<string, number[]>()   ← 模块级内存
src/core/metrics/auto-evaluate.ts:60   if (history.length < windowSize) return false
```

`loop evaluate` 每次是新进程 → `history.length` 恒为 1，窗口需 3 → `isStableConvergence`
**恒 false**。`historyMap` **无任何持久化/重建路径**（已独立确认）。

**第二层：上层用单轮阈值短路了整个窗口。**

```
src/change/loop-engine.ts:282
if (finalEvaluation.goal_achieved || finalEvaluation.progress >= CONVERGENCE_THRESHOLD)
```

`|| progress >= 0.85` 使**单轮** 0.85 即 `converged`，稳定性窗口根本不被咨询。

**第三层（v2 新增）：hybrid 模式同样不看窗口。** `auto-evaluate.ts:149-178` 的 `hybridEvaluate`
直接 `hybridProgress >= config.threshold` 判 `goalAchieved`，与 `autoEvaluate` 的
`progress >= threshold && allAboveMin && stableMet` 判据不一致——**同一语义两个判据**。

**层级关系（关键，决定修法）**：第二层**已完全支配**判定，第一层因此被掩盖。
但若只删 `||`，由于第一层恒 false，收敛将**永不可达**——从"假收敛"翻转为"永不收敛"。
**故 P1-2 必须两层（实为三处）同批修改，不可分批。**

### E15 `[v2 新增]` 权重存在真实副本，D2 重平衡从未生效

**v1 称"权重分散在各自 defaultWeight，已无副本，符合红线"——此断言错误。**
实测 4 个 evaluator 的 `defaultWeight` 与**实际返回**的 `weight` 不符：

| evaluator | `defaultWeight` | 返回的 `weight` | 文件 |
|---|---|---|---|
| test-pass-rate | 0.3 `// D2 rebalance (was 0.35)` | **0.35** | `test-pass-rate.ts:13 / :48` |
| drift-score | 0.2 `// D2 rebalance (was 0.25)` | **0.25** | `drift-score.ts:14 / :48` |
| spec-compliance | 0.2 `// D2 rebalance (was 0.25)` | **0.25** | `spec-compliance.ts:13 / :56` |
| code-delta | 0.1 `// D2 rebalance (was 0.15)` | **0.15** | `code-delta.ts:15 / :39,:62` |
| design-build-first-pass | `FIRST_PASS_DEFAULT_WEIGHT` | 同常量 ✅ | — |
| constraint-density | 0 | 0 ✅ | — |

而 `autoEvaluate` 消费的是 **`MetricResult.weight`**，不是 `defaultWeight`：

```
auto-evaluate.ts:100   metrics.filter(m => m.weight > 0)
auto-evaluate.ts:116   m.weight = m.weight / totalWeight
auto-evaluate.ts:120   progress = Σ m.value * m.weight
```

**结论：D2 重平衡只写在注释和 `defaultWeight` 里，从未影响任何一次评分。** 实际生效权重
（归一化后约 0.29/0.21/0.21/0.125/0.167）与设计意图（0.3/0.2/0.2/0.1/0.2）不一致——
test-pass-rate 的实际话语权高于设计值。

这正是项目自身红线所禁止的形态：**同一语义存在两条权威源**（`defaultWeight` 与返回字面量），
且消费者读的是错的那条。与 E14 同源：**事实留在错误位置**。

### E16 `[v2 新增]` `converged` 与 `goal_achieved` 两变量发散

`loop-engine.ts:282` 用 `progress >= 0.85` 置 `loop.phase = 'converged'`，但
`finalEvaluation.goal_achieved` 仍为 `false`。随后：

```
loop-engine.ts:296   const shouldCommit = loop.auto_commit && !finalEvaluation.goal_achieved;
```

→ **已判定收敛却仍然提交**。两个变量描述同一事实（"本轮到目标了吗"）却各自独立演化。

### E17 `[v2 新增]` `spec-compliance` 在 Windows 下可能静默降级

```
src/core/metrics/spec-compliance.ts:20-23
spawnSync('npx', ['mumuspec','guard',...], { cwd, encoding:'utf-8', timeout:30_000 })
```

未设 `shell: true`。Windows 上 `npx` 是 `npx.cmd`，`spawnSync` 不解析 `.cmd` → `result.error`
→ 返回 `nullResult`（`weight: 0`）→ 该指标被**静默跳过**。在 `autoEvaluate` 里表现为
"少了一个指标"，权重重新归一化后**其余指标话语权上升**，无任何告警。

这对 P0-1 有直接影响：P0-1 的落盘通道正是依赖这条 spawn。**"链条已跑通"应降级为"待实测"**，
落地时必须先验证该路径真的能取到 guard 的 JSON。

---

## 二、根因归并：三个病，不是一张清单

| 病 | 症状 | 条目 | 修复性质 |
|---|---|---|---|
| **断线** | 生产者有、消费者有、中间那条线没接（或接了又被覆盖/丢在错误位置） | E5 E7 E8 E11 E12 E13 **E15** | 接线，改动小、确定性高 |
| **fail-open** | 失败被当成成功；动作未实现却 exit 0；真实错误被吞 | E2 E6 E10 **E17** | 改判据，必须 fail-closed |
| **自封闭 / 判据失效** | 只用自己的产物当输入；判据宽到无法否证；同语义两处判据 | E1 E3 E4 E14 **E16** | 引入外部锚与留出集，改动最大 |

**E15 与 E14 同构**：都是"同一事实存在于两处，消费者读了错的那处"。
**E16 是 E14 的下游症状**（判据分裂 → 状态变量分裂）。

**关键推论：病 2 必须先于病 3 修。** 否则任何新增的搜索/度量能力都会掉进同一个 fail-open 的洞。

---

## 三、改进建议

### P0 · 接通回路

#### P0-1 让 `guard` 写入 `CheckRecord`（单点最大杠杆）`[设计已修正]`

- **改点**：`src/cli/commands/guard.ts`，在 `runPhaseGuard`（`:38`）与重新评测（`:50`）之后各落盘一次，
  调用既有的 `recordCheck`（`src/meta-evolution/stats.ts:33`）。action 是同步函数 → 改 `async`
  或显式 `catch` 报告失败，**不得静默**。
- **⚠️ 粒度设计（v2 修正的核心）**：`GuardResult` **只枚举失败**（`errors: GuardError[]`），
  **没有"通过约束"清单**。因此：

  | 做法 | 是否诚实 |
  |---|---|
  | 逐 `error.code` 记 `passed:false`，并用它算 `passRate` | ❌ **不诚实**。这些 code 的 passRate 恒为 0/1=0，会得到"所有约束都失效"的**镜像谎言** |
  | 只记相位聚合 `{constraintId:'guard:<phase>', passed: result.passed}` | ✅ 诚实，但粒度粗（每次 guard 一条） |
  | 逐约束枚举（需改造每个 check 函数使其上报"通过"） | ✅ 最完整，但改动面扩到 `src/guard/` 全目录 |

  **推荐：相位聚合记录参与 `passRate` 计算，失败 code 只作"归因"记录、且必须落在独立字段
  （如 `failedCodes: string[]`）中，绝不参与分母。** 若不愿扩展 `CheckRecord`，则最小可行版本
  只落相位聚合记录，逐约束枚举推迟到 P1。
- **不可误用的近邻**：`GuardResult.coverage?: EnforcementCoverage`（`types-workflow.ts:182-199`）是
  **静态注解覆盖率**（`enforced_strong` / `manual` / `unverifiable` / `declared_ratio`），
  **不是运行时逐条通过失败**。`coverage.total` 不能拿来当 passRate 的分母。
- **落盘位置**：必须解析到**主工作区**而非 worktree。`.mumuspec/evolution/` **未列入 `.gitignore`**
  （已核实），在 worktree 中表现为未跟踪文件 → 必随 `worktree remove --force` 丢失。
  用 `git rev-parse --git-common-dir` 推主仓根，或引入 `MUMUSPEC_EVOLUTION_ROOT` 覆盖。
- **顺带**：`--force` 分支（`guard.ts:74-79`）同时写一条 `falsePositive: true`，为 E13 补生产者。
- **前置验证**：先确认 E17（npx on Windows）不会让这条通道静默失效。
- **验收**：连续两次 `mumuspec guard <change> verify` 后 `.mumuspec/evolution/stats.jsonl` 非空，
  且 `meta-evolve --analyze` 不再打印 `No check records accumulated yet.`

#### P0-2 `meta-evolve` 读真实数据，空索引显式声明

- **改点**：`src/cli/commands/meta-evolve.ts:66` 与 `:105`，`const emptyRecords: CheckRecord[] = []`
  → `await readCheckRecords(root)`；`runAnalyze` 的 `_root` 形参恢复使用。
- **顺带修 `:80`**：`analyzeAllFreshness([])` 传空数组冒充"无动作"。若索引不可得，应显式打印
  `knowledge index unavailable — skipped` 并跳过。
- **验收**：stats 为空时仍打印 `No check records`（诚实）；非空时输出真实评分与 `[low confidence]` 标记。

#### P0-3 `--apply` 未实现即 fail-closed

- **改点**：`src/cli/commands/meta-evolve.ts:138-147`。要么实现，要么 `process.exit(1)`。
- **验收**：`mumuspec meta-evolve --apply --confirm; echo $?` → 非 0。

#### P0-4 消除裸 `catch {}` `[类型已修正]`

- **改点**：`src/change/loop-engine.ts:304-306`；同类 `:269-273`。
- **⚠️ v1 写法有类型错误**：`AuditLogEntry.result` 只接受 `'success' | 'fail'`
  （`src/core/types-analysis.ts:194`），**不是 `'error'`**。应写 `result: 'fail'`，
  错误详情放 `error` 字段（`types-analysis.ts:195`）。
- **验收**：人为制造一次提交失败，`audit.log` 出现 `result:'fail'` 条目。

#### P0-5 `loop experiment` 定性封存，**不补 commit**

- **改法**：`experiment init` 打印显著警告并置 `state.enabled = false`；`adopt` 在 `enabled===false`
  时明确拒绝并 exit 1（文案："experiment mode 未接通，不可采纳"），而非当前的"Cherry-pick failed"
  ——那会把结构缺失伪装成运行失败。`experiment info` 标注 `experimental (未接通)`。
- **为什么**不补 commit：arm 间差异只是**一行注释**（`:435`），方向来自静态启发式（`findFilesWithMostLines`
  按文件行数取前 10、`findFilesWithErrorHandling` 匹配 `throw new Error` / `catch (`），
  度量是**文件存在性检查**（`simulateChangeExecution`，`:561-626`，只 `existsSync` 四个文件名）。
  在这种质量下补 commit，只会让噪声获得**可采纳通道**，**比继续空转更危险**。
  符合项目已有纪律：*先校验器后消费者*、*无消费者的产出物不得交付*。
- **附带**：把 `simulateChangeExecution` / `compute*Score` 标注为 simulated 或删除，
  避免"看起来像度量"的产物被下游误用。

---

### P1 · 提带宽、修判据、引外部锚

#### P1-1 回填 `issues` / `needs_user_input`（成本最低）

- **最小改法**：`loop-engine.ts:246,248` → 透传 `evaluation.issues` / `evaluation.needs_user_input`。
- **彻底改法**：auto 分支内主动采集失败事实拼入 `issues`——复用已跑通的通道：
  `runPhaseGuard` 的 `error.code`、`detectDriftWithContracts` 的 drift code、失败用例名。
- **依据**：GEPA 的结论是**标量指标会使反思退化为盲搜**。当前每轮带宽 = 1 标量 + 1 句模板。
- **验收**：存在真实问题时 `loop status` 的 Issues 段非空（`loop.ts:295` 已有渲染逻辑，从未有数据到达）。

#### P1-2 修 E14 的三处判据 `[必须同批改]`

1. `auto-evaluate.ts:38` 的 `historyMap` → 改为从 `loop_state.progress_trend` 派生。
   **该字段已持久化在 `.mumuspec.yaml`**（`types-loop.ts:136`，`loop-engine.ts:279` 写入），
   持久化等价物已存在，改动是"换事实源"而非新建机制。
2. `loop-engine.ts:282` → 去掉 `|| progress >= CONVERGENCE_THRESHOLD`。若确需单轮快速通道，
   必须**另起名字**（如 `provisional_convergence`）并要求人工签收，不得复用 `converged`。
3. `auto-evaluate.ts:168-173` `hybridEvaluate` → 与 `autoEvaluate` 统一判据。

**⚠️ 顺序硬约束**：第 2 步单独做会让收敛**永不可达**（因第 1 步未修时窗口恒 false）。
**1、2、3 必须同批提交。**

- **附带（配置层）**：`max_rounds` 默认 3 与 `stabilityWindow` 3 相等，在"窗口需 3 条历史"语义下
  数学上不可能提前收敛。建议解耦，或在 `loop init` 对 `max_rounds < stabilityWindow + 1` 告警。
- **验收**：单轮高分不再触发 `converged`；连续 3 轮达标才收敛；`progress_trend` 跨进程有效。

#### P1-3 `[v2 重写]` 消除权重副本，让 D2 重平衡真正生效

- **问题**：见 E15。四个 evaluator 的返回 `weight` 是重平衡前的旧值，而消费者读的正是它。
- **改法（二选一）**：
  - **(a) 单一来源**：evaluator 返回 `weight: <该 evaluator 的 defaultWeight>`（引用自身常量，
    不再写字面量），保留 `defaultWeight` 为唯一权威源；
  - **(b) 消费者改读 `defaultWeight`**：`autoEvaluate` 归一化时用注册表中的 `defaultWeight`，
    使 `MetricResult.weight` 退化为可选提示。
  **推荐 (a)**：改动更局部，且不改变 `Evaluator` 接口语义。
- **附带**：清理 `nullResult` 里 `weight: 0` 的魔法值语义（0 = 不参与，需在 `types.ts:34` 注释中固化）。
- **验收**：新增一条断言测试——`registerBuiltInEvaluators()` 后，各 evaluator 的
  `defaultWeight` 之和（排除 0 权重）等于其返回 `weight` 之和；且归一化前的 `weight` 与
  `defaultWeight` 逐项相等，防止再次漂移。
- **性质**：这条应提升为 **P0 级**（它直接违反项目红线"同一语义不得有两条权威源"），
  但因不影响 fail-open 链，排期上紧随 P0-4。

#### P1-4 held-out 验证门与拒绝缓冲（迁移自 SkillOpt）

- **现状**：收敛只看本轮 composite，无留出集——等价于在训练集上收敛。
- **建议**：保留固定用例子集**不参与**日常 `evaluate`，仅在收敛判定时执行；或退化实现——
  取最近 K 轮中最差一轮指标作为 held-out 代理。只有留出集**严格**优于基线才允许收敛。
  `LoopState` 增 `rejected_attempts: {patch_hash, reason, round}[]`，被拒方向不得重复提交。

#### P1-5 方向生成改为失败驱动 + 建最小 archive（迁移自 EvoSkill）

- **现状**：`generateDirections` 与失败无关（见 P0-5）。
- **建议**：输入改为 `stats.jsonl` 的低分约束 + drift code 频次 + 失败用例名。
  archive 以 JSONL 落 `(方向, 指标向量, 结果)`，可直接复用 `stats.ts:72-86` 的 append-only + rotation。
  **安全提醒**：SafeEvolve 的教训是**不安全检索会让风险翻倍**——retrieve 侧同样要有门，
  本条只先落数据，暂不启用自动检索。

---

### P2 · 安全门与结构

- **P2-1 安全门前移到 write + retrieve 两侧**：当前所有门都在"人签收"一环，生成侧无门。
- **P2-2 建"引擎自检"面**：D1–D4（归档引擎）与 E6/E10/E4/E15/E16（自改进引擎）是同一个病——
  信任根缺少对自身的校验。建议把"引擎状态工件 ↔ 物理布局一致性"纳入 `mumuspec check` 覆盖面。
- **P2-3 收敛 `loop` 与 `loop experiment` 的职责边界**：`exitLoop` 不推进 DCG → 双状态源。
  **E16 是同类问题的第二个实例**（`converged` vs `goal_achieved`），建议一并建模为单一状态源。

---

## 四、依赖顺序

```
P0-3 ─┐
P0-5 ─┼─► 可立即独立完成（各 ≤ 10 行）
P0-4 ─┘        ↑ 注意 result:'fail'（非 'error'）

P0-1 ──► P0-2 ──► [最小可观测闭环]
  ↑ 先实测 E17（npx/Windows），再定粒度（见 §3.1 表）

P1-3（权重副本，建议提前到 P0 之后第一件）
P1-2（三处同批）──► P1-4 ──► P1-5
P1-1（低依赖，可并行）
```

**最小可观测闭环 = P0-1 + P0-2 + P0-3。** 闭合后第一次 `meta-evolve --analyze` 输出真实评分，
才具备评估 P1 是否有效的前提。

---

## 五、明确不做

| 不做 | 理由 |
|---|---|
| 给 `loop experiment` 补 commit | 会让噪声获得可采纳通道，比空转更危险 |
| 用 `error.code` 逐条算 `passRate` | 只记失败不记通过 → passRate 恒 0，是空数据集的镜像谎言 |
| 把 `coverage.total` 当 passRate 分母 | 它是静态注解覆盖率，语义不同 |
| 新增 evaluator | 现有 6 个的输入数据尚未接通，加指标只扩大无数据的空洞 |
| 自动调整 `constraint_strength` | 项目红线 bp_04，保留人工签收 |
| 为 stats 引入新存储机制 | 复用 `stats.ts` 的 append-only + rotation（Ponytail #2/#3） |

---

## 六、落地路径与治理约束 `[v2 新增]`

代码修复**不能**直接落在当前工作区。已核实的事实：

1. **当前分支 `mumuspec/archive-state-integrity`（HEAD `ed94a31`）上有一个活跃变更**，
   且 `src/change/lifecycle.ts:33-42` 在 branch-driven 模式下会**硬抛 `E-CHANGE-001`**：
   *"单分支仅允许单一激活变更；如需并行请先合并/归档当前变更"*。
   → **`mumuspec new` 在当前分支必然失败。**
2. **唯一 worktree 被该变更占用**（`git worktree list` 只有 `D:/Code/AI-coding/mumuspec`），
   工作区含**未提交**的 `archive-state-integrity` 修复
   （`src/change/{archive,branch,state}.ts`、`src/core/errors.ts`、`src/cli/commands/{guard,spec}.ts`+测试），
   而其 `build_layers[0].status` 仍为 `pending`。
3. **`guard.ts` 存在重叠**：在途改动已修改 `guard.ts:45`（D3 修复），而 P0-1 要在 `:38`/`:50` 附近插入。
   同一文件同一区域，落地时需处理合并顺序。
4. **环境事实**：本会话 shell 的 `PATH` 丢失（`dirname`/`git`/`ls` 全部 `command not found`），
   需显式 `export PATH=...` 才能运行 CLI 与测试。

**两条可行路径**：

- **路径 A（先收尾）**：完成并归档 `archive-state-integrity` 的 layer 0 → 再新建变更实施 P0。
  优点：单分支串行，符合项目纪律。缺点：阻塞。
- **路径 B（隔离并行）**（**推荐**）：从 `master` 开一个新分支 + 独立 worktree，
  在其中 `mumuspec new`（该分支上无活跃变更，`E-CHANGE-001` 不触发），实施 P0。
  优点：不触碰在途 hotfix。代价：与 `guard.ts` 的重叠需在两条分支合并时统一。

---

## 七、实施前置条件：HEAD 自检为红 `[v2 补充，2026-09-12 实测]`

**在动手实施 P0 之前，必须先处理一个新发现的、与本次修复强耦合的问题。**

### 事实

干净树 HEAD（`master @ ea82055`，`dist` 已重建）上 `mumuspec check` **exit 1**：

```
exit=1
  60  [E-GUARD-003]  SHALL NOT 仅以 `.mumuspec` 存在性判定模块（BOUNDARY-only 目录不是已注册模块）
   2  [E-ARCH-003]   归档目录名出现重复日期前缀（2026-09-09-2026-09-09-*，两例）
```

干净树 == HEAD，故这是 **HEAD 的固有属性**，与任何未提交改动无关。连锁后果：项目自称的反回归门
`tests/cli/cli-smoke.test.ts › mumuspec check runs (dogfooding) with exit 0` **确定性失败**，
且**任何新变更走 verify 阶段都会被这条门挡住**。

### 根因（已定位到行）

1. 约束文本 `.mumuspec/spec.md:493` 用行内标记包了 bare 目录名：`` 仅以 `.mumuspec` 存在性判定模块 ``；
2. `src/spec/verifier-classify.ts:89` 的 `extractQuotedTerms` 取出 term = `.mumuspec`；
3. `src/guard/checker.ts:696-720`：term 长度 9 > 4 → 正则退化为**裸子串匹配** `/.mumuspec/i`；
   而它既不满足 `isFlagTerm`（非 `--` 开头），也不满足 `isFileTerm`
   （正则 `\.(md|ya?ml|json|txt|log)$` 不匹配）→ **两条亲和性守卫全部落空**；
4. 于是任何**非注释行**只要含 `.mumuspec` 即判违规——连 `.mumuspec.yaml` 也命中（子串）。

**判定：假阳性。** 与 `checker.ts:694-695` 自身的设计意图直接矛盾——
*"a matched line must plausibly **perform** the prohibited act, not merely mention it"*。
60 个命中文件包含 `src/spec/loader.ts`、`src/spec/validator.ts` 等**合法解析 `.mumuspec` 路径**的文件。
同时违反项目自己的 Requirement「约束通道与约束语义一致」。

### 与本方案的耦合（为什么必须先修）

P1-1 的"彻底改法"要把 `runPhaseGuard` 的 `error.code` 与 drift code 灌进 loop 的 `issues`。
**在通道未洗净前做这件事，会让 loop 每轮被注入 60 条假 issue——"提带宽"变成"灌噪声"**，
比不改更糟（会污染 `next_focus`、`blocked` 判定与后续 archive）。
故：**修 FP 是 P1-1 的前置条件**，且 P0-1 落盘时也必须对 `E-GUARD-003` 做去噪或标记，
否则 stats 里 60 条/次的假失败会直接扭曲 `passRate`。

### 两个修法（含设计选择，需人裁决）

| 方案 | 内容 | 评价 |
|---|---|---|
| **(A) 改约束文本**（推荐） | 改写 `.mumuspec/spec.md:493`：去掉对 bare 目录名的行内标记，或换成有语义的通道（`ast:` 注解 / 块级 `Enforcement`） | 符合「通道与语义一致」的既有裁决；需走 spec 变更 |
| (B) 给 checker 补守卫 | 在 `checker.ts` 为"目录名类 term"增加亲和性守卫，与既有 `isFlagTerm` / `isFileTerm` 同构 | 在启发式上再打启发式补丁；且不解决文本本身的通道错配，同类问题会再犯 |

### 测试基线的判读纪律（附带）

全量测试连跑三次得 `5 files/11 tests failed` → `2/2` → `1/1`，抖动的成因是
**`dist/` 在运行途中被重建**：测试 spawn 的是 gitignored 的构建产物，撞上写了一半的模块图 →
`SyntaxError: module './commands/grill-me.js' does not provide an export named 'registerGrillMeCommand'`
（而 `src/cli/commands/grill-me.ts:27` 定义无误）。**这不是真实回归。**
排查 CLI 相关离奇失败时，第一件事是比对 `dist` 与 `src` 的 mtime 并重建后再跑，
否则会把产物竞态误判为代码回归。

---

## 附录 A · 独立评审记录

**方法**：本方案 v1 交付后，派出一名独立 subagent（**不同模型**）执行**证伪式**复核——
明确要求"不要附和，逐条回源码验证，并主动寻找未提到的缺陷"，只读、不修改文件。

**逐条判定**（复核者结论）：

| 条目 | 判定 | 备注 |
|---|---|---|
| E2/E4 | `[成立]` | 并经穷举确认无别处代其提交 |
| E14 | `[成立]` | 并补充：层级关系为"第二层支配判定" |
| E11 | `[成立]` | — |
| E5 / E6 / E10 | `[成立]` | — |
| E12 | `[夸大]` | 两类型字段不同、需映射，"同构"不准确 → **本版已软化** |

**复核发现的本方案硬伤 → 本版修正**：

1. **P1-5 断言错误**：v1 称"权重已无副本，符合红线"。实测 4 个 evaluator 的 `defaultWeight`
   与返回 `weight` 不符，**D2 重平衡从未生效**。→ 提升为独立缺陷 **E15**，并重写为 **P1-3**。
   （笔者已独立复核确认该结论成立。）
2. **P0-4 类型非法**：v1 写 `result:'error'`，而 `AuditLogEntry.result: 'success'|'fail'`
   （`types-analysis.ts:194`）。→ **本版已更正为 `'fail'`。**（笔者已独立复核确认。）

**复核额外发现的缺陷 → 本版收录**：

3. `hybridEvaluate` 同样不看稳定性窗口（`auto-evaluate.ts:168-173`）→ 并入 **E14 第三层**。
4. `converged` 与 `goal_achieved` 发散，导致"已收敛却仍提交"→ 新增 **E16**。
5. `spec-compliance` 的 `spawnSync('npx', ...)` 未设 `shell`，Windows 下可能静默降级为 weight 0
   → 新增 **E17**，并把 P0-1 的"链已跑通"降级为"待实测"。
6. **P0-1 实施障碍**：`GuardResult` 只枚举失败 code，无"通过约束"清单，逐 E-code 的 `passRate`
   无法诚实产出 → **本版 §3.1 的粒度表**即为回应。

**方法论收获**：v1 的两处硬伤都是**"我断言某处已正确"**类的错误（"权重无副本"、"链已跑通"），
而不是"我断言某处有缺陷"类的错误。**缺陷断言倾向保守，而正确性断言倾向乐观**——
这是本轮复核暴露出的系统性偏差。后续审查应对"已合规 / 已跑通 / 无副本"这类**正面断言**
施加与缺陷断言同等的证据要求。

---

## 附录 B · 缺口索引

| ID | 缺口 | 证据位置 | 处置 |
|---|---|---|---|
| E1 | 方向生成为静态启发式 | `experiment-engine.ts:250-283` | P0-5 封存 / P1-5 重做 |
| E2 | arm 无 commit → adopt 无对象 | `experiment-engine.ts` 全文无 commit | P0-5 |
| E3 | 度量退化为文件存在性 | `experiment-engine.ts:561-626` | P0-5 标注 |
| E4 | adopt 取到 base commit | `experiment-engine.ts:886-899` | 同上（已坐实） |
| E5 | `recordCheck` 零调用方 | `stats.ts:33`（全仓唯一出现） | **P0-1** |
| E6 | `runApply` 占位却 exit 0 | `meta-evolve.ts:138-147` | **P0-3** |
| E7 | 知识演化传空数组 | `meta-evolve.ts:80` | P0-2 |
| E8 | 技能推荐校准零调用方 | `skill-recommender.ts:119-130` | P0-2 |
| E10 | 裸 `catch {}` 吞提交失败 | `loop-engine.ts:304-306` | **P0-4** |
| E11 | `issues`/`needs_user_input` 被覆盖 | `loop-engine.ts:246,248` | **P1-1** |
| E12 | guard 判定未落盘（可机械映射） | `types-workflow.ts:167,201` / `guard.ts:38,50` | **P0-1** |
| E13 | `--force` 未记为 falsePositive | `guard.ts:74-79` | P0-1 |
| E14 | 收敛判据三处击穿（内存窗口 + 单轮短路 + hybrid 不一致） | `auto-evaluate.ts:38,60,168-173` / `loop-engine.ts:282` | **P1-2（同批）** |
| E15 | 权重副本 → D2 重平衡从未生效 | `*-rate.ts:13/48`、`drift-score.ts:14/48`、`spec-compliance.ts:13/56`、`code-delta.ts:15/39,62` | **P1-3** |
| E16 | `converged` 与 `goal_achieved` 发散 | `loop-engine.ts:282,296` | P1-2 附 |
| E17 | `spawnSync('npx')` Windows 静默降级 | `spec-compliance.ts:20-23` | P0-1 前置验证 |
