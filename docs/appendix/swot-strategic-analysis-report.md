# MumuSpec SWOT 分析与战略建议报告

> **[研究参考]** 本报告基于 2026-08 时期的竞品格局。当前项目状态请参阅 [STATUS.md](../../STATUS.md)。
>
> **报告性质**：技术战略顾问级分析报告  
> **分析日期**：2026 年 8 月  
> **基准版本**：MumuSpec v0.17.0（设计进度 ~90%，实现进度 ~90%）  
> **竞品覆盖**：12+ 对标项目，3 大赛道（SDD 框架 / 方法论系统 / 元进化系统）

---

## 摘要

MumuSpec 在当前 AI 辅助编程工具生态中占据一个独特的技术位点——**规范可靠性工程平台**。与竞品相比，其独创的双向约束体系（SHALL/SHALL NOT + Ponytail 7 级优先级）、动态强度分级、契约漂移检测与 BOUNDARY.md 目录边界系统，构成了一个其他项目无法直接复制的"规范执行力"壁垒。然而，该壁垒同时伴随着认知负荷过高、Guard 层实现依赖正则而非 AST、缺乏 Graph 层编排能力等结构性短板。

本报告的核心结论是：MumuSpec 正处于从"设计完备"到"产品-市场契合"的关键转折窗口。未来 12 个月的战略选择将决定它是成为一个利基市场的基础设施，还是在平台化浪潮中被 Claude Code/Copilot 的边缘功能吞噬。

---

## 一、SWOT 四象限分析

---

### 1.1 Strengths（内部优势）

**S1. Ponytail 7 级优先级阶梯——全球独创的编码约束方法论**

MumuSpec 的 Ponytail 体系（YAGNI → 复用 → 标准库 → 平台特性 → 已有依赖 → 一行代码 → 最小实现）是目前生态中唯一从"是否需要写代码"开始逐级下探的编码约束体系。它在概念上将"约束AI编码行为"从架构层面（SHALL/SHALL NOT）延伸到实现层面（单个函数/单行代码的设计决策），这正是其他 SDD 框架的盲区。OpenSpec 仅有正向 SHALL，Spec Kit 的 Constitution 只定义规则内容而不定义"如何最小化实现"。Ponytail 的独特性为 MumuSpec 贡献了一个难以通过复制获得的方法论品牌资产。

**S2. 双向约束 Guard Layer + SHALL/SHALL NOT 体系**

在竞品普遍仅支持正向约束的环境下，MumuSpec 的双向约束机制产生了两个差异化效果：其一，SHALL NOT 提供了"红线不可逾越"的底线保障——这在企业级安全合规场景中直接可用；其二，正向约束（SHALL）与反向禁止（SHALL NOT）的组合覆盖了完整的决策空间，使 AI agent 在任何开发动作中都能找到明确的合规判据。该体系在 `constraint-evaluator.ts` 中通过四级优先级逻辑实现（always_enforce → workflow override → capability override → strength-based），技术成熟度在生态中属于较高水平。

**S3. BOUNDARY.md 目录边界系统 + Top-Down/Bottom-Up 混合范式**

MumuSpec 要求每个目录维护自身的 BOUNDARY.md 文档，记录对外接口、依赖声明和数据契约。这一设计将"模块化"从代码结构层面提升到了契约文档层面，配合 Top-Down Design（根→叶创建契约变更）和 Bottom-Up Implementation（叶→根完成变更）的混合流程，实现了一种"自文档化模块边界"。在竞品中，没有任何项目实现了这一机制——OpenSpec 的 artifact 漂移问题、Spec Kit 的集中 Constitution 都无法替代 BOUNDORY.md 的细粒度边界管控。

**S4. Contract Drift Detection（契约漂移检测）**

MumuSpec 的契约漂移检测（`impact-analyzer.ts` + `validator.ts`）将漂移类型扩展至 6 类以上，覆盖了契约破坏、规则违反、规范与代码不一致等多维信号。相比之下，OpenSpec 完全没有漂移检测，Spec Kit 仅通过人工审查保障一致性。在多模块、多人协作场景中，契约漂移检测的价值随项目规模线性增长，是走向企业级市场的关键能力。

**S5. 模型无关架构 + MCP Server 标准协议**

