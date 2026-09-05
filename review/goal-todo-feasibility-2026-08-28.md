# Goal/Todo 集成方案可行性评估报告

> 评审对象：`.mumuspec/knowledge/todo-goal-integration.md` v1.1.0
> 评审日期：2026-08-28　评审人：见远（架构师）　性质：纯架构评审，未改动任何源码/skill

---

## 结论先行

**判定：部分可行 —— 「Todo 层」可行且建议零代码落地；「Goal 层」当前设计不可行，须先解决自相矛盾。**

核实的 19 项实体中：**完全可落地 12 项（63%）、需修正 6 项、仅 1 项完全不存在**。好消息是提案对 BP 体系的引用**基本正确**（11 个 BP 映射中 8 个语义一致），比预期扎实得多。

但两个结论不变：
1. **架构矛盾真实存在**（非误读）。4.2/7.2 规定 Todo/Goal 零持久化，3.1/6.1/6.2/7.1 却承诺 Goal"跨会话有效"并把"跨会话恢复时间减少 50%"列为成功指标。零持久化前提下该指标**不可兑现**。
2. **方案 ①（纯 skill 指令层）+ ③（宿主原生 todo）组合，代码改动量为 0**。

**本次核实最重要的发现**：MumuSpec 的 BP 体系是**三层不对称**的——设计层 18 个 BP、指令层 18 个 BP、**代码层只强制 3 个（BP-3/4/17）**。这意味着"用 skill 指令承载流程约束"就是 MumuSpec 的既有正统架构。**Todo/Goal 放 skill 层不是妥协，而是与现有 BP-5/6/8/13/16 完全同构的正确归属。**

---

## 一、提案实体核实表（核心）

> ✅ 可落地　⚠️ 需修正　❌ 不存在

### 1.1 命令与字段

| # | 提案声称 | 判定 | 代码事实与路径证据 |
|---|---|---|---|
| 1 | `state set <name> cognitive_framework.q1_count <N>` | ⚠️ **受保护字段** | 命令与点路径写入**存在**（`src/cli/commands/state.ts:282-356`，点路径解析 `:342-351`）。但 `cognitive_framework` 在**受保护前缀表**内（`state.ts:35-42`）。命中后要求 `guard.bypass_audit !== false` 并写审计 `state.set_unverified`（`:323-340`）；`bypass_audit=false` 时 `exit 1` 报 `E-STATE-001`。**提案将其当常规写入手段，语义错误** |
| 2 | `state set <name> test_cases.design_locked true` | ⚠️ **受保护字段** | 同上，`test_cases` 同为受保护前缀（`state.ts:38`）。字段本身存在（`src/core/types-workflow.ts:33-39,70`） |
| 3 | `decisions append --phase --change --text` | ✅ **完全匹配** | `src/cli/commands/decisions.ts:75-110`，三 option 签名一致（`:79-81`）。**提案中零瑕疵条目** |
| 4 | `mumuspec drift detect --change <name>` | ❌ **名称错误** | `src/cli/index.ts:398-429` 注册表**无 `drift` 命令**。真实为 `mumuspec contract drift`（`src/cli/commands/contract.ts:249-254`），带 `--change <name>`，**但无 `detect` 子命令** |
| 5 | `rollback_count`（回退前检查） | ✅ **存在且已强制** | 类型 `types-workflow.ts:71`；强制点 `src/change/state-machine.ts:210`、自增 `:250`、二次校验 `:302`、guard 侧 `:370`，超限报 `E-CHANGE-002`。**提案 3.7 描述正确** |
| 6 | `rollback_limit` | ✅ **存在** | 类型 `types-workflow.ts:73`；来源 `src/change/lifecycle.ts:87` ← `config.changes.default_rollback_limit`，默认 **3**（`src/core/config-io.ts:70`） |
| 7 | `build_mode: executing-plans` | ✅ 存在 | `config-io.ts:72` 即默认值 |
| 8 | `build_mode: subagent-driven-development` | ✅ 存在 | `skills/mumuspec/workflow.yaml:213`；`skills/mumuspec/phase-build/SKILL.md:125` |
| 9 | `build_mode: direct` | ✅ 存在 | `skills/mumuspec/workflow.yaml:296,329`；`skills/mumuspec/workflow-presets/SKILL.md:57,138` |
| 10 | `build_mode` 枚举约束 | ❌ **不存在** | `types-workflow.ts:75` 声明为 **`build_mode: string`**，非枚举，**无任何运行时取值校验**。三个合法值只存在于 skills/docs 文本中 |

