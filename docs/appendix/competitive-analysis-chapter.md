# 竞品分析报告

> **[研究参考]** 竞品分析章节（2026-08 时期）。

## 1. SDD 框架赛道深度分析

### 1.1 OpenSpec（Fission AI）

OpenSpec 是一款以 artifact 驱动的轻量规范框架，以 npm 包 + slash 命令的形式分发。其核心价值主张是将规范（spec）与具体实现 artifact（代码片段、配置文件、prompt）直接绑定，通过 artifact 的版本化实现规范的追踪与迭代。

**设计哲学对比：**

| 维度 | OpenSpec | MumuSpec |
|------|----------|----------|
| 规范形态 | Artifact 绑定（code-level artifact） | 树状双向约束（What-How 分离） |
| 迭代模式 | 自由迭代，无强制阶段门禁 | 五阶段 + Loop 双模式 |
| 约束机制 | 弱约束，依赖 LLM 自觉 | SHALL/SHALL NOT + Guard Layer 兜底 |
| 生态开放 | slash 命令自主注册 | Skill 生态 + MCP Server 标准化 |

OpenSpec 的优势在于极低的上手成本和轻量迭代速度，适合中小项目和快速原型阶段。然而，artifact 绑定模式在项目规模增长后会导致规范与实现之间的耦合加剧——artifact 变更后规范同步依赖人工自觉，缺乏自动漂移检测机制。MumuSpec 的 BOUNDARY.md + Contract Drift Detection 体系在此维度提供了更严谨的工程保障，但代价是更高的认知负荷和初始化开销。

### 1.2 Spec Kit（GitHub 官方）

Spec Kit 是 GitHub 官方出品的重型规范框架，以 Python CLI 形态分发。其核心概念 "Constitution" 定义了项目不可违背的底层宪法，所有阶段门禁（phase gate）必须满足 Constitution 才能推进。

**设计哲学对比：**

| 维度 | Spec Kit | MumuSpec |
|------|----------|----------|
| 底层约束 | Constitution（单一宪法文件） | 多维度 Strength Field（TD/RG 双向树） |
| 门禁类型 | 强阶段门禁（硬性阻塞） | 动态强度调整（low/medium/high → info/warn/block） |
| 语言栈 | Python | TypeScript |
| 用户自由度 | 低（锁定工作流） | 高（worktree isolation 可降级） |

Spec Kit 的 Constitution 思路与 MumuSpec 的 `prohibitions.md` 和 `BUILTIN_CONSTRAINT_EXCEPTIONS`（`always_enforce: true`）机制在概念上收敛——两者都承认有些规则不可降级。但 MumuSpec 引入了更精细的强度梯度：通过 `ConstraintStrengthField` 和 `STRENGTH_ACTION_MAP`，使同一条约束在 high 强度下 block、medium 强度下 warn、low 强度下 info。这种设计兼顾了严格场景（CI/CD 合入门禁）和探索场景（原型期快速迭代）。

Spec Kit 的劣势在于 Python CLI 形态限制了前端/全栈开发者的使用意愿，且强阶段门禁在自进化场景（Loop 模式）中会产生大量中断等待。

### 1.3 Kiro（AWS）

Kiro 是 AWS 出品的独立 IDE（基于 VS Code OSS），最大特征是锁死 Claude 模型作为底层推理引擎，提供 "Vibe" 和 "Spec" 双模式切换。

**设计哲学对比：**

| 维度 | Kiro | MumuSpec |
|------|------|----------|
| 形态 | 独立 IDE（VS Code OSS 分支） | CLI + MCP Server（IDE 无关） |
| 模型绑定 | 强制 Claude | 模型无关（Skill 协议驱动） |
| 工作流 | Vibe（自由对话）+ Spec（结构化） | 五阶段 + Loop |
| 扩展性 | 封闭生态 | 开放 Skill 协议 |

Kiro 的 IDE 集成带来了更优的交互体验（可视化 diff、内联 spec 预览），但模型绑定和封闭生态构成了显著的 vendor lock-in 风险。MumuSpec 选择 CLI + MCP Server 路线的决策是刻意的：通过 MCP 标准协议解耦工具与模型，使同一套规范系统可以在 Claude Code、Cursor、OpenCode、Kiro 等多种 agent 前端下运行。这种 "harness-first" 定位使 MumuSpec 具有更强的可移植性。

---

## 2. Harness/Methodology 生态分析

### 2.1 Superpowers（Jesse Vincent / obra）

