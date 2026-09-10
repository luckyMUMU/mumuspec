---
date: "2026-09-10"
topic: MumuSpec 作为"人—agent 中间层"的目标契合度复评
criteria: 关注需求、目标及核心设计；实现交由 agent 且与具体 agent 无关；实现上给予 agent 自由度
baseline: review/middleware-positioning-evaluation-2026-09-09.md
revision: v0.21.0-alpha.0（package.json）
---

# MumuSpec 中间层定位复评（2026-09-10）

## 1. 评价基准

| 准则 | 对照机制 |
|---|---|
| 关注需求、目标及核心设计（人侧） | goal.md 北极星指标、prd/tech 分层、完备性双签门禁（open-questions / assumptions + decisions.md 签收）、CHG-5「为目标增加限制，不限制过程」 |
| 实现 agent 无关、Spec 即标准（中间层） | Spec-as-DSL（KP-0059）、AGENTS.md canonical + 10 agent installer、MCP `get_spec_context` 渐进式披露、`capability` 能力分层 |
| 实现上给予 agent 自由度（agent 侧） | SHALL / SHALL NOT 只锁 WHAT、树状继承「可收紧不可放宽」、CHG-5 H1、规则-实现分离（KP-0060）、CLI-first 收走确定性步骤 |

## 2. 逐条判定

| 准则 | 判定 | 硬证据（本次核实） |
|---|---|---|
| 人侧：需求 / 目标 / 核心设计 | 契合 | goal.md 北极星「人工审查成本降低 60%」；`src/guard/phase-guard.ts` L16-90 双签语义——LLM 起草工件、人在 decisions.md 签收，无签收直接 block；`checkCompletenessGate` 在 L454 / L628 分别挂 design→build 与 verify 门禁；`<!-- no-open-questions -->` 声明路径**仍需**签收（L42-51），不可绕过 |
| 中间层：agent 无关的标准 Spec | 契合 | `src/install/installer-registry.ts` AgentType 已含 10 值（catpaw/claude/cursor/trae/workbuddy/opencode/codex/windsurf/gemini/copilot）；AGENTS.md 为 canonical，GEMINI.md 等走 `@AGENTS.md` 桥接；`.cursorrules`/`.windsurfrules` 由 `src/rules/generator.ts` L51 硬过滤 + `src/guard/checker.ts` L313 红线双保险，遗留格式确已停止生成 |
| agent 侧：实现自由度 | **基本契合，闭环未合** | 自由度度量已从「口头承诺」落地为代码：`src/core/metrics/constraint-density.ts`（归一化密度，weight=0 明确排除出收敛复合值，防止「删规范涨进度」的反向激励）、`src/core/metrics/design-build-first-pass.ts`（由 state 工件推导一次通过率，禁止 LLM 手写）、`auto-evaluate.ts` L237 `buildSuggestions()` 纯函数产出「放宽 / 收紧」建议并标注须人工签收。但产出物出口断裂，见 §3 |

## 3. 本次新核实的缺口（contrast 09-09 版 T2「自由度缺度量」——该项已闭合）

**G1 · advisory 建议是 dead-end 产出（P1，最严重）。**
`autoEvaluate()` 返回 `{ progress, goalAchieved, metrics, recommendation, suggestions, history }`（auto-evaluate.ts L127-134），但 `src/change/loop-engine.ts` L240-267 的转换层只映射 progress / goal_achieved / recommendation 三项：
- `evalResult.suggestions` 未进入 `LoopEvaluation`（`src/core/types-loop.ts` 无该字段）；
- 持久化到 `MetricsSnapshot` 的只有 `{ name, value, details }`，suggestions 被丢弃；
- 因此 `mumuspec loop evaluate` 不会打印建议，也不会落进 decisions.md。
归档变更 `2026-09-09-completeness-artifacts-freedom-metrics` 的 delta-spec ENF-3 要求「建议仅以 advisory 文本进入报告与 decisions 建议条目」——**实现已产出、契约已声明、消费者缺失**。这正是项目自身红线「禁止在无对应校验器的情况下引入新的 LLM 结构化产出物」的同构失效（此处是产出物无消费面），并直接违反「先命令后文档 / 先消费者再产出」的纪律。

