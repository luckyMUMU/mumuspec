# Goal/Todo 任务会话引入必要性评估

> 评审对象：`.mumuspec/knowledge/todo-goal-integration.md` v1.1.0（2026-08-27，917 行）
> 评审日期：2026-08-28 · 评审人：产品经理 · 结论性质：**否决性评审**

---

## 结论先行

**不建议做。** 具体立场分三档：

1. **Goal（会话级目标）—— 不做，建议整章删除。** 提案 §1.3 与 §4.2 明确要求 Goal"不持久化、不影响 guard"，而它唯一的核心卖点是"跨会话恢复"（§3.1、§6.2 指标"跨会话恢复时间减少 50%"）。**一个不落盘的层无法支撑跨会话恢复**——这是提案自身的内部矛盾。且 `create_goal` / `turn_budget` / `depends_on` 是宿主能力而非 MumuSpec 能力，在本机宿主（WorkBuddy）上只有 Task 工具、无 `create_goal` 与 `turn_budget`，提案 §3.3/§3.6/冲突 5 在当前环境**根本无法执行**。
2. **Todo（步骤任务列表）—— 不单独立项，降级为 ≤10 行的宿主原生提示。** 五个阶段的 Todo 模板共 31 项，逐项比对后**无一项落在现有机制的空白区**（见 §二）。若确需 UI 上的进度条，在 `mumuspec/SKILL.md` 加一句"进入阶段时可用宿主任务列表呈现本阶段 Step 序列"即可，零新增规范。
3. **真实缺口只有一个，且解法不是 Todo/Goal。** 缺的是"跨阶段未决 BP 的聚合视图"（`mumuspec status` 只给阶段级下一步，不给 BP 级）。这是 CLI 可解决的问题，建议做 `mumuspec bp list --pending`。

一句话：**提案想标准化的是宿主的 HOW 层，而 MumuSpec 的立身之本是"能机器校验的 WHAT"。一个不持久化、不入 guard、不可 CI、不可漂移检测的层，即便写进规范也执行不了，只能靠模型自觉——这与 MumuSpec 的核心机制正交且相斥。**

---

## 一、痛点真实性评估

| 维度 | 判定 | 证据 | 说明 |
|------|------|------|------|
| ① 执行进度追踪<br>（AI 做到哪一步了） | **部分真实 → 已被覆盖** | `src/change/decisions.ts:37-84` `getChangeStatusSummary()` 已输出 build_layers 的 ✓/◐/○、test_cases locked、Q1~Q4 计数、rollback/rebuild 计数与"下一步"提示；`src/cli/commands/dashboard.ts:62` 面板化渲染；`phase-build/SKILL.md:49` 用 `grep -n '\- \[ \]' tasks.md \| head -1` 定位未完成任务 | 进度已是**持久化且机器可数**的，比会话级 Todo 更强 |
| ② 跨会话恢复<br>（会话断了不知道做到哪） | **伪需求** | 5 个 phase skill **全部**具备「上下文压缩恢复」章节 + `mumuspec state check <phase> --recover`（phase-open:315、design:457、build:274、verify:266、archive:190）；`mumuspec/SKILL.md:90` 明令"每次上下文恢复时重新执行 Step 0-3，**不依赖会话历史**"；`src/cli/commands/state.ts:445-456` 有状态完整性自检 + `--recover` 自动修复 | 恢复能力由 state + 工件承担。提案称"读取 Todo/Goal 即可继续"，但 Todo/Goal 明令不持久化（§1.3.1、§4.2、反模式 4）——**会话断了它也没了** |
| ③ 决策待办追踪<br>（哪些项在等用户确认） | **部分真实 → 解法错位** | BP 是**代码级注册表**：`src/change/phase-graph-loader.ts:282-302` 每条边携带 `{id:'BP-3', description:'工件审查与确认', required:true}`；`src/core/bp-advisor.ts:50-80` 为 BP 生成带 risk/effort 的 2-3 个选项；`skills/mumuspec/SKILL.md:157-169` 已列 9 个必停决策点；L171-179 Red Flags 已含"不反对 ≠ 同意，必须获取显式选择" | 唯一真实空白：**没有"当前有哪些未决 BP"的聚合视图**。这是 CLI 缺口，不是 Todo/Goal 缺口 |