MumuSpec 通过 `@modelcontextprotocol/sdk` 实现 MCP Server，将工具能力与底层 LLM 完全解耦。在当前 Claude 能力快速增强、GPT 系列持续追赶的多变格局下，这是一个具有前瞻性的架构决策。相比之下，Kiro 锁死 Claude 模型、Cursor 深度绑定 VS Code 的模型调度——当底层模型能力发生迁移时，MumuSpec 的"harness-first"策略使其具备抗模型供应商波动的能力。

**S6. Worktree 隔离 + 自动 Commit 机制**

每个变更在独立的 git worktree 中运行，配合每轮自动 commit，产生了一个类似"学术实验记录"的开发可审计链。这一机制不仅防止了变更间的交叉污染，还为 AI agent 的失败回滚提供了清晰的检查点。在 Loop 模式中，worktree 隔离的价值尤为显著——多轮迭代的每一步都有独立的代码状态可对比、可恢复。

**S7. 跨契约变更的强制用户征询机制**

MumuSpec 对外部契约变更设置了硬性的人机协同门槛——必须执行影响分析、用户征询、文档同步、记录持久化四步流程后才允许实施变更。这一设计的保守性在面向生产代码的企业场景中是核心优势：它确保了任何对外部 API、数据库映射、SDK 接口的破坏性变更都经过显式的人类确认。这一安全设计在竞品中几乎不存在——OpenSpec 和 Superpowers 都将此类变更的决策权完全下放给 AI agent。

**S8. Knowledge Layer（LLM-Wiki + PageIndex）的知识回流闭环**

Archive 阶段的知识提取（D1-D8 子流程）将变更过程中的决策、风险、模式提取为持久化知识页面，并在下一变革的 Open 阶段回流使用。这一"变更越多→知识越丰富"的正循环机制在竞品中独一无二。它使得 MumuSpec 在长期项目中的价值随时间递增，而非像其他工具一样价值恒定。

---

### 1.2 Weaknesses（内部劣势）

**W1. 认知负荷高——概念密度过大**

新用户必须同时理解的概念体系包括：SHALL/SHALL NOT 双向约束、Ponytail 7 级优先级、ConstraintStrengthField 三档动态强度、BOUNDARY.md 目录边界、五阶段 + Loop 双模式、Top-Down/Bottom-Up 混合范式、Contract Registry、Knowledge Layer、Hyperplan 对抗审查、Worktree 隔离、Config.yaml 多维配置等。这个概念密度远超 OpenSpec（仅需理解 artifact + change）和 Superpowers（复制 markdown 即用的 prompt 模板库）。认知负荷是 MumuSpec 用户转化率的最大阻力——预估新用户完成首个变更的时间在 60-120 分钟，而 OpenSpec 仅需 10-15 分钟。

**W2. Guard 层实现依赖正则而非 AST 分析**

`guard/checker.ts` 中的 `checkProhibitionViolation()` 大量使用正则模式匹配来检测规则违反。这种实现在浅层约束场景（如"禁止 import 某模块"、"文件名必须以 test- 开头"）中有效，但在深层语义约束（如"禁止使用可变状态"、"函数必须保持幂等"、"不得引入循环依赖"）中几乎无效。相比之下，AST-based 分析（如 ESLint Plugin 体系、Tree-sitter 查询）能覆盖语义级别的约束。Guard 层的实现粗糙导致 MumuSpec 在前端框架约束、设计模式约束、性能模式约束等高层场景中的适用性受限——而这些恰恰是企业级合规的核心需求。

**W3. Loop 模式收敛判断依赖人工，缺乏自动化评估**

MumuSpec 的 Loop 模式要求人类输入 `LoopEvaluation.progress` 和 `goal_achieved` 布尔值来判断迭代收敛。相比之下，DGM（Sakana AI）通过经验验证（pass/fail + benchmark）实现了收敛的自动化判断，这也是其在 SWE-bench 上从 20% 跃升至 50% 的核心原因。MumuSpec 依赖人工判断的问题在于：其一，主观判断导致"虚假收敛"（未真正达标但宣布完成）和"过度迭代"（已达标但继续消耗资源）的概率较高；其二，在无人值守的 CI/CD 场景中，Loop 模式无法运行。

**W4. 缺乏 Graph 层——无法编排多 Agent 协同**