### 1.2 BP 映射表（提案 2.6，共 11 项）

> 真实语义以 `skills/mumuspec/workflow.yaml:150-351` 与 `docs/design/constraint-strength.md:642-659` 为准。

| # | 提案 Todo | 提案 BP | 提案语义 | 真实语义 | 判定 |
|---|---|---|---|---|---|
| 11 | open-2 | BP-2 | Open 大型 PRD 需确认拆分 | PRD 拆分决策（`workflow.yaml:151`） | ✅ |
| 12 | open-5 | BP-3 | 提案/设计/任务审查确认 | 工件审查与确认（`:152`） | ✅ |
| 13 | design-2 | BP-4 | Brainstorming 确认设计方向（**Q2 追问**） | **设计方案确认**（`:179`） | ⚠️ 混入 Q2，且 `bp-advisor.ts:83` 又作 "Design missing"，三处语义不一 |
| 14 | design-3 | BP-5 | **Q3 推理** | 认知框架 **Q2** 回答（`:180`） | ❌ **Q2/Q3 错位** |
| 15 | design-7 | BP-6 | **Hyperplan 问题** | 认知框架 **Q3** 确认（`:181`）；Hyperplan 实为 **BP-7**（`:182`） | ❌ **张冠李戴，应为 BP-7** |
| 16 | design-8 | BP-8 | 测试锁定确认 | 测试用例锁定确认（`:183`） | ✅ |
| 17 | build-1 | BP-9 | plan-ready 暂停选择 | 计划就绪暂停选择（`:216`） | ✅ |
| 18 | build-7 | BP-13 | 范围扩展需重新设计/拆分 | 范围扩展拆分决策（`:220`） | ✅ |
| 19 | verify-1 | BP-14 | 验证失败修复/接受偏差 | 验证失败修复/接受偏差（`:249`） | ✅ |
| 20 | verify-5 | BP-16 | 分支处理方式选择 | 分支处理方式选择（`:251`） | ✅ |
| 21 | archive-3 | BP-17 | 归档最终确认 | 归档最终确认（`:275`） | ✅ |

**BP 映射准确率：8/11（73%）。** 初判时因仅检索 `src/` 目录，误判 BP-5/6/8/13/16 为"完全不存在"——**该结论已更正**：它们完整定义在 skills 与 docs 层，仅未下沉到 `src/`。

### 1.3 三分类汇总

| 分类 | 项数 | 条目 |
|---|---|---|
| ✅ **完全可落地** | 12 | #3 decisions append、#5/#6 rollback_count+limit、#7-9 build_mode 三值、#11-12 BP-2/BP-3、#16 BP-8、#17 BP-9、#18 BP-13、#19 BP-14、#20 BP-16、#21 BP-17 |
| ⚠️ **需修正** | 6 | #1/#2 受保护字段、#4 drift→contract drift、#13 BP-4 语义分歧、#14 BP-5 Q2/Q3 错位、#15 BP-6 应为 BP-7 |
| ❌ **完全不存在** | 1 | #10 build_mode 枚举约束 |

### 1.4 附带发现（提案未涉及，但同属"文档≠代码"）

