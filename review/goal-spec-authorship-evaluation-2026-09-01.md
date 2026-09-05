# 目标修正评审：Spec 由大模型起草、设计决策归人工

> 日期：2026-09-01 | 类型：目标评审 | 关联：KP-0059（Spec 即 DSL）、`docs/overview.md` §0 核心目标
> 触发：项目负责人修正核心目标表述——"人工编写 spec"收窄为"人工设计"，spec 全文由大模型起草。

---

## 1. 目标修正确认

**修正前**（`docs/overview.md` §0 现行表述）：

```
随意的自然语言 → 精准的 Spec（人工编写）→ 代码（AI 生成）
```

**修正后**（本次确认）：

```
随意的自然语言 → 大模型起草精准 Spec ⇄ 设计缺陷时大模型向人追问补全 → 大模型判定设计完备性 → 代码（AI 生成）
```

角色再分配：

| 环节 | 修正前 | 修正后 |
|------|--------|--------|
| 表达意图 / 设计 | 人 | **人（不变）** |
| 编写 Spec 全文 | 人 | **大模型起草 + 人审批签收** |
| 发现设计缺陷 | 人 | **大模型（追问机制）** |
| 设计决策 | 人 | 人（不变） |
| 完备性判定 | 人 | **大模型判定 + 机械化地基 + 人签收** |
| 编写代码 | AI | AI（不变） |

核心不变量：**设计决策权始终在人**。变化的是"执笔"与"发现缺陷"的责任从人转移到 LLM。

---

## 2. 代码现状：现有机制与修正后目标的映射

| 目标环节 | 现有机制 | 位置 | 成熟度 |
|----------|---------|------|--------|
| LLM 起草 Spec | Open 阶段产出 `proposal.md` + `delta-specs/`；spec-scaffolder 启发式脚手架 | `src/cli/commands/change.ts`、`src/core/spec-scaffolder.ts` | 中（散在阶段流程内，无一等起草命令） |
| 大模型向人追问补全 | Grill-Me Universal Engine：任意阶段触发、歧义检测、每问附推荐+理由、事实自检（代码/文档可答的问题自动跳过）、共识门（用户确认才放行）、轮次上限（默认 10）、决策分支 DFS、**fact/decision 分离** | `src/core/grill-me.ts` | 高（与修正目标几乎一一对应） |
| 设计决策登记 | decisions CLI 管理，accepted / rejected / deferred 三态 | `src/change/decisions.ts` | 中高 |
| 完备性判定（机械面） | 可验证性四分类（enforced-strong / enforced-weak / manual / unverifiable）、E-SPEC-015 恒 block、validate 可验证性覆盖率 | `src/spec/verifier-classify.ts`（2026-08-29 P0） | 高（已落地） |
| 完备性判定（语义面） | **无一等机制**——"设计是否完备"的 LLM 语义评估尚未形成结构化工件与门禁 | — | 缺失（G2） |
| 代码生成与校验回路 | guard/checker、phase-guard（650 行）、drift、contract 漂移检测 | `src/guard/`、`src/contract/` | 高 |

其他现状要点：

- 五阶段工作流（open→design→build→verify→archive）状态机为 DCG 实现（含回滚边、hotfix/tweak 跳过边、项目级 phase-graph 注入），成熟度高，测试覆盖充分（`tests/change/` 18 个文件）。
- MCP Server（stdio + Streamable HTTP，约 28 个工具）功能完备，但 `src/mcp-server.ts` 无直接单测。
- 整体进度：0.19.1 稳定，0.20.0-dev；STATUS.md 显示 Phase 2 约 70%。

**结论：修正后的目标不是推倒重来，而是把 Open/Design 阶段已隐含的"AI 起草、人确认"分工升格为显式目标。grill-me 是这条目标链路的直接实现载体。**

---

## 3. 对修正后目标的评价

### 3.1 结论：成立，且比原目标更强

1. **符合瓶颈现实**：写 Spec 的瓶颈从来不是打字，而是决策。把决策留给人、把转写交给 LLM，与 grill-me 已实现的 fact/decision 分离完全同构——事实类问题 LLM 自查代码/文档解决，只有决策类问题才升级到人。
2. **与 KP-0059 不冲突且更自洽**：KP-0059 否定的是"Spec 是编译中间产物"（从需求编译来、向代码编译去），肯定的是 Spec 为作者直接书写的一等语言。修正后 Spec 仍是一等源文件，只是作者从"人独著"变为"人机合著"（人出决策、LLM 执笔、人签收）。语言地位不变，作者结构变了。
3. **与业界收敛方向一致**：spec-driven 路线（Kiro / Spec Kit 等）均在向"AI 起草 + 人工审批"收敛。MumuSpec 的差异化在于：完备性判定有机械化地基（四分类 + E-SPEC-015 一票否决），而非纯 LLM 自评。

### 3.2 风险与对策

| # | 风险 | 对策 |
|---|------|------|
| R1 | **裁判独立性**：LLM 既起草 Spec 又判定完备性 → 自我确认偏误 | 双轨制：机械化地基（四分类 / E-SPEC-015）为一票否决；LLM 语义完备性评估仅 advisory，且必须产出结构化工件（未决问题清单 + 未确认假设清单）；最终共识门在人（grill-me consensus gate 已有） |
| R2 | **设计退化为"点头审批"**：人只按 accept，Spec 质量上限 = LLM 默认值 | `decisions.ts` 强制记录 rejected/deferred 及理由，把"人的设计贡献"变成可审计工件；phase-guard 可要求每个变更至少 N 条人本（human-originated）决策记录 |
| R3 | **"完备" ≠ "正确"**：完备性判定通过不代表设计正确 | 明确语义边界：完备性门禁只回答"没有未决问题"；正确性仍由 test-cases 锁定（Design 锁定不可变）+ Verify 把关。两层语义不得混淆 |
| R4 | 追问疲劳 | 已内置：轮次上限（默认 10，可按阶段配置）+ 事实自检跳过可自查问题。无需额外改动 |