Superpowers 拥有约 170k GitHub Stars，是 AI 编程方法论领域影响力最大的项目之一。其核心理念 "Process over Prompt" 强调：与其精心设计单个 prompt，不如构建可复用的 process skill。项目内置 14 个 process skill，覆盖从需求澄清到代码审查的完整工作流。

**关键差异：**

Superpowers 本质上是一个 **prompt 模板库 + 方法论指南**，其 skill 是静态的 markdown 文档，不包含 runtime 校验逻辑。MumuSpec 的 skill 体系（`skill-authoring/protocol.ts`）虽然同样以 markdown（SKILL.md）为核心，但引入了三层运行时保障：

1. **Guard Layer**：每个阶段转换前必须通过 phase guard 检查（`guard/checker.ts`），而非依赖 LLM 自觉遵循指南
2. **Contract Drift Detection**：`detectContractGuardDrift()` 持续监控规范与代码的一致性
3. **Decision Audit**：所有变更决策写入 `decisions.md` 并 hash 校验，防止事后篡改

这种 "方法论 + 自动化校验" 的组合使 MumuSpec 在执行层面比 Superpowers 有更低的 drift 风险，但也引入了更高的维护成本——Superpowers 用户只需复制 markdown 文件即可使用，而 MumuSpec 用户需要理解 config.yaml、strength field、contract registry 等机制。

### 2.2 BMad-Method

BMad-Method 采用 9 个专职 sub-agent 的编排模式，每个 sub-agent 对应一个角色（Architect、PM、Developer、Tester 等）。其核心理念是通过角色分工实现工作流的流水线化。

**与 MumuSpec 的对比：**

BMad 的 sub-agent 编排在概念上与 MumuSpec 的 Skill 系统有相似性——两者都试图将复杂任务分解为可复用的 role/skill。但实现路径截然不同：

- BMad：通过 prompt engineering 定义 sub-agent 的行为，无 runtime 约束
- MumuSpec：Skill 协议 + Guard Layer + Contract 系统，runtime 可校验

MumuSpec 的 Loop 模式实际上提供了一种替代多 sub-agent 编排的方案：单一 agent 通过 Plan→Act→Evaluate 循环逐步收窄解空间，配合 worktree 隔离实现并行探索。这种 "单 agent 迭代" 模式在简单场景中更高效，但在需要多视角交叉验证的复杂架构决策中，BMad 的多角色并行推理可能更有优势。

### 2.3 GSD（Get Stuff Done）

GSD 提供 50+ slash 命令和带状态的 workflow 系统，以 "零规范依赖" 为卖点——用户不需要写 spec 文件即可使用。

GSD 的设计哲学与 MumuSpec 形成鲜明对比：GSD 主张规范应该隐式存在于命令行为中，而 MumuSpec 主张规范必须显式文档化且可追溯。这种分歧反映了对 "规范成本" 的不同判断：GSD 认为显式规范的编写成本高于其收益，MumuSpec 则认为缺乏显式规范的 AI 编程在规模化后必然产生 drift 和不可预测性。

从 MumuSpec 的实现来看，其五阶段 + Loop 双模式实际上是为不同成熟度场景提供了梯度选择：探索性任务使用 Loop 模式（最小规范，快速迭代），生产级变更使用五阶段模式（完整规范门禁）。这种分层策略部分弥合了两极之间的张力。

---

## 3. 元进化/自进化系统技术分析

### 3.1 Darwin Gödel Machine（DGM）

DGM 由 Sakana AI 与 UBC 联合开发，核心机制是开放式进化 + 经验验证替代形式证明。其在 SWE-bench 上的表现从 基线 20% 提升至 50%（ICLR 2026），证明了 "试错进化" 路线的有效性。

**与 MumuSpec Loop 模式的对比：**

| 维度 | DGM | MumuSpec Loop |
|------|-----|---------------|
| 进化粒度 | 代码片段/算法级别 | Change 任务级别 |
| 选择机制 | 经验验证（pass/fail + benchmark） | `LoopEvaluation.progress` + `goal_achieved` |
| 多样性维持 | 种群级多样性保持 | Worktree 隔离（单 change 单 worktree） |
| 收敛条件 | 无固定阈值（持续进化） | `CONVERGENCE_THRESHOLD = 0.85` + `STAGNATION_LIMIT` |

DGM 的种群级进化机制比 MumuSpec 的单 change 迭代更强，但工程实现复杂度也高出数个量级。MumuSpec 的 Loop 模式（`loop-engine.ts`）是一个务实的折中：通过 `detectStagnation()` 检测收敛停滞，通过 `STAGNATION_LIMIT = 2` 决定是否提前终止交互，本质上是一种 "受限进化"。