**补充判据（痛点真实性反证）**：提案 §6.2 自设的成功指标——"阶段内步骤遗漏率 <5%""跨会话恢复时间减少 50%""用户确认等待时间减少 30%"——**全部无数据源可测**。因为 Todo/Goal 不落 `.mumuspec/`、不入 guard、不进 audit-log，而 `docs/STATUS.md:3` 明定"本文件是进度的唯一权威来源"，Todo/Goal 与该数据链完全不通。**提案连自己的验收标准都无法验收。**

---

## 二、现有机制覆盖度对照表

| 提案要求的能力 | 现有机制 | 证据 | 判定 |
|---------------|---------|------|------|
| Todo ↔ **tasks.md** 同步 | `tasks.md` `- [ ]/- [x]` 已是持久化单一真源；`state.ts:484` 正则计数、`state.ts:503` 用于规模评估；guard 校验"all tasks.md items checked" | `phase-build/SKILL.md:217,245` | ❌ **重复且有害**：引入双写，再由冲突 8 自造"不一致时以 tasks.md 为准 + 同步失败阻塞" |
| Todo ↔ **cognitive-map.yaml** | 已有 `mumuspec state set <name> cognitive_framework.q1_count <N>` 及 grep 计数脚本模板，guard 已校验 | `skills/mumuspec/SKILL.md:126-145`；`phase-design/SKILL.md:432-436` | ❌ **完全重复** |
| Todo ↔ **test-cases** | `test_cases.design_locked` + `design_content_hash` 已是 guard 必检项 | `phase-design/SKILL.md:425-426`；`phase-build/SKILL.md:254-255` | ❌ **完全重复** |
| Todo ↔ **BOUNDARY.md** | BOUNDARY.md 是**按源码目录**维护的契约文档（E-CONTRACT-001/002），非变更级进度工件 | `CLAUDE.md:81,90`；`docs/reference/error-codes.md:582-583` | ❌ **分类错误**：把目录契约文档当成变更进度同步目标 |
| Todo ↔ **decisions.md** | `decisions_log.counts.<phase> > 0` 且 `content_hash` 匹配，是**每阶段 guard 必检项** | `phase-design/SKILL.md:440-441`；`phase-build/SKILL.md:232,259` | ❌ **完全重复**（提案冲突 11 相同） |
| BP 显式确认拦截 | BP 已编码为状态机边（含 required 标志）+ bp-advisor 生成选项 + 9 个必停决策点 + Red Flags | 见 §一③ | ❌ **完全重复**（提案冲突 10、12 相同） |
| 阶段回退 / rollback 上限 | 状态机已有 backward/rollback/rebuild 三类边；`.mumuspec.yaml` 已有 `rollback_count/limit`、`rebuild_count/limit` | `phase-graph-loader.ts:293-296`；`skills/mumuspec/SKILL.md:304-305` | ❌ **完全重复**（提案冲突 3、13 相同） |
| 预设路径升级 | 已有 BP-18 升级条件触发确认 | `workflow-presets/SKILL.md:28` | ❌ **完全重复**（提案冲突 4 相同） |
| Change discard 清理 | 已有 5 条 `→discarded` 终止边 | `phase-graph-loader.ts:298-302` | ❌ **完全重复**（提案冲突 7 相同） |
| Open/Verify/Archive 的 step checklist | **无**（只有 build 有 tasks.md） | — | ✅ **唯一真实空白**（价值有限：三阶段通常单会话可完成，且已有"退出条件"清单充当 checklist） |

**14 条冲突规则归属统计**：冲突 1/2/5/6/9 共 5 条专为 Goal 而生（Goal 不做则自动消失）；冲突 3/4/7/10/11/12/13 共 7 条是既有机制的复述；冲突 8/14 共 2 条是提案自己制造的问题。**补空白：0 条。**