### 3.3 目标表述建议

"人工编写 spec 而不编写代码"建议改写为：

> **人工设计而不编写 spec 与代码。** Spec 由大模型起草，经人机对话补全设计缺陷并通过完备性判定；代码由 AI 依据 Spec 生成。人工的角色是设计决策与审批签收。

对应 README / overview 的公式更新为：

```
随意的自然语言 → 大模型起草 Spec ⇄ 追问补全（人机对话）→ 完备性判定 → 代码（AI 生成）
                                        人工：设计决策 + 审批签收
```

---

## 4. 主流 Agent 适配：现状与建议

### 4.1 生态事实（2026-09 调研）

- **AGENTS.md 已是事实标准**：由 Linux 基金会 Agentic AI Foundation 中立托管（与 MCP、goose 同为锚项目），60,000+ 开源项目采用；OpenAI Codex、Cursor、GitHub Copilot、Windsurf/Cognition、Jules、Zed、Aider、Devin 原生支持，Gemini CLI 可经 `context.fileName` 配置读取。
- **Claude Code 是唯一不原生读 AGENTS.md 的主流 agent**：官方桥接方式为 CLAUDE.md 首行 `@AGENTS.md`、symlink、或 v2.1.213+ 的 `/import`。
- 跨 agent 的 skills 分发（一份 SKILL.md 多引擎复用）已成为社区主流模式。
- 容量预算：Codex 默认 32KiB（`project_doc_max_bytes`），各家建议 Rules 文件控制在数百行内——全量规范上下文应交给 MCP 渐进式披露，Rules 文件只做"入口指引"。

### 4.2 适配现状（代码证据）

| 项 | 现状 | 证据 |
|----|------|------|
| Agent 覆盖 | 仅 6 个：catpaw / claude / cursor / trae / workbuddy / opencode | `src/install/installer-registry.ts:5` |
| 缺失 | codex、gemini、copilot、windsurf 无 installer | 同上 |
| 安装内容 | 每 agent 仅装单一 `mumuspec-workflow` skill/command 文件；全量 phase skills 仅 workbuddy 独享 | `installer-registry.ts:111-135` |
| Rules 文件 | README 宣称自动生成 CLAUDE.md / .cursorrules / AGENTS.md，代码中实际缺位，AGENTS.md 靠文档手工复制 | `docs/reference/ai-tools-setup.md:133-135` |
| 通用能力层 | MCP Server：stdio + Streamable HTTP（CORS 白名单、Bearer 认证），约 28 工具 | `src/mcp-server.ts`（1268 行，无直接单测） |

**结论：理念跨平台（平台无关 DSL + MCP），但分发层是当前最大工程缺口**——主流 agent 覆盖约 6/10，且"Rules 文件自动生成"与代码实际不符。

### 4.3 建议：canonical-first 分发架构

1. **AGENTS.md 为唯一 canonical Rules 生成目标**：内容 = 规范链摘要 + Ponytail 约束 + CLI 速查 + "如何调 MCP"入口；控制容量预算，全量上下文交给 MCP 渐进式披露。
2. **桥接文件一律薄壳**：`CLAUDE.md` = 首行 `@AGENTS.md`（一并解决 Claude Code 不读 AGENTS.md 的唯一兼容坑，免除用户手工 symlink）；`GEMINI.md` 可选薄壳；`.cursorrules` / `.windsurfrules` 已属遗留格式，停止生成。
3. **installer-registry 扩展 4 个 AgentType**：+codex（AGENTS.md + `~/.codex/skills/`）、+gemini（GEMINI.md 薄壳 + 提示配置 context.fileName）、+copilot（AGENTS.md nearest-wins，零额外文件）、+windsurf（任意目录读 AGENTS.md，成本最低）。
4. **Skill 分发统一为目录式 SKILL.md**（Claude Code 与通用 agent 均兼容），phase-open/design/build/verify/archive 不再 workbuddy 独享。
5. **MCP 为能力主入口**：渐进披露 / 校验 / guard / 知识层全部走 MCP；Rules 文件只承担"引导 agent 调用 MCP/CLI"的最小职责。

### 4.4 落地顺序建议（若采纳）

| 优先级 | 事项 | 说明 |
|--------|------|------|
| P0 | AGENTS.md canonical 生成器 + CLAUDE.md 薄壳 + codex/windsurf/gemini/copilot 四个 installer | 纯增量，无外部契约破坏；消除"宣称与实现不符" |
| P0 | 完备性门禁 v1：Design/Verify 产出结构化 `open-questions` + `assumptions` 工件，phase-guard 挂钩"LLM 判完备 + 人签收"双签 | 补齐 G2，落地 §3 修正目标的最后一环 |
| P1 | `mumuspec spec draft` 一等命令：随意 NL → grill-me 追问 → delta-specs 起草 → 人工确认 | 把起草链路从 phase-open 中提为一等命令，直接对应修正后公式 |
| P1 | `mcp-server.ts` 补直接单测 | 核心入口零测试是当前最大质量风险点 |

---

## 5. 一句话总结

修正后的目标（**人设计、LLM 执笔 Spec、LLM 追问补全与判定完备、AI 写代码**）成立且比原表述更强：grill-me 与可验证性四分类已把这条链路的骨架建好，真正的缺口只有两个——**语义完备性门禁（G2）**与 **Agent 分发层（AGENTS.md canonical + 4 个缺失 installer）**；两者都有明确的 P0 路径，且不破坏任何外部契约。