**G2 · 自由度信号仅在 loop 工作流可见（P1）。**
`autoEvaluate` 的调用点只有 `src/change/loop-engine.ts`，入口是 `mumuspec loop evaluate`。而 `default_workflow: full` 的变更（含本仓库绝大多数变更工件）完全不计算 constraint-density 与 design-build-first-pass。goal.md 的「Design→Build 一次通过率 ≥ 80%」是全项目北极星指标，其样本却只覆盖 loop 模式变更——度量口径与指标口径不匹配，且样本天然偏斜。

**G3 · 信号未进入 agent 契约面（P2）。**
`grep -rn "自由度|freedom" skills/` 无命中；根 AGENTS.md 中「约束密度」只以一条 SHALL NOT（「禁止将约束密度直接判定为好/坏质量分」）出现，没有任何入口让 agent 查询本轮自由度信号。中间层的价值在于被 agent 消费——度量只进收敛复合值、不进契约面，等于停留在内部指标。

**G4 · 中间层自身的事实源出现漂移（P2，元问题）。**
- `docs/STATUS.md` 自称「本文件是 MumuSpec 项目进度的唯一权威来源」，却停在 `0.19.2-alpha.11 / 最后更新 2026-09-06`，而 `package.json` 已是 `0.21.0-alpha.0`；
- `.mumuspec/config.yaml` 仍写 `version: 0.16.0-beta.0`，且 `ai.rules_files` 仍含 `.cursorrules`（靠 generator 硬过滤兜底，而非事实源自身干净）；
- 与之对比：CLI 版本号纪律是健康的——`src/cli/index.ts` L81-86 运行时读 package.json，CHANGE-3 不变式成立。

G4 值得单独记一笔：MumuSpec 的第一大核心问题是「规范写完即过时，无法自动校验，沦为摆设文档」。当前漂移的是**进度类事实源**（STATUS.md / config.yaml），而非约束类规范（那部分由 validate / check / drift 严格看守）。这正是「校验覆盖到约束、未覆盖到元数据」的边界暴露处。

## 4. 结论

**定位判定：契合，且自由度已从承诺升级为可计算量——但回路末端断裂。**

三条准则中前两条已由代码事实充分支撑，无需再论证。第三条在本次复评中取得实质进展：约束密度与一次通过率两个 evaluator 落地，配合「密度不得作为质量分」「指标不得由 LLM 手写」「不得自动修改 constraint_strength」三条红线，构成了同类工具中少见的、正式化的自由度调节通道。方向正确，设计克制（weight=0 的处理尤其正确——避免把调节信号误当进度信号）。

剩余工作不是补度量，而是**接通回路**：

1. **P1 — 接通建议出口**：在 `loop-engine.ts` 转换层保留 `suggestions` 字段，`loop evaluate` 打印建议段，并按 ENF-3 落 decisions 建议条目。复用既有 `buildSuggestions` 纯函数，无需新逻辑（YAGNI）。
2. **P1 — 扩大度量口径**：把两个 evaluator 挂到 `verify` / `archive` 前的检查路径（或 `mumuspec check`），使 full 工作流变更同样产出自由度信号，北极星指标样本回归全量。
3. **P2 — 信号进契约面**：在 `mumuspec capability` / `context --json` 或 AGENTS.md 摘要中暴露当前自由度信号，让 agent 可读，而非只供引擎内部收敛使用。
4. **P2 — 收口元数据漂移**：STATUS.md 加自动校验（版本号与 package.json 对齐），清理仓库自身 config.yaml 的遗留值。

> 与 09-09 版的关系：T1（完备性门禁）、T2（自由度缺度量）两项经本次代码核实均已闭合，结论从「P1：建立自由度度量回路」推进为「P1：接通已建成回路的出口并扩大口径」。T3（语义级验收依赖 test-cases 质量）、T4（生态依赖不可控）本次未复核，维持 09-09 版结论。
