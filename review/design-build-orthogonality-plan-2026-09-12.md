# 设计与实现的视野正交性 — 实现计划

> 日期：2026-09-12 · 状态：**待裁决（3 项 BP）** · 类型：规范 + 引擎实现计划
> 关联：`docs/design/change-layer.md:42`（四大工作流规则之三）、`.mumuspec/constraints.yaml` TD 维度

---

## 0. 一句话论点

> **实现侧的并行度，是设计侧完备性的可测量投影。**

设计把层内契约冻得越完整，实现能并行的模块就越多；同层模块若无法并行，不是"实现能力不足"，而是"设计没闭合"。这条等式把"默认并行"从一个愿望，变成了一把**测量设计质量的尺子**。

---

## 1. 理念的精确化

原口号"自顶向下设计，自下而上实现"有歧义：可以读作**时间顺序**（先设计后实现——同义反复），也可以读作**依赖顺序**（设计时视野向上，实现时视野向下）。本次按后者精确化为三条可判定不变量：

| 编号 | 不变量 | 反面（可判定的反例） |
|------|--------|---------------------|
| **I1** | **设计向上闭合**：设计 Level *N* 时视野 = Level 0..*N*，产物须声明继承了哪些更高层约束 | 存在 Level *N* 的设计产物，但祖先层无对应设计 → **断链** |
| **I2** | **实现向下自足**：实现 Level *N* 时视野 = Level *N*..叶子，只依赖本层契约与更低层 | 出现对同层兄弟模块**内部实现**（非契约）的引用 → **越界** |
| **I3** | **层内默认可并行**：层内模块间只经由已冻结契约耦合 | 同层两模块互相依赖对方未冻结的实现 → **设计未闭合** |

**关键**：I3 不是 I2 的附属口号，而是 I2 的**探针**。I2 成立 ⟺ 同层模块可并行。因此"默认并行"不需要额外机制去"实现"，只需要**去检测它为什么做不到**。

---

## 2. 现状核查（事实，均带证据）

### 2.1 已经具备的基础（比预期好）

| 事实 | 证据 | 意义 |
|------|------|------|
| 渐进式披露加载的正是**当前层及更高层** | `src/spec/loader.ts:26-41`（root + 被限流的中间层 + 目标层） | I1 所需的加载语义**已天然对齐** |
| 规范链已有层级字段 | `.mumuspec/*/index.yaml` 的 `layer: N` / `scope` / `children`；`src/cli/index.ts:229-233` | I1 的"无断链"有可判定基础 |
| 继承规则已实现"可收紧不可放宽" | `src/spec/inheritance.ts:29-45`（child SHALL NOT ⊥ parent SHALL） | I1 的合法性判据已存在 |
| 测试在设计阶段锁定 | `test_cases.design_locked` / `design_content_hash`（`types-workflow.ts:33-39`） | **契约冻结的可执行形式**，并行安全的前提 |

### 2.2 缺口（四个，同源）

| # | 缺口 | 证据 | 性质 |
|---|------|------|------|
| **G1** | `workflow.top_down_design` **零消费者** | 定义于 `config.ts:80`、强度矩阵 `config-tree.ts:48,68`、默认值 `config-io.ts:85`、CLI 展示 `constraints.ts:65-72`；**guard 全无引用** | 声明了却不生效 |
| **G2** | `build_layers` 无并行语义 | `BuildLayer { layer, scope, status }`，无 depends/group 字段（`types-workflow.ts:26-30`） | 无法表达 I3 |
| **G3** | 同层多 scope 会被静默吞掉 | `updateBuildLayerStatus` 用 `find(l => l.layer === layer)` 定位（`lifecycle.ts:482-485`）→ 同 layer 多条时**永远只改第一条** | 隐式假设"一层一个模块" |
| **G4** | guard 只查"全部 done"，不查顺序 | `phase-guard.ts:601,652`（`filter(l => l.status !== 'done')`） | 顺序约束空缺 |

### 2.3 文档声称但代码不存在的检查项（漂移）

