# Goal/Todo 任务会话引入 —— 综合评估与裁决

> 评审对象：`.mumuspec/knowledge/todo-goal-integration.md` v1.1.0（917 行，2026-08-27）
> 评审日期：2026-08-28　主理人：齐活林（汇总裁决）
> 成员产出：`review/goal-todo-feasibility-2026-08-28.md`（架构师 高见远）、`review/goal-todo-necessity-2026-08-28.md`（产品经理 许清楚）
> 性质：纯分析评审，未改动任何源码与 skill

---

## 结论先行

**裁决：不建议引入 Goal/Todo 层。提案应降级为「文档待修正清单」，而非「待实施方案」。**

三条判定：

1. **Goal 层 —— 不做。** 提案 §1.3/§4.2 规定 Goal「不持久化、不入 guard」，但 §3.1/§6.2/§7.1 又承诺「跨会话有效」「跨会话恢复时间减少 50%」。**不落盘的对象无法跨会话恢复，这是内在矛盾，非表述问题。** 14 条冲突规则中 5 条（冲突 1/2/5/6/9）专为 Goal 而生，随之自动消解。
2. **Todo 层 —— 不做规范，只留一句宿主无关的提示（≤10 行）。** 31 项 Todo 模板经逐项比对，**无一项落在现有机制的能力空白区**（详见 §三）。执行进度已由 `mumuspec status`/`dashboard`/`tasks.md` 持久化承载，会话级 Todo 是纯 UI 层需求，属宿主的 HOW 层。
3. **真实缺口只有一个，且正确解法不是 Todo/Goal** —— 缺「当前有哪些未决 BP」的聚合视图。建议做 `mumuspec bp list --pending`（但有一个前置依赖，见 §五风险 R-4）。

**一句话总结**：提案想标准化的，是宿主交互层的 HOW；而 MumuSpec 的立身之本是可机器校验的 WHAT。一个不持久化、不入 guard、不可 CI、不可漂移检测的层，即便写进规范也执行不了，只能靠模型自觉——**与 MumuSpec 的核心机制正交且相斥**。

---

## 一、当前流程评价（现状体检）

先回答用户的第一个问题「分析并评价当前流程」。结论：MumuSpec 的流程层**已经很厚，问题不在"缺一层"，而在"层间不对齐"**。

### 1.1 已经很扎实的部分

| 能力 | 现状 | 证据 |
|---|---|---|
| 执行进度可观测 | `getChangeStatusSummary()` 已输出 build_layers ✓/◐/○、test_cases locked、Q1~Q4 计数、rollback/rebuild 计数与「下一步」提示；`dashboard.ts` 面板化渲染 | `src/change/decisions.ts:37-84`、`src/cli/commands/dashboard.ts:62` |
| 任务清单单一真源 | `tasks.md` 的 `- [ ]/- [x]` 被机器计数（`/^- \[[ x]\]/gm`）并纳入 guard 校验「all items checked」 | `src/cli/commands/state.ts:484,503`、`phase-build/SKILL.md:217,245` |
| 跨会话恢复 | 5 个 phase skill **全部**具备「上下文压缩恢复」章节 + `mumuspec state check <phase> --recover`；`mumuspec/SKILL.md:90` 明令「每次上下文恢复时重新执行 Step 0-3，**不依赖会话历史**」 | phase-open:315 / design:457 / build:274 / verify:266 / archive:190 |
| 决策与阻塞点 | BP 编码在状态机边上（含 `required` 标志）+ `bp-advisor` 为 BP 生成带 risk/effort/recommended 的 2-3 个选项 + Red Flags 已含「不反对 ≠ 同意」 | `src/change/phase-graph-loader.ts:282-302`、`src/core/bp-advisor.ts:50-80`、`skills/mumuspec/SKILL.md:157-179` |
| 回退与终止 | 状态机已有 backward/rollback/rebuild 三类边 + 5 条 `→discarded` 终止边；`rollback_count/limit` 在状态机与 guard 双向强制，超限报 `E-CHANGE-002` | `phase-graph-loader.ts:293-302`、`src/change/state-machine.ts:210,250,302,370` |

### 1.2 真实病灶（本次评审最有价值的副产品）

**MumuSpec 的 BP 体系是三层不对称的，而且塌陷得很厉害：**