MumuSpec 处于五层能力栈的 L4（Loop Engineering），L5（Graph Engineering）为空白。BMad-Method 的 9 个专职 sub-agent、OmO 的 11 个专职 Agent、AutoGen 的多 Agent 对话都属于 L5 能力。MumuSpec 使用单次 Plan→Act→Evaluate 迭代来替代多角色并行推理，在简单场景中有效，但在涉及多子系统并行变更（如同时修改 API 契约、数据库 schema、前端组件、CI 配置）时，顺序串行执行效率显著低于 Graph 层编排。随着项目复杂度上升，这一短板的制约效应将愈发明显。

**W5. 安装与初始化配置复杂度高于竞品**

新用户执行 `mumuspec init` 后，需要配置 `.mumuspec/config.yaml`（含 workflow、capability、strength 三个维度）、创建 BOUNDARY.md、理解 `.mumuspec/spec.md` / `design.md` / `tech.md` / `prd.md` / `prohibitions.md` 等多个文件的用途、注册 Skill 路径。相比之下，OpenSpec 只需一个 `openspec init`，Superpowers 只需复制一个文件夹。配置复杂度的差异直接影响了 MumuSpec 在中小项目和个人开发者中的渗透能力。

**W6. 社区规模远小于头部竞品**

Superpowers 拥有约 170k GitHub Stars、OpenSpec 约 58k、CGC 约 35k。MumuSpec 项目尚未大规模公开推广，社区规模处于早期阶段。在开源工具的竞争格局中，社区规模直接影响 NPM 下载量、第三方集成数量、Issue 响应速度等关键指标。MumuSpec 需要在保持方法论严谨性的同时找到社区增长的杠杆点。

**W7. 缺少 IDE 原生集成**

Kiro 基于 VS Code OSS 提供了可视化 diff、内联 spec 预览、实时 Guard 状态面板等原生集成体验。Cursor 在编辑器内直接渲染 AI 决策过程。MumuSpec 目前的输出形态以 CLI 日志 + markdown 文件为主，在交互体验维度显著落后于 IDE-native 工具。对于习惯在 IDE 中完成全部操作的开发者，CLI-first 的工具形态构成使用壁垒。

---

### 1.3 Opportunities（外部机会）

**O1. 元进化趋势——自进化是 AI 编程的下一个范式转移**

从 Gödel Machine（2003）到 DGM（ICLR 2026，SWE-bench 20%→50%）再到 HyperAgents（Meta AI），元进化正在从理论走向工程实践。MumuSpec 的 self-improve-loop 变更已验证了"用自身工具改进自身规范"的可行性。如果 MumuSpec 能在 Loop Engine 中引入自动化评估（用 test pass rate、drift score 等客观指标替代人工 LoopEvaluation），就可以实现从"人类辅助迭代"到"自动化收敛搜索"的跃迁。这一能力使其成为首个具备"规范的规范演进"（meta-spec evolution）特性的框架——即在 Shaney 层次上领先竞品一个身位。

**O2. Graph Engineering 浪潮——从 Loop 到 Graph 的演进是必然**

五层能力栈清晰地展示了工具演进的方向：Loop（L4）解决单 agent 迭代效率问题，Graph（L5）解决多 agent 协同问题。2026 年 BMad-Method、OmO、AutoGen 在 L5 的积累已经证明了市场对多 agent 编排的需求真实存在。MumuSpec 当前在 Graph 层的空白恰好是一个明确的扩展机会——将 BOUNDARY.md 定义的模块边界作为 Graph 节点，将 Contract Registry 定义的接口契约作为 Graph 边，可以在不重构的情况下实现基于契约的多 Agent 并行变更编排。这一路径利用了 MumuSpec 现有的契约基础设施作为 Graph 编排的语义基础。

**O3. 企业级 SDD 市场空白——面向团队和合规的工具严重不足**

当前 SDD 工具（OpenSpec、Superpowers、GSD）主要面向个人开发者或小型团队，缺乏面向中大型企业（50+ 开发者、多仓库、合规审计要求）的产品能力。MumuSpec 的 Contract Impact Analysis、Audit Log、Decision Hash 校验等机制天然面向企业级合规场景。金融、医疗、航空等行业的 AI 编程合规需求正在增长——这些行业需要"谁批准了什么变更、为什么批准、影响范围是什么"的完整审计链。MumuSpec 是唯一能提供此审计链的开源框架。

**O4. AI 安全/合规需求增长——SHALL/SHALL NOT 体系天然适配**

