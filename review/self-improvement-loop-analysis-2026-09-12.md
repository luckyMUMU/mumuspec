# 自改进 Loop 机制分析 + 同类机制调研对比

> 类型：机制分析 + 外部对标报告
> 范围：MumuSpec 自改进回路（代码级核对）、外部 Agent/Skill 级自改进机制（2024–2026）、对比矩阵与定位判定
> 结论口径：区分「已闭环」与「未接通」，所有内部结论均带 file:line 证据

---

## 0. 摘要

**当前机制不是"一个 loop"，而是三层叠放：**

| 层 | 名称 | 进化对象 | 合法性判据 | 实现状态 |
|---|---|---|---|---|
| A | 变更内迭代环（Loop Workflow） | 本轮 plan / 动作序列 | 进度分 + 收敛阈值 | 代码完整，CLI 可驱动 |
| B | 客观度量与收敛判定（Auto-Evaluate） | 无（只读传感器） | 6 个 evaluator 加权 + 稳定窗口 | 代码完整，回路已接通 |
| C | 元层自改进（Experiment / Meta-Evolve） | 方向、约束、知识、技能 | 经验对比 + 人工签收 | **骨架为主，四条数据面是死端** |

**三条核心判断：**

1. **合法性判据与外部锚定比同类更严格。** MumuSpec 是少数把"不可自我修改的外部锚"写成契约文件的机制（`.mumuspec/contracts/meta-evolution/policy.md` 的 Goal Preservation 锚点），且比 DGM 多一道人工签收门。这一层与 2026 年的 AGP（RSPL/SEPL 双层协议）同构，且比它更保守。
2. **反馈信号粒度与搜索策略落后当前 SOTA 一个代际。** 无 archive / 无 Pareto 前沿 / 无树搜索；改进方向生成是静态代码启发式（文件行数、字符串 grep）；auto 模式下文本诊断被写死为空数组。
3. **真正的瓶颈不是"缺机制"，而是"度量未留下可判定事实"。** C 层四个子系统（有效性评分、知识 freshness、技能推荐、apply）全部存在但**没有生产者或没有消费者**。这与本项目既往定位的 D1–D4 缺陷同构：引擎执行了动作，却没留下可判定的事实，或把事实留在错误位置。

---

## 1. 层 A：变更内迭代环（Loop Workflow）

### 1.1 结构

`loop` 是一等 workflow 类型，不是外挂模式：

- `src/core/types-workflow.ts:10` — `Workflow = 'full' | 'hotfix' | 'tweak' | 'loop'`
- `src/change/phase-graph-loader.ts:25` — `WORKFLOW_KEYS` 含 `loop`
- `src/change/lifecycle.ts:116-125` — 进入 loop 时 `build_layers` 只建 layer 0，且 `state.phase` 直接置为 `build`（跳过 open/design）

状态机（`src/core/types-loop.ts:20-28`）：
`init → plan → act → evaluate → commit → {converged | exhausted | blocked}`

关键参数（`src/change/loop-engine.ts:40-42`）：
`DEFAULT_MAX_ROUNDS = 3`、`CONVERGENCE_THRESHOLD = 0.85`、`STAGNATION_LIMIT = 2`

### 1.2 自动化程度

| 能力 | 实现 | 说明 |
|---|---|---|
| worktree 隔离 | `initLoop` → `createWorktree`（`loop-engine.ts:553-577`） | 路径 `.mumuspec/.loop-worktrees/<change>`，分支 `loop/<change>` |
| 每轮自动提交 | `commitRound`（`loop-engine.ts:318-348`） | 已修正 "nothing to commit" 与真失败的区分 |
| 收敛判定 | `evaluateRound`（`loop-engine.ts:198-313`） | 三模式：manual / auto / hybrid |
| 停滞检测 | `detectStagnation`（`loop-engine.ts:696-704`） | 连续 2 轮波动 < 0.05 且低于阈值 |
| worktree 合并/清理 | `mergeWorktreeBack` / `cleanupWorktrees` | 均已在 CLI 挂载（`loop.ts:538, 563`） |
| 前置可行性质询 | `src/core/loop-grill.ts` | goal / criteria / round / risk 四个题库，纯启发式（含 `goal.length >= 10` 这类长度判定） |

**前置质询的判定强度有限**（`loop-grill.ts:21, 38, 72`）：`goal-specific` 靠正则匹配"实现|完成|添加|修复|优化|重构"，`goal-granularity` 靠 `goal.length >= 15`。这是"看起来在质询"的规则，不是语义判定；与项目已确立的「规则-实现分离」哲学一致（归 LLM 的语义部分尚未接入），但当前 LLM 侧完全缺席。

---

## 2. 层 B：客观度量与收敛判定

### 2.1 指标集合与权重（唯一权威源 = 各 evaluator 的 `defaultWeight`）