| 层 | 载体 | BP 覆盖 | 强制力 |
|---|---|---|---|
| 设计层 | `docs/design/constraint-strength.md:642-659` | 完整 18 个 | 规范 |
| 指令层 | `skills/mumuspec/workflow.yaml:150-351` + 各 phase SKILL.md | 完整 18 个 | skill 指令，**Agent 可绕过** |
| **代码层** | `src/change/workflow.default.yaml` edge | **仅 BP-3 / BP-4 / BP-17** | **硬强制**，`state.ts:133-139` 缺 `--confirm` 即 `exit 2` |
| 顾问层 | `src/core/bp-advisor.ts:330-339` | BP-1/2/3/4/9/10/14/17（8 个） | 只给建议，不阻塞 |

> 主理人复核确认：`grep BP- src/change/workflow.default.yaml` 只命中 4 处（BP-3、BP-4、BP-17、BP-3 预设路径）。**BP-5/6/7/8/11/12/13/15/16/18 共 10 个 BP 在代码层完全没有实现**，纯靠 skill 指令承载。

**这个发现的双向含义：**
- 正面：证明「用 skill 指令承载流程约束」是 MumuSpec 的既有正统架构，Todo/Goal 若归入 skill 层不算降级。
- 负面：**提案 7.2 把 P0-1 定为「外部征询违规率 0%，零容忍」，但它依赖的 11 个 BP 里有 5 个（BP-5/6/8/13/16）在代码层完全不存在** —— 当前架构下连违规都无法被发现，遑论零容忍。这才是真正该补的洞。

---

## 二、可行性判定

架构师对提案引用的实体做了 21 项逐条核实。**结论：提案从未与实现代码对齐过，落地率约 67%，且存在硬错误。**

### 2.1 核实结果汇总

| 分类 | 数量 | 典型条目 |
|---|---|---|
| ✅ 完全可落地 | **14** | `decisions append --phase --change --text`（签名完全匹配）、`rollback_count`/`rollback_limit`（已强制，默认 3）、`build_mode` 三个取值、BP-2/3/8/9/13/14/16/17 映射 |
| ⚠️ 需修正 | **6** | 见下表 |
| ❌ 完全不存在 | **1** | `build_mode` 枚举约束（`types-workflow.ts:75` 声明为 `string`，无任何运行时校验） |

> BP 映射准确率 **8/11（73%）** —— 比预期扎实，但错的那 3 条错得关键。

### 2.2 必须修正的硬错误（文档 ≠ 实现，用户底线）

| # | 提案原文 | 真实情况 | 证据（主理人已复核的标 ⭐） |
|---|---|---|---|
| 1 | `mumuspec drift detect --change <name>` | **命令根本不存在**。真实为 `mumuspec contract drift`，且无 `detect` 子命令 | ⭐ `grep drift src/cli/index.ts` 零命中；`src/cli/commands/contract.ts:122`「Verify contract drift (optionally scoped to a change)」 |
| 2 | `state set cognitive_framework.q1_count` 当常规手段 | **受保护字段**（PROTECTED），写入需 `bypass_audit` 并落审计 `state.set_unverified`，否则 `exit 1` 报 `E-STATE-001` | ⭐ `src/cli/commands/state.ts:35-42` 受保护前缀表含 `cognitive_framework`、`test_cases` |
| 3 | `state set test_cases.design_locked true` | 同上，受保护字段 | ⭐ 同上 |
| 4 | design-3 → BP-5 标为「Q3 推理」 | **Q2/Q3 错位**：BP-5 实为认知框架 **Q2** 回答 | `workflow.yaml:180` |
| 5 | design-7 → BP-6 标为「Hyperplan」 | **张冠李戴**：BP-6 是 Q3 确认，**Hyperplan 实为 BP-7** | `workflow.yaml:181-182` |
| 6 | design-2 → BP-4 标为「Q2 追问」 | 三处语义不一：`workflow.yaml` 作「设计方案确认」，`bp-advisor.ts:83` 作「Design missing」 | `workflow.yaml:179`、`bp-advisor.ts:83` |

**附带发现（提案未涉及，同属文档≠实现）**：`docs/reference/configuration.md:79` 写的 `build_mode` 简写值 **`subagent` 在代码中不存在**，实际为 `subagent-driven-development`。

### 2.3 架构矛盾判定（内在矛盾，成立）

| 位置 | 主张 |
|---|---|
| L38 / L443-444 / L874 / L881 | Todo/Goal **不持久化到磁盘**、不得写入 `.mumuspec/` |
| L270 / L822 / L871 | **跨会话**的大型变更 → 创建 Goal；Goal 生命周期「**跨会话有效**」 |
| L830 | 成功指标：**跨会话恢复时间减少 50%**，测量方式「**读取** Todo/Goal 即可继续」 |