| 声称项 | 出现位置 | 实际 |
|--------|---------|------|
| `design_layers_covered` | `phase-guards.md:131`、`phase-design/SKILL.md:401` | **不存在** |
| `each_layer_shall_defined` | `phase-guards.md:132`、`SKILL.md:428` | **不存在** |
| `build_layers_completed_in_bottom_up_order` | `phase-guards.md:167`、`phase-build/SKILL.md:224` | **不存在** |
| `ponytail_constraints_defined` / `ponytail_compliance_checked` | `phase-guards.md:147,175` | **不存在** |
| `subagent_dispatch` | `phase-build/SKILL.md:125` | **不存在** |
| `isolation` / `build_mode` / `hard_constraints_merged` / `open_questions_resolved` / `degraded` / `suites_hash` | 各 SKILL.md | **字段存在，guard 不读** |

> 元结论：**G1–G4 与前表中的"声称但不存在"同构**——引擎登记了概念却没有消费点。这与项目已记录的 `archive-lifecycle-defects` D1–D4、`self-improvement-loop` 死端四例是**同一个病**：*声明与执行之间没有回路*。

---

## 3. 待裁决点（BP）

> 以下 3 点决定计划的形态，**需先拍板再动手**。

### BP-1 · 设计的"停止面"在哪？

| 选项 | 含义 | 代价 |
|------|------|------|
| **A（推荐）** | 设计**产出止于当前层**：Level *N* 的设计只冻结 Level *N* 的对外契约 + 测试用例；Level *N+1* 以下的内部结构**不在 Design 展开** | 需改 `design_layers_covered` 语义与 test-cases 组织方式 |
| B | 维持现状：设计覆盖到所有层（Level 0→叶子），只是"视野须向上确认" | 改动最小，但设计阶段仍需展开叶子细节，"局部性"没落地 |

**我的判断**：选 A。理由——若设计展开到叶子，实现的"局部性"就无从谈起（叶子细节已被设计规定）；且 A 才使 I3 有意义（层内契约冻结 = 并行前提）。**倾向把 `layer-N-cases.md` 从"该层内部实现用例"改为"该层对外契约用例"。**

### BP-2 · 层间顺序是否强制？

| 选项 | 含义 |
|------|------|
| **A（推荐）** | 层间保持**自下而上**（下层是上层的基础），**层内默认并行**（同 layer 多 scope 构成并行组） |
| B | 彻底解耦：契约冻结后，上层可先于下层实现（依赖倒置），顺序完全自由 |

**我的判断**：选 A。它是"自下而上实现"的字面兑现，且与现有 `build_layers` 的 layer 编号语义一致，不需要重构数据结构。B 需要引入契约桩机制，成本高、收益需实证。

### BP-3 · `top_down_design` 的默认值

现状不一致：`config-io.ts:85` 默认 `false`，而 `docs` 声称默认 `true`，强度矩阵 high 才为 `true`（当前项目 TD=medium → 实际 false）。

| 选项 | 含义 |
|------|------|
| A | 保持 medium 下的 false，I1 仅作为 **advisory（WARN）** 落地 |
| **B（推荐）** | 保持强度矩阵不动，但把 I1 的判定**做成"恒可见的 WARN + 结构化产出"**（符合项目既定裁决：LLM 语义评估仅 advisory，但**必须产出结构化工件**）；用户可在 `.mumuspec/config.yaml` 显式置 `true` 转为 block |

**我的判断**：选 B。不擅自提高约束强度（这是项目红线），但拒绝"静默失效"——WARN 必须带可判定的事实。

---

## 4. 实现计划

### 阶段划分原则

遵循项目既定纪律：**CLI-first**（确定性步骤走 CLI，`TD-F-001`）、**先校验器后消费者**、**规则-实现分离**（引擎归代码，规则归 LLM）、**Ponytail 阶梯**（不新增无消费者的配置项）。

---

### Phase 1 · 让"层级"成为可判定的事实（P0）

> 目标：I1 从口号变为 guard 可见的事实。**不新增配置项**——复用空转的 `top_down_design`。