### 3.2 HyperAgents（DGM-H）

HyperAgents 引入元认知自我修改（metacognitive self-modification）机制——agent 不仅能修改解决方案代码，还能修改自身的改进策略（"改进改进机制本身"）。

这一能力在当前 MumuSpec 架构中并不直接存在，但 MumuSpec 的 `self-improve-loop` 变更记录（位于 `.mumuspec/changes/self-improve-loop/`）展现了一个有趣的中间态：MumuSpec 使用自身的 Loop 模式来改进自身的规范体系。具体而言，self-improve-loop 变更通过自身的 Plan→Act→Evaluate 循环来发现并修复 Guard Layer 的不足，最终生成了 `new-shall.md` 和 `new-shall-not.md`。

这是一种 "弱元进化"：agent 不直接修改自身的推理机制（Schmidhuber 意义上的 Gödel Machine 不可实现），但通过改变规范约束间接地影响后续推理行为。该路径在工程上更可审计（每个规范变更都有 commit hash 和 audit log 可追溯），且具有明确的人工监督边界。

### 3.3 Autogenesis Protocol（AGP）

AGP 提出双层协议架构：RSPL（资源基底协议）定义资源分配与安全边界，SEPL（自进化协议）定义进化规则。其产物 Autogenesis System（AGS）实现了持续在线进化。

MumuSpec 的 Contract 系统（`impact-analyzer.ts` + `validator.ts`）在功能上部分映射了 RSPL 的安全边界角色：`analyzeContractImpact()` 在执行任何契约变更前必须评估 upstream/downstream 影响，并提供明确的风险评级和 mitigation 建议。然而，MumuSpec 缺乏 SEPL 层的自动化进化循环——所有契约变更必须经过用户明确确认（AGENTS.md Step 2 硬性要求），不支持自主进化。

这是一个有意的保守选择：AGP 的持续在线进化在 SWE-bench 等基准测试上表现优异，但在生产代码场景中可能引入不可控的契约漂移风险。MumuSpec 的 "用户确认门" 设计牺牲了进化速度，换取了对关键契约变更的可控性。

### 3.4 VeriLoop Coder-E1

VeriLoop 采用 PEFT（参数高效微调）+ Self-Harness 循证螺旋的组合策略，在窄域任务上通过微调获得显著提升。其 "循证螺旋" 概念与 MumuSpec 的 Loop 模式高度相似：两者都是 "执行→评估→改进→再执行" 的迭代结构。

关键差异在于 VeriLoop 结合了模型微调（改变底层能力），而 MumuSpec 仅改变 harness 层配置（改变执行策略）。这使得 VeriLoop 在窄域任务上可能获得更高的效率上限，但 MumuSpec 方案具有跨模型可移植性——同一套 Loop 逻辑可以在 Claude、GPT、Gemini 等不同模型上运行，无需重新微调。

---

## 4. 理论演进脉络：Prompt → Context → Harness → Loop → Graph

### 4.1 五层能力栈

AI 编程工具的能力演进可以归纳为五个层级，每层依赖前一层的基础：

```
┌─────────────────────────────────────────────────┐
│ Layer 5: Graph Engineering                       │
│  多 Agent 协同编排 (BMad, AutoGen)               │
├─────────────────────────────────────────────────┤
│ Layer 4: Loop Engineering                        │
│  Plan→Act→Evaluate 迭代循环 (MumuSpec Loop,     │
│  VeriLoop)                                      │
├─────────────────────────────────────────────────┤
│ Layer 3: Harness Engineering                     │
│  Agent = Model + Harness, 可靠性工程             │
│  (MumuSpec Guard Layer, Spec Kit)               │
├─────────────────────────────────────────────────┤
│ Layer 2: Context Engineering                     │
│  知识注入, RAG, spec loading (MumuSpec Knowledge │
│  Layer, Index.yaml)                             │
├─────────────────────────────────────────────────┤
│ Layer 1: Prompt Engineering                      │
│  单 prompt 技巧 (Chain-of-thought, few-shot)     │
└─────────────────────────────────────────────────┘
```

### 4.2 各层的技术内涵

**Layer 1 - Prompt Engineering：** 最早的 AI 编程交互形式。弱点在于单次上下文窗口有限，无法承载复杂项目的全部信息。

**Layer 2 - Context Engineering：** 通过外部知识源扩展 AI 的认知边界。MumuSpec 的知识层（`knowledge/` 模块 + `_index.yaml` + `_reverse-index.yaml`）实现了渐进式知识加载（`getKnowledgeContext()` + `max_pages_per_layer`）：只在需要时加载与当前路径相关的知识，避免上下文爆炸。