**决定性证据是 L830 自己写的实现路径——「读取」。** 读取的前提是对象在会话销毁后仍然存在，而 L443-444 明确禁止落盘。不落盘 + 上下文已销毁 ⇒ 被读取对象不存在 ⇒ 指标不可达。

提案把持久性外包给宿主（L437 "CatPaw 管理"）同样失效：MumuSpec 无法保证宿主存在、无法保证其跨会话语义、无法校验其内容，加之自身被禁止写入 `.mumuspec/`，框架侧不持有任何可恢复状态。**跨会话能力 100% 依赖一个框架不可控、且未被任何契约约束的第三方。**

### 2.4 三条解决路径

| 路径 | 做法 | 代价 | 评价 |
|---|---|---|---|
| A. 放弃跨会话诉求 | 删 L270 触发项、L822、L830 指标、L871「跨会话有效」 | Goal 只剩「预算控制」一个不可替代价值 | 保守但自洽 |
| B. 轻量持久化 | Change 目录内落 session 文件，显式置于 guard 与归档之外 | 与 L443/L881 文字冲突须改 P0 约束 | 唯一能兑现 L830，但违背提案自身定位 |
| **C. 宿主原生 + 锚点重建（推荐）** | 跨会话恢复交给宿主；MumuSpec 只提供**确定性模板**，从已持久化的 `tasks.md`/`proposal.md`/state 重建清单。**锚点是持久化工件，不是 Todo 本身** | 恢复的是「流程模板」而非「上次进度」 | **零代码、不违反 Ponytail** |

**推荐 C 为主 + A 为辅**：放弃「进度级」跨会话，只承诺「模板级」跨会话。

---

## 三、必要性判定

### 3.1 痛点真实性（三维度分开评估，价值完全不同）

| 维度 | 判定 | 关键证据 |
|---|---|---|
| ① 执行进度追踪 | **部分真实 → 已被覆盖** | 见 §1.1：进度已持久化且机器可数，比会话级 Todo 更强 |
| ② 跨会话恢复 | **伪需求** | 5 个 phase skill 全有恢复章节 + `--recover` + 状态自检；且 `SKILL.md:90` 明令「不依赖会话历史」。提案称「读取 Todo/Goal 即可继续」，但 Todo/Goal 明令不持久化——**会话断了它也没了** |
| ③ 决策待办追踪 | **部分真实 → 解法错位** | BP 已是代码级结构 + advisor 生成选项 + Red Flags。**唯一真实空白：没有「当前有哪些未决 BP」的聚合视图** |

**反证**：提案 §6.2 自设的三项成功指标（步骤遗漏率 <5%、跨会话恢复 -50%、确认等待 -30%）**全部无数据源可测** —— Todo/Goal 不落 `.mumuspec/`、不入 guard、不进 audit-log，而 `docs/STATUS.md:3` 明定该文件是进度唯一权威来源。**提案连自己的验收标准都无法验收。**

### 3.2 覆盖度对照：补空白还是重复造轮子

| 提案要求 | 现有机制 | 判定 |
|---|---|---|
| Todo ↔ tasks.md 同步 | tasks.md 已是持久化单一真源 + guard 校验 | ❌ **重复且有害**（制造双写） |
| Todo ↔ cognitive-map / test-cases / decisions.md 同步 | 均为 guard 必检项 | ❌ **完全重复** |
| Todo ↔ BOUNDARY.md 同步 | BOUNDARY.md 是**按源码目录**维护的契约文档，非变更级进度工件 | ❌ **分类错误** |
| BP 显式确认拦截 | 状态机边 required + advisor + Red Flags | ❌ **完全重复** |
| 阶段回退 / rollback 上限 / 预设路径升级 / discard 清理 | 状态机全部已有 | ❌ **完全重复** |
| Open/Verify/Archive 的 step checklist | **无**（仅 build 有 tasks.md） | ✅ **唯一真实空白**（价值有限：三阶段通常单会话可完成，且已有「退出条件」清单） |

**14 条冲突规则归属统计**：5 条专为 Goal 而生（Goal 不做即消失）、7 条是既有机制的复述、2 条是提案自己制造的问题。**补空白：0 条。**

### 3.3 成本被低估

