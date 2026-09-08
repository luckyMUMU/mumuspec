---
scope: .
layer: 0
last_updated: '2026-09-05'
---

# 产品需求概览: MumuSpec

## 产品定位

MumuSpec 是一门**面向 Vibe Coding 的领域特定语言（DSL）**。你用自然语言编写 Spec（规范），MumuSpec 把它校验为可执行的约束网络，AI 编程工具根据约束自动生成代码。

```
随意的自然语言  →  大模型起草精准 Spec  ⇄  设计缺陷时向人追问补全  →  大模型判定设计完备性（人签收）  →  代码（AI 生成）
```

核心不变量：

- **设计决策权始终在人** — 人不再逐字编写 Spec 全文，只做设计决策与审批签收；Spec 由大模型起草、追问补全、判定完备性后交由 AI 生成代码。Spec 仍是一等源文件（人机合著），代码是衍生品
- **Spec 即一等源文件（Spec-as-Source，KP-0059）** — Spec 不是文档或配置，而是带有语法、语义和诊断器的可执行 DSL；可读性、可写性与诊断质量是语言设计的一等约束
- **双向约束（Dual Constraint）** — SHALL 指明必达目标，SHALL NOT 划定不可逾越红线；约束关联 Enforcement 条目自动校验，**不可验证的约束等于不存在的约束**（0.20 E-SPEC-015）
- **树状分布 + 渐进式披露（Tree Progressive）** — Spec 按项目目录树分层存放，子层自动继承父层约束（可收紧、不可放宽）；AI 只加载当前工作目录的规范链，降低 token 消耗
- **持久化 + 代码绑定（Code-Bound）** — Spec 存储在 `.mumuspec/` 下，版本化管理，不随代码删除而消失；漂移检测覆盖 spec、graph、contract、knowledge 等维度
- **双维度动态约束强度（Dynamic Constraint Strength）** — 沿"技术设计 HOW"与"需求目标 WHAT"两条独立轴线组织约束，每轴独立配置 high / medium / low 强度，工作流规则按强度等级渐进式调整
- **为目标增加限制，但不限制过程（CHG-5）** — Spec 只约束 WHAT（验收标准、红线），不约束 HOW（执行路径）；AI 的执行自由度不被限制，但产出必须通过 Spec 校验
- **规则-实现分离（KP-0060）** — 引擎归代码（固定部分由代码实现）、规则归 LLM（仅创建声明式规则）、校验归代码（非法规则拒绝执行）；CLI-first 是其在流程层的特例

## 核心能力

| 能力 | 说明 |
|------|------|
| **Spec 语法与语义** | `## Requirement:` 块 + `### SHALL / SHALL NOT` 极性声明 + `### Enforcement` 验证声明；极性（SHALL × SHALL NOT）× 维度（HOW × WHAT）× 强度（high / medium / low）三面语义 |
| **可验证性四分类** | enforced-strong（annotation → AST）/ enforced-weak（正则兜底）/ manual（人工验证，归档前须有 evidence）/ unverifiable（格式缺陷，SHALL NOT 恒 block）；`E-SPEC-*` 错误码即编译诊断 |
| **Spec 树** | 按目录分层存放 Spec，子层继承父层、可收紧不可放宽 |
| **渐进式披露** | AI 只加载当前工作目录的规范链，减少 token 消耗 |
| **变更生命周期** | Open → Design → Build → Verify → Archive 五阶段管理，支持 hotfix / tweak 预设路径（自动检测升级条件）与回退 |
| **Phase Guard** | 阶段转换时自动执行的校验门禁；测试套件 hash 锁定（0.20） |
| **红绿 TDD + 核心规则** | Worktree 隔离、单一活跃变更、自顶向下设计自底向上实现、测试用例 Design 锁定后不可变更 |
| **动态约束强度** | high / medium / low 三档，按团队成熟度动态调整工作流严格度 |
| **Ponytail 编码约束** | 7 级优先级阶梯（YAGNI → 复用 → 标准库 → 平台特性 → 已有依赖 → 一行代码 → 最小实现），内建到规范体系 |
| **Skills 编排** | 阶段编排器，自动感知当前阶段并分发子 Skill（TDD / Code Review 等） |
| **Workflow 外化 + 项目级 override** | 阶段状态机以声明式 YAML 定义（workflow.default.yaml 单一事实源）；`.mumuspec/workflow.yaml` 项目级覆盖未声明字段回落内置默认（CHG-7） |
| **CLI-first 流程载体** | 确定性工作流步骤（阶段转换、guard 校验、hash 锁定、决策登记）必须经 CLI 执行；LLM 只承担需求澄清、设计创作、对抗审查等复杂决策域 |
| **MCP Server** | 提供 30+ 工具接口供 AI 调用（spec context / compliance / drift / guard / knowledge 等） |
| **Rules 文件生成** | AGENTS.md 为唯一 canonical 规则文件（AAIF 托管事实标准），CLAUDE.md / GEMINI.md 薄壳桥接；10 agent 安装器，遗留格式 `.cursorrules` / `.windsurfrules` 已停止生成 |
| **知识层** | 知识上下文 / 检索 / 问答（chat）、影响分析、新手引导（onboard）、知识覆盖率与缺口发现 |

