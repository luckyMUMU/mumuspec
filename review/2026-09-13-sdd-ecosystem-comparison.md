# SDD 生态横向对比与 MumuSpec 改进建议报告

> 调研日期：2026-09-13 ｜ 基准：MumuSpec v0.24.0-alpha.0（Spec-as-DSL）
> 方法：Web 调研同类项目最新版本特性 + WorkBuddy 插件市场专家检索，从功能覆盖、实现方式、用户体验三维度横向对比。

---

## 一、对象一：关联项目最新版本特性（头部 SDD 工具）

### 1. GitHub Spec Kit — v1.0.0（2026-08-21，约 132k stars，"品类锚点"）

- **五大可组合原语**：integrations / extensions / presets / workflows / workflow steps，外加 **bundle**（按角色/团队打包扩展+预设+工作流+步骤为单一可安装单元）与 **community catalog**（目录可见 ≠ 代码已审计，信任分级明确声明）。
- **/speckit.converge 收敛闭环**：正面回应"spec 与实现漂移"这一最高频批评。
- **可编程工作流引擎**：step catalog 社区可装、run/resume/status 结构化 JSON 输出、`from_json`、`continue_on_error` 非致命失败。
- **assess 扩展**（v0.13）：idea 进入 SDD 前的前置五步评估（intake → research → define → shape → decide：Go / 澄清 / Kill）；另有 bug 扩展（assess → fix → test）。
- **skills 安装模式**：`specify init --integration copilot` 默认装 skills 而非 slash commands；支持版本 pinning 与升级检测；38 个 agent 集成、157 社区扩展。
- 哲学：**spec 先于实现、工件可持久、流程 agent 无关、方法可适配**。

### 2. OpenSpec — v1.13.0（2026-09-09，Spec-Anchored 代表，约 66.7k stars）

- **双目录模型**：`specs/`（当前真相）+ `changes/`（delta 提案，ADDED/MODIFIED/REMOVED/RENAMED 语义标记），归档时按 **requirement 身份**语义解析合并，不依赖 header 文本匹配。
- **v1.0 重构：阶段锁定 → 动作制**：10 个 `/opsx:` 动作（explore/new/continue/ff/apply/verify/sync/archive/bulk-archive/onboard）；工件构成 **DAG**（BLOCKED/READY/DOWN 三态），`/opsx:continue` 用拓扑排序给出下一个就绪动作。
- **三层指令运行时组装**：context（≤50KB 项目上下文）+ rules（按工件分键的约束）+ templates（YAML schema），**改配置立即生效、无需重建**。
- **code-grounded planning**：propose/ff 先读相关代码、测试、文档再起草；explore 先查仓库再向用户提问。
- 工程可靠性持续投入：findings-only 校验报告、fence-aware 归档（不改动代码示例）、delta 解析多重假阳性修复、update 比对 command 文件内容而非仅存在性。

### 3. BMAD-METHOD — v6.9（约 49k stars，多角色方法论代表）

- **角色化 agent 团队**：v6.3 将 9 个 agent 精简为 6 核心（PM/架构师/SM/Dev/QA/UX），34+ 工作流、7 官方模块、44+ 平台支持。
- **规模自适应（ceremony sizing）**：QuickFlow（两步直达代码）/ BMad Method / Enterprise 三档，**按项目复杂度自动切换**——这是对"新瀑布主义"批评的直接回应。
- **持久化 spec = 跨会话外部记忆**：docs/specs/、docs/stories/ 文件在会话间保持上下文；story 粒度切分实现。
- v6.8+ 新增：无人值守开发循环（bmad-dev-auto）、规格蒸馏器（bmad-spec，任意意图蒸馏为标准合约）、Web Bundles（规划阶段放到包月 Web LLM 执行降成本）、bmad-help 自然语言引导。

### 4. AWS Kiro — IDE/CLI 双形态（门禁式商业代表）