**Layer 3 - Harness Engineering：** 认识到 AI agent 的可靠性不仅取决于模型能力，更取决于执行框架（harness）的设计。MumuSpec 的 Guard Layer（`guard/checker.ts`）是最典型的 Harness Engineering 实践：通过 `applyStrengthToGuardResult()` 将所有 SHALL/SHALL NOT 约束按项目当前强度分级执行，实现了 "同一个项目在不同成熟度阶段有不同严格程度" 的灵活性。

**Layer 4 - Loop Engineering：** 引入迭代反馈机制，使 AI 可以通过多轮执行逐步逼近目标。MumuSpec 的 Loop Engine（`loop-engine.ts`）提供了 `convergence_criteria`（收敛条件）、`stagnation detection`（停滞检测）、`auto round commit`（每轮自动提交）等 Loop 原语，但收敛判断仍依赖人工输入 `LoopEvaluation`，而非自动化的 benchmark 评估。

**Layer 5 - Graph Engineering：** 多 agent 协同，将复杂任务分解为有向无环图（DAG）中的节点。BMad 的 9 sub-agent 编排和 AutoGen 的多 agent 对话都属于此层。MumuSpec 当前未实现 Graph 层能力（BMad-Method 的分析中提到多角色并行验证的优势），这是一个明确的扩展方向。

### 4.3 MumuSpec 在五层栈中的覆盖度

| 层级 | MumuSpec 覆盖度 | 证据 |
|------|-----------------|------|
| Prompt | 部分 | Skill 协议包含 prompt 模板 |
| Context | 完整 | Knowledge Layer + progressive disclosure + reverse index |
| Harness | 完整 | Guard Layer + Constraint Strength + BUILTIN_CONSTRAINT_EXCEPTIONS |
| Loop | 基本完整 | Loop Engine + worktree isolation + auto commit (缺自动化评估) |
| Graph | 未实现 | 无多 agent 并行编排能力 |

MumuSpec 在 L1-L3 的覆盖度较高，L4 缺少自动化评估（依赖人工 `LoopEvaluation`），L5 为空白。这与 "规范驱动 + 人工确认" 的设计哲学一致：系统优先保障可控性而非自主性。

---

## 5. MumuSpec 差异化定位与 SWOT 分析

### 5.1 差异化定位

MumuSpec 在竞品生态中的独特定位是 **"规范可靠性工程平台"**。这一定位区别于：

- **OpenSpec / Spec-Kit**：它们是规范管理工具（spec as artifact），MumuSpec 是规范执行平台（spec as runtime constraint）
- **Superpowers / GSD**：它们是方法论与方法 prompt 库（process as documentation），MumuSpec 是方法论自动化引擎（process as executable guard）
- **DGM / HyperAgents / AGP**：它们追求最大化自主进化（autonomous evolution），MumuSpec 追求可控进化（human-in-the-loop evolution）

### 5.2 核心优势（Strengths）

**1. 动态强度分级系统**
MumuSpec 独创的 ConstraintStrengthField + STRENGTH_ACTION_MAP 允许同一套约束在不同强度级别产生不同行为（info/warn/block）。这解决了 "严格 vs 灵活" 的零和博弈——其他框架必须在两者之间二选一。实际实现上（`constraint-evaluator.ts`），通过 `evaluateConstraint()` 的四级优先级（always_enforce → workflow override → capability override → strength-based）实现了精细控制。

**2. 双向约束验证**
SHALL/SHALL NOT 的二元约束机制（在 `prohibitions.md` 和 `AGENTS.md` 中定义）配合 `checkCompliance()` 的三类检查（shall / shallNot / ponytail），实现了 "正向必须做到" 和 "负向绝对不能做" 同时兜底。这在竞品中是较为少见的——多数框架仅提供正向约束。

**3. 契约漂移检测**
`detectDriftWithContracts()` 组合了 spec drift（规范声明了但代码未实现）和 contract drift（契约在目录间被破坏）的双重检测。这一能力在微服务/多模块项目中具有直接的生产价值，目前竞品中尚未见到等效实现。

**4. 模型无关架构**
通过 MCP Server 作为抽象层，MumuSpec 不绑定任何特定 LLM。这与 Kiro（锁死 Claude）形成鲜明对比，在当前模型快速迭代的背景下，这是一个具有前瞻性的架构决策。

### 5.3 主要劣势（Weaknesses）