| 位置 | 问题 |
|---|---|
| `docs/reference/configuration.md:79` | 注释 `executing-plans \| subagent \| direct`，其中简写值 **`subagent` 在代码中不存在**，实际为 `subagent-driven-development` |
| `src/core/bp-registry.ts` | 易被误认为 BP 注册地。**实际是运行时内存注册表**（`:50` `new Map()`，`:11` 明示 "in-memory, process-scoped, not persisted to disk"），**启动为空**，只能经 `registerBP()`（`:57`）动态注入。静态 BP 定义在 `workflow.default.yaml` 的 edge 上，仅 BP-3/BP-4/BP-17 |

---

## 二、BP 三层不对称（本次核实最关键的结构性发现）

| 层 | 载体 | BP 覆盖 | 强制力 |
|---|---|---|---|
| **设计层** | `docs/design/constraint-strength.md:642-659` | **完整 18 个** | 规范 |
| **指令层** | `skills/mumuspec/workflow.yaml:150-351` + `phase-*/SKILL.md` | **完整 18 个** | skill 指令，Agent 可绕过 |
| **代码层** | `src/change/workflow.default.yaml` edge | **仅 BP-3 / BP-4 / BP-17** | 硬强制，`state.ts:133-139` 缺 `--confirm` 即 `exit 2` |
| **顾问层** | `src/core/bp-advisor.ts:330-339` | BP-1/2/3/4/9/10/14/17（8 个） | 只给建议，不阻塞 |

**推论**：BP-5/6/7/8/11/12/13/15/16/18 共 10 个 BP **在代码层完全没有实现**，纯靠 skill 指令承载。这直接证明——**用 skill 指令层承载流程约束，就是 MumuSpec 的既有正统架构**。Todo/Goal 归入 skill 层与 BP-5/6/8/13/16 完全同构，不是降级妥协。方案 ②（CLI + 持久化）反而是给 Todo/Goal 一个比现有 10 个 BP 更高的待遇，违反 `ponytail.ts:58` 的 YAGNI。

---

## 三、架构矛盾分析

### 3.1 矛盾定位（内在矛盾，非误读）

| 位置 | 原文主张 |
|---|---|
| L38 / L874 / L881 / L443-444 | Todo/Goal **不持久化到磁盘**、不得写入 `.mumuspec/` |
| L437 | 临时存储归 **"CatPaw 管理"**（宿主，非 MumuSpec） |
| L270 | **跨会话的大型变更** → ✅ 创建 Goal |
| L871 | Goal 生命周期 **"跨会话有效"** |
| L822 | 第 3 周 **"引入 Goal（跨会话任务）"** |
| L830 | 成功指标：**跨会话恢复时间减少 50%**，测量方式为 **"读取 Todo/Goal 即可继续"** |

**判定：矛盾成立。** 关键证据是 L830 自己给出的实现路径——"**读取** Todo/Goal 即可继续"。读取的前提是对象在会话销毁后仍存在；而 L443-444 明确禁止落盘。不落盘且上下文已销毁，则被读取对象不存在，指标不可达。这不是表述含糊，是目标与约束直接对冲。

唯一调和路径是 L437 把持久性外包给宿主 CatPaw，但该路径同样失效：
1. CatPaw 是**外部宿主**，MumuSpec 无法保证其存在、无法保证其跨会话保存语义、无法校验其内容；
2. 提案**同时**禁止 MumuSpec 写入 `.mumuspec/`，故框架侧不持有任何可恢复状态；
3. 结论：跨会话能力 100% 依赖一个**框架不可控、且未被任何 MumuSpec 契约约束**的第三方。

### 3.2 三条解决路径（零持久化与跨会话不可兼得）