- **三文档门禁**：requirements.md（EARS 语法）→ design.md → tasks.md，逐文档人工审批后才写代码。
- 2026-05 三项 spec 提速：**并行任务执行**（依赖图分波调度，同文件任务串行）、**Quick Plan**（先扫工作区、定向澄清问题、一次生成三文档）、**Analyze Requirements**（神经符号 AI 检测真歧义/需求间矛盾/未定义缺口，每条发现以"二选一问题 + 建议修复"呈现）。
- **Design-First 工作流**（从架构图/伪代码反推需求）与 **Bugfix 工作流**（根因分析 + fix 设计 + 明确"什么必须保持不变"的回归防护）。
- **steering 文件**（条件加载 fileMatch）+ **agent hooks**（事件驱动、JSON 版本受控、团队共享）+ hunk 级 supervised review。

---

## 二、对象二：同类相似项目实现做法与行业最佳实践

### 二线/差异化项目速览

| 项目 | 定位 | 关键做法 |
|---|---|---|
| **Tessl**（$125M 融资） | Spec-as-Source 激进愿景 | Spec Registry（10k+ 库规格，治 API 幻觉）+ Framework（`tessl build` 从 spec 生成代码）。**核心困境：LLM 非确定性使同一 spec 产出不同实现**，2026-01 已转向"Skills Registry / Agent 赋能平台" |
| **MUSUBI** v1.2 | 高 rigor 合成框架 | 融合六大框架、25 个 Claude Code skills、强制 EARS 格式，宣称 100% 需求-实现映射 |
| **Agent OS** | 标准注入 | 只做 house conventions 注入，advisory、无持久 spec |
| **CodeMySpec** | 垂直栈强制门禁 | Phoenix/Elixir 专用，**强制 BDD 门禁 + 运行中应用的浏览器 QA 验证** |

### 行业最佳实践提炼

1. **Enforcement 缺口是品类最大公约数**：主流对比表的"enforcement / verification"两列几乎全是 none——"**没有被强制的 spec 只是会漂移的文档**"。这是 MumuSpec 机械校验路线的差异化护城河。
2. **Ceremony sizing 决定日常可用性**：固定仪式（spec-kit 七阶段）对小任务是"review overload"；BMAD 自动分档、Kiro Quick Plan 是两种主流解法。
3. **棕地（brownfield）是被低估的硬需求**：OpenSpec 的 delta 语义合并、spec-kit 的 converge、Kiro 的 bugfix 工作流都在补"修改问题"（modification problem）。
4. **三层组装/渐进式披露成为共识**：spec-kit 32KiB 预算的 AGENTS.md、OpenSpec 三层组装、MumuSpec 的 MCP 渐进加载同源。
5. **Spec-as-Source 尚不成立**：Tessl 非确定性编译困境反证了 MumuSpec"spec 是一等源文件、代码由 AI 生成、**正确性由测试锁定**"路线的务实性。
6. **生态分发模型成熟**：原语 + bundle + catalog（可见性与审计分离）是 spec-kit 一年做到 157 扩展的关键。

---

## 三、对象三：WorkBuddy 中功能相近的专家能力与定位

检索插件市场（type=expert）后，与 SDD 研发流程相近的专家如下：

| 专家 | 类型 | 能力定位 | 与 SDD 工作流的映射 |
|---|---|---|---|
| **软件开发团队**（SoftwareCompany） | 专家团 | 产品经理定需求 → 架构师设计+拆任务 → 工程师批量实现 → QA 验证；小需求支持快速模式 | 完整 PM→Design→Tasks→Implement→QA 链路，相当于**对话版 BMAD** |
| **软件工坊**（SoftwareWorkshop） | 专家团 | 6 角色：产品评审、代码审查、安全审计、QA 测试、设计系统、调试运维 | 偏 Verify 阶段的多角色评审面 |
| **产品战略团队**（ProductStrategyTeam） | 专家团 | 需求分析师（PRD/功能规格书）、用户研究、竞品分析、数据分析、路线图规划 5 角色 | Open 阶段的需求起草与澄清 |
| **产品通**（ProductManagementExpert） | 单专家 | 功能规格编写、路线图、利益相关者沟通、竞品与指标 | 单人版需求侧 |
| **架构通**（SoftwareArchitect）/ **磐石石**（BackendArchitect） | 单专家 | 全局可扩展架构设计 / 分布式高并发方案 | Design 阶段的架构起草 |
| **火眼眼**（CodeReviewExpert） | 单专家 | 逐行缺陷拦截式代码评审 | Verify 阶段 |