---

## 三、成本评估

| 成本项 | 量化 | 证据 / 判断 |
|--------|------|------------|
| **提案体量** | 917 行 ≈ 30k 字符 ≈ 20-22k token | 与单阶段 skill（300-500 行）相当 |
| **常驻 token 增量** | 落地后 orchestrator `mumuspec/SKILL.md` 从 373 行 → 约 600 行（+60%）；5 套 Todo 模板（31 项）另增 150-200 行到各 phase skill | 行数实测来源：Grep count `skills/mumuspec/**/SKILL.md`。orchestrator 是**每次 `/mumuspec` 必加载**的 |
| **是否违反北极星 token 指标** | ⚠️ **不直接违反，但判定仍需扣分** | `goal.md:18` 的"规范加载 token 消耗减少 ≥60%"在 `README.md:42-44` 明确限定为**规范链加载**（渐进式披露 `get_spec_context`），与 skill 指令 token 是两个口径，不能混为一谈。但它**直接违反 MumuSpec 自设的 token 自律设计**：每个 phase skill 顶部都有「快速决策（Decision Core）— Agent 只需读取本节即可决策」（5 个 phase skill 第 10 行一致），把 900 行规则灌进去等于废掉这个设计 |
| **AI 认知负荷** | 现状已高：design 阶段退出条件 23 项 + Red Flags 13 条；build 阶段 guard 17 项 + Red Flags 10 条；orchestrator 另有 9 个必停决策点。提案再加 31 个 Todo 状态 + 11 条 BP 映射 + 14 条冲突流程 + 5 条同步义务 | 冲突规则是**流程分支**（"询问用户 a/b/c"），不是 checklist，对 LLM 注意力消耗最大 |
| **可校验性（最致命）** | 0 | 不持久化 → 不可 guard、不可 CI、不可 drift、不可审计。MumuSpec 全部价值建立在机器校验上（`README.md:186` 渐进式披露、`goal.md:44` 自动校验），一个不可校验的层是**架构异物** |
| **对项目自诊劣势的加剧** | 负面 | `docs/appendix/competitive-analysis-chapter.md:217` 自诊首要劣势即"专有概念过多导致认知负荷与学习曲线陡峭，限制采用率"；`goal.md:22` 北极星含"新项目首次变更 <30min"、L21"init 成功率 ≥95%"。新增 Goal/Todo 两个专有概念 + 14 条规则**直接恶化首要劣势、反向拖累采纳类指标** |

---

## 四、最终优先级建议

| 提案项 | 提案自评 | **评审判定** | 理由 |
|--------|---------|------------|------|
| Todo 任务列表 | P0（立即） | **P2 → 且仅保留 ≤10 行提示** | 31 项模板无一项补空白；执行进度已被 `mumuspec status`/`dashboard`/`tasks.md` 覆盖。UI 层需求交给宿主原生能力，MumuSpec 不写规范 |
| Goal 目标管理 | P1（按需） | **P3 —— 不做，建议删除** | 卖点（跨会话恢复）与其"不持久化"定义自相矛盾；依赖的 `create_goal`/`turn_budget`/`depends_on` 非通用宿主能力（本机宿主即缺失）；14 条冲突中 5 条专为它而生 |
| 双向同步 5 类工件 | 未评级 | **全部删除** | 4 条完全重复既有 guard 项，1 条（tasks.md）制造双写 |
| 14 条冲突规则 | 未评级 | **保留 0 条**，其中冲突 10/11 的精神已由 Red Flags + guard 落实 | 见 §二统计 |
| 真实缺口的替代解法 | — | **P1（建议做）**：`mumuspec bp list --pending` | BP 已是代码级注册表（`phase-graph-loader.ts`），只需加一个聚合查询命令，即可提供"当前有哪些未决 BP"。成本 ≈ 1 个 CLI 子命令，收益覆盖提案 §一③ 的全部真实价值 |