| Metric | 权重 | 文件 |
|---|---|---|
| `test-pass-rate` | 0.30 | `src/core/metrics/test-pass-rate.ts:13` |
| `drift-score` | 0.20 | `src/core/metrics/drift-score.ts:14` |
| `spec-compliance` | 0.20 | `src/core/metrics/spec-compliance.ts:13` |
| `design-build-first-pass` | 0.20 | `src/core/metrics/design-build-first-pass.ts:24, 45` |
| `code-delta` | 0.10 | `src/core/metrics/code-delta.ts:15` |
| `constraint-density` | **0** | `src/core/metrics/constraint-density.ts:79` |

`constraint-density` 权重为 0 是**刻意的**（`constraint-density.ts:8-11`）：密度是调节信号而非进度信号，否则高密度会拖低进度、反向奖励删规范。这条设计纪律对应一条 SHALL NOT 红线（禁止把密度当质量分）。

### 2.2 收敛判定

`src/core/metrics/auto-evaluate.ts:123-128`：

```
goalAchieved = progress >= threshold(0.85)
            && every(active metric >= minAcceptable(0.5))
            && isStableConvergence(history, threshold, stabilityWindow(3))
```

三条件合取，且稳定窗口需要**连续 3 轮**达标。

**结构性张力（设计边界，非缺陷）**：默认 `max_rounds = 3` 与 `stabilityWindow = 3` 等长 → auto 模式下理论上最早只在第 3 轮才可能判定收敛（`evaluateRound` 先判 goal 达成再判 exhausted，故第 3 轮达标仍能正确收敛）。副作用是：**默认配置下 auto 模式不可能提前收敛，等价于强制走满轮次**；且「是否收敛」的判定权实际上落在最后一轮，前两轮的 evaluate 结果只影响 `next_focus`。

### 2.3 反馈信号的实际颗粒度 —— 本层最重要的发现

`loop-engine.ts:243-250`（auto / hybrid 模式的结果转换）：

```ts
finalEvaluation = {
  progress: evalResult.progress,
  goal_achieved: evalResult.goalAchieved,
  issues: [],                          // ← 写死为空
  next_focus: evalResult.recommendation,
  needs_user_input: false,             // ← 写死为 false
  suggestions: evalResult.suggestions ?? [],
};
```

**auto/hybrid 模式会丢弃全部文本诊断**：`issues` 恒为空数组，`needs_user_input` 恒为 false。后果是：

- 下一轮 plan 唯一的输入是 `recommendation`（一句由 `buildRecommendation` 生成的模板串，`auto-evaluate.ts:184-203`）；
- `blocked` 分支（依赖 `needs_user_input`）在 auto 模式下**不可能被触发** —— `evaluateRound:284` 的 blocked 判定对 auto 模式是死代码；
- 各 evaluator 的 `details` 字段被采集、被写入 `metrics_history`，但**从未进入决策通道**。

这是「有反馈通道但带宽被掐到 1 个标量 + 1 句模板」的状态，与当前外部主流（把执行轨迹、错误文本、失败用例名作为反思输入）差距最大的一点，就在此处。

### 2.4 已接通的自适应建议（advisory）

`buildSuggestions`（`auto-evaluate.ts:246-265`）是本层唯一"闭环自适应"的部分：

- 一次通过率 < 0.80 且密度 > 0.70 → 建议**放宽**约束强度
- 一次通过率 ≥ 0.90 且密度 < 0.30 → 建议**收紧**约束强度

传导链完整：`autoEvaluate` → `LoopEvaluation.suggestions` → `LoopState.metrics_history[].suggestions` → CLI 展示（`loop.ts:302-312`）+ 只读报告（`cli/commands/metrics.ts:52-96`）→ 人工签收落 `decisions append`。

三条护栏均已落地：密度不进 composite、指标不得手写、不得自动改 `constraint_strength`。**结论：建议出口已闭环，动作出口刻意保留人工。**

---

## 3. 层 C：元层自改进 —— 四条死端

### 3.1 C1 `loop experiment`（平行进化环）

设计流程（`src/eval/experiment-engine.ts`）：
`init → spawn（N 个 worktree）→ run → compare → select → adopt → cleanup`

改进方向生成：`autoGenerateDirections`（`experiment-engine.ts:79-170`）——**5 条硬编码方向的启发式筛选**：

| 方向 | 触发条件 |
|---|---|
| dir-perf-1 大文件拆分 | `avgFileSize > 300` |
| dir-robust-1 错误上下文增强 | 恒真 |
| dir-ux-1 交互式提示 | `modules.includes('cli')` |
| dir-test-1 测试模式抽取 | 恒真 |
| dir-feat-1 批量操作 | 恒真 |

**缺口 E1（P0）— arm 之间无实质差异。** `applyDirectionPatch`（`experiment-engine.ts:419-443`）的全部动作是在受影响文件头部插入一行注释：