| 成本项 | 量化 |
|---|---|
| 提案体量 | 917 行 ≈ 30k 字符 ≈ 20-22k token，与单阶段 skill 相当 |
| 常驻 token 增量 | orchestrator `mumuspec/SKILL.md` 从 373 → 约 600 行（+60%），且该文件**每次 `/mumuspec` 必加载** |
| 认知负荷 | 现状已高（design 阶段退出条件 23 项 + Red Flags 13 条；build 阶段 guard 17 项 + Red Flags 10 条），再加 31 个 Todo 状态 + 11 条 BP 映射 + 14 条冲突流程。冲突规则是**流程分支**而非 checklist，对 LLM 注意力消耗最大 |
| 与自律设计的冲突 | 每个 phase skill 顶部都有「快速决策（Decision Core）— Agent 只需读取本节即可决策」，灌入 900 行规则等于废掉这个设计 |
| **可校验性** | **0**。不持久化 ⇒ 不可 guard、不可 CI、不可 drift、不可审计。这是架构异物 |
| 对项目自诊劣势的加剧 | `competitive-analysis-chapter.md:217` 自诊首要劣势即「专有概念过多、认知负荷高、限制采用率」；新增 Goal/Todo 两个专有概念 + 14 条规则**直接恶化首要劣势** |

> 口径澄清：提案不直接违反 `goal.md:18` 的「规范加载 token 减少 ≥60%」——该指标在 `README.md:42-44` 明确限定为**规范链渐进式披露**，与 skill 指令 token 是两个口径，不能混为一谈。但违反 MumuSpec 自设的 token 自律设计这一点成立。

---

## 四、成员分歧与主理人裁决

两位成员在**大方向上一致**（不做 CLI + 持久化、不新增状态层、Goal 矛盾须先解），但在一个执行层问题上分歧：

| 分歧点 | 架构师（高见远） | 产品经理（许清楚） | **裁决** |
|---|---|---|---|
| Todo 模板放哪 | 内嵌进 `phase-*.md`（沿用提案已写好的 5 份模板，1~2 人日） | 不写进 skill，仅在 `mumuspec/SKILL.md` 加 ≤10 行宿主无关提示 | **采产品经理方案** |
| 理由 | 10 个 BP 全靠 skill 指令承载 ⇒ skill 层是既有正统，Todo/Goal 同层是架构一致性 | skill 层有 token 成本与零约束力；且 MumuSpec 生成 CLAUDE.md/.cursorrules/AGENTS.md 多平台规则，硬编码某宿主私有能力会**破坏可移植性** | PM 的可移植性论据更硬；且架构师忽略了**各 phase skill 本身已有 Step 序列**，再嵌一份 Todo 模板即第三份重复，撞 Ponytail「禁止未被请求的样板代码」 |

**裁决依据（补充架构师未注意的一点）**：Todo 模板的内容在各 phase skill 的执行步骤里**已经存在**。真正缺 checklist 的只有 Open/Verify/Archive 三阶段，而这三阶段**已有「退出条件」清单**，可直接作为 checklist 呈现 —— **零新增内容、零新增 token**。

**同时纠正产品经理的一处过度概括**：PM 称「`phase-graph-loader.ts:282-302` 每条边携带 BP」。经主理人复核，该区间 15 条边中**仅 4 条携带 BP**（BP-3、BP-4、BP-17、BP-3 预设路径），其余 11 条无 BP。架构师「代码层只强制 3 个 BP」的判断成立。此纠正**加强**了 PM 的结论——BP 强制力比 PM 描述的还要弱。

---

## 五、最终决议

| 提案项 | 提案自评 | **裁决** | 理由 |
|---|---|---|---|
| Goal 目标管理（§三、3.4-3.7、冲突 1/2/5/6/9） | P1 | **不做，整章删除** | 卖点与定义自相矛盾；依赖的 `create_goal`/`turn_budget`/`depends_on` 是宿主能力而非 MumuSpec 能力（全仓零命中，属"文档描述框架不支持的能力"） |
| Todo 任务列表（§二、31 项模板） | P0 | **不做规范，仅留 ≤10 行宿主无关提示** | 31 项无一项补空白；执行进度已被 status/dashboard/tasks.md 覆盖 |
| Todo ↔ 5 类工件双向同步（§2.5） | — | **全部删除** | 4 条完全重复 guard 项，1 条（tasks.md）制造双写 |
| BP 映射表（§2.6） | — | **删除** | 重复既有机制；且其中 3 条映射有误 |
| 14 条冲突规则 | — | **保留 0 条** | 5 条为 Goal 而生、7 条复述既有机制、2 条自造问题。冲突 10/11 的精神已由 Red Flags + guard 落实 |
| 文档校正（§2.2 修正表） | — | **P0，立即做（0.5 人日）** | 提案中存在 1 个不存在的命令、2 个受保护字段误用、3 条 BP 映射错误 —— 与「代码与文档必须一致」的底线直接冲突 |
| `mumuspec bp list --pending` | — | **P1，建议做** | 承接提案唯一真实价值（未决 BP 聚合视图） |