| # | 任务 | 落点 | 验证 |
|---|------|------|------|
| 1.1 | 新增 `BuildLayer.parallel_group?: number` 与 `depends_on?: number[]`（**可选字段，向后兼容**） | `src/core/types-workflow.ts:26-30` | `tsc --noEmit` |
| 1.2 | 修 G3：`updateBuildLayerStatus` 按 `(layer, scope)` 定位，或新增 `--scope` 参数；同层多条不再被吞 | `src/change/lifecycle.ts:472-488` | 新增单测：同层两 scope 分别置 done |
| 1.3 | 新增 CLI：`mumuspec state layers <name>` — 输出层级表（layer / scope / status / parallel_group），并**显式报告并行组** | `src/cli/commands/state.ts`（对齐 `:661-683` 现有 `layer` 命令） | 命令输出含 "parallel groups: [[a,b],[c]]" |
| 1.4 | guard `design_to_build` 增加 I1 检查：设计产物的 layer 集合**无断链**（覆盖 L*N* 必覆盖 L0..*N*-1） | `src/guard/phase-guard.ts:326-458` | 构造断链 fixture → WARN |
| 1.5 | 落地 BP-3：I1 违规在 TD=medium 下为 **WARN 且带结构化条目**（写入 `state.design_coverage`），high 下为 block | 同上 + `constraint-evaluator.resolveWorkflowRule` | 双强度各跑一次 |

**产出工件**：`.mumuspec.yaml` → `design_coverage: { covered_layers: [0,1], unreachable_from: null }`（**新事实源，供 LLM 与后续 guard 共用**）。

---

### Phase 2 · 让"层内并行"可计算（P0）

> 目标：I3 从愿望变为可计算的并行组。**这是本计划的核心交付。**

| # | 任务 | 落点 | 验证 |
|---|------|------|------|
| 2.1 | 新增 CLI：`mumuspec state plan-parallel <name>` — 读 code-graph，对**同 layer 的多个 scope** 计算耦合：无边 → 同一并行组；有直接 CALLS/IMPORTS 边 → 拆分或登记为 `depends_on` | 新文件 `src/change/parallel-planner.ts` + `src/cli/commands/state.ts` | 对 `src/` 自身跑一次，人工核对分组合理性 |
| 2.2 | `initBuildLayers` 接受同层多 scope，自动分配 `parallel_group` | `src/change/lifecycle.ts:454-470` | 单测 |
| 2.3 | guard `build_to_verify` 增加 I2 检查：同层 scope 间的引用**必须**指向 `BOUNDARY.md` 已登记契约；否则报 `E-BUILD-PARALLEL` （**可 forceable 的 WARN，非恒 block**，避免误杀） | `src/guard/phase-guard.ts:592-632` | 构造越界引用 fixture |
| 2.4 | `phase-build/SKILL.md` Step 5 改写：由"逐层实现"改为"**按并行组实现**；组内可分发并行子 agent，组间按 layer 自下而上" | `skills/mumuspec/phase-build/SKILL.md:136-158` | 文本一致性核对 |
| 2.5 | 接通 `subagent_dispatch`：要么实现该字段并在 guard 消费，要么从文档删除（**不留第三种状态**） | `SKILL.md:125` ↔ `state.ts` | 二选一，无中间态 |

**关键设计**：并行组的计算**不需要新数据结构**——同 `layer` 数字即候选并行组。`parallel_group` 只是显式化"经过验证可并行"的子集。

---

### Phase 3 · 文档与规范的收敛（P1）

> 目标：消除 §2.3 的漂移，让"声称"与"存在"一一对应。

| # | 任务 | 落点 |
|---|------|------|
| 3.1 | **逐条裁决** `docs/reference/phase-guards.md` 与两份 SKILL.md 中声称的检查项：**实现它，或删掉它**。禁止保留"文档有、代码无" | `phase-guards.md`、`phase-design/SKILL.md`、`phase-build/SKILL.md` |
| 3.2 | 新增根规范 Requirement（草案见 §5），并登记到 `.mumuspec/constraints.yaml` TD 维度 | `.mumuspec/constraints.yaml` |
| 3.3 | 修正 `config-io.ts:85` 与文档的默认值不一致（默认 `false` vs 文档称 `true`） | `src/core/config-io.ts:85` |
| 3.4 | `docs/design/change-layer.md:42` 第三条规则的表述，从"Design 自顶向下…Build 自下向上…"扩写为含 **I1/I2/I3 三条不变量** | `docs/design/change-layer.md` |

---

### 依赖关系图

```
Phase 1 (事实层：层级可判定)
   │  1.1 类型 → 1.2/1.3 可并行开发
   │  1.4 依赖 1.1
   ▼
Phase 2 (计算层：并行组)  ← 依赖 Phase 1 的 1.1/1.2/1.3
   │  2.1 可与 1.4 并行
   ▼
Phase 3 (收敛层：文档/规范)  ← 依赖 1 与 2 的最终形态
```

