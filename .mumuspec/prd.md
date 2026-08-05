---
scope: .
layer: 0
last_updated: '2026-08-04'
---

# 产品需求概览: MumuSpec

## 产品定位

MumuSpec 是一个**树状双向约束规范系统**，用"做什么"（SHALL）和"不做什么"（SHALL NOT）两条轴线，约束 AI 编程的工作边界。

核心定位：
- **持久化的规范** — 约束定义存储在 `.mumuspec/` 下，版本化管理，不随代码删除而消失
- **独立于代码** — 约束描述"agent 应做 / 不应做"的行为准则，不引用具体代码路径
- **双维度** — 沿"技术设计 (HOW)"与"需求目标 (WHAT)"两条独立轴线组织
- **正反向并重** — 正向 SHALL 指明必达目标，反向 SHALL NOT 划定不可逾越红线

## 核心能力

| 能力 | 说明 |
|------|------|
| **规范树** | 按目录分层存放 SHALL/SHALL NOT 规范，子层继承父层、可收紧不可放宽 |
| **渐进式披露** | AI 只加载当前工作目录的规范链，减少 token 消耗 |
| **变更生命周期** | Open → Design → Build → Verify → Archive 五阶段管理，支持回退 |
| **Phase Guard** | 阶段转换时自动执行的校验门禁 |
| **动态约束强度** | high / medium / low 三档，按团队成熟度动态调整工作流严格度 |
| **Ponytail 编码约束** | 7 级优先级阶梯（YAGNI → 复用 → 标准库 → 平台特性 → 已有依赖 → 一行代码 → 最小实现） |
| **Skills 编排** | 阶段编排器，引导 AI 工具按工作流执行 |
| **MCP Server** | 提供 15+ 工具接口供 AI 调用（spec context / compliance / drift / guard 等） |

## 用户旅程

```
mumuspec init . --name my-app --language typescript
    → mumuspec doctor（检查环境依赖）
    → mumuspec add-spec src/api --type shall / --type shall-not
    → mumuspec validate（校验规范格式）
    → 配置 MCP Server 或生成 Rules 文件
    → mumuspec new my-change --workflow hotfix
    → AI 按 /mumuspec Skill 执行五阶段
    → mumuspec status（查看状态）
    → mumuspec archive my-change（归档并提交）
```

关键体验目标：
- 三步走则：`init` → `add-spec` → `new` → AI 走完五阶段 → `archive`
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
- 唯一提供**双向约束**（SHALL + SHALL NOT）的系统
- 唯一实现**树状分层 + 渐进式披露**的规范加载
- 唯一将**编码约束**（Ponytail）内建到规范体系中的工具

## 非目标（Non-Goals）

以下功能明确不在 MumuSpec 当前范围内：

| 非目标 | 原因 |
|--------|------|
| 多项目规范同步 | 当前聚焦单项目规范管理 |
| IDE 原生插件 | 通过 MCP Server + CLI 覆盖 IDE 集成需求 |
| 可视化编辑器 | 规范文件为 YAML + Markdown，无需专用编辑器 |
| 规范自动生成（从代码逆向） | 规范是设计意图的表达，自动生成导致循环依赖 |
| 强制代码风格检查 | 由 ESLint/Prettier 负责，MumuSpec 聚焦架构约束 |