### 落地路径

| 优先级 | 内容 | 工作量 |
|---|---|---|
| **P0** | **文档校正**：① `drift detect` → `contract drift`；② `state set` 受保护字段加显式警示（推荐改用受支持路径，或显式声明 `bypass_audit`）；③ BP-5 改 Q2、BP-6 改 Q3、Hyperplan 归 BP-7；④ 统一 BP-4 三处语义；⑤ 修 `configuration.md:79` 的 `subagent` 简写；⑥ 按路径 C+A 解决跨会话矛盾 | **0.5 人日** |
| **P1** | ① `mumuspec/SKILL.md` 增加 ≤10 行宿主无关提示：「进入阶段时，可用宿主任务列表呈现本阶段 Step 序列（见各 phase skill 执行步骤）；Todo 仅为展示，不作为门禁依据」；② 开发 `mumuspec bp list --pending` | **1~2 人日** |
| P2 | 将 Open/Verify/Archive 的「退出条件」清单在 UI 层呈现为 checklist（**复用已有内容，不新增**） | **0.5 人日** |
| **不做** | CLI 新增 `todo`/`goal` 子命令及持久化状态 | — |

**在 P0 文档校正完成前，不建议进入任何编码阶段** —— 否则会把 1 个不存在的命令、2 个受保护字段误用、3 条 BP 映射错误、1 个不可兑现的指标固化进可执行 skill。

### 遗留风险

| # | 风险 | 说明 |
|---|---|---|
| R-1 | `mumuspec bp list --pending` 的数据源受限 | 若只基于 `workflow.default.yaml` edge，只能列出 BP-3/4/17 共 3 个，价值大打折扣。要覆盖 18 个 BP，需先把 `skills/mumuspec/workflow.yaml` 的 BP 定义下沉为可查询数据层 —— **这是一个独立的小改造，须单独立项评估，不可混在本次决策里** |
| R-2 | 10 个 BP 无代码层实现 | 提案 P0-1「外部征询违规率 0%」在当前架构下**连违规都无法观测**。这是比 Todo/Goal 更该优先处理的洞 |
| R-3 | 提案文档定位需明确 | 建议将 `todo-goal-integration.md` 标注为「历史设计提案 · 评审未通过 · 保留作决策留痕」，避免后续误当作待实施规范 |
| R-4 | 宿主差异 | 不同宿主的 todo 能力不同（本机宿主有 TaskCreate/TaskUpdate/TaskList，无 `create_goal`/`turn_budget`）。任何宿主私有能力都不应写进 MumuSpec skill |

---

## 附：证据索引

| 文件 | 关键位置 | 支撑 |
|---|---|---|
| `src/change/workflow.default.yaml` | L28/34/45/58 | ⭐ 代码层仅 BP-3/4/17 硬强制 |
| `src/change/phase-graph-loader.ts` | L278-302 | ⭐ 15 条边中仅 4 条携带 BP（纠正 PM 过度概括） |
| `src/cli/index.ts` | 全文件 | ⭐ 无 `drift` 命令注册 |
| `src/cli/commands/contract.ts` | L122 | ⭐ `contract drift` 真实定义 |
| `src/cli/commands/state.ts` | L35-42, 322-340, 484, 503 | ⭐ 受保护字段前缀表、审计写入、tasks.md 计数 |
| `src/change/state-machine.ts` | L210/250/302/370 | rollback_count 强制点 |
| `src/core/types-workflow.ts` | L71/73/75 | rollback_count/limit、build_mode 为 string 无枚举 |
| `src/change/decisions.ts` | L37-84 | 进度汇总已存在 |
| `skills/mumuspec/workflow.yaml` | L150-351 | 指令层 18 个 BP 定义 |
| `docs/design/constraint-strength.md` | L642-659 | 设计层 18 个 BP |
| `docs/reference/configuration.md` | L79 | `subagent` 简写错误 |
| `.mumuspec/goal.md` | L18/21/22/44 | 北极星指标口径 |
| `docs/appendix/competitive-analysis-chapter.md` | L217 | 自诊首要劣势 |