**关于"写进 skill 还是依赖宿主原生"**：**依赖宿主原生，明确不写进 skill 指令。** 三条理由——(1) `skills/mumuspec/SKILL.md:14-18` 已定架构原则「MumuSpec 管 WHAT，外部 Skill 管 HOW，Guard 兜底」，会话级 Todo 属 HOW/交互层；(2) 宿主已有该能力（本机 TaskCreate/TaskUpdate/TaskList；提案自身也用宿主 `todo_write`），写不写进 skill 都不影响可用性，写进去只有 token 成本、零约束力；(3) MumuSpec 已支持多平台规则生成（CLAUDE.md / .cursorrules / AGENTS.md，`STATUS.md` AI Integration 90%），把某一宿主的私有能力硬编码进 skill 会**破坏可移植性**。

---

## 五、证据索引

| 文件 | 关键行 | 用于支撑 |
|------|-------|---------|
| `.mumuspec/knowledge/todo-goal-integration.md` | §1.3.1 / §4.2 / 反模式 4；§3.1；§6.2；冲突 1-14 | 被评审对象：不持久化定义、跨会话卖点、不可测指标 |
| `.mumuspec/goal.md` | L18, L21-22, L44 | 北极星指标口径、自诊核心问题 |
| `skills/mumuspec/SKILL.md` | L14-18, L90, L126-145, L157-179, L304-305 | 架构原则、恢复规则、BP/Red Flags、rollback 字段 |
| `skills/mumuspec/phase-design/SKILL.md` | L425-441, L457-468 | guard 已覆盖 test-cases/decisions；上下文恢复章节 |
| `skills/mumuspec/phase-build/SKILL.md` | L49, L217-259, L274-284 | tasks.md 单一真源、guard 检查项、恢复流程 |
| `skills/mumuspec/phase-open\|verify\|archive\|workflow-presets` | L315 / L266 / L190 / L28 | 各阶段恢复章节；BP-18 |
| `src/change/decisions.ts` | L37-84 | `getChangeStatusSummary()` 已输出进度 + 下一步 |
| `src/change/phase-graph-loader.ts` | L282-302 | BP 为代码级注册表，含 required 标志 |
| `src/core/bp-advisor.ts` | L50-80 | BP 自动生成选项（risk/effort/recommended） |
| `src/cli/commands/state.ts` | L445-456, L484, L503 | 状态自检 + tasks.md 机器计数 |
| `src/cli/commands/dashboard.ts` | L33, L62 | 进度面板已存在 |
| `docs/STATUS.md` | L3, L17, L45-51 | 单一权威来源约定；Contract Layer 0%、Worktree isolation 未完成的真实欠账 |
| `docs/appendix/competitive-analysis-chapter.md` | L217 | 项目自诊首要劣势：专有概念过多、认知负荷高 |
| `README.md` | L42-44, L186 | "规范加载 token"口径限定为规范链渐进式披露 |
| `CLAUDE.md` / `AGENTS.md` | L81, L90 | BOUNDARY.md 是目录级契约文档，非变更进度工件 |

---

## 附：若坚持推进，最小可行收敛方案

> 供决策者权衡，非推荐方案。

1. 删除 Goal 全章（§三、冲突 1/2/5/6/9、3.4-3.7）。
2. 删除 §2.5 同步表与 §2.6 BP 映射表（重复 guard）。
3. 保留 §2.2 五阶段 Todo 模板，**但由 917 行规范压缩为 `mumuspec/SKILL.md` 内 ≤10 行**："进入阶段时，可用宿主任务列表呈现本阶段 Step 序列（见各 phase skill 的执行步骤）；Todo 仅为展示，不作为门禁依据。"
4. 冲突 10/11（显式确认、决策入 decisions.md）的**精神**并入各 phase skill 既有 Red Flags 表，不新增独立章节。
5. 配套做 `mumuspec bp list --pending`，承接跨会话的真实价值。

净效果：新增规范 ≈ 10 行（对比 917 行），新增 CLI 1 个，真实痛点（未决 BP 聚合视图）得到解决，且不引入任何不可校验的架构异物。