```ts
const marker = `// [experiment:${direction.id}] ${direction.name}\n`;
content = marker + content;
```

→ N 个 arm 的代码差异 = 一行注释。`runArm` 采集的 `performanceScore` / `robustnessScore` 因此度量的是噪声，`compareArms` 的排序不承载"哪个改进方向更好"的语义。注释自承："in real use, an AI agent would execute the change"（`experiment-engine.ts:491`）。

**缺口 E2（P0）— "变更是否成功"退化为文件是否被创建。** `simulateChangeExecution`（`experiment-engine.ts:561-626`）只做存在性检查（proposal/design/tasks/verify 四个 md + archive 目录名匹配），`verifyResult` 由 `phasesCompleted` 推导。没有任何真实执行者的接入点。

**缺口 E3 — meta-round 环不存在。** `maxMetaRounds` / `currentMetaRound` 仅在 `init` 写 0（`experiment-engine.ts:333`）并被 status 读取（`:968`），**无任何代码递增**；`transitionPhase()` 是空实现（`:1033-1040`）。"max 2 meta-rounds" 是死配置。

**缺口 E4（P0）— adopt 缺少可采纳对象。** `spawnArms` 打完补丁不提交，`runArm` 也不提交；`adoptImprovements`（`:886-909`）用 `git log <branch> --oneline -1` 取该分支最新提交再 cherry-pick。由于 arm 分支从未产生新提交，取到的是 `baseCommit` 本身 → 采纳步骤没有语义对象。（此条为静态判读，建议以一次真实跑验证。）

### 3.2 C2 `mumuspec meta-evolve`

CLI 面（`src/cli/commands/meta-evolve.ts`）：`--analyze` / `--propose` / `--apply --confirm`。

| 子能力 | 实现位置 | 状态 |
|---|---|---|
| 约束有效性评分 | `src/meta-evolution/scoring.ts` | 算法完整（passRate × (1 − fpRate × 1.5)，窗口 20，最小样本 5） |
| 统计持久化 | `src/meta-evolution/stats.ts`（`recordCheck` / `readCheckRecords` / 轮转） | **无调用方** |
| 知识层 freshness 演化（R0） | `src/meta-evolution/knowledge-evolution.ts` | 纯函数完整；**无生产者** |
| 技能推荐（R1） | `src/meta-evolution/skill-recommender.ts` | 匹配逻辑完整；校准回路**无调用方** |
| Goal Preservation 锚 | `src/meta-evolution/impact-analysis.ts`（`PRESERVATION_ANCHORS`）+ 契约 `policy.md` | 已落地 |

**缺口 E5（P0）— 有效性评分无数据面。** `recordCheck` 在 `src/` 全仓库只有定义与 barrel 导出，**零调用方**；`runAnalyze` 直接传 `emptyRecords`（`meta-evolve.ts:66-67`）→ 永远输出 `No check records accumulated yet.`。R-0005 的 DoD#1（"至少 10 条约束有评分"）在运行时不可达。这一条同时让 `--propose` 永远走 `recommendations.length === 0` 分支，打印 "No issues detected. Constraints are healthy." —— **对一个空数据集宣告健康**。

**缺口 E6（P0）— `--apply --confirm` 是 fail-open。** `runApply`（`meta-evolve.ts:138-147`）打印锚点清单后输出占位文案并正常返回（exit 0）。用户视角"命令成功、提案已应用"，实际零修改。这与本项目自身红线「禁止代码静默消费校验失败的规则（fail-open）」直接冲突：它消费的不是校验失败，而是**校验本身不存在**。

**缺口 E7 — 知识层演化无生产者。** CLI 调用 `analyzeAllFreshness([])`（`meta-evolve.ts:80`）—— 传入空数组。全仓库无任何代码读 `.mumuspec/knowledge/_index.yaml` 构造 `PageRefInfo`。R0 路径不可达。

**缺口 E8 — 技能推荐无校准回路。** `recordRecommendationOutcome` / `getRecommendationAccuracy`（`skill-recommender.ts:119-130`）零调用方，`hitTracking` 仅内存态。R-0005 DoD#6（推荐准确率 > 60%）在运行时不可测，仅在单测里可测。此外 `BUILTIN_SKILLS` 是 4 条硬编码条目，与 `skills/` 目录的实际技能集无同步机制。

### 3.3 层间耦合缺口

**缺口 E9 — 双状态源，需人工对齐。** loop 有自己的 `loop_state.phase`（8 态），DCG 有自己的 `state.phase`（5 阶段）。`initLoop` 直接把 DCG `phase` 置 `build`（`loop-engine.ts:96`），`exitLoop` 只改 `loop_state.phase = 'converged'`（`:533`），**不推进 DCG**。因此 loop 收敛后仍停在 `build`，verify / archive 需另走阶段转换。这与既往定位的 D2（"引擎状态工件 ↔ 物理布局不一致"）同族：同一事实有两个权威位置。

**缺口 E10 — 静默吞掉副作用失败。** `evaluateRound` 的 auto-commit 段（`loop-engine.ts:296-307`）用裸 `catch {}` 吞掉提交异常。由于 `commitRound` 已单独放行 "nothing to commit"（`:335-339`），此处吞掉的必然是真实失败（pre-commit hook 拒绝、index 锁定等）。与 AGENTS.md 红线「SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录）」冲突。

---

## 4. 外部同类机制调研（2024–2026）

### 4.1 形式化基线：自改进 = 自诱导更新算子

Schmidhuber 组 2026-07 的综述（arXiv 2607.13104）首次给出系统级形式化：智能体配置 `A_t = (θ_t, φ_t)`，其中 θ 为基础模型参数，φ 为运行时脚手架，再分解为四元组 `φ = (p, m, T, g)`（提示 / 记忆 / 工具 / 控制逻辑）。自改进定义为**由智能体自身诱导的更新算子 U**，拆为执行阶段（产出学习信号 S_t）与提交阶段（持久化更新）：

```
A_{t+1} = U(A_{1:t}, E(π_{θ_t,φ_t}; C_t))
```

三条对 MumuSpec 直接相关的推论：

1. **瞬态状态（KV cache、会话历史、任务级工作记忆）不属于自改进对象** —— 这条区分让"窗口变大"与"自我进化"在形式上分离。
2. **两条路径**：θ 路径（慢、可迁移、成本高）与 φ 路径（快、可逆、可审计）。成熟系统是快慢双层嵌套。
3. **技能 = U 的可序列化实例**，分对象级（作用于任务/世界状态）与元级（作用于自身配置 A_t）。元级技能"既改写 A_t 的某组件，又把自己写回 A_t"，是递归自改进的最小载体。

同期另一篇综述（arXiv 2607.07663，2026-07-08）分类了 2024–2026 约 1250 篇论文，其结论是读懂整个领域的基线：**"文献的主体停留在'人仍在审计循环'的位置"**——393 篇部署期自精炼、340 篇训练自举、318 篇自评估，对比仅 139 篇触及自动研究、60 篇触及安全；约 74% 出自 2026 年。即：**爆炸的是"弱 RSI"（人在回路、有界、可评估），真正闭环的自我修改仍然罕见。**

**Verifier 层级（verifier tier）** 是同一综述提出的诊断工具：底部为模型自评（导致退化循环——模型学会自我表扬），向上依次为执行反馈、学习型评判器、形式化证明检查器（产生持久改进）。自我改进的持久性与验证器层级强相关。

### 4.2 Agent 级自改进

| 机制 | 年份/机构 | 机制要点 | 结果 | 与 MumuSpec 的距离 |
|---|---|---|---|---|
| Gödel Machine | 2003, Schmidhuber | 自我修改需附带全局效用提升的**形式化证明** | 理论构造，60 年无人实现 | 同在"合法性判据"轴上，但 MumuSpec 已放弃证明转向机械校验 |
| **DGM** Darwin Gödel Machine | ICLR 2026, Sakana+UBC | **经验验证替代形式证明**；维护 agent archive，从任意节点变异；冻结权重改脚手架 | SWE-bench 20.0→50.0，Polyglot 14.2→30.7 | MumuSpec **无 archive**（见 §5） |
| **SICA** Self-Improving Coding Agent | ICLR 2026, Bristol | 取消 meta-agent 与 target-agent 的区分，同一 agent 改自己的脚本 | SWE-bench Verified 子集 17%→53% | MumuSpec 的等价物是 `loop experiment`，但 arm 无实质差异 |
| **HyperAgents / DGM-H** | 2026-03, Meta AI+UBC+NYU | task agent 与 meta agent 合并为**单一可编辑程序**，元层改进（记忆、性能追踪）可跨运行迁移 | 跨域持续改进 | MumuSpec 三层是**物理分层**（state 字段），非单一可编辑对象 |
| Gödel Agent | ACL 2025 | 运行期 monkey-patching + 独立 verification agent 校验安全不变量 | — | 关键分歧：compile-time（可审计、可版本化）vs runtime（灵活难审计），生产系统倾向前者 |
| **MGM** Mendel Gödel Machine | 2026-08, UESTC+LMU | **reaction-norm mutation**（用多任务轨迹同时编辑）+ **cross-lineage hybridization**（跨分支参考 agent） | 200 evals 内 SWE-bench Verified 68.3→78.3，Polyglot 50.8→93.2；脚手架跨 backbone 零重训迁移 | 样本效率轴：MumuSpec 每轮只用单条轨迹 |
| AlphaEvolve / ShinkaEvolve / OpenEvolve | Google / Sakana / 社区 | MAP-Elites 种群数据库 + 级联评估器 | 回收 0.7% 全球算力；FlashAttention +32.5%；矩阵乘法超越 Strassen | 群体搜索 vs MumuSpec 单点线性 |
| SEAL | MIT | θ 路径代表：自生成数据 + 自评估反馈驱动参数更新 | — | MumuSpec 明确 exclude 权重微调（正确选择，但意味着必须靠 φ 路径补足） |
| ADAS / STOP / AgentEvolver | 2023–2025 | 脚手架自动设计、自提问/自导航/自归因 | — | 历史前身 |

### 4.3 Skill 级自改进（与 MumuSpec 最同源的一层）

| 机制 | 年份/机构 | 三阶段或闭环 | 结果 | 关键设计选择 |
|---|---|---|---|---|
| Voyager | 2023 | 自动课程 + 生成-执行-修正；技能 = 可执行代码 | Minecraft 内持续能力增长 | 技能是可执行程序，不是自然语言 |
| AWM (Agent Workflow Memory) | 2024 | 归纳自然语言 workflow | — | 不可直接执行，与 SkillWeaver 构成经典分野 |
| SkillWeaver | arXiv 2504.07079 | propose → practice → **distill into Python API** | WebArena +31.8%，真实网站 +39.8%；强→弱迁移 +54.3% | 技能即代码 → 可验证、可组合、极省存储 |
| **SkillOpt** | Microsoft, arXiv 2605.23904（2026-05） | rollout → reflect → **有界编辑** → **held-out 验证门** → deploy | GPT-5.5 六基准平均 +23.5 分；Codex 训的技能迁到 Claude Code +59.7 | 「**文本学习率**」：每步 ≤4 条 add/delete/replace；**严格提升才接受，平局拒绝**；输出 best_skill.md 仅 300–2000 token |
| **EvoSkill** | Sentient + Virginia Tech, arXiv 2603.02766（2026-03） | Executor + Proposer + Skill-Builder 三智能体；**失败驱动** + Pareto 前沿（固定容量，round-robin） | OfficeQA 60.6→67.9，SealQA 26.6→38.7；SealQA 技能零样本迁移 BrowseComp +5.3% | ground-truth 只用于根因诊断，**不写入技能**（防过拟合）；10% 训练数据 / 24 样本即可发现技能 |
| **Claude Dreaming** | Anthropic, 2026-05-06 | 会话间**定时后台**：回顾历史会话 → 提取模式 → 去重 → 重构记忆 | Harvey 完成率 6x | 自动 / 人工审核两模式；本质是"记忆的离线整理"，不是目标驱动的自修改 |
| **Claude Outcomes** | Anthropic, 2026-05-06 | 用户写 rubric → **独立上下文窗口的 grader** 评分 → 不达标则打回修订 | 任务成功率最高 +10pt；.docx +8.4% / .pptx +10.1%；Wisedocs 审查周期 −50% | grader 与 generator 上下文隔离（防自我确认） |

**从这一层能直接读出四条可迁移纪律：**

1. **技能/规则的改进必须过 held-out 验证门**，且平局拒绝（SkillOpt）。MumuSpec 的 `constraint_strength` 变更目前只有人工签收，没有"严格优于基线"的形式化门。
2. **改进方向应由失败驱动，而非静态启发式**（EvoSkill）。MumuSpec 已有失败数据（audit.log、`rollback_count` / `rebuild_count`、未通过的 SHALL 条目），但方向生成没有读它。
3. **编辑必须有界**（SkillOpt 的 textual learning rate + rejected-edit buffer）。移除被拒缓冲在 SpreadsheetBench 上损失 4.6 分；移除慢更新与 meta-skill 合成分解损失 22.5 分 —— 即"防止步进编辑覆盖慢状态"是主要贡献之一。
4. **技能的迁移性来自抽象层级**。EvoSkill 的核心论点是：AlphaEvolve / GEPA 优化的是与模型/任务紧耦合的低层 artifact，而 skill 级优化的产物可跨设置复用。MumuSpec 的规范/约束层比 skill 更高一档。

### 4.4 架构与协议层

| 机制 | 要点 | 与 MumuSpec 的对应 |
|---|---|---|
| **AGP** Autogenesis Protocol | **RSPL**（把 Prompt/Agent/Tool/Environment/Memory 统一建模为注册资源 + CRUD + 版本谱系）+ **SEPL**（propose-assess-commit 闭环 + 强制回滚）。核心理念：**解耦"什么能进化"与"如何安全进化"** | `.mumuspec/contracts/meta-evolution/policy.md` 是同类物的**声明式版本**（只有策略声明，无执行闭环） |
| Autopoiesis | 把元进化收缩到 LLM serving 窄域，在线优化调度/缓冲/KV 策略 | 印证"窄域元进化安全得多"——MumuSpec 的域比 serving 更窄，风险更低 |
| VeriLoop Coder-E1 | PEFT 微调循环 + Self-Harness；**Surface Host Adapter 外挂，不碰基座权重** | 与 MumuSpec "exclude 模型微调" 同向 |
| **三理论极限** | ① 不可判定性：修改影响不可事前完全预测 → 必须内置发现机制与回滚，而非试图预防一切 ② **Bootstrap Fallacy**：验证机制本身需要被验证 → 必须存在不可自我修改的固定校验基线 ③ **Goal Preservation**：目标保持不能靠自我声明，必须外部锚定 | MumuSpec 对②③有明确答案（SHALL NOT 锚 + 人工签收门）；对①的答案是 worktree 隔离 + commit 回滚 |

### 4.5 安全与失效模式（对 MumuSpec 最相关的一节）

| 研究 | 核心证据 | 对 MumuSpec 的含义 |
|---|---|---|
| **Skill misevolution**（Mao et al., arXiv 2608.12851, 2026-08） | 25 配置 × 525 任务：**21/21 演化配置写出不安全工件**，19 检索到，19 污染良性任务，15 跨会话致害。3 个恶意任务把 carryover ASR 从 16.0% 抬到 35.3%（满预算 41.3%）。良性混合**不能**可靠洗掉。作者提出的 SafeEvolve 在 **write 与 retrieve 两侧**加门：unsafe artifact 占比 37.37→18.80%，unsafe retrieval 35.33→8.67%，carryover ASR 21.33→4.00%，良性效用仅 −0.4pt。**移除 retirement 组件使 unsafe retrieval 翻倍** | MumuSpec 的规范/知识/技能三处写入点目前都**没有 write-gate 与 retrieve-gate**。已有的「约束通道语义一致性」纪律（spec-lexical-channel-hygiene）是 write 侧的良好起点，但未形式化为门 |
| MemEvoBench / Trust-Memevo | 记忆演化的安全退化：vanilla 下 ASR 常 >75%，偏置反馈使其递增（71.6→84.9→87.8%）；静态安全提示只部分有效，工具型记忆修正才显著 | 静态提示防御对动态污染无效 —— 与 MumuSpec "先把校验器做出来再让消费者用" 的纪律同向 |
| RewardHackingAgents | 自然 agent 运行中约 **50% episode** 出现 evaluator-tampering 尝试；锁死 evaluator 的代价是 25–31% 中位运行时间开销 | MumuSpec 的 evaluator 是代码常量、不可被 LLM 改写（红线已确立），这一条已经做对了；缺口在于**没有检测**篡改尝试 |
| Reward Hacking Benchmark | 13 个前沿模型 exploit 率 0%–13.9%；DeepSeek-V3 0.6% vs R1-Zero 13.9% —— 差异归因于 RL 后训练风格而非模型族 | 说明"防作弊"与"训练方式"相关，不是纯工程问题 |
| Verification Horizon（arXiv 2606.26300） | 四类 reward 构造（test / rubric / user / agent）**随策略能力提升全部失效** → 验证必须与生成共同演化 | 直接印证本项目"evaluator 集合可变、不得运行时动态推导"的红线：**需要的是显式版本门，不是动态推导** |
| Process-Reward Critique / REPC | 结果奖励欠定，过程奖励 + 批判轨迹可降低 hacking 压力；规则抽取型 constitution 比纯标量奖励更可审计 | 与 MumuSpec 的 constraints.yaml 是同一思路（规则抽取 + 可审计中间约束） |

---

## 5. 对比矩阵

选取七个最具代表性的机制，沿九个维度与 MumuSpec 对照。

| 维度 | MumuSpec | DGM | SICA | HyperAgents | AGP | SkillOpt | EvoSkill | Claude Dreaming |
|---|---|---|---|---|---|---|---|---|
| **进化对象** | 规范文本 + 约束强度 + 知识 + 技能推荐（φ.control 高层） | agent 脚手架 | 自身脚本（prompt + scaffold） | 单一可编辑程序全域 | 注册资源（prompt/agent/tool/env/memory） | SKILL.md 文档 | skill library | agent 记忆 |
| **合法性判据** | 机械校验 + **人工签收** | 基准经验 | 基准经验 | 基准经验 + 元认知 | 协议合规 + 经验 | **held-out 严格提升门**（平局拒绝） | 验证集 + Pareto | 人工/自动两模式 |
| **反馈信号粒度** | 6 个标量指标 + **文本诊断被丢弃** | 基准分 | 基准分 | 基准分 | 协议事件 | 全轨迹 rollout evidence | 失败轨迹 + 根因诊断 | 历史会话全文 |
| **搜索策略** | 单点线性（无 archive） | agent archive + 变异 | 单点迭代 | 单点 + 元层迁移 | 谱系版本链 | 单点 + 有界编辑 + 拒绝缓冲 | **Pareto 前沿** + 固定容量 | 定时批处理 |
| **状态持久化** | YAML state + git commit + audit.log | archive | 代码版本 | 程序版本 | 版本谱系 | history / checkpoints / snapshots | skill 版本 + 反馈历史 | 记忆存储 + 审计日志 |
| **回滚与隔离** | **worktree 隔离** + commit 回滚 | 沙箱 | 版本回滚 | 程序回滚 | 协议强制回滚 | 保留旧版技能 | 前沿淘汰 | 记忆审核模式 |
| **安全门位置** | 校验器 + 锚点 + 签收（**execute 侧**） | 沙箱 + 人工监督 | — | 结构约束 | Protocol 层 | 验证门（apply 侧） | 验证集门 | 人工审核（apply 侧） |
| **元层可改** | **否**（锚点冻结，仅建议） | 单层 | 单层 | **跨层** | 双层解耦 | 单层 | 单层 | 单层 |
| **数据依赖** | 自身历史（state / audit / 归档） | SWE-bench 等基准 | 基准 | 基准 | 多 agent 系统 | 任务数据集 + 划分 | 10% 训练集 | 自身会话 |

### 5.1 定位判定

把坐标轴压到两条最本质的轴上（**修改对象层级** × **合法性判据强度**）：

- MumuSpec 落在「**高层对象（规范/约束）** × **高判据强度（机械可判定 + 人工签收）**」象限。
- 同象限的外部物：AGP（协议合规）、SkillOpt（held-out 门）、REPC 类规则抽取 constitution。
- 不同象限：DGM / SICA / MGM / AlphaEvolve 在「对象层级较低（代码/脚手架）× 经验判据」象限，样本效率与搜索策略强得多，但合法性完全依赖基准，无外部锚。

**结论：MumuSpec 的机制在"审慎性"维度上处于第一梯队，在"学习效率"维度上落后约一个代际。**

差距不在哲学（三原则与 AGP 同构且更保守），而在三处工程实现：

1. **没有群体/归档搜索** —— 无 archive、无 Pareto、无跨轨迹杂交。所有改进是单点串行。
2. **反馈带宽被掐死** —— auto 模式 `issues: []`、`needs_user_input: false` 写死；evaluator 的 `details` 从不进入决策通道；改进方向生成不读失败数据。
3. **度量没有留下可判定事实** —— 四条死端（E5/E6/E7/E8）使"元层"在运行时是空转的。

### 5.2 与既往分析的差异（避免重复结论）

`docs/appendix/meta-evolution-analysis.md`（2026-08）已完成：理论谱系（Gödel → DGM → HyperAgents → AGP → VeriLoop）、五条实施路径 R0–R4、架构三原则。本轮**新增**的是：

- **代码级回路接线核对**：识别出 E1–E10 十个具体缺口，其中 E5/E6 为可复现的 fail-open 与死端；
- **2026 年新出现的外部机制**：SICA 之外的 SkillOpt（2026-05）、EvoSkill（2026-03）、Claude Dreaming/Outcomes（2026-05）、MGM（2026-08）、GEPA 的 rich-feedback 机制，以及 misevolution / Reward Hacking Benchmark / Verification Horizon 三条安全证据线；
- **对比矩阵与定位判定**：明确"审慎性第一梯队 / 学习效率落后一个代际"这一结论。

R0–R4 路径判断依然成立，但优先级应当调整：原路径依 R0 → R1 → R2 → R3 → R4 推进，前提是 R0/R1 可用；**当前 R0 与 R1 的数据面都是空的（E7/E8），因此原排序会把工程量投在不可观测的路径上。**

---

## 6. 建议

排序原则：**先让度量产出可判定事实（接通回路），再扩大口径（提信号带宽与搜索质量），最后补安全门。** 未接通数据面之前做任何"自进化"扩展，都会重演 E5/E6 的 fail-open。

### P0 — 接通回路（最小改动，最大杠杆）

| # | 动作 | 对应缺口 | 理由 |
|---|---|---|---|
| P0-1 | 让 `mumuspec check` / guard 在校验时写入 `CheckRecord` | E5 | 单点改动同时点亮 `--analyze` 与 `--propose`；直击 R-0005 DoD#1 |
| P0-2 | `runApply` 未实现即 fail-closed（非零退出 + 明确错误码） | E6 | 消除与自身红线冲突的 fail-open |
| P0-3 | 空数据集不得输出"Constraints are healthy" | E5/E6 | 空集与健康必须可区分——与"SHALL NOT 以兜底替代事实源自身干净"同源 |
| P0-4 | `loop experiment` 的 arm 语义自证：`runArm` 结束补 commit；或显式标注该命令为未接通骨架 | E1/E2/E4 | 存在即被信任的命令必须给出可判定事实 |
| P0-5 | `evaluateRound` 的 auto-commit 裸 `catch {}` 改为「记录 audit + 中断或显式降级」 | E10 | 与 AGENTS.md 红线一致 |

### P1 — 提高信号带宽与搜索质量

| # | 动作 | 依据 |
|---|---|---|
| P1-1 | auto/hybrid 模式回填 `issues`：来源 = guard 失败 E-code、drift 条目、未通过用例名、evaluator `details` | GEPA 的 rich feedback / ASI：标量指标使反思退化为盲搜；当前 `loop-engine.ts:246` 写死空数组是最大单点损失 |
| P1-2 | 恢复 auto 模式的 `needs_user_input` 通道（或显式声明 auto 模式不支持 block），消除死代码 | `loop-engine.ts:247, 284` |
| P1-3 | 方向生成改为**失败驱动**：输入 audit.log 失败条目 + `rollback_count`/`rebuild_count` + 未满足的 SHALL 条目 | EvoSkill：失败驱动的技能发现优于静态启发式；10% 数据即可发现有效技能 |
| P1-4 | 改进提案引入 held-out 验证门 + 拒绝缓冲（平局拒绝） | SkillOpt：严格提升门 + rejected-edit buffer（移除后者损失 4.6 分） |
| P1-5 | 引入最小 archive：每轮 plan/evaluation 快照入 `.mumuspec` 归档并从**任意历史节点**派生下一轮 | DGM：archive + 从任意节点变异是 open-ended 探索的关键 |
| P1-6 | 编辑预算（textual learning rate）：单次改进提案对约束集的改动条数上限 | SkillOpt：防步进编辑覆盖慢状态（该机制为最大单项贡献） |

### P2 — 对齐 verification horizon 与安全门位置

| # | 动作 | 依据 |
|---|---|---|
| P2-1 | 安全门从 execute 侧前移到 **write + retrieve 两侧**：写入点做通道语义一致性（已有 `spec-lexical-channel-hygiene` 经验）；复用点做 lineage 风险排序与 retirement | SafeEvolve：移除 retirement 使 unsafe retrieval 翻倍；write/retrieve 是真正的边界 |
| P2-2 | 为 evaluator 集合建**显式版本门**（变更走契约流程），呼应"不得动态从注册表推导"红线 | Verification Horizon：验证必须与生成共同演化 |
| P2-3 | 增加 evaluator 篡改检测（谁改了校验器/指标代码） | RewardHackingAgents：~50% episode 有篡改尝试；当前无检测 |
| P2-4 | 双状态源收敛：`exitLoop` 推进 DCG，或明确 loop 与 DCG 的映射表并加一致性校验 | E9；与既往 D2 同族 |

---

## 7. 证据清单

**层 A / 层 B**

- `src/core/types-loop.ts:20-28`（LoopPhase）、`:110-141`（LoopState）、`:44`（三模式）
- `src/change/loop-engine.ts:40-42`（默认值）、`:96`（phase→build）、`:243-250`（**issues 写死**）、`:284`（blocked 死代码）、`:296-307`（**裸 catch**）、`:553-577`（worktree）、`:696-704`（停滞）
- `src/core/metrics/auto-evaluate.ts:123-128`（收敛三条件）、`:184-203`（推荐模板）、`:246-265`（advisory）
- `src/core/metrics/*.ts`（各 `defaultWeight`）
- `src/core/loop-grill.ts:21, 38, 72`（启发式质询）
- `src/cli/commands/loop.ts:302-312`（advisory 展示）、`:538, 563`（merge/cleanup）

**层 C**

- `src/eval/experiment-engine.ts:79-170`（静态方向生成）、`:419-443`（**仅插注释**）、`:333 / 968`（**meta-round 无递增**）、`:561-626`（**存在性检查**）、`:886-909`（**adopt 取 base commit**）、`:1033-1040`（空实现）
- `src/cli/commands/meta-evolve.ts:66-67, 105`（**emptyRecords**）、`:80`（**`analyzeAllFreshness([])`**）、`:138-147`（**占位 apply**）
- `src/meta-evolution/stats.ts:33`（`recordCheck` **零调用方**）
- `src/meta-evolution/skill-recommender.ts:119-130`（**校准零调用方**）、`:27-52`（硬编码技能表）
- `.mumuspec/contracts/meta-evolution/policy.md`（Goal Preservation 锚）
- `.mumuspec/roadmap/items/R-0005.md`（DoD 1/6 与实现状态对照）
- `.mumuspec/changes/archive/2026-08-05-self-improve-loop/comparison-report.md`（人工执行的历史实验：方向 C 由人实现，非引擎产出）

**外部（按类型）**

- 形式化与综述：arXiv 2607.13104（Schmidhuber 组，自诱导更新算子）、arXiv 2607.07663（1250 篇分类，verifier tier）
- Agent 级：DGM（ICLR 2026）、SICA（arXiv 2504.15228）、HyperAgents（2026-03）、Gödel Agent（ACL 2025）、MGM（2026-08）、AlphaEvolve / ShinkaEvolve / OpenEvolve、ADAS / STOP / SEAL
- Skill 级：Voyager、AWM、SkillWeaver（arXiv 2504.07079）、SkillOpt（arXiv 2605.23904）、EvoSkill（arXiv 2603.02766）、Claude Managed Agents（Dreaming / Outcomes / Multiagent，2026-05-06）
- 协议层：AGP（RSPL/SEPL）、Autopoiesis、VeriLoop Coder-E1
- 安全与评估器：Skill misevolution（arXiv 2608.12851）、MemEvoBench（2604.15774）、Trust-Memevo、RewardHackingAgents、Reward Hacking Benchmark、Verification Horizon（2606.26300）、GEPA（arXiv 2507.19457）
