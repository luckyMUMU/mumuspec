# 已配置 Skill 组合的系统性评价

> 日期：2026-09-12 · 范围：本仓库自有 skill + 用户级已安装 skill + 其声明的外部依赖
> 方法：先做回路接线表（生产者/消费者/状态），再逐条回文件与代码验证，最后对生态做定位对标
> 纪律：凡"已合规/已同步/已闭环"类正面断言，均给出与缺陷断言同等强度的证据；无证据者改写为"未验证"

---

## 结论摘要

**组合不是一件事，是四层叠放**：A 项目源（9 件，写得很细）→ B 已安装态（8 件，模型实际能加载的）→ C 平台插件池（约 32 件，与本项目基本无关）→ D 被声明的外部依赖（28 个名字，**可达率 0/28**）。

核心结论三句：

1. **写得好、装得旧。** 项目源 `skills/` 在 09-12 的视界正交性改造后已换代（并行组、`W-` 错误码口径、幽灵字段删除），而用户级已安装的 7 件仍是 09-07 的上一代。**7/7 内容不一致，但 frontmatter 版本号被安装器统一戳成 `0.19.2-alpha.10`**——版本号一致恰好掩盖了内容隔代，用户看版本号会以为已同步。
2. **声明的 required 依赖全部落空。** 28 个被 phase skill 标为 `required: true` 的外部 skill，11 个只存在于市场目录（未安装，模型加载不到），17 个在任何可见来源中都不存在。于是"跳过此步骤被禁止"这类强断言**恒为空转**，实际执行 100% 走 fallback。
3. **可维护性是最弱维度（1/5）。** 没有任何命令能发现 `skills/` ↔ 已安装副本的漂移；而项目源自身还有 3 处自相矛盾（幽灵字段仍被 Red Flags / workflow.yaml 当作守卫项）。

按严重度排序的问题总量：**P0 三项（漂移不可见、幽灵字段三态、编排器四写）**、P1 三项、P2 两项。

---

## 1. 评价范围与分级口径

"当前已配置"不是一个目录，而是四个互不相同的集合。先把边界定清楚，否则各维度会得出互相矛盾的结论。