随着欧盟 AI 法案（EU AI Act）、中国生成式 AI 管理办法等法规的落地，AI 辅助开发的合规要求将逐步制度化。"AI 代码生成过程的可审计性"和"规范约束的不可绕过性"将从"最佳实践"变为"法规要求"。MumuSpec 的 Guard Layer（每条 SHALL/SHALL NOT 有 Enforcement 条目）、Contract Drift Detection（自动检测契约破坏）、Decision Audit（决策 hash 防篡改）三重机制，使其在合规维度领先所有竞品至少 18 个月。

**O5. 契约漂移检测的标准化机会**

当前没有行业标准定义"AI 编程工具应该如何检测规范与代码的不一致性"。MumuSpec 的 6 类契约漂移检测是一个事实上的标准草案。如果能推动这一机制成为 IDE / DevTool 行业的共同实践（类似 ESLint 对 JS linting 的标准化效应），MumuSpec 将获得巨大的行业标准红利。具体路径包括：在 GitHub 上建立 open-standard 提案、与 MCP 协议工作组协调将 drift detection 纳入 MCP tool schema、发布 VS Code 扩展以可视化展示 drift 状态。

**O6. OctoCodingBench 等过程评估基准的兴起**

SWE-bench 等 pass/fail 基准无法评估 AI 编程过程的规范性（是否遵循了约束、契约是否被破坏）。新兴的过程评估基准（如 OctoCodingBench）正在惩罚"虽然功能通过了测试但过程严重违规"的生成轨迹。这与 MumuSpec 的设计理念完全契合——如果 MumuSpec 的 Guard Layer 成为过程评估框架的标准组件，其在学术和工程社区的影响力将显著放大。

**O7. MCP 协议生态扩张——成为 MCP 生态的规范基础设施层**

随着 Claude Code、Cursor、Windsurf、OpenCode 等工具全面采纳 MCP 协议，MumuSpec 作为早期 MCP Server 实现者（`mcp-server.ts`），有机会成为 MCP 生态中 Guard/Drift/Knowledge 能力的默认提供者。如果更多 IDE 和 CLI 工具通过 MCP 调用 MumuSpec 的能力，MumuSpec 将从单一 CLI 工具升格为跨工具的规范中间件。

---

### 1.4 Threats（外部威胁）

**T1. Claude Code 等 Agent 的原生 SDD 能力增强——平台化吞噬**

Anthropic 持续为 Claude Code 增加原生能力约束、工具调用结构化输出和上下文管理。2026 年 Claude Code 已支持 CLAUDE.md 级别的规则注入，其能力正在逼近 MumuSpec 的核心功能区域。如果 Claude Code 继续增加阶段门禁、规范校验等原生能力，外部框架（包括 MumuSpec）的存在价值将被持续压缩。这不是短期威胁——Anthropic 可能在 12-18 个月内覆盖 MumuSpec 50% 以上的差异化功能。

**T2. 大厂碾压——GitHub/AWS/OpenAI 的资源不对称**

GitHub 官方推出 Spec Kit、AWS 推出 Kiro——它们拥有百万级用户基础、成熟的 IDE 分发渠道和几乎无限的工程资源。如果 GitHub 将 Spec Kit 深度集成到 GitHub Actions 和 GitHub Copilot 中，MumuSpec 在企业级 CI/CD 场景中的差异化空间将被急剧压缩。同样，如果 OpenAI 的 Codex Agent 内置了"变更影响分析 + 契约校验"能力，MumuSpec 的技术独特性将不复存在。

**T3. Harness Engineering 概念碎片化——用户注意力被稀释**

"AI Agent Harness Engineering"在 2026 年正处于爆发期，几乎每周都有新概念涌现：Evaluation Engineering、Context Engineering、Prompt Engineering 2.0、SpecOps、AgentOps 等新名词层出不穷。在这个碎片化环境中，MumuSpec 的"Specification + Guard + Contract + Knowledge"品牌定位可能被新概念稀释——用户可能将 MumuSpec 等同于"又一个规范工具"，而非"规范可靠性工程平台"。品牌化的竞争将愈发激烈。

**T4. 元进化安全风险——自修改代码的不可控性**

DGM 和 HyperAgents 的自修改能力虽然在 benchmark 上取得了显著进展，但也引发了安全社区的广泛关注。Autogenesis Protocol 的 RSPL/SEPL 双层架构正是为了应对这一风险。如果 2026-2027 年出现因自进化 Agent 导致的重大安全事件（如自修改导致生产代码被破坏、契约被意外篡改），整个 AI 编程工具生态可能面临监管收紧。MumuSpec 虽然在进化机制上相对保守（坚持人工确认门），但如果行业整体遇冷，保守方案的推广速度也将受阻。

