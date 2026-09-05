# MumuSpec 改进计划（2026-09-01）

> **基准**：核心目标修正版（`review/goal-spec-authorship-evaluation-2026-09-01.md`）+ KP-0060 规则-实现分离
> **承载**：Wave 0 由活跃 CHG `goal-p0-dispatch-gate` 承载；Wave 1/2 待开变更
> **图例**：✅ 已就位 · 🔨 进行中 · 📋 计划 · ⏸ 待裁决

---

## 0. 链路覆盖矩阵（计划的对齐基准）

修正后的目标链路共 7 个环节，每项改进必须指明它服务的环节——不服务链路的项不进计划：

| # | 链路环节 | 一等机制现状 | 缺口 | 改进项 |
|---|---------|-------------|------|--------|
| 1 | 人工表达设计意图（随意 NL） | phase-open 接收任意输入 | — | — |
| 2 | LLM 起草精准 Spec | 散在 phase-open（proposal/delta-specs）+ spec-scaffolder 启发式 | G3 | W1-1 |
| 3 | 缺陷→大模型向人追问补全 | ✅ grill-me Universal Engine（共识门/轮次上限/DFS） | — | W1-1 集成 |
| 4a | 完备性判定·机械面 | ✅ 四分类 + E-SPEC-015 恒 block | — | W2-1 |
| 4b | 完备性判定·语义面 | 无结构化工件、无门禁、无签收闭环 | G2 | W0-B |
| 5 | AI 依据 Spec 生成代码 | ✅ 红绿 TDD + tasks next / lock-suite（0.20） | G5 残留 | W1-3 |
| 6 | Guard 校验回路 | ✅ phase-guard + drift + contract | 反向通道弱 | W2-2 |
| 7 | 分发给主流 Agent | 6 agent、单 skill、AGENTS.md 生成缺位 | G1 | W0-A |

---

## 1. Wave 0 — 当前变更收尾（🔨 `goal-p0-dispatch-gate`）

| 项 | 内容 | 前置 | 验收锚点 |
|----|------|------|---------|
| W0-0 ✅ | C2/C3 契约裁决；处置另两个活跃变更（loop-auto-evaluate / meta-spec-evolution） | ~~用户裁决~~ **已裁决（2026-09-01，D1=A/D2=A/D3=B/D4=X，见 goal-decision-briefing-2026-09-01.md）** | proposal 征询表已闭合，变更已放行 design |
| W0-A | 分发层 canonical-first：AGENTS.md 生成器、CLAUDE.md / GEMINI.md 薄壳、+4 installer、skill 统一目录式分发 | W0-0 | proposal 验收标准 1–3 |
| W0-B | 完备性门禁 v1：open-questions / assumptions 工件 + schema 校验器 + phase-guard 双签 | W0-0 | proposal 验收标准 4–6 |
| W0-C | 文档同步：README / overview / ai-tools-setup；根 spec 归档时合并三份 delta-specs | W0-A/B | "宣称与实现一致" |

> **KP-0060 实现顺序约束（W0-B）**：先工件 schema 与校验器 → 再 guard 消费 → 最后 skill 指引。分发层同构：先声明式 agent 配置 → 再生成器 → 再校验生成物。

---

## 2. Wave 1 — P1：核心目标链路一等化（📋）