**注意**：Phase 1/2 内部任务**彼此独立，可并行开发**（这正是本方法论的自举示范——计划自身遵守 I3）。

**前置依赖（计划外）**：若 `review/self-improvement-loop-remediation-plan-2026-09-12.md` 的 fail-open 修复未完成，则本计划新增的 WARN 类检查**会掉进同一个洞**（写入后被丢弃）。建议顺序：**先修 fail-closed，再落地本计划**。

---

## 5. 规范文本草案

新增 Requirement：`design-build-orthogonality`（设计与实现的视野正交性），落 `.mumuspec/spec.md`，登记 `.mumuspec/constraints.yaml` 的 TD 维度。

```markdown
### Requirement: 设计与实现的视野正交性

设计阶段的关注面 SHALL 为当前层级及其全部更高层，实现阶段的关注面 SHALL 为
当前模块及其全部更低层。

#### Scenario: 设计向上闭合
- **WHEN** 设计 Level N 的模块
- **THEN** 设计产物 SHALL 声明其继承的更高层约束来源
- **AND** 若覆盖了 Level N 而未覆盖 Level N-1，guard SHALL 报告断链

#### Scenario: 实现向下自足
- **WHEN** 实现 Level N 的模块
- **THEN** 该模块 SHALL NOT 引用同层兄弟模块未经冻结契约导出的符号

#### Scenario: 层内默认可并行
- **WHEN** 同一 Level 存在多个模块
- **THEN** 模块间若不存在直接调用边，SHALL 归入同一并行组
- **AND** 若无法归入同一并行组，SHALL 视为设计未闭合的信号，回退 Design
```

### ⚠️ 规范文本的通道卫生（红线，必读）

依项目既有红线「约束通道与约束语义一致」：`SHALL NOT` 条目中的**行内代码标记会被 `verifier-classify.ts` 当作字面量检索目标**（`src/guard/checker.ts`）。

- 上草案的场景 2 是 `SHALL NOT`，**故意不使用行内标记**——因为其判定目标是"引用关系"而非"字面量是否出现"，加标记会制造假阳性通道。
- → 该条目的强制通道应落在 `manual` 或 `ast`（由 Phase 2 的 2.3 提供），**不能落 R2 词法通道**。
- 若最终必须走词法通道，标记内**只能写真实检索目标**（如 `BOUNDARY.md`），不得写语义无关的对象标识符。

---

## 6. 风险与红线

| 风险 | 缓解 |
|------|------|
| **过度并行导致集成失败** | 并行组的准入条件是"契约已冻结 + 测试已锁定"；`test_cases.design_locked` 是先决条件，不是可选项 |
| **WARN 被当成噪声忽略** | Phase 1.5 强制 WARN 带结构化条目写入 `state.design_coverage`；符合项目既定裁决"advisory 也必须产出结构化工件" |
| **新增配置项再次空转** | 本计划**不新增布尔配置**；I1 复用空转的 `top_down_design`，I2/I3 落为 guard 检查 + CLI |
| **提高约束强度越界** | 严守红线：不擅自改 `constraint_strength` 默认值（BP-3 选 B） |
| **计划自身违反方法论** | Phase 1/2 内部任务已标注可并行；Phase 3 才做收敛 |

---

## 7. 验收标准

1. `mumuspec state layers <name>` 能输出并行组，且对同层多 scope 不再静默吞掉（G3 修复）
2. 构造"断链设计"fixture，guard 能报出 I1 违规且**带文件级证据**
3. 构造"越界引用"fixture，guard 能报出 I2 违规
4. `phase-guards.md` 中不再存在"声称但代码不存在"的检查项（§2.3 全表清零）
5. 根规范新增 Requirement 通过 `mumuspec check`，且 `SHALL NOT` 条目**不引入 R2 词法假阳性**（引入前后 ERROR 数不增）

---

> **导航**：本计划与 `review/archive-lifecycle-defects-2026-09-12.md`、`review/self-improvement-loop-analysis-2026-09-12.md` 共享同一元结论——**引擎执行了动作却没留下可判定的事实**。三份文档的修复应共用同一套 fail-closed 纪律。