**T5. Fast-Follower Marketplace 模式 vs Heavy 方法论的游击战**

当前市场上存在大量"轻量级、快速复制、快速发布"的工具（GSD 的 50+ 命令零规范依赖、OpenSpec 的三步工作流），它们以"开箱即用"为卖点快速获取用户。相比之下，MumuSpec 的"完整方法论 + 概念体系 + 多阶段工作流"是典型的 heavyweight 方法论。Heavyweight 方法论在早期用户获取速度上天然落后于 lightweight 方案——如果 lightweight 竞品先占据开发者心智（"我用 OpenSpec 就够了"），MumuSpec 的差异化教育成本将大幅增加。

**T6. 资金支持不足——单人/小团队维护 risks**

与 Superpowers（200k+ contributions）、Spec Kit（GitHub 官方团队）、Kiro（AWS 投入）相比，MumuSpec 的开发资源高度有限。在关键能力缺失（Graph 层、AST-based Guard、IDE 扩展）的情况下，资源约束会延缓产品迭代速度，导致在快速变化的市场中错失窗口期。

---

## 二、三大战略方向建议

### 2.1 近期战略（0-6 个月）：降低门槛 + 单点击穿

**核心命题**：在 Claude Code 等平台吞并基础能力之前，将 MumuSpec 的不可替代性锚定在一个垂直场景中，建立早期用户口碑。

**策略一：将"合规审计链"作为单点击穿场景**

MumuSpec 的 Contract Impact Analysis + Audit Log + Decision Hash 是竞品短期内无法复制的合规能力。建议面向以下垂直场景打造产品化形态：开源项目的外部 API 兼容性管理（如 npm 库的版本升级变更审计）、金融科技企业的 AI 编程合规流程。该场景的用户（Tech Lead、DevOps、安全工程师）对"规范约束"有天然付费意愿，且 Claude Code 等平台尚未关注合规审计细分市场。

**策略二：推出"Onboarding CLI"降低新用户门槛**

当前 `mumuspec init` 的认知负荷过高。建议推出一个引导式 `mumuspec onboard` 命令，通过 5-8 个交互式问答（"你的项目类型？""团队规模？""是否需要合规审计？"）自动生成优化的 `.mumuspec/config.yaml` 和初始 BOUNDARY.md 骨架。目标：将新用户完成首个变更的时间从 60-120 分钟压缩至 15-20 分钟。

**策略三：发布 VS Code 扩展（最小可用版本）**

不追求全功能 IDE 集成，先发布一个 VS Code 扩展仅做三件事：(1) BOUNDARY.md 编辑时的自动补全和模板；(2) Guard Layer 违反时的内联诊断（红色波浪线）；(3) Drift Detection 状态面板。这个最小扩展可以将 MumuSpec 的交互体验拉升至"可用"水平，同时为后续完整的 IDE 集成铺路。

---

### 2.2 中期战略（6-12 个月）：Graph 层突破 + 元进化框架

**核心命题**：从 L4（Loop Engineering）跃升至 L5（Graph Engineering），同时引入自动化评估机制补全 Loop 模式的最后短板。

**策略一：实现基于契约的 Graph 编排引擎**

核心设计思想：将 BOUNDARY.md 定义的模块边界作为 Graph 节点，将 Contract Registry 定义的接口契约作为 Graph 边。当变更涉及多个模块时，MumuSpec 自动生成 DAG 编排图——无依赖关系的模块可以并行变更（每个模块分配独立的 skill-context agent），有依赖关系的模块串行执行。这一设计的差异化优势在于"契约驱动的并行"——相比 BMad 的 prompt-defined 角色分配，MumuSpec 的模块切分基于文档化契约而非 prompt 推断，可靠性更高。

**策略二：引入自动化评估替代人工 LoopEvaluation**

在 Loop Engine 的 `detectStagnation()` 基础上，增加自动化评估通道：(1) `evaluation-runner.ts` 已存在基础框架可复用；(2) 将测试通过率、drift score、spec compliance rate 等客观指标纳入收敛判断；(3) 当客观指标全部达标且连续 3 轮无 drift 时，自动宣布收敛（而非依赖人工输入）。这一改进将 Loop 模式从"人类辅助"升级为"半自动化收敛"，为后续全自动化元进化奠定基础。