| 路径 | 做法 | 代价 | 评价 |
|---|---|---|---|
| **A. 放弃跨会话诉求** | 删 L270 触发项、L822、L830 指标、L871"跨会话有效" | Goal 只剩"预算控制"一个不可替代价值（L271） | 保守但自洽 |
| **B. 轻量持久化** | Change 目录内落 session 文件，**显式置于 guard 与归档之外**（加 guard 忽略清单/.gitignore），使"不影响 guard"仍成立 | 与 L443/L881 文字冲突须改文档。是**唯一能兑现 L830** 的路径 | 可行但需改 P0 约束 |
| **C. 宿主原生 todo + 锚点重建（推荐）** | 跨会话恢复交给宿主；MumuSpec 只提供**确定性模板**：从已持久化的 `tasks.md`/`proposal.md`/state 重建 Todo 清单。锚点是**持久化工件**，不是 Todo 本身 | 恢复的是"流程模板"而非"上次进度"；L830 须改写为"减少重建清单的思考时间" | **零代码、不违反 Ponytail、指标可兑现** |

**推荐 C 为主 + A 为辅**：放弃"进度级"跨会话，只承诺"模板级"跨会话。既不动代码、不违反 Ponytail，也不留下不可兑现的指标。

---

## 四、分层归属方案对比

| 维度 | ① 纯 skill 指令层（零代码） | ② CLI 新增命令 + 持久化 state | ③ 宿主原生 todo + MumuSpec 模板约定 |
|---|---|---|---|
| 代码改动量 | **0** | 大（新命令、新类型、guard 集成、测试） | 0 ~ 小 |
| 跨会话 | ❌（宿主决定） | ✅ | 视宿主 |
| 强制力 | ❌ 建议性 | ✅ 可进 guard | ❌ 建议性 |
| 是否影响 guard | 否（符合提案本意） | **违背**"不得影响 guard" | 否 |
| Ponytail 合规 | ✅ | ⚠️ 撞 `ponytail.ts:58` YAGNI / `:59` 禁新依赖 | ✅ |
| 与现有 BP 架构同构 | ✅ **完全同构**（见第二节） | ❌ 待遇高于现有 10 个 BP | ✅ |
| **推荐度** | **推荐（主）** | **不推荐** | **推荐（与①组合）** |

**推荐 ①+③**，四条理由：
1. MumuSpec 领域对象是 **Change / Phase / Contract / guard**；Todo/Goal 是 **Agent 行为约定**，不应进入状态机；
2. 第二节已证明 10 个 BP 全靠 skill 指令承载，Todo/Goal 同层是**架构一致性**要求；
3. `src/spec/ponytail.ts:58-61`：禁止未被请求的抽象层 / 禁止新依赖 / 禁止未被请求的样板代码——方案 ② 三条全中；
4. 提案 4.2(L445) 与 7.2-P0-4 自定 "Todo/Goal **不得影响** guard 校验"。**不参与门禁，就没理由进入状态层**。

---

## 五、冲突与风险清单