## 用户旅程

```
npm install -g mumuspec
    → mumuspec onboard quickstart（快速上手引导）
    → 编写第一条 Spec（自然语言，.mumuspec/spec.md 或子层 .mumuspec/tech.md）
    → mumuspec validate（校验 Spec 格式 + 可验证性覆盖率）
    → AI 工具接入（MCP Server 或 AGENTS.md Rules 文件）
    → mumuspec new my-first-change --workflow hotfix
    → AI 按 /mumuspec Skill 执行五阶段
    → mumuspec status（查看状态）
    → mumuspec archive my-first-change --confirm（归档）
```

关键体验目标：
- 三步走则：`init` → 写 Spec → `new` → AI 走完五阶段 → `archive`
- 新用户首次变更（hotfix 路径）30 分钟内完成

## 竞品定位

| 项目 | 核心价值 | MumuSpec 借鉴点 |
|------|---------|-----------------|
| **OpenSpec** | 变更驱动的规范生命周期 | delta spec 语义合并、变更工件流水线 |
| **Comet** | OpenSpec + Superpowers 双星工作流 | 五阶段状态机、phase guard、hotfix/tweak 预设 |
| **codebase-memory / GitNexus** | 代码知识图谱 | 图谱 schema、search/trace/impact 工具 |
| **context-engineering** | 上下文分层策略 | 渐进式披露原则、反模式避免 |
| **Ponytail** | 懒惰高级开发者编码约束 | 7 级优先级阶梯，作为 MumuSpec 基础编码约束 |

**差异化优势**：
- 唯一把 Spec 当作**一等 DSL**（语法 / 语义 / 诊断器俱全，`E-SPEC-*` 即编译诊断）的规范系统
- 唯一以**人机合著流水线**为第一性流程：大模型起草 ⇄ 追问补全 → 完备性判定 → 人签收，设计决策权始终在人
- 唯一提供**双向约束**（SHALL + SHALL NOT）且强制可验证性四分类（不可验证的约束等于不存在的约束）
- 唯一实现**树状分层 + 渐进式披露**的规范加载
- 唯一将**编码约束**（Ponytail）内建到规范体系中的工具

## 非目标（Non-Goals）

以下功能明确不在 MumuSpec 当前范围内：

| 非目标 | 原因 |
|--------|------|
| 多项目规范同步 | 当前聚焦单项目规范管理 |
| IDE 原生插件 | 通过 MCP Server + CLI（含 AGENTS.md canonical 规则文件生成）覆盖 IDE 集成需求 |
| 可视化编辑器 | Spec 文件为 Markdown + YAML，语言可读可写性是设计一等约束，无需专用编辑器 |
| 规范自动生成（从代码逆向） | Spec 是设计意图的一等源文件，代码是衍生品；自动生成导致循环依赖 |
| 强制代码风格检查 | 由 ESLint/Prettier 负责，MumuSpec 聚焦架构约束 |
| 限制 AI 执行过程（HOW） | CHG-5：只为目标增加限制（WHAT），不限制过程；执行自由度不受约束 |