**策略三：建立"规范的规范演进"（Meta-Spec Evolution）框架**

在 self-improve-loop 的基础上，设计一个正式的 meta-evolution 能力：(1) Guard Layer 的 Enforcement 条目可以有自己的"有效性评分"（通过率 vs. 误报率）；(2) 低有效性评分的 Enforcement 条目自动进入"优化建议队列"；(3) 用户可以批准对规范体系自身的修改（新增/废弃/调整约束），但所有 meta-level 变更强制执行完整的影响分析 + 用户征询流程。这使得 MumuSpec 成为生态中唯一具备"安全自进化"能力的框架——既享受 DGM 式进化的红利，又保留人工确认的安全边界。

---

### 2.3 长期战略（12-24 个月）：生态标准化 + 平台化

**核心命题**：将 MumuSpec 的技术能力从单一 CLI 工具拓展为跨工具的规范基础设施层，确立行业标准地位。

**策略一：推动 MCP Tool Schema 中的 Guard/Drift 标准化**

向 MCP 协议工作组提交提案，将 `detectDrift`、`evaluateCompliance`、`analyzeContractImpact` 纳入 MCP Tool Schema 的标准工具集。一旦被采纳，所有实现 MCP Server 的 AI 工具都可以复用 MumuSpec 的规范校验能力，MumuSpec 将成为事实上的"规范层 SDK"。

**策略二：建立 MumuSpec Marketplace / Skill Registry**

现有 Skill 生态（`bundles/` 目录 + `skills/` 目录）是本地化的，缺乏跨用户的共享机制。建议构建一个在线 Skill Registry，允许用户发布和发现社区贡献的合规配置模板（如"React + TypeScript 项目的最佳 Guard Layer 配置"、"微服务项目的 Contract Registry 模板"）。Marketplace 的网络效应是抵御平台化竞争的有效壁垒——GitHub/AWS 可以复制单个工具能力，但难以复制社区驱动的模板生态。

**策略三：推出"Boomerang Analytics"——规范有效性反馈服务**

收集匿名化的规范使用数据（"哪些 SHALL 规则最常被违反"、"哪些 SHALL NOT 约束从未触发"、"drift 检测的最常见类型"），生成行业级的"AI 编程质量报告"。该产品有三重价值：(1) 面向企业的付费功能——"你的团队 AI 编程合规度行业对比"；(2) 面向社区的免费报告——类似 State of JS 的行业报告效应，持续提升品牌影响力；(3) 产品迭代的数据基础——基于真实使用数据优化 Guard Layer 的检测准确率。

---

## 三、产品路线图建议（TODO 格式）

