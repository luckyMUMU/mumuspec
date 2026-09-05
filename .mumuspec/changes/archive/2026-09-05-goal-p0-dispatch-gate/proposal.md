# Proposal: goal-p0-dispatch-gate

## Why

核心目标于 2026-09-01 修正（评审见 `review/goal-spec-authorship-evaluation-2026-09-01.md`）：

> 随意的自然语言 → 大模型起草精准 Spec ⇄ 设计缺陷时大模型向人追问补全 → 大模型判定设计完备性 → 代码（AI 生成）。人工角色 = 设计决策 + 审批签收。

评审结论：链路骨架已就位（grill-me 追问引擎、verifier-classify 四分类），但两个 P0 缺口阻塞目标落地：

- **G-分发**：Agent 适配层仅覆盖 6 个 agent（`installer-registry.ts:5`），codex / gemini / copilot / windsurf 无 installer；README 宣称的 CLAUDE.md / AGENTS.md 自动生成在代码中缺位（实际靠手工复制，`docs/reference/ai-tools-setup.md:133`）。
- **G-门禁**："设计是否完备"的 LLM 语义判定无一等机制——机械面（四分类 / E-SPEC-015）已有，语义面无结构化工件、无门禁挂钩、无人签收闭环。

**设计哲学（用户裁决 2026-09-01，KP-0060：规则-实现分离）**：凡是"给定规则后可由工具确定性实现"的相对固定部分，由代码实现；LLM 仅创建规则；且代码必须校验规则（非法规则拒绝执行）。本变更两条主线即该原则的实例——分发层 = 声明式配置 + 代码生成器 + 生成物校验；完备性门禁 = schema 校验器消费 LLM 工件，advisory 不得单独放行。

本变更承载两条 P0 主线，直接落地修正后的核心目标链路。

## What

### 主线 A：分发层 canonical-first 改造

1. **AGENTS.md 为唯一 canonical Rules 生成目标**：新增 Rules 文件生成器，产出内容 = 规范链摘要 + Ponytail 约束 + CLI 速查 + MCP 调用入口指引；容量控制（Codex 默认 32KiB 预算），全量上下文仍由 MCP 渐进式披露承担。
2. **桥接文件一律薄壳**：`CLAUDE.md` 首行 `@AGENTS.md`（解决 Claude Code 不原生读 AGENTS.md 的兼容坑）；`GEMINI.md` 可选薄壳；**停止生成** `.cursorrules` / `.windsurfrules`（遗留格式，Cursor / Windsurf 均已原生读 AGENTS.md）。
3. **installer-registry 扩展 4 个 AgentType**：+codex（AGENTS.md + `~/.codex/skills/`）、+windsurf（任意目录读 AGENTS.md，成本最低）、+gemini（GEMINI.md 薄壳 + context.fileName 指引）、+copilot（AGENTS.md nearest-wins，零额外文件）。
4. **Skill 分发统一目录式 SKILL.md**，phase-open/design/build/verify/archive 不再 workbuddy 独享。

### 主线 B：完备性门禁 v1

1. **结构化工件**：Design / Verify 阶段产出 `open-questions.yaml`（未决问题清单）与 `assumptions.yaml`（未确认假设清单），schema 版本化。
2. **双签门禁**：phase-guard 挂钩——LLM 完备性判定为 advisory（产出上述工件），人工签收（consensus）为放行条件；机械四分类保持一票否决不变。
3. **可审计**：未决问题/假设的消解记录进 decisions 日志， rejected/deferred 保留理由。

## Impact Scope

### 代码影响

| 模块 | 变更 | 类型 |
|------|------|------|
| `src/install/installer-registry.ts` | AgentType 联合类型 +4 值；AGENT_MANIFEST 扩展 | additive |
| `src/install/installer-ops.ts` | 各 agent 落盘路径与安装流程 | 修改 |
| 新增 Rules 生成器（位置 Design 定，倾向 `src/install/rules-generator.ts`） | AGENTS.md / CLAUDE.md / GEMINI.md 生成 | 新增 |
| `src/guard/phase-guard.ts` | design→build、build→verify 转换处挂钩完备性双签 | 修改 |
| `src/change/` 或 `src/core/` | open-questions / assumptions 工件读写与 schema | 新增 |
| `src/cli/commands/state.ts` 等 | 工件登记进变更状态 | 修改 |

### 外部契约影响（按 AGENTS.md 契约规则逐项征询）

| # | 契约变更 | 类型 | 风险 | 待用户确认 |
|---|---------|------|------|-----------|
| C1 | `AgentType` 新增 4 个枚举值 | additive | 低 | 可直接通过 |
| C2 | `init` / `install` 开始生成 AGENTS.md + CLAUDE.md 薄壳 | 新行为 | 低-中：与用户手写文件冲突 | **已裁决（D1，2026-09-01）**：标记分路——托管文件幂等更新、用户文件跳过+警告+`--force-rules` 接管、doctor 降级警告 |
| C3 | **停止生成** `.cursorrules` / `.windsurfrules` | 行为移除 | 低（生成器从未实现，实为撤销宣称） | **已裁决（D2，2026-09-01）**：立即停止且不建迁移命令；停止生成 ≠ 删除存量；doctor 提示 + release note 承担沟通 |
| C4 | 变更目录新增 `open-questions.yaml` / `assumptions.yaml` | additive（工件 schema 为对外格式契约） | 低 | schema 带 `version:` 字段 |

### 上游 / 下游

- 上游文档：README、docs/overview.md、docs/getting-started-agent.md、docs/reference/ai-tools-setup.md 需同步（"宣称与实现不符"就此消除）；根 spec.md 归档时合并「规则-实现分离」Requirement 块（delta-specs/rule-driven-implementation.md），与「流程执行载体（CLI-first）」同构；知识层已登记 KP-0060。
- 下游：`scripts/enforcement-check.mjs`（如校验 Rules 生成需更新）、demo、dashboard（若展示 agent 覆盖面）。

## 验收标准（草案 → Design 阶段锁定测试）

- **enforced-strong**：`mumuspec install --agent codex` 后 AGENTS.md / skills 落盘且内容含规范链摘要（FS 断言）。
- **enforced-strong**：`mumuspec init` 生成的 CLAUDE.md 首行为 `@AGENTS.md`。
- **enforced-strong**：`.cursorrules` / `.windsurfrules` 不再出现在任何生成路径（源码级断言 + e2e）。
- **enforced-strong**：design→build 转换时若 `open-questions.yaml` 存在未消解条目且未经签收，guard 返回 block。
- **enforced-strong**：本变更新增的每类 LLM 结构化产出物（open-questions / assumptions）均有对应代码校验器，非法工件拒绝进入执行（单测断言 fail-closed）。
- **manual**：薄壳 CLAUDE.md 在真实 Claude Code 会话中被加载（evidence 记入 verify.md）。
- **红线（SHALL NOT）**：LLM 完备性判定不得单独放行门禁（无人工签收时必须 block）——此条本身须为可验证约束，不得落入 unverifiable。

## Risks / Non-Goals

- **非目标**：`mumuspec spec draft` 一等命令（P1，另行开变更）；完备性 LLM 评估的算法深化（本变更只锁定工件契约与门禁挂钩，评估质量由 Skill 层指引承担）。
- **风险 R1 裁判独立性**：双轨制写入 spec（机械一票否决 + LLM advisory + 人签收）。
- **风险 R2 存量用户**：C3 遗留格式移除影响旧版 Cursor / Windsurf 用户，靠迁移提示缓解。

## Workflow

full
