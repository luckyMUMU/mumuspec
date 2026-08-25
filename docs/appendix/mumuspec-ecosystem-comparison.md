# MumuSpec 项目现状与 AI Agent 生态调研对比分析

> **[研究参考]** 分析基于 2026-07-24 时期的项目状态和竞品格局。
>
> 层级: Level 3 附录

> **最后更新**: 2026-07-24
> **数据来源**: 工作量估算引用 implementation-plan.md,进度数据引用 STATUS.md

> 对比分析报告 · 日期: 2026-07-24 · 版本: MumuSpec 0.10.0-draft · 调研覆盖: 8 个项目 / 5 大方向

基于《AI Coding Agent 生态深度调研报告》覆盖的 8 个标杆项目，从规范驱动、工作流编排、代码图谱、记忆层、多代理编排五大维度，对 MumuSpec 当前设计现状进行系统性对比与差距分析。

## 目录

1. [执行摘要](#执行摘要)
2. [项目定位全景](#项目定位全景)
3. [维度一: 规范驱动开发](#维度一-规范驱动开发)
4. [维度二: 工作流编排](#维度二-工作流编排)
5. [维度三: 代码知识图谱](#维度三-代码知识图谱)
6. [维度四: 记忆与知识层](#维度四-记忆与知识层)
7. [维度五: 多代理编排](#维度五-多代理编排)
8. [MumuSpec 独特创新](#mumuspec-独特创新)
9. [成熟度差距分析](#成熟度差距分析)
10. [战略建议](#战略建议)
11. [参考来源](#参考来源)

---

## 执行摘要

MumuSpec 是一个**树状双向约束规范系统**，定位为 AI 辅助开发的"规范基础设施"。它并非单一方向的工具，而是将调研中多个项目的核心理念——OpenSpec 的规范驱动、Comet 的五阶段编排、Superpowers 的强制工作流、CGC/CBM 的代码图谱、mem0 的持久化记忆——融合为统一的六层架构，并在此基础上有显著创新。

> **核心结论**: MumuSpec 在**设计完备性**上已超越调研中的所有单一项目，是唯一同时覆盖"正向约束 + 反向禁止 + 代码图谱绑定 + 契约管理 + 认知框架 + 跨变更知识积累"的系统。其设计文档体系化程度达到 A 级（全部闭环），架构深度和约束粒度在生态中独一无二。

> **关键风险**: MumuSpec 当前处于**0.10.0 设计草案**阶段，所有 Roadmap 任务标记为未完成。而调研中的 8 个项目均已发布正式版本，平均 Stars 超过 6 万。MumuSpec 面临的最大挑战不是设计深度，而是**从设计到实现的落地速度**和**生态社区建设**。

| 指标 | 数值 |
|------|------|
| 架构层数 | 6 |
| 对标维度 | 5 |
| 独特创新 | 8 |
| Roadmap 完成度 | 0% |

---

## 项目定位全景

调研报告将 AI Coding Agent 生态分为四层：代码理解与记忆层、规范管理层、工程方法论层、多代理编排层。MumuSpec 的独特之处在于**横跨全部四层**，以六层架构覆盖了调研中需要多个项目组合才能实现的能力。

### 架构层次映射

- **多代理编排层**: oh-my-openagent (11 Agent), comet (双星编排) → **MumuSpec Skill 编排器 + Hyperplan 对抗审查**
- **工程方法论层**: superpowers (强制工作流), skills (小而可组合) → **MumuSpec 四大工作流规则 + TDD + 认知框架**
- **规范管理层**: OpenSpec (Spec-Driven) → **MumuSpec Spec Layer (双向约束 + Ponytail)**, **Contract Layer (契约管理)**
- **代码理解与记忆层**: mem0 (AI 记忆层), CGC (多后端图谱), CBM (纯C极致性能) → **MumuSpec Knowledge Layer (图谱+Wiki+PageIndex)**

上图清晰展示了 MumuSpec 的定位策略：**不做单一工具的替代品，而是做整合层**。它在每一层都借鉴了标杆项目的最佳实践，同时通过原生集成解决了项目间"拼接成本高"的问题。

### 定位对比矩阵

| 维度 | 调研项目定位 | MumuSpec 定位 | 关系 |
|------|-------------|---------------|------|
| 规范驱动 | OpenSpec: "先对齐再编码" | 双向约束 + 树状分布 + 渐进式披露 | 增强 |
| 工作流编排 | Comet: OpenSpec WHAT + Superpowers HOW | 五阶段 + 回退 + TDD + 认知框架 + 知识回流 | 增强 |
| 工程方法论 | Superpowers: 强制工作流 + 子代理 | 强制 TDD + Worktree 隔离 + 单一活跃变更 | 借鉴+扩展 |
| 代码图谱 | CGC/CBM: 可查询知识图谱 | 原生集成 + 规范-代码双向绑定 | 增强 |
| 持久化记忆 | mem0: 跨会话记忆层 | Knowledge Layer: LLM-Wiki + PageIndex + 知识提取 | 差异化 |
| 多代理编排 | OmO: 11 Agent 全自主 | Skill 编排器 + Hyperplan 5 角色对抗 | 部分覆盖 |
| 服务契约 | 无项目覆盖 | Contract Layer: 外部 + 对外契约 + 漂移检测 | 独有 |
| 认知框架 | 无项目覆盖 | 乔哈里窗变体 Q1-Q4 + Design 集成 | 独有 |
| 编码约束 | Ponytail (外部引用) | 7 级优先级阶梯 + Spec 注入 + 漂移检测 | 独有 |

---

## 维度一: 规范驱动开发

### 对标项目: OpenSpec (~58k Stars, v1.5.0)

OpenSpec 的核心理念是"先对齐再编码"——通过结构化规范文件让人类和 AI 在写代码前对需求达成共识。其核心概念包括 Specs（真相源）、Change（工作单元）、Delta Specs（差异描述）、Archive（闭环归档）。

### 方式对比

**OpenSpec 的方式**:
- 仅正向约束（SHALL），无反向禁止
- 集中存放 `openspec/specs/`
- 全量加载规范
- 无代码索引/绑定
- 无漂移检测
- 无 CI/CD 集成
- 无默认隔离
- 无 TDD 强制
- "Enablers, not Gates" 哲学

**MumuSpec 的方式**:
- **正向 + 反向**（SHALL + SHALL NOT），每个 SHALL NOT 有可执行检查
- **树状分布**，按目录结构分层存放
- **渐进式披露**，按切入层级加载，Token 减少 ≥60%
- 原生集成代码图谱（GOVERNED_BY 边）
- 自动检测规范与代码漂移（6+ 种类型）
- Pre-commit + CI + Phase Guard 三层校验
- **默认 Worktree 隔离**，物理隔离主分支
- **默认红绿 TDD**，遵循配置（默认 tdd）
- 强制工作流 + 约束守卫兜底

> **关键差异**: MumuSpec 在 OpenSpec 的 Delta Spec 语义基础上，增加了 **SHALL NOT delta**（反向禁止差异）和 **constraints/ 工件**（约束工件目录）。同时将 OpenSpec 的"全量加载"替换为"渐进式披露"——这一改进直接解决了 AI 上下文窗口过载问题，是 MumuSpec 设计中最具工程价值的创新之一。

### Delta Spec 对比

| 特性 | OpenSpec | MumuSpec |
|------|---------|----------|
| 差异类型 | ADDED / MODIFIED / REMOVED | ADDED / MODIFIED / REMOVED + **SHALL NOT delta** |
| 工件结构 | proposal → specs → design → tasks | proposal → **constraints/** → delta-specs → design → **test-cases/** → **cognitive-map.yaml** → **decisions.md** |
| 归档方式 | Delta 合并回主 Spec | Delta 合并 + **知识提取**（D1-D8 子流程） |
| 回退支持 | 无 | **3 种回退路径** + 快照 + 回退计数上限 |

---

## 维度二: 工作流编排

### 对标项目: Comet (~2.4k Stars) + Superpowers (~160k Stars)

Comet 将 OpenSpec（WHAT）和 Superpowers（HOW）串联为五阶段流水线，通过 `.comet.yaml` 状态文件实现可恢复工作流。Superpowers 则提供强制工作流方法论——子代理驱动、两阶段审查、原子任务规划。MumuSpec 在两者的基础上做了深度增强。

### 五阶段流程对比

| 阶段 | Comet | MumuSpec 增强 |
|------|-------|--------------|
| **Open** | 创建提案 + 设计（OpenSpec 领域） | + 影响分析（代码图谱）+ **历史知识加载**（PageIndex）+ 契约加载 + Worktree 创建 |
| **Design** | 头脑风暴 + Spec（Superpowers 领域） | + **认知框架 Q1-Q4**（乔哈里窗变体）+ **Hyperplan 对抗审查** + 测试用例锁定 + Ponytail 约束定义 |
| **Build** | 计划 + 编码（Superpowers 领域） | + **自下向上逐层实现** + 红绿 TDD 强制 + Ponytail 合规检查 + 图谱增量更新 |
| **Verify** | 测试 + 验证（协作领域） | + **6 类漂移检测**（规范/图谱/测试/契约/知识/Ponytail）+ 知识新鲜度验证 |
| **Archive** | 归档 + 同步（OpenSpec 领域） | + **知识提取 D1-D8**（认知地图 → 知识页面）+ git 提交 + MR/PR + 主分支合并 |

### 回退机制对比

**Comet 的回退**:
- 仅 verify-fail 可回退到 build
- 无快照保存
- 无回退计数限制
- 无决策记录

**MumuSpec 的回退**:
- **3 种回退路径**：build→design, verify→design, verify→build
- **回退快照**保存与恢复
- **回退计数上限**（防无限循环）
- **决策记录**追加到 decisions.md（hash 防篡改）
- hotfix/tweak 预设路径（不豁免 TDD）

> **设计亮点**: MumuSpec 的**知识回流闭环**是工作流编排中最有价值的设计——Archive 阶段提取的知识（D1-D8 子流程）会回流到下一个变更的 Open 阶段，形成"变更越多、知识越丰富"的正循环。这在调研的 8 个项目中均未实现。

---

## 维度三: 代码知识图谱

### 对标项目: CodeGraphContext (~35k Stars) + codebase-memory-mcp (~8k Stars)

CGC 和 CBM 代表了代码图谱的两个方向：CGC 追求生态丰富（5 种图数据库后端、23+ 语言、预索引 Bundle），CBM 追求极致性能（纯 C、158 语言、单二进制、120x Token 节省）。MumuSpec 的 Knowledge Layer 将代码图谱作为子组件集成，但定位不同——它不是为了替代 CGC/CBM，而是将图谱能力**绑定到规范和变更生命周期**。

### 图谱能力对比

| 能力 | CGC | CBM | MumuSpec Knowledge Layer |
|------|-----|-----|-------------------------|
| 解析引擎 | Tree-sitter (23+ 语言) | Tree-sitter 纯 C (158 语言) | Tree-sitter (计划中) |
| 存储方案 | 5 种图数据库 | SQLite + 内嵌向量 | SQLite + 图查询层 |
| MCP 工具 | 21 个 | 15 个 | 8+ 个知识工具 (计划中) |
| 语义搜索 | 无内置 | 内置 Nomic 嵌入 | 渐进式知识加载 (按 scope+新鲜度) |
| 规范绑定 | 无 | 无 | **GOVERNED_BY / ENFORCED_BY 边** |
| 契约图谱 | 无 | 无 | **Contract 节点 + CONSUMES/EXPOSES 边** |
| 知识页面 | 无 | 无 | **LLM-Wiki 知识页面 + PageIndex 索引** |
| 变更集成 | 无 | 无 | **8 阶段生命周期集成** |
| 性能 | 中 (Python) | **极高 (纯 C)** | 待验证 (Node.js) |
| 部署复杂度 | 中 (Docker) | **极低 (单二进制)** | 低 (npm 包) |

> **实现差距**: MumuSpec 的代码图谱能力目前**仅存在于设计文档**中（Phase 3 任务全部未完成）。CGC 和 CBM 已经是生产级工具，拥有成熟的 MCP 工具集和性能优化。MumuSpec 在 Phase 3 采用**可插拔后端架构**(默认 CBM、可选 CGC、内置降级),仅需投入约 **6-8 人天**实现 GraphBackendAdapter 与知识页面管理(原 16 人天,改为可插拔后端架构后降低),性能上直接复用 CBM 纯 C 实现。

> **差异化策略**: MumuSpec 不应与 CGC/CBM 在"图谱性能"上竞争，而应聚焦于**"规范-代码双向绑定"**这一独有能力——这是 CGC/CBM 完全不具备的。同时可考虑将 CGC/CBM 作为**可插拔后端**（类似 CGC 的多后端策略），而非自建全套图谱引擎。

---

## 维度四: 记忆与知识层

### 对标项目: mem0 (~60k Stars, YC S24)

mem0 为 AI Agent 提供跨会话的个性化记忆，核心创新包括 ADD-only 提取算法（v3）、多信号融合检索（语义向量 + BM25 + 实体匹配）、时序推理（区分当前/过去/未来）。MumuSpec 的 Knowledge Layer 定位不同——它不是通用记忆层，而是**项目级设计知识的持久化和管理系统**。

### 方式对比

**mem0 的方式**:
- 通用 AI 记忆层，跨项目跨会话
- 从对话中自动提取记忆（ADD-only）
- 多信号融合检索（向量+BM25+实体）
- 时序推理（当前/过去/未来）
- 三档部署：Library → Server → Cloud
- 记忆粒度：用户偏好、事实、事件
- 无代码结构感知
- 无规范关联

**MumuSpec Knowledge Layer**:
- 项目级设计知识，随项目版本管理
- 从变更工件**结构化提取**（D1-D8 子流程）
- 渐进式知识加载（按 scope + 新鲜度筛选）
- 知识状态机：fresh → stale → unverified
- 嵌入 CLI + MCP，无需独立部署
- 知识粒度：决策、模式、风险、设计依据
- **代码图谱双向关联**（graph_bindings）
- **规范关联**（7 种知识边）

### 知识来源三维度

MumuSpec 将知识按 HOW / WHY / WHERE 三个维度管理，形成互补关系：

- **HOW — 代码图谱**: 代码结构、调用关系、依赖链。回答"代码是如何组织的"。对应 CGC/CBM 的能力。
- **WHY — LLM-Wiki**: 设计决策、架构理由、认知过程。回答"为什么这样设计"。从变更工件结构化提取，解决设计知识失忆问题。
- **WHERE — PageIndex**: 知识位置索引、渐进式加载。回答"去哪里找相关知识"。主索引 + 反向索引，按 scope 和新鲜度筛选。

> **独有优势**: MumuSpec 的**"设计知识失忆"解决方案**在调研项目中独一无二——其他项目的知识要么是对话记忆（mem0），要么是代码结构（CGC/CBM），没有项目解决"为什么现有代码是这样设计的"这一核心问题。MumuSpec 通过变更归档时的知识提取（D1-D8）实现了跨变更的知识积累。

---

## 维度五: 多代理编排

### 对标项目: oh-my-openagent (~65k Stars, v4.13.0)

OmO 是调研中唯一的多代理全自主系统——11 个专职 Agent、54+ 生命周期 Hook、Skill > MCP > Tool > Hook 四层架构。MumuSpec 在多代理编排方面采取了**不同的策略**：不追求全自主执行，而是通过 Skill 编排器 + Hyperplan 对抗审查实现"人机协作式"编排。

### 方式对比

**OmO 的方式**:
- **11 个专职 Agent**，通过 team_* 工具协调
- "Agent 是工作者，不是助手"
- 54+ 生命周期 Hook 过程控制
- 六层架构重构（Core/MCP/Skills/Adapters/Platform/Web）
- 反锁定哲学，不绑定单一 AI 供应商
- 全自主执行循环（ulw-loop）
- 7 个月 9,559 次提交（~45 次/天）

**MumuSpec 的方式**:
- **Skill 编排器**（7 个阶段 Skill 文件）
- "MumuSpec 管 WHAT，外部 Skill 管 HOW"
- Phase Guard 守卫 + 约束校验兜底
- 六层架构（Spec/Contract/Change/Knowledge/Guard/AI Integration）
- 开放兼容多 Skill 生态（Superpowers/Agent/Comet/Codex/Custom）
- **人机协作**，阻塞点需用户确认
- **Hyperplan** 5 角色对抗审查

### Hyperplan 对抗式规划

MumuSpec 从 OmO 的 `/hyperplan` 命令提取了对抗式规划理念，但赋予了新的设计：

| 特性 | OmO /hyperplan | MumuSpec Hyperplan |
|------|---------------|-------------------|
| 对抗角色 | 5 个（skeptic/validator/researcher/architect/creative） | 5 个（相同角色，增加 MumuSpec 衔接） |
| 触发条件 | 用户手动调用 | **自动触发**（affected_scopes >= 3 或引入新 SHALL NOT 或 full workflow） |
| 执行流程 | 7 阶段 | 7 阶段（相同，增加 MumuSpec 约束衔接） |
| 幸存洞察处理 | 通用持久化 | **4 类洞察分流**：hard_constraints → SHALL/SHALL NOT；decisions → decisions.md；risks → test-cases；open_questions → 用户门禁 |
| TDD 衔接 | 无 | **test-cases 基于幸存硬约束设计**，risks 须有对应验证用例 |
| 降级策略 | 无 | researcher 不可用时降级为 4 角色团队 |

> **定位差异**: MumuSpec 和 OmO 代表了两种不同的 AI 编程哲学：OmO 追求**全自主**（人类只发起任务），MumuSpec 追求**强约束下的人机协作**（人类在关键节点保留控制权）。两者并非竞争关系——MumuSpec 的 Skill Bridge 可以与 OmO 的 Skill 生态互操作。

---

## MumuSpec 独特创新

以下 8 项创新在调研的 8 个项目中均未实现，是 MumuSpec 的核心竞争力：

1. **双向约束体系**: SHALL（正向要求）+ SHALL NOT（反向禁止），每个 SHALL NOT 都有可执行 Enforcement 检查。其他项目仅有正向约束。

2. **树状分布 + 渐进式披露**: 规范按目录树分层存放，按切入层级加载。Token 消耗较全量加载减少 ≥60%，解决上下文窗口过载问题。

3. **Contract Layer 契约层**: 外部服务契约 + 自身对外契约，自动派生约束注入 spec.md，6 类契约漂移检测。无项目覆盖此领域。

4. **Ponytail 编码约束**: 7 级优先级阶梯（YAGNI→复用→标准库→平台特性→已有依赖→一行代码→最小实现），自动注入根层 spec.md，漂移检测。

5. **认知框架（乔哈里窗变体）**: Q1-Q4 四象限认知：已知已知→已知未知→未知已知→未知未知。集成到 Design 阶段 Step 0，与 Hyperplan 形成反馈循环。

6. **知识回流闭环**: Archive 阶段 D1-D8 知识提取子流程，将认知地图和决策记录转化为持久化知识页面，回流到下一变更的 Open 阶段。

7. **规范-代码双向绑定**: GOVERNED_BY / ENFORCED_BY 图谱边，将规范约束直接绑定到代码节点。CGC/CBM 仅做代码索引，无规范关联。

8. **全链路漂移检测**: 12 种漂移类型：规范漂移、图谱漂移、测试不可变性漂移、契约漂移（6 类）、知识漂移（4 类）、Ponytail 漂移。

---

## 成熟度差距分析

设计完备性与实现成熟度是两个维度。MumuSpec 在设计上达到 A 级闭环，但在实现上仍处于早期阶段。以下从多个维度对比成熟度差距：

### 关键指标对比

| 指标 | 调研项目平均 | MumuSpec | 差距 |
|------|------------|---------|------|
| Stars | ~61k | 0 (未公开) | 巨大差距 |
| 版本 | v1.0+ 正式版 | 0.10.0-draft | 设计阶段 |
| 提交数 | ~2,500+ | 初始提交 | 起步阶段 |
| 架构层数 | 1-2 层 | 6 层 | 领先 |
| 约束类型 | 仅 SHALL | SHALL + SHALL NOT + Ponytail | 领先 |
| 漂移检测类型 | 0 种 | 12 种 | 领先 |
| 知识管理 | 无 / 通用记忆 | 三层知识体系 | 领先 |
| 文档体系化 | 中（README + Wiki） | A 级闭环（6 层 × 8 能力） | 领先 |
| Roadmap 完成度 | ~80% (已发布) | 0% (全部待实现) | 巨大差距 |
| 多平台支持 | 10-29 个平台 | 设计阶段（计划 4+ 平台） | 待实现 |

### 实现进度评估

**实现进度**: 0%（设计完备性 100%，实现进度 0%）

> 详细进度数据请参见 [STATUS.md](../STATUS.md) §能力层进度表。本文件不再重复描述具体进度数字，统一引用 STATUS.md 作为权威来源。

| 能力层 | 设计完备性 | 实现进度 | 备注 |
|-------|-----------|---------|------|
| （全部 8 层） | 100% | 0% | 详见 STATUS.md |

> 本表数据引用自 [STATUS.md](../STATUS.md)，为唯一权威来源。

> **最大风险**: MumuSpec 已有的代码实现主要集中在 **Spec 解析、变更管理、基础检查** 等 Phase 1-2 任务。Phase 3-5 的核心能力（代码图谱、MCP Server、CI/CD 集成、契约管理、知识提取）基本未开始。**工作量估算**: 80-85 人天（基于 [implementation-plan.md](../implementation-plan.md) 详细估算），在 2 人并行的情况下约需 **2.5 个月**。设计文档的深度反而可能成为"过度设计"的风险——如果实现跟不上设计的复杂度。

---

## 战略建议

### 1. 优先实现 MVP，验证核心价值

建议**立即启动 Phase 1 的 P0 任务**（规范格式定义、加载引擎、CLI 核心命令），在 3 个真实项目中验证"树状双向约束 + 渐进式披露"的核心价值。不要等待全部设计完善后再开始实现——设计已经足够成熟，需要在实践中验证假设。**总工作量估算: 80-85 人天（基于 [implementation-plan.md](../implementation-plan.md) 详细估算）**,在 2 人并行的情况下约需 2.5 个月完成全部 5 个 Phase。

### 2. 代码图谱采用"集成而非自建"策略

考虑到 CGC 和 CBM 已在代码图谱领域建立了成熟方案，建议 MumuSpec 的 Knowledge Layer 采用**可插拔后端策略**——将 CBM（极致性能）或 CGC（多后端灵活性）作为图谱引擎后端，MumuSpec 专注于**规范-代码绑定**和**知识页面管理**这一独有价值层。这可以节省约 8-10 人天的图谱引擎开发，并直接获得生产级性能。

### 3. 建立"设计-实现"反馈循环

MumuSpec 当前的设计文档已经非常详细（6 层架构、8 个能力闭环），但存在**"过度设计"风险**。建议在实现过程中严格执行"先实现核心路径、后补全边界条件"的原则，将认知框架、Hyperplan、契约层等高级特性推迟到 Phase 2-3，确保 Phase 1 的 MVP 能快速验证市场。

### 4. 开源社区策略

| 策略 | 具体行动 | 优先级 |
|------|---------|--------|
| 差异化定位 | 强调"唯一的双向约束规范系统"定位，不与 OpenSpec/Comet 直接竞争 | P0 |
| 兼容而非替代 | Skill Bridge 兼容 Superpowers/OpenSpec/Comet 生态，降低迁移成本 | P1 |
| 文档先行 | 将现有设计文档作为"规范驱动开发"的最佳实践案例推广 | P1 |
| 示例项目 | 提供 3 个不同规模的示例项目（小型/中型/大型），展示渐进式披露效果 | P2 |
| 与 mem0 互补 | 探索与 mem0 的集成——mem0 管通用记忆，MumuSpec 管项目知识 | P2 |

### 5. 分阶段发布路线

| 里程碑 | 时间 | 交付物 | 验证目标 |
|--------|------|--------|---------|
| M1 — MVP 内测 | T+3 周 | Phase 1 完成：树状规范 + 双向约束 + CLI + Ponytail | 3 个项目验证渐进式披露效果 |
| M2 — 变更管理 | T+5 周 | Phase 2 完成：五阶段流程 + TDD + 状态机 + 回退 | 完整变更生命周期可用 |
| M3 — 图谱集成 | T+7 周 | Phase 3 完成：代码图谱 + 规范绑定 + MCP Server | 10 万文件图谱可用（或集成 CBM） |
| M4 — CI/CD 就绪 | T+9 周 | Phase 4 完成：漂移检测 + 知识提取 + 文档生成 | 全链路自动化校验 |
| M5 — 公开发布 | T+11 周 | Phase 5 完成：npm 包 + 多平台 Skill + 模板库 | 新用户 30min 完成首个变更 |

> **总结**: MumuSpec 拥有**生态中最深的设计**和**最多的独创能力**，但面临从设计到实现的巨大落地挑战。核心策略应是：**快速发布 MVP 验证核心价值 → 通过 Skill Bridge 兼容现有生态 → 以"双向约束 + 渐进式披露 + 知识回流"三大独有能力建立差异化壁垒**。不需要在所有维度都超越调研项目，而应在"规范-代码一致性"这一无人覆盖的领域做到最好。

---

## 参考来源

1. **AI Coding Agent 生态深度调研报告**。覆盖 Skills 工程化、规范驱动开发、记忆层、代码图谱、多代理编排五大方向，解析 8 个标杆项目。用户上传文档: `ai-agent-ecosystem-research.md`

2. **MumuSpec 全局概览 (overview.md)**。版本 0.10.0-draft，包含目标用户画像、问题陈述、量化目标、三大设计支柱、四大工作流规则、总体架构图。项目文档: `../overview.md`

3. **MumuSpec 实现计划 (implementation-plan.md)**。包含能力体系化评估矩阵、与 OpenSpec/Comet 对齐分析、Phase 1-5 任务分解。项目文档: `../implementation-plan.md`

4. **MumuSpec 与参考项目对比 (comparison.md)**。核心差异表、借鉴与增强矩阵、技术选型建议。项目文档: `./comparison.md`

5. **MumuSpec 实施路线图 (roadmap.md)**。Phase 1-5 实施计划、DoD 验收标准、资源需求、工作量估算。项目文档: `./roadmap.md`

6. **MumuSpec Skill 生态参考 (skill-ecosystem.md)**。阶段-Skill 映射表、Skill 分发协议、Hyperplan 对抗式规划、Skill 矩阵。项目文档: `../reference/skill-ecosystem.md`

7. **MumuSpec AI 集成层设计 (ai-integration.md)**。原生 Skill 编排器、外部 Skill 生态兼容、Rules 文件生成、MCP Server。项目文档: `../design/ai-integration.md`

8. **MumuSpec 源代码**。CLI 实现 (`src/cli.ts`)、核心模块 (`src/index.ts`)、`package.json` 依赖配置。项目源码: `src/`