```markdown
# MumuSpec 产品路线图 — 基于 SWOT 分析

## Phase N: 认知负荷削减（0-3 个月）
- [ ] T-N1: 实现 `mumuspec onboard` 引导式初始化，通过交互式问答自动生成 config
- [ ] T-N2: 内置 3 个项目模板（frontend / backend / fullstack），init 可选用
- [ ] T-N3: 实现渐进式功能披露——新用户默认仅展示核心功能，高级功能按需解锁
- [ ] T-N4: 编写交互式 Tutorial（`mumuspec tutorial`），15 分钟内完成首个变更全流程
- [ ] T-N5: 更新 README 首页，将"核心卖点 + 快速开始"从 80 行压缩至 20 行

## Phase O: VS Code 最小扩展（2-4 个月）
- [ ] T-O1: 确定 VS Code 扩展的最小功能集（BOUNDARY.md 编辑 + Guard 诊断 + Drift 面板）
- [ ] T-O2: 实现 Language Server Protocol (LSP) 绑定到 Guard Layer 校验结果
- [ ] T-O3: 实现 BOUNDARY.md 编辑时的 snippet 自动补全
- [ ] T-O4: 发布扩展至 VS Code Marketplace（Beta Tag）
- [ ] T-O5: 收集前 100 名扩展用户的反馈迭代

## Phase P: 合规审计场景验证（3-6 个月）
- [ ] T-P1: 识别 3-5 个种子用户（中大型开源项目 / 金融科技企业）
- [ ] T-P2: 为种子用户定制 Contract Registry 模板（适配其 API / SDK 现状）
- [ ] T-P3: 实现 Contract Impact Analysis 的 PDF/HTML 审计报告导出
- [ ] T-P4: 实现 Audit Log 的跨变更聚合分析（时间线视图、决策热力图）
- [ ] T-P5: 发布 2 篇 Case Study（种子用户场景 + 量化效果）

## Phase Q: Graph 层突破（6-9 个月）
- [ ] T-Q1: 设计 Graph Orchestrator 原型——基于 BOUNDARY.md 节点 + Contract 边的 DAG 生成
- [ ] T-Q2: 实现模块级并行变更编排（无依赖模块分配独立 worktree + agent context）
- [ ] T-Q3: 实现依赖感知的串行调度（有依赖的模块按拓扑序执行）
- [ ] T-Q4: 添加 Graph 执行状态面板（CLI Dashboard 或 VS Code 可视化）
- [ ] T-Q5: 在 MumuSpec 自身代码库中试用 Graph 变更编排（dogfooding）

## Phase R: Loop 自动化评估（7-10 个月）
- [ ] T-R1: 设计 Loop 评估指标体系（test pass rate, drift score, compliance rate, code delta ratio）
- [ ] T-R2: 实现 `auto-evaluate` Loop 模式——收敛判断基于指标阈值而非人工确认
- [ ] T-R3: 实现 `hybrid-evaluate` 模式——客观指标为主，人工确认为辅的加权判断
- [ ] T-R4: 添加 Loop 评估报告的 HTML 导出（每轮指标变化趋势图）
- [ ] T-R5: 在 MumuSpec 自身的 Loop 变更中验证自动化评估的准确性

## Phase S: Meta-Spec Evolution 框架（10-14 个月）
- [ ] T-S1: 设计 Guard Layer  Enforcement 条目的有效性评分算法
- [ ] T-S2: 实现低评分 Enforcement 条目的自动检测和建议优化
- [ ] T-S3: 实现 `mumuspec meta-evolve` 命令——对规范体系自身发起改进提案
- [ ] T-S4: 为 Meta 变更强制执行完整的影响分析 + 用户征询流程
- [ ] T-S5: 在 MumuSpec 自身项目中运行 Meta-Spec Evolution 并记录结果

## Phase T: 生态标准化与平台化（12-18 个月）
- [ ] T-T1: 向 MCP 协议工作组提交 Guard/Drift 工具 Schema 标准化提案
- [ ] T-T2: 设计 Skill Registry 原型（社区共享的配置模板分发平台）
- [ ] T-T3: 设计 Boomerang Analytics 数据收集和分析框架（隐私-preserving）
- [ ] T-T4: 发布首份匿名化的"MumuSpec AI 编程质量报告"
- [ ] T-T5: 探索商业化模式（企业版 / Cloud 托管的合规审计服务）

## 持续进行
- [ ] Guard Layer 从正则升级至 AST-based 分析（分阶段替换，先覆盖高频规则）
- [ ] 文档多语言化（中文 / 英文 / 日文）
- [ ] 社区运营（Discord / GitHub Discussions / 博客）
```

---

## 四、对 MumuSpec 团队的五条核心建议

### 建议 1：在"全面性"与"可学习性"之间果断倾斜到后者

MumuSpec 的方法论体系是双刃剑——它提供了竞品无法比拟的执行保障，同时也构成了新用户进入的最大壁垒。建议在当前阶段牺牲部分体系的完整性，优先确保"15 分钟完成首个变更"这一用户体验目标。具体做法：将 Ponytail 约束和 Hyperplan 对抗审查从"默认开启"改为"显式开启"，让新用户先体验"SHALL/SHALL NOT 约束 + 五阶段流程"的核心价值，再在后续变更中逐步解锁高级功能。MumuSpec 不需要在第一天展示其全部能力——它需要让用户在第一天就感受到"这个东西确实有用"。

### 建议 2：将 AST-based Guard 列为 Q3 最高优先级技术债

正则匹配实现使 Guard Layer 在语义级约束上的盲区，是 MumuSpec 从"可用"走向"可靠"的最大技术障碍。建议：(1) 使用 TypeScript Compiler API 或 ESLint Plugin 架构替换 `guard/checker.ts` 中"禁止可变状态""强制幂等"等高频语义约束的正则实现；(2) 对于"禁止引入新依赖"等结构性约束，保留正则实现（它们已经足够准确）；(3) 在 `STRENGTH_ACTION_MAP` 中新增 `parser` 字段区分正则规则和 AST 规则，使开发者理解不同约束的检测可靠性差异。这一改进对面向企业合规场景的推广具有决定性意义。