**共性能力**：零安装、自然语言交互、多角色视角互补、小需求快速模式（与 BMAD QuickFlow 同构）。
**共性局限**：会话内角色扮演，**无跨会话持久工件、无状态机门禁、无机械校验、产物是文档而非可判定约束**——产出质量完全依赖模型现场发挥，无法阻止漂移。

---

## 四、横向对比（三类对象）

### 4.1 功能覆盖

| 能力 | MumuSpec | Spec Kit | OpenSpec | BMAD | Kiro | WorkBuddy 专家 |
|---|---|---|---|---|---|---|
| 需求→规格起草与澄清补全 | LLM 起草+追问（目标态） | specify/clarify | opsx:explore/new | PM agent | requirements.md | ✅（最强项） |
| 规格作为持久一等源文件 | ✅ 分层 L0..Ln | ✅（过程产物） | ✅（语义合并台账） | ✅ | ✅ | ❌ 会话即弃 |
| 分层/模块化规范体系 | ✅ **独有**（层闭合/自足/并行投影） | ❌ | 部分（能力域） | ❌ | ❌ | ❌ |
| 机械校验/强制门禁 | ✅ **独有**（四分类+E-SPEC-015+四通道+error code registry） | ❌（约定） | 结构校验 | 流程交接门禁 | 审批门禁 | ❌ |
| 约束来源可追溯（provenance） | ✅ **独有**（E-CONSTRAINT-001/002） | ❌ | ❌ | ❌ | ❌ | ❌ |
| 漂移检测/收敛闭环 | drift 命令 | converge | show --diff | verify-and-learn | bugfix 不变量 | ❌ |
| 仪式规模自适应 | tweak/hotfix/workflow 预设（手动） | ❌ | ~（ff 直达） | ✅ 自动三档 | ✅ Quick Plan | ✅ 快速模式 |
| 并行支持 | parallel_group（设计侧投影） | ❌ | bulk-archive | Party Mode | ✅ 任务分波执行 | — |
| 无人值守循环 | ❌（Loop 元层待修） | ❌ | ❌ | ✅ dev-auto | autopilot | ❌ |
| 生态/扩展分发 | skill 两层安装 | ✅ bundle+catalog（157 扩展） | profiles | 模块+marketplace | 封闭 | 平台原生 |
| 棕地友好 | 中（变更工件模型） | 中 | ✅ 强 | ✅ | 中 | ✅ |

### 4.2 实现方式

| 维度 | MumuSpec | Spec Kit | OpenSpec | BMAD | Kiro | WorkBuddy 专家 |
|---|---|---|---|---|---|---|
| 形态 | TS CLI + MCP server + skills | Python CLI + slash/skills | Node CLI + skills/commands | npm + skills/commands | 商业 IDE/CLI | 平台内置会话 |
| 工件模型 | **分层规范 + delta-spec + 约束树(tighten-only)** | constitution/spec/plan/tasks 文件 | specs/changes 双目录 + DAG | docs/specs + stories | 三文档 | 无 |
| 校验机制 | **代码引擎机械校验（fail-open 纪律）** | 无 | 结构校验 | 流程门禁 | LLM 审批 + 神经符号分析 | 无 |
| 指令注入 | AGENTS.md 32KiB 预算 + MCP 渐进披露 | 原语+bundle | 三层运行时组装 | TOML 定制 | steering 条件加载 | 系统提示词 |
| LLM 依赖面 | 引擎归代码、规则归 LLM（KP-0060） | 全 LLM | 全 LLM | 全 LLM | 混合 | 全 LLM |
| 开放性 | MIT、agent 无关 | MIT、38 集成 | MIT、25+ 集成 | MIT、44+ 平台 | 封闭、AWS 系 | 平台锁定 |

### 4.3 用户体验

| 维度 | MumuSpec | Spec Kit | OpenSpec | BMAD | Kiro | WorkBuddy 专家 |
|---|---|---|---|---|---|---|
| 安装/上手门槛 | 中（需理解 DSL 与命令面） | 低-中 | 低 | 中-高（学习曲线陡） | 低（IDE 内） | **极低（对话即用）** |
| 认知负担 | **高：58 顶层命令 + 强纪律** | 中（5 核心命令+扩展） | 低（10 动作 + continue 引导） | 中（bmad-help 引导） | 低（UI 引导） | 极低 |
| 反馈可视性 | check/validate 文本输出 | JSON + converge | findings 报告 + diff | 工件文件 | hunk 级 UI + credit 仪表 | 对话即时 |
| 对小变更的友好度 | 中（tweak 预设但需手动选） | 低（ceremony 重，最高频批评） | 中-高 | 高（自动分档） | 高 | **高** |
| 跨会话连续性 | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| 成本模型 | 免费（BYO 模型） | 免费 | 免费 | 免费（token 密集） | credit 计费（被诟病） | 平台内 |

