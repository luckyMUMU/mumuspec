---
date: "2026-09-09"
topic: MumuSpec 作为"人—agent 中间层"的目标契合度评价
criteria: 关注需求、目标及核心设计；实现交由 agent 且与具体 agent 无关；实现上给予 agent 自由度
---

# MumuSpec 中间层定位评价（2026-09-09）

## 1. 评价基准

以三条准则对照项目现状：

| 准则 | 对照的项目机制 |
|---|---|
| 关注需求、目标及核心设计（人侧） | goal.md 北极星指标、prd/design/spec 分层、完备性双轨制 + 人签收（grill-me consensus gate）、CHG-5"为目标增加限制，不限制过程" |
| 实现 agent 无关、Spec 即标准（中间层） | Spec-as-DSL（KP-0059）、AGENTS.md canonical 生成 + 10 agent installer、MCP `get_spec_context` 渐进式披露、能力分层 `capability` 查询 |
| 实现上给予 agent 自由度（agent 侧） | SHALL/SHALL NOT 只锁 WHAT（验收与红线）、树状继承"可收紧不可放宽"、capability tier（general 只读、dedicated 有校验）、CLI-first 把确定性步骤收走，剩余过程留给 agent |

## 2. 目标契合度：成立，且结构自洽

**2.1 中间层定位成立。** MumuSpec 不是"需求编译器"也不是"代码生成器"，而是以 Spec 为唯一契约的仲裁层：人向下注入 WHAT（目标、红线），agent 在红线内自由选择 HOW，产出再经校验层（guard / drift / check）回扣 Spec。这正对应 goal.md 的北极星——"让 AI 在项目架构与需求的边界内工作"。README 的核心理念句（"人不再逐字编写 Spec 全文，只做设计决策与审批签收"）与本次准则逐字吻合。

**2.2 agent 无关性已从口号变为实现。** 早期缺口（installer 仅 6 agent、AGENTS.md 生成缺位）已在 P0 收口：AGENTS.md 为 canonical + CLAUDE.md 薄壳（`@AGENTS.md`）+ 10 个 installer，`.cursorrules`/`.windsurfrules` 遗留格式停止生成，且"禁止静默覆盖用户手写 Rules 文件"入了红线。MCP 渐进式披露（Rules 文件 ≤32KiB、全量上下文走 `context`）保证不同 agent 拿到的是同一份规范链，而不是各自的转写副本——这是"标准 spec 实现"的实质。

**2.3 实现自由度有真实的设计保障，而非口头承诺。** 三个证据：
- CHG-5 明文写入设计理念："Spec 只约束 WHAT，不约束 HOW。AI 的执行自由度不被限制，但产出必须通过 Spec 校验。"
- KP-0060 规则-实现分离：引擎归代码、规则归 LLM、校验归代码。agent 不被要求充当引擎，只需在声明式规则下工作。
- 红线的粒度控制得当：SHALL NOT 主要压在流程类（禁止跳过校验、禁止绕过状态机、禁止手工编辑状态工件）与架构类（YAGNI、不引新依赖），对实现内部路径干涉极少——即"结果约束 > 行为约束"，与项目负责人一贯的管理风格一致。

**2.4 双维度约束强度（HOW/WHAT 两轴独立配置 high/medium/low）为"自由度分级"预留了正式通道**，这在同类 spec 工具中是少见的、直接服务于"给予 agent 自由度"的机制。

## 3. 残余张力（按影响排序）

**T1 语义完备性门禁（已闭环，原判断过时）。** 初评时判断"工件尚未落 CLI + 校验器"；经代码核实（2026-09-09 补全任务执行期），完备性门禁 v1 已在归档变更 2026-09-05-goal-p0-dispatch-gate 中实现：`src/change/artifact-validator.ts` 提供 open-questions.yaml / assumptions.yaml 的 schema 校验（字段、状态枚举、version、resolution 链），`src/guard/phase-guard.ts` 在 design→build 等转换时执行双签门禁（LLM advisory 判定不入 gate 决策路径，无人工签收不放行）。评价基准中的 G2 缺口已闭合，无需再补。

**T2 自由度缺度量。** "给予 agent 自由度"目前是定性承诺：capability tier 度量的是**工具风险**，不是**实现自由度**（如约束密度、SHALL NOT 覆盖率与 Design→Build 一次通过率的关系）。goal.md 中的"Design→Build 一次通过率 ≥ 80%"是唯一与自由度间接相关的指标，尚无反哺机制（一次通过率低 → 自动建议放宽/收紧哪一轴）。

**T3 语义级验收依赖 test-cases 质量。** 中间层只校验 Spec 与代码的形式一致性（hash、drift、SHALL 提取），"实现是否真的满足目标"由 test-cases 锁定承担——这符合"完备≠正确"的裁决，但意味着中间层效果高度依赖 test-cases 锁定环节的严格性，agent 换平台后测试可执行性无保障机制。

**T4 生态依赖不可控。** agent 端是否真正读 AGENTS.md / 调 MCP 由外部生态决定（如 Claude Code 需薄壳桥接）。中间层无法强制，只能靠多 installer 冗余覆盖——现状可接受，但需持续追踪 agent 生态变化（结论来自 2026-09-05 与 2026-09-08 两轮全流程评审）。

## 4. 结论

**定位评价：契合。** MumuSpec 已经是"人与 agent 之间以 Spec 为唯一契约的中间层"：需求/目标/核心设计的入口在人（且有签收门禁），Spec 是 agent 无关的标准（canonical 生成 + 渐进式披露），实现自由度由 CHG-5 + 规则-实现分离 + 红线粒度三重保障。剩余工作只有一处"半机制化"：

1. **P1**：为"自由度"建立最小度量回路（约束密度 ↔ Design→Build 一次通过率），使"给予多少自由度"从经验判断变为可调参数。度量基础已存在（src/core/metrics/ auto-evaluate 框架，含 test-pass-rate / drift-score / spec-compliance / code-delta 四个 evaluator），缺口为：约束密度 evaluator、一次通过率追踪（可由变更 state 的 rollback/rebuild 计数推导）、反哺建议输出（advisory，人签收后生效）。

> 勘误（2026-09-09）：初评 T1"完备性门禁未闭环"经代码核实为过时结论，门禁 v1 已随 2026-09-05-goal-p0-dispatch-gate 变更落地，详见 T1 修正条目。