### 建议 3：以"契约驱动的 Graph 编排"作为差异化叙事而非技术探索

不要在 Graph 层与 BMad 或 OmO 正面竞争"多 Agent 对话编排"——那是一条已经被占位的赛道。MumuSpec 的 Graph 差异化应聚焦于"契约驱动"：每个模块的 BOUNDARY.md 定义了其输入/输出契约，Contract Registry 定义了跨模块接口，Graph 编排引擎基于这些文档化的契约自动切分变更任务并分配 Agent 上下文。这个叙事有三个优势：(1) 利用已有的 BOUNDARY.md 基础设施而非从零建设；(2) "契约驱动的并行"比"prompt 定义的并行"更可靠，对企业用户更有说服力；(3) 自然衔接 MumuSpec 的核心品牌——规范驱动。

### 建议 4：建立与 Claude Code 的互补关系而非竞争关系

Anthropic 对 Claude Code 的增强是大势所趋，而非 MumuSpec 可以阻挡的结构性力量。建议采取"互补而非竞争"的定位策略：(1) 明确宣称"MumuSpec 是 Claude Code 的规范增强层，而非替代品"；(2) 确保 MumuSpec 的 `mcp-server.ts` 无缝集成到 Claude Code 的 MCP Server 列表中，让用户可以通过 `claude mcp add mumuspec` 一行命令接入；(3) 将 Claude Code 中已有的能力（如代码补全、Agent 工具）视为 MumuSpec 的基础设施而非竞品——MumuSpec 在这些能力之上提供规范约束和漂移检测；(4) 当 Claude Code 的原生能力覆盖 MumuSpec 某些功能时，优雅地让出这些功能（避免无谓的重复建设），将资源集中在 Claude Code 短期内无法覆盖的领域（Contract Registry、BOUNDARY.md、Meta-Evolution）。

### 建议 5：用"可视化 + 数据"驱动社区增长

在开源项目的增长竞争中，"好看"和"可量化"是两个最强杠杆。建议：(1) 构建一个 Dashboard（项目中已存在 `/dashboard/` 子项目）展示实时 Drift 状态、Guard 违反统计、Compliance Rate 趋势——这既是功能产品，也是最佳的营销素材（"规范质量的可视化"一词即可激发传播）；(2) 在每篇博客文章和社区帖子中使用真实数据（"我们的用户平均每周发现 3.2 次 spec drift"）而非纯理论对比；(3) 定期发布行业基准报告（"2026 年 AI 编程规范合规度调查"），将 MumuSpec 与行业标准研究绑定；(4) 在 GitHub README 中加入实时更新的合规度 badge（类似 CI status badge），让每个使用 MumuSpec 的项目都可以展示其合规分数——这是零成本的传播渠道。

---

## 附录 A：关键数据点汇总

| 维度 | 数据 |
|------|------|
| 当前版本 | 0.17.0-beta（next 通道），0.10.0（latest）|
| 设计进度 | ~90% |
| 实现进度 | ~90% |
| 代码模块数 | 15+（src/ 下各层）|
| 竞品 Stars 对比 | Superpowers 170k / OpenSpec 58k / CGC 35k / Mumuspec 未公开 |
| 五层能力栈覆盖度 | L1(部分) L2(完整) L3(完整) L4(基本) L5(空白) |
| 独特创新点数量 | 8（双向约束 / 渐进式披露 / Contract Layer / Ponytail / 认知框架 / 知识回流 / 规范绑定 / 全链路漂移检测）|

## 附录 B：竞品威胁时间线评估

| 竞品 | 威胁等级 | 预计时间窗 | 核心威胁 |
|------|---------|-----------|---------|
| Claude Code 原生增强 | 高 | 6-12 个月 | 覆盖正向约束 + 简单门禁 |
| Cursor / Windsurf 垂直整合 | 中 | 3-6 个月 | 交互体验优势吸走个人用户 |
| GitHub Spec Kit 扩张 | 中 | 12-18 个月 | CI/CD 集成 + Copilot 生态绑定 |
| OpenSpec 轻量化迭代 | 低 | 持续 | 中小项目心智占据 |
| DGM/AGP 安全事件 | 低-中 | 不确定 | 监管收紧风冷全局 |