| ID | 项 | 服务环节 | 依赖 | 规模 | 要点 |
|----|----|---------|------|------|------|
| W1-1 | **`mumuspec spec draft` 一等命令**：随意 NL → grill-me 追问 → delta-specs 起草 → 人工确认 | 2/3 | W0-B（复用工件契约） | M | 起草产物即结构化规则，走既有校验器；不新增 LLM 自由文本通道 |
| W1-2 | mcp-server.ts 直接单测（约 28 工具） | 全链路底座 | 无 | S | 消除核心入口零直测 |
| W1-3 | feedback CLI 收尾（STATUS.md：Phase 2 仅 70% 的残留项） | 5 | 无 | S | 规划中→实现 |
| W1-4 | LLM 完备性评估质量指引（skill 层） | 4b | W0-B | S | 只写评估方法与产出契约，不写算法 |
| W1-5 | 分发真实验证回填：codex / windsurf / gemini / copilot 实测 evidence | 7 | W0-A | S | manual 类 evidence 入 verify.md |
| W1-6 | KP-0060 迁移盘点：skill 提示词中确定性流程逻辑清单（候选：phase skills 内嵌命令序列、guard 前置检查清单、起草模板结构） | 全链路 | 无 | S | 只盘点出工单，不在 W1 实施 |

---

## 3. Wave 2 — P2：机械完备性与生态深化（📋，排序待裁决）

| ID | 项 | 服务环节 | 依赖 | 要点 |
|----|----|---------|------|------|
| W2-1 | SHALL 自动化执行通道 | 4a | verifier-classify 扩展 | SHALL 目前无自动通道（verifier-classify 源码自述）；候选：ast: 目标提取 / EARS 句式可验证化 |
| W2-2 | 反向通道一等公民：spec target 变更但代码未动 → 漂移告警 | 6 | drift 扩展 | overview 开放问题 4 |
| W2-3 | 按 target 的 JIT 式加载：代码图谱绑定成为 context 主入口 | 2/5 | code graph | 开放问题 3 |
| W2-4 | `mumuspec next` 结构化编排入口（"我现在该做什么"） | 全链路 | W0-B 状态字段 | 开放问题 6 |
| W2-5 | 统一 DSL 语言规范：grammar + semantics + diagnostics 形式化 | 2/4a | KP-0059 | 开放问题 1 |
| W2-6 | 过程层出清：15 个不可校验过程性阻塞点移出强制面 | 全链路 | — | 开放问题 2 |
| W2-7 | 多语言 AST 抽象 / 知识新鲜度自动化验证 | 5/6 | — | 开放问题 7/8 |

---

## 4. KP-0060 持续约束（非独立波次，贯穿所有 Wave）

1. **先校验器后消费者**：每新增一类 LLM 产出物，同 PR 先落 schema + 校验器，才允许引擎 / skill 消费。
2. **先命令后文档**：skill 指引不得描述引擎未实现的确定性步骤（既有规则，同等精神扩展到规则 schema）。
3. **迁移方向**：硬编码在 skill 提示词中的流程性逻辑，逐步外置为"声明式规则 + 代码引擎"（工单从 W1-6 盘点产出）。

---

## 5. 里程碑判据

| 里程碑 | 判据 |
|--------|------|
| **M1**（W0 归档） | 修正后目标链路在 10 个主流 agent 上可安装、可校验；完备性双签门禁生效 |
| **M2**（W1 归档） | `spec draft` 打通"随意 NL → 起草 → 追问 → 门禁"完整回路，人工全程只做设计决策与审批签收 |
| **M3**（W2 渐进） | SHALL 可验证化 + 反向通道生效，机械完备性覆盖 SHALL 侧 |

---

## 6. 裁决点汇总（✅ 已全部裁决：2026-09-01 用户采纳建议，D1=A / D2=A / D3=B / D4=X，详见 goal-decision-briefing-2026-09-01.md）

| # | 裁决 | 影响范围 |
|---|------|---------|
| D1 | C2：Rules 生成与用户手写文件冲突策略（倾向：跳过 + 警告） | W0-A 实现分支 |
| D2 | C3：停止生成 .cursorrules / .windsurfrules（倾向：一次迁移提示后移除） | W0-A 范围 |
| D3 | loop-auto-evaluate / meta-spec-evolution 的处置顺序（归档或挂起） | W0 推进节奏 |
| D4 | Wave 2 排序偏好：完备性深化（W2-1/2）优先 vs 生态深化（W2-3/4）优先 | W2 顺序 |