| # | 风险 | 代码事实依据 | 等级 |
|---|---|---|---|
| 1 | **Todo↔tasks.md 双向同步的循环与竞态**（冲突 8, L580-603）。要求 a) Todo 完成→写 tasks.md；b) tasks.md 变更→回写 Todo；c) 失败则置 in_progress 并阻塞。无主仲裁的双向同步，两侧互为因果，任一抖动即振荡；且 tasks.md 是自由文本 markdown **无稳定 ID**，Todo→tasks.md 只能按内容/行序匹配，行序一变即错位 | `tasks.md` 在代码中**仅被只读统计**：`src/cli/commands/state.ts:481-485` 用 `/^- \[[ x]\]/gm` 计数。**MumuSpec 全库无写回 tasks.md 的能力** | **高** |
| 2 | **BP 强制力不可观测**（冲突 12, L605-618；7.2 P0-1/P0-5）。提案依赖的 11 个 BP 中，仅 BP-3/BP-4/BP-17 在代码层硬强制（`workflow.default.yaml:28,34,45`）；BP-2/9/14 仅有 advisor（只建议不阻塞）；**BP-5/6/8/13/16 在代码层完全不存在**。故强制力 100% 来自 skill 指令、宿主可绕过，且**无任何审计点可验证**。提案称 P0-1"零容忍、违规率 0%"，但当前架构下**连违规都无法被发现** | `workflow.default.yaml` edge 全集仅 BP-3/4/17；`state.ts:133-139` 是唯一硬拦截点 | **高** |
| 3 | **guard 一致性要求自相打架**（4.2 L445 "不得影响 guard" vs 2.6 L245 "与 guard 双重确认"）。若真做双重确认，须在 `phase-guard.ts` 新增 Todo 状态读取；而 guard 当前对同类过程检查**一律降级 warning**（`phase-guard.ts:307-335` 全部 push 进 `warnings`，判定 `passed: errors.length === 0`）。**MumuSpec 自己的过程 BP 都不阻塞**，Todo 更不可能 | `phase-guard.ts:307-335`、`:363` | **中** |
| 4 | **受保护字段直写污染审计流**（核实项 #1/#2）。提案把 `state set` 写 `cognitive_framework.*` / `test_cases.*` 当常规手段，二者属 PROTECTED（`state.ts:35-42`），**每次写入产生一条 `state.set_unverified` 审计**（`:331-339`）。skill 高频调用会让审计日志被"正常流程"淹没，掏空 CHG-2 设该保护的意图 | `state.ts:35-42, 322-340` | **中** |
| 5 | **Goal 预算/依赖机制在框架内无任何对应物**。`turn_budget`、`depends_on`、`blocked` 在**全仓（含 skills/docs）零命中**。属纯宿主侧概念，写进 MumuSpec skill 会形成"文档描述框架不支持的能力" | 全仓检索 `turn_budget` 仅命中本报告 | 低 |

---

## 六、工作量与落地路径

| 优先级 | 阶段 | 内容 | 工作量 |
|---|---|---|---|
| **P0（必做前置）** | 文档校正 | ① BP-5 改为 Q2、BP-6 改为 Q3 并把 Hyperplan 归 BP-7；② 统一 BP-4 三处语义；③ `drift detect` → `contract drift`；④ `state set` 受保护字段加显式警示；⑤ 标注 `build_mode` 三值真实来源为 skills/config 而非类型层；⑥ 修 `configuration.md:79` 的 `subagent` 简写；⑦ 解决第三节矛盾（选路径 C+A） | **0.5 人日** |
| **P1（推荐）** | 阶段一：纯 skill | 在 `skills/mumuspec/phase-*.md` 内嵌各阶段 Todo 模板（沿用提案 2.2 已写好的 5 份，质量可用）；明确"不持久化、不参与 guard、跨会话靠宿主 + 工件重建" | **1~2 人日** |
| P2（可选） | 阶段二：轻量增强 | guard 增加 Todo 摘要**只读展示**（不参与判定）；或把 `decisions append` 封装进 skill 以落实 7.2-P0-2 | **1~2 人日** |
| **不做** | — | CLI 新增 `todo`/`goal` 子命令及持久化状态 | — |

**总体建议**：先 0.5 人日做 P0 文档校正，再 1~2 人日做纯 skill 落地。在第三节矛盾解决前**不建议进入任何编码阶段**——否则会把 1 个不存在的实体、6 项需修正的引用、1 个不可兑现的指标固化进可执行 skill，与"代码与文档必须一致"的底线直接冲突。

---

## 附：取证范围

所有判定均由直接读取源码/文档得出，未做推测；BP 相关结论经 `src/`、`skills/`、`docs/` **三层交叉核实**。
`src/cli/commands/{state,decisions,contract}.ts`、`src/cli/index.ts`、`src/core/{bp-advisor,bp-registry,types-workflow,config-io}.ts`、`src/change/{workflow.default.yaml,state-machine,lifecycle}.ts`、`src/guard/phase-guard.ts`、`src/spec/ponytail.ts`、`skills/mumuspec/workflow.yaml`、`skills/mumuspec/phase-{design,build,verify}/SKILL.md`、`skills/mumuspec/workflow-presets/SKILL.md`、`docs/design/constraint-strength.md`、`docs/reference/configuration.md`