---

## 五、优劣归纳

- **MumuSpec 优势**：唯一同时具备"分层规范体系 + 机械强制校验 + 约束来源可追溯"的方案，直击品类最大缺口（enforcement）；规则-实现分离（KP-0060）与 fail-open 纪律在工程可靠性上超过多数同类；Spec-as-Source 的非确定性困境反证了"测试锁定正确性"路线的稳健。
- **MumuSpec 劣势**：① 认知负担最高（58 命令 + 强纪律，缺少 OpenSpec 式"下一步就绪动作"引导）；② 仪式规模自适应靠手动预设，落后 BMAD/Kiro 的自动分档；③ 生态分发薄弱（skill 副本单向快照、无版本 pinning/升级检测，required:true 可达率 0/28 的空转未根除）；④ drift/converge 结果可视性弱于 show --diff / converge；⑤ 完备性判定与用户交互形态（结构化工件）较 Kiro 的"二选一问题+建议修复"重。
- **头部项目共性短板**（= MumuSpec 的相对优势）：机械校验缺位、约束无来源追溯、流程对规范文本的漂移无防御。
- **WorkBuddy 专家**：UX 极致轻量但不可判定、不可审计、不可持久；与 MumuSpec 是**互补而非竞争**——专家可充当各阶段"人机合著"的起草/评审角色，MumuSpec 提供其不具备的持久化与守卫。

## 六、可借鉴的改进点（按优先级）

1. **P0 · 下一步就绪动作引导（借鉴 OpenSpec DAG + continue）**：基于现有状态机，在 `status` / MCP 中暴露"当前阶段就绪的下一个动作"拓扑提示，压缩 58 命令面的认知负担。属 UX 层增量，不动状态机语义。
2. **P0 · 完备性检查交互化（借鉴 Kiro Analyze Requirements）**：把 LLM advisory 的结构化工件输出升级为"每条发现 = 二选一问题 + 建议修复"的轻量交互，直接服务核心目标"追问补全"，降低人签收成本。
3. **P1 · 仪式规模自动分档（借鉴 BMAD 三档 / Kiro Quick Plan）**：为 tweak/hotfix/workflow 预设增加机械判据的自动推荐（影响层数、约束变更量、新增命令面），只**推荐**不裁决，保持设计决策权在人。
4. **P1 · 技能分发升级（借鉴 spec-kit bundle + catalog）**：为两层 skill 体系补版本 pinning、升级检测与"副本过期"状态（当前单向快照无过期概念）；引入 catalog 元数据 + "可见 ≠ 已审计"信任分级，根治 required:true 与实体存在性脱钩的空转。
5. **P2 · 漂移可视化（借鉴 openspec show --diff / converge）**：为 `drift` 与 delta-spec 提供 diff 级展示，让"规范与实现漂移"从 exit code 变成可读结论。
6. **P2 · 任务波次执行（借鉴 Kiro 并行任务执行）**：parallel_group 已是"设计侧完备性的可测量投影"，可向执行侧延伸——按已验证 parallel_group 分波调度实现任务，与 I3 层内可并行不变量闭环。
7. **观察项 · 无人值守循环（BMAD dev-auto）**：待 C 元层数据面死端修复后再评估，当前 fail-open 纪律下不宜先行。

---

## 附：信息来源

Spec Kit 官方 History/Newsletter、vibecoding.app 评测、jamesm.blog；OpenSpec Releases（v1.11–v1.13）与 spec-compare 工具档案；BMAD 使用教程（chihhung）、theagenttimes、rywalker 研究档案；Kiro 官网/Changelog、AWS Builder Center 实战、dev.to 评测；codemyspec.com 七工具横评、tomrochette 特性矩阵、besthub SDD 深度评述、thenextgentechinsider 生态综述。WorkBuddy 专家信息来自插件市场实时检索（2026-09-13）。