| 面 | 位置 | 数量 | 谁能消费 |
|---|---|---|---|
| **A 项目源** | `D:\Code\AI-coding\mumuspec\skills\` | 9 | 仅 `mumuspec install`（无运行时消费者） |
| **B 已安装** | `%USERPROFILE%\.workbuddy\skills\` | 8 | **模型唯一可加载集合** |
| **C 平台池** | 内置插件 / 市场缓存 | ≈32 | 宿主按需注入 |
| **D 声明依赖** | 各 phase skill 的"领域 Skill 提示"表 | 28 个名字 | 无实体 |

A 面 9 件：`mumuspec/SKILL.md`（编排器·中文丰富版）、`mumuspec-workflow/SKILL.md`（编排器·英文精简版）、`phase-{open,design,build,verify,archive}`、`workflow-presets`、`sync`、`mumuspec/workflow.yaml`（分发表）、`mumuspec/en/orchestrator-en.md`（英文残留）。

B 面 8 件：`mumuspec-workflow` + 5 个 `phase-*` + `workflow-presets` + `mechanism-circuit-audit`（唯一 agent 自建）。与安装器 `WORKBUDDY_PACKAGES`（`src/install/installer-registry.ts:135-143`）**恰好对应，说明 B 面完全由安装器生成，无人工增删**。

### 六维度判据（评价标准）

| 维度 | 判据（可核对） | 5 分锚点 | 1 分锚点 |
|---|---|---|---|
| **功能性覆盖** | ①5 阶段载体齐否 ②编排/分发/恢复是否有载体 ③required 依赖可达率 ④缺口是否落在关键路径 | 全链路闭环且有验证 | 存在但无消费者 |
| **协同与冲突** | ①上下层交接是否唯一权威 ②同一事实出处数（≥2 即冲突）③状态机目标 vs 文本 ④编号唯一性 | 单一权威源、零冲突 | 同一事实多出口且互相矛盾 |
| **冗余度** | ①同一语义维护处数 ②副本同步机制 ③无消费者产出物 ④不可达文件 | 一处维护、零副本 | 多副本且无同步机制 |
| **执行效率** | ①常驻上下文成本 ②渐进披露结构 ③失误自愈路径可达性 ④人工阻塞点的必要性 | 按需加载 + 自愈可达 | 手册不可达 / 恒空转 |
| **场景适配性** | ①full/hotfix/tweak 三档可执行性 ②降级路径物理可用 ③与项目技术栈匹配 | 三档都被实跑验证 | 只有"理想路径"存在 |
| **可维护性** | ①单一权威源 ②漂移可检测性 ③版本一致性 ④文本自洽性 | 漂移由命令/测试捕获 | 漂移只能靠人肉比对 |

---

## 2. 事实基线（F1–F8，全部可复现）

| # | 事实 | 证据 |
|---|---|---|
| F1 | A 面 9 件中，**只有 7 件进入 B 面**；`mumuspec`（编排器丰富版）与 `sync` 未安装 | `installer-registry.ts:135-143` 的 `WORKBUDDY_PACKAGES` 不含二者 |
| F2 | **7/7 已安装件与 A 面源哈希全部不同** | 逐件 sha256 比对（phase-open 13330B→13290B；phase-build 13968B→12221B；phase-design 19560B→19835B；workflow-presets 8224B→9314B；mumuspec-workflow 4012B→3905B） |
| F3 | 版本戳掩盖隔代：源文件 `version: 0.19.2-alpha.0`，安装副本 `0.19.2-alpha.10` | `skills/mumuspec-workflow/SKILL.md` vs 安装副本；`installer-ops.ts:346` `stampSkillVersion()` 以运行时包版本覆盖 frontmatter |
| F4 | 安装器 install 模式**遇已存在即失败**，无默认更新路径 | `installer-ops.ts:338-340`（`Already installed ... Use --force to update`） |
| F5 | 28 个被 `required: true` 声明的外部 skill：**11 个仅存在于市场目录**（`plugins/marketplaces/codebuddy-plugins-official/external_plugins/superpowers/skills/`），**17 个不存在** | 穷举扫描 50,508 个文件（工作区 + `~/.workbuddy`，深度 7，排除 `node_modules`） |
| F6 | 17 个不存在者含**最关键的两个共识门**：`grill-me`、`hyperplan`，以及 `gitnexus-*`、`spec-driven-development`、`documentation-and-adrs` | 同上扫描结果差集 |
| F7 | 项目源仍存在幽灵字段三态：`phase-design/SKILL.md:478`、`phase-open/SKILL.md:340` 的 Red Flags 仍称它们是守卫必检项；`workflow.yaml:424-427` 仍列为 `open_to_design` 检查项；而 `phase-open/SKILL.md:279` 与 `phase-design/SKILL.md:431-432` 已声明删除 | 逐处 grep |
| F8 | `workflow.yaml` 版本 `0.12.2`，与包版本 `0.19.2-alpha.10` 差 7 个次版本；其 18 个 BP 定义被 4 份 review 文档引为权威 | `skills/mumuspec/workflow.yaml` frontmatter + `review/goal-todo-*.md` 引用 |

**与既往结论的区分**：`review/release-0.19.2-alpha.10-2026-09-07.md:24-25` 已闭环"7 包 `--force` 更新 + 版本单一源"。F2/F3 是**本轮新暴露**：版本单一源解决了"版本号该不该手改"，但**没有解决"内容是否与源一致"**，反而因为两侧版本号相同，把内容漂移变成了不可见的。

---

## 3. 逐维度评价

### 3.1 功能性覆盖 — 3/5

**优势**：五阶段载体完整（B 面 5/5），且每个阶段都有 Decision Core（前置条件/阻塞点/退出条件）与"上下文压缩恢复"章节——**恢复语义进 skill 是本组合少见的优点**，多数 harness 的 skill 只管 happy path。

**不足**：
- **编排决策核未安装（F1）**。B 面只有一个 77 行的英文摘要版；A 面那份 366 行的中文编排器里，`Step 0 预设检测（最高优先级）`、`Step 3 阶段判定（8 条按序规则）`、`guard 错误速查表`（`E-GUARD-009`/`W-BUILD-001` 等 6 条码→修复命令）、`.mumuspec.yaml` 字段参考——**全部不在模型可加载范围内**。等于把"调度中心的说明书"留在了仓库里。
- **required 依赖可达率 0/28（F5）**。这不是"降级策略没写好"（fallback 写得很细），而是**强断言在物理上不可执行**：`phase-build:140`"使用 Skill 工具加载 `test-driven-development` skill。跳过此步骤被禁止"、`phase-verify:192`"跳过此步骤被禁止"—— 对 17 个无来源的 skill，这些句子的唯一效果是让模型面对一个无法满足的强制项。
- 缺口位置不佳：缺的恰是**共识门**（`grill-me` 承担 BP-4.5、`hyperplan` 承担 BP-7）。这两处 fallback（Fallback E/F）虽已内联，但它们是"单 Agent 自我审查"，与"5 成员对抗团队"在审查带宽上不同质——**对抗审查的独立性是本项目红线"设计决策权在人"的一部分**，降级后这条红线的执行强度实际下降。

### 3.2 技能间协同与冲突 — 2/5

**优势**：分层关系清晰且无循环依赖（编排 → 阶段 → 预设 → 回退），BP 编号全局唯一连续（BP-1..18），错误码在有来源的范围内口径一致（`W-DESIGN-*` 口径修正已进 A 面）。

**冲突（同一事实多出口）**：
- **编排器四写（F1/F8）**：`skills/mumuspec/SKILL.md`（中文，未安装）、`skills/mumuspec-workflow/SKILL.md`（英文，已安装）、`en/orchestrator-en.md`（41 行，v0.12.2）、`workflow.yaml`（18 BP）。四者描述同一个"入口"，两两版本不同。
- **幽灵字段三态（F7）**：引擎不读 → 项目源正文说"已删除" → 同文件 Red Flags 仍称"是守卫必检项" → `workflow.yaml` 仍列为检查项。**这正是项目自己的红线所禁止的"文档有、代码无"第三态**（`AGENTS.md` 约束 + `mechanism-circuit-audit` 处置纪律："逐条裁决实现它或删掉它"）。
- **目标阶段错误（仅存在于 B 面）**：安装副本 `phase-open` 写 `guard <name> open --apply`、`workflow-presets` 写 `guard <name> open --apply`；A 面已修正为**目标阶段**（`design` / `build`），并在 `mumuspec-workflow` 中补了 `(<phase> is the TARGET phase)` 括注。**模型实际读的是错的那份**——按记忆中的阶段门禁纪律，这会让"每个阶段的出口门禁从未被执行"复发。

### 3.3 冗余度 — 2/5

**优势**：阶段 skill 之间的步骤表**没有实质性重复**（各阶段引用而非复写）；`workflow-presets` 明确"复用 `phase-verify` / `phase-archive`"而非复制。

**不足**：
- 同一语义的**双份维护**：7 件全部存在 A/B 两份，且**同步机制不存在**（无漂移检测，见 3.6）。
- 4 处冗余文件：编排器 4 写中至少 2 处（`en/orchestrator-en.md`、`workflow.yaml`）**无消费者**——`workflow.yaml` 只被 review 文档引用（`review/goal-todo-*.md`），`orchestrator-en.md` 无任何引用。
- `sync` skill（A 面）不在安装清单（F1），是**不可达文件**：`mumuspec sync` 由 CLI 实现，skill 文本没有运行时消费者。
- 内容取向的**双向漂移**（不是单向"用户副本旧"）：A 面 `workflow-presets` **丢掉了** B 面仍保留的 tweak 静默失败陷阱段（含 `finalize-archive --keep-old` 补救）。该段是记忆中标记为"血泪"的权威知识，属真正的内容丢失，需回填。

### 3.4 执行效率 — 3/5

**优势**：渐进披露结构好——每份 skill 首屏是 Decision Core，长尾表格在后；`phase-design` 的"常见 guard 错误与修复"表把错误码直接映射到修复动作。

**不足**：
- **自愈手册不可达**：`guard 错误速查表`（6 条码 + 修复命令）只在未安装的编排器里。模型遇到 `E-GUARD-009` / `W-BUILD-001` 时，B 面没有任何一处告诉它怎么修——**效率损失直接落在最需要效率的失败路径上**。
- **"必须加载"的恒空转开销**：每次进入 build/verify，模型都要先判定一个不可能满足的 required 条件，再改走 fallback，属于纯损耗。
- 18 个人工阻塞点：**不判为缺陷**（这是"设计决策权在人"不变量的代价，且都配了 2-4 个选项），但 BP-9（plan-ready 暂停）与 BP-10（隔离 + 执行方式）在同一次调用内相邻触发，可合并为一次询问以减少一次往返——属可省而当前未省的摩擦。

### 3.5 适用场景适配性 — 3/5

**优势**：三档路径齐备且**边界可判定**——hotfix 三条适用条件、tweak 四条、以及两张"升级条件"表（文件数/架构/接口/schema 逐条），比多数 harness 的"小改动可以直接改"要严谨。`workflow-presets` 还明确了"tweak 跳过知识提取"这类非直觉差异。

**不足**：
- **降级路径是唯一实际路径**：每个阶段的 required skill 在实机上都不满足，"降级说明"从例外变成了默认。runbook 描述的是理想生态，与 0/28 的可达率脱节。
- **适配错位在共识门**：`grill-me` / `hyperplan` 无任何来源，而这三个门恰是"设计决策权在人"的执行载体——**适配性风险的落点不是便利性，而是不变量本身**。
- C 面约 32 件插件 skill 中，与本项目（spec 引擎 + CLI + TS 工程）相关的仅 `agent-browser`/`playwright-cli`/`pdf`/`pdfkit-py` 等少数；其余（`tencent-*`、`weixinpay-*`、`wx` 金融类、`expert-manager`）与本项目无关。**这不判为不足**（平台池是共享资源，无关不等于污染），但需在"选择哪件 skill 处理任务"时避免误触发。

### 3.6 可维护性 — 1/5（最弱）

**判据全部未通过**：
- **单一权威源**：❌ 同一 skill 存在 A/B 两处，且 A 面内部编排器再分四处。
- **漂移可检测性**：❌ 自检三件套（`check`/`validate`/`ci:check`）均不覆盖 `skills/` 与安装目标的比对；`ci:check` 只比 config 的 `schema_version`。**漂移只能靠人肉比对哈希发现**——本轮就是这么发现的。
- **版本一致性**：❌ 三源不一：包 `0.19.2-alpha.10` / A 面源内嵌 `0.19.2-alpha.0` / `workflow.yaml` `0.12.2`。且 F3 使**版本号成为误导项**而非提示项。
- **文本自洽性**：❌ 同一文件内 3 处自相矛盾（F7）；A 面 `phase-open` 删掉幽灵字段时，未同步清理同文件的 Red Flags 表。

**根因（这就是为什么修一处不够）**：install 是**单向快照**（F4：遇已存在即拒绝，除非 `--force`），而 `skills/` 是**高频编辑的源**。二者之间没有任何"到期校验"——**一次安装形成一个不会过期的副本**。这与本项目已经被反复识别的形态同构（见 §5 根因归并）。

---

## 4. 根因归并（三类同源病）

不按清单长度排序，按同源归并：

**病一｜单向快照 + 无到期校验（断线）**
安装器把 `skills/` 复制一份就再也不看，副本没有"过期"这一状态。F2+F4+F5 都是它的表现：7 件副本隔代、28 个依赖无人校验是否可得。
→ **必须先修**，因为它决定后续所有修复能否到达模型。

**病二｜强断言与可满足性脱钩（fail-open 的镜像：fail-silent）**
`required: true` + "跳过被禁止"是**断言**，但没有任何机制校验该断言是否可满足；不满足时不报错、不阻断、不告警，只是静默走 fallback。这与项目红线"禁止代码静默消费校验失败的规则（fail-open）"是同一形状：**校验失败被静默消费**。区别是发生在文档层而非代码层，所以逃过了全部机械校验。

**病三｜事实留在无消费者的位置（死端）**
编排决策核、guard 错误速查表、18 个 BP、`sync` skill、`orchestrator-en.md` —— 全部写在仓库里，全部没有消费者。对应项目既有的"产出物与消费面必须同批交付"红线。

三者的共同点：**引擎（这里是安装器与 skill 体系）执行了动作，却没留下可判定的事实**。修病一是前提，病二病三可以在同一批里修。

---

## 5. 外部对标（定位判定）

用两条轴：**副本治理** × **依赖可满足性**。

| 机制 | 副本治理 | 依赖可满足性 | 备注 |
|---|---|---|---|
| agentskills.io 生态（约 40 产品兼容） | 靠"安装即复制"的普遍做法，同样不治理 | 无 required 语义，只有建议 | `review/full-flow-consistency-ecosystem-2026-09-05.md:69`：47,150 个公开 skill 平均质量 6.2/12，36% 含 prompt injection |
| superpowers（本机市场可见，11 件） | 单体包分发，**版本即整包** | 包内自足，不跨包依赖 | 它的 `brainstorming`/`hyperplan` 类互补能力正是本项目缺的 |
| 本项目 | **多处维护，零同步机制** | **required 28 项，可达 0** | 文本质量显著高于生态均值，治理机制低于生态均值 |

**定位判定**：差距在**工程层**，不在哲学层。哲学上（渐进披露、CLI-first、阻塞点编码、错误码纪律、恢复章节）本项目明显领先生态均值；但恰恰因为它把大量事实写进了 skill 文本，而 skill 文本的**副本生命周期**没有任何治理，于是"写得越细，漂移面越大"。

**抄纪律而非抄算法**：superpowers 那种"整包分发、包内自足"的纪律值得抄——**一个 skill 的有效性不应依赖另一个不在包内的 skill**。本项目已在做（inline fallback），但把 fallback 写成"降级说明"而不是一等公民步骤，导致它可以被跳过而不留痕。

---

## 6. 改进建议（P0 → P2，每条含验收判据）

### P0-1｜重装安装态 + 建立技能漂移检测

**改点**：`mumuspec install --agent workbuddy --force` ×7（先修 A 面，再重装）；新增漂移检测消费者。
**改法**：
1. 先把 P0-2/P0-3 的 A 面修正落地（否则重装的是错的）；
2. `install` 后重刷；
3. 新增 `scripts/check-skill-drift.mjs`：对 `AGENT_MANIFEST.workbuddy` 逐包做 sha256 比对（**只比正文，排除 frontmatter 的 `metadata.version`**，因为 F3 的戳印必然造成差异），接入 `mumuspec check` 为 `W-SKILL-001`，并进 `ci:check`。
**验收判据**：① 比对脚本 exit 0 且输出 7/7 SAME；② `mumuspec check` 中 `W-SKILL-001` 计数为 0；③ 故意改一行 A 面文本后重跑 `check`，`W-SKILL-001` 必须出现（**新建的检查必须对自身生效**，否则它是仪式）。

### P0-2｜清除幽灵字段三态（项目自身红线）

**改点**：`skills/mumuspec/phase-design/SKILL.md:478`、`skills/mumuspec/phase-open/SKILL.md:340`、`skills/mumuspec/workflow.yaml:424-427`。
**改法**：逐条裁决"实现它，或删掉它"。本轮建议**删**（`E-GUARD-*` 已由引擎承担，`ponytail_compliance_checked` 已由 `mumuspec check` 的独立通道承担，`single_active_change` 已由 `mumuspec new` 承担）——保留只会持续制造"文档有、代码无"。
**验收判据**：`grep -rn "design_layers_covered\|ponytail_constraints_defined\|build_layers_completed_in_bottom_up_order\|subagent_dispatch\|each_layer_shall_defined\|ponytail_compliance_checked" skills/` 命中数 = 0（现为 4 处命中）。

### P0-3｜编排器单源化（四写 → 一写一备）

**改点**：`skills/mumuspec/SKILL.md` vs `skills/mumuspec-workflow/SKILL.md`。
**改法**（二选一，**不可都留**）：
- 方案 A（推荐）：把编排器的**决策核**（预设检测 Step 0、8 条阶段判定、guard 错误速查表、`.mumuspec.yaml` 字段表）合并进已安装的 `mumuspec-workflow/SKILL.md`，删除 `skills/mumuspec/SKILL.md` 的重复部分，使其只留"资源"（分发表、BP 定义）；
- 方案 B：把 `mumuspec` 加入 `WORKBUDDY_PACKAGES`（`installer-registry.ts:135`），让丰富版可安装。
同时给 `en/orchestrator-en.md` 与 `workflow.yaml` 加显式**非权威标注**（或删除），并把 `workflow.yaml` 的 `0.12.2` 与包版本对齐。
**验收判据**：`skills/` 下描述"阶段分发规则"的文件数 = 1；`mumuspec-workflow` 安装副本内含 `E-GUARD-009`/`W-BUILD-001` 速查条目（本轮 grep 命中必须 > 0，现为 0）。

### P1-1｜required 语义诚实化（消除恒空转）

**改点**：4 份 phase skill 的"领域 Skill 提示"表 + `mumuspec-workflow` 的 Required Skill 注册表。
**改法**：把 `required: true` 拆成两栏——`required`（**本包内自足、必须执行**）与 `companion`（外部增强，可用则用）。fallback 从"降级说明"升格为**显式步骤**（有编号、有产出、有验收），使每次执行都留痕而非静默替换。
**验收判据**：`mumuspec check` 或安装时的预检输出中，`companion` 类缺失**列清单而不报错**；skill 文本中不存在"必须加载 X skill"而 X 无来源的句子（现 28 处）。

### P1-2｜合成门强度倒挂收口

**改点**：`phase-build/SKILL.md` Step 7（代码审查门禁）。
**改法**：当前唯一给了无条件逃逸口（"若 skill 不可用，跳过但记录"），而风险更低的 TDD/调试却写"跳过被禁止"。改为：**必须执行自审并写 findings 到 `tasks.md`**，CRITICAL 必须修复——使门禁强度与风险等级一致。
**验收判据**：该段不再出现"跳过"字样；`tasks.md` 中存在审查发现记录（`grep -c "review" tasks.md` > 0）。

### P1-3｜回填 tweak 静默失败陷阱

**改点**：`skills/mumuspec/workflow-presets/SKILL.md`（A 面当前缺失该段，B 面仍保留）。
**改法**：把 B 面的陷阱段（`workflow === 'tweak'` 跳过 delta 合并且不报错 → `finalize-archive --keep-old` 补救）回填 A 面。
**验收判据**：A 面该文件 grep `finalize-archive` 命中 > 0（现为 0）。

### P2-1｜阻塞点相邻项合并

**改点**：`phase-build` 的 BP-9 与 BP-10。
**改法**：合并为一次询问（plan-ready + 隔离方式 + 执行方式），减少一次用户往返。仍须显式确认，不得自动选择。
**验收判据**：build 阶段单次调用内的用户交互次数由 2 降为 1，且选项集不变。

### P2-2｜把纪律固化为守卫测试

**改点**：新增 `tests/guard/skill-registry.test.ts`（沿用 `tests/guard/error-code-registry.test.ts` 的既有做法）。
**改法**：三条断言——① 每个 phase skill 声明的 guard 目标阶段合法（open→design|build、design→build、build→verify、verify→archive-in-progress）；② `WORKBUDDY_PACKAGES` 与安装器的 skill 源查找路径对每个包都能命中现有文件（防 `sync` 这类不可达包）；③ skill 文本中不出现已知幽灵字段名。
**验收判据**：`npx vitest run tests/guard/skill-registry.test.ts` 通过；故意把某处 guard 目标改回 `open` 时该测试失败。

---

## 7. 明确不做（防过度工程）

| 不做 | 理由 |
|---|---|
| 不把 11 件 superpowers skill 装进来凑数 | 它们的 `hyperplan`/`grill-me` 类能力**不在那 11 件里**（F6）；装 TDD/调试类对现状无改善——A 面已内联了等价 fallback，反而引入新的外部依赖面（Ponytail 第 5 级：已安装依赖能做就不引新依赖） |
| 不为 C 面无关插件做裁剪 | 插件池是宿主共享资源，无关 ≠ 污染；裁剪属宿主配置，不是 skill 体系问题 |
| 不重命名遗留 `E-` 前缀告警码 | 记忆中的既有裁决：14 例属主流惯例，改名会制造唯一异类；且属破坏性变更，只能提出 |
| 不改 18 个人工阻塞点的存在性 | "设计决策权始终在人"是不变量，摩擦是设计代价不是缺陷 |
| 不引入"自动重装 skill"的钩子 | 会绕过 `install` 的"不覆盖用户手写文件"纪律（`installer-ops.ts:459`），且把副作用放进不可见的时机 —— 与"人工签收"纪律冲突 |

---

## 8. 需裁决的点

1. **P0-3 的 A/B 方案选择**：把决策核并入英文精简版（方案 A，安装面不变），还是把中文编排器加入安装清单（方案 B，常驻上下文 +366 行）？涉及**常驻 token 预算 vs 自愈手册可达性**的取舍，属设计决策。
2. **`workflow.yaml` 的去留**：它是 18 个 BP 的唯一结构化定义，被 4 份 review 引为权威，但版本落后 7 个次版本、无引擎消费者。**实现它（下沉为可查询数据层）还是标注为历史资源**？记忆中已有"须单独立项评估，不可混在本次决策里"的既有裁决，本轮不推翻。
3. **漂移检测的资产归属**：`W-SKILL-001` 放在 `mumuspec check` 内（项目自检），还是仅放在 `ci:check`（发布流水线）？前者会让**每个使用者的 `check` 都依赖本机安装态**，可能对非本机开发者误报。

---

## 附：本轮未验证项（诚实标注）

- C 面 32 件插件 skill 的**实际加载时序与触发优先级**未实测（宿主行为，非文件系统事实）。
- B 面 `phase-verify` / `phase-archive` 与 A 面的逐行差异未展开（已确认哈希不同，未逐条定性）。
- `mechanism-circuit-audit` 与 mumuspec 体系**无依赖关系**，本轮未发现冲突；但它自己写的纪律（"禁止保留文档有、代码无的第三种状态"）正被 B 面违反——属自指风险，值得后续留意。