**1. 认知负荷与学习曲线**
MumuSpec 引入了大量专有概念：Strength Field、ConstraintDimension、BOUNDARY.md、Contract Registry、Loop Engine、Knowledge Page、Ponytail Ladder、Top-Down/Bottom-Up 混合范式等。对于新用户，理解这些概念的门槛显著高于 Superpowers（复制 markdown 即可用）或 GSD（无需写 spec）。这限制了 MumuSpec 在小型项目和个人开发者中的采用率。

**2. 验证自动化不足**
Loop 模式的收敛判断依赖人工输入 `LoopEvaluation.progress` 和 `goal_achieved`，缺乏 DGM 式的自动化 benchmark 评估。这意味着 Loop 模式的收敛完全取决于用户的主观判断，在复杂任务中可能出现"虚假收敛"（用户误判为已完成）或"过度迭代"（用户未识别到已收敛）。

**3. 无多 Agent 编排（Graph 层缺失）**
当变更涉及多个需要并行验证的子系统时（如同时修改 API 契约、数据库 schema、前端组件），MumuSpec 当前只能通过顺序执行或单次人工确认来实现。缺乏 BMad 式多角色并行推理能力，在处理高并发变更时效率较低。

**4. Guard 实现层面的粗糙之处**
Guard Layer 的核心检测逻辑（`checkProhibitionViolation()`）大量依赖正则模式匹配而非 AST 分析。对于简单场景（"禁止 import react"）有效，但对于复杂语义约束（"禁止使用可变状态"）则力不从心。这限制了其在前端框架约束、设计模式约束等高层语义场景中的应用。

### 5.4 外部机会（Opportunities）

**1. MCP 协议生态扩张**
随着 MCP 成为 AI 工具互操作的标准协议，MumuSpec 作为早期 MCP Server 实现者（`mcp-server.ts`），有机会成为 MCP 生态中的规范基础设施层。如果更多 AI 工具（IDE、CLI）采纳 MCP，MumuSpec 的 Guard Layer 可以被第三方工具复用。

**2. 企业级合规需求增长**
金融、医疗、航空等行业的 AI 编程合规需求正在增长。MumuSpec 的契约审计（`audit.log`）、decision hash 校验、contract impact analysis 等能力天然适配合规审计场景，可以探索从开发者工具向合规平台的延展。

**3. 自进化能力集成**
MumuSpec 的 self-improve-loop 变更证明了 "用自身进化自身" 的可行性。如果能将 DGM 式的自动化评估（用 benchmark 替代人工 LoopEvaluation）集成到 Loop Engine 中，MumuSpec 的 Loop 模式将从 "人类辅助的迭代" 升级为 "自动化的收敛搜索"。

### 5.5 外部威胁（Threats）

**1. Claude Code 的原生增强**
Anthropic 持续为 Claude Code 增加原生结构化输出、工具调用和上下文管理能力。随着 Claude Code 内置能力的增强，外部框架（包括 MumuSpec）的存在价值可能被压缩——如果模型本身已经足够可靠，额外的 Guard Layer 就成为 overhead。

**2. IDE 厂商的垂直整合**
Cursor、Kiro、Windsurf 等 IDE 正在将 AI 交互能力直接集成到编辑器中，提供比 CLI 工具更优的交互体验（可视化 diff、内联 preview、实时 spec 渲染）。MumuSpec 的 CLI-first 策略可能在用户体验维度被 IDE-native 工具超越。

**3. 标准化竞争**
如果 OpenAI、GitHub 等大厂推出事实上的 SDD 标准（如 GitHub Spec Kit 扩大影响力），MumuSpec 的专有格式（BOUNDARY.md、prohibitions.md、config.yaml）可能面临互操作性问题。

---

## 6. 总结

MumuSpec 是一款在 **规范可靠性工程** 维度具有独特定位的开源框架。其核心贡献不是引入了全新的方法论概念，而是将已有的 SHALL/SHALL NOT 约束、契约漂移检测、强度分级等理念工程化为一组可执行的 runtime 保障机制。在 AI 编程从 "prompt 走向 harness" 的大趋势下，MumuSpec 的 Guard Layer + Contract 系统提供了其他竞品尚未覆盖的底层可靠性基础设施。

但其竞争力也面临挑战：认知负荷过高限制了用户规模增长，验证自动化不足制约了 Loop 模式的效率上限，IDE-native 竞品的交互体验优势日益明显。MumuSpec 的未来发展取决于能否在保持规范严谨性的同时降低使用门槛——这是一个典型的 "可靠性 vs 易用性" 工程权衡，也是整个 SDD 赛道需要共同回答的核心问题。
