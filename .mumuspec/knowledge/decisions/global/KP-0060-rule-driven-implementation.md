# === 标识 ===
id: "KP-0060"
title: "规则-实现分离：LLM 创建规则，代码实现并校验规则"
type: decision
status: confirmed
scope: "global"
created_at: "2026-09-01T00:00:00Z"
updated_at: "2026-09-01T00:00:00Z"
verified_at: "2026-09-01T00:00:00Z"

# === 来源 ===
source_change: "goal-p0-dispatch-gate"
source_phase: "open"
source_artifact: "用户裁决 2026-09-01（会话指令）；工件 delta-specs/rule-driven-implementation.md"

# === 图谱关联 ===
graph_bindings:
  - src/spec/verifier-classify.ts
  - src/guard/phase-guard.ts
  - src/install/installer-registry.ts
  - src/change/state-machine.ts

# === 索引 ===
tags: ["rule-driven", "deterministic-engine", "cli-first", "design-philosophy", "goal"]
related_pages:
  - "KP-0059"
  - "KP-0008"
  - "KP-0019"

## 决策

用户裁决（2026-09-01）：对于能够通过传递复杂规则后由工具实现的相对固定部分，应当由代码实现；大模型仅创建规则；并且代码必须对规则进行校验。

## 三条公理

1. **引擎归代码**：凡是"给定规则后即可确定性执行"的相对固定部分，由代码实现（引擎 / 解释器），不交由 LLM 现场发挥。
2. **规则归 LLM**：LLM 的产出物是声明式规则（spec、delta-specs、workflow yaml、结构化工件、模板填充内容），不是执行逻辑。
3. **校验归代码**：代码必须对 LLM 创建的规则做 schema + 语义校验，非法规则拒绝进入执行并产出诊断——**不可校验的规则不得消费**。

## 与既有决策的关系

- **KP-0059（Spec 即 DSL）的执行面延伸**：Spec 是规则的语言，本原则补上"解释器必须是代码、加载器必须校验"的另一半。
- **CLI-first 是本原则在流程层的特例**：确定性工作流步骤走 CLI 命令，是"引擎归代码"在变更生命周期上的投影。
- **可验证性四分类 + E-SPEC-015 是"校验归代码"的既有机械化地基**（verifier-classify）。
- **与 CHG-5 原则不冲突**：本原则只约束"相对固定部分"的实现归属，不限制 LLM 在 HOW 上的执行自由——为目标增加限制，不限制过程。

## 影响

1. `goal-p0-dispatch-gate` 两条主线按此原则对齐：**分发层** = 声明式 agent 清单 / 模板配置 + 代码生成器 + 生成物可校验；**完备性门禁** = schema 校验器消费 LLM 工件，advisory 结论不得单独放行。
2. 新增确定性能力的实现顺序固定为：**先规则 schema 与校验器，再引擎消费，最后 skill / LLM 指引**（先校验器后消费者）。
3. 既有反模式的迁移方向：硬编码在 skill 提示词中的流程性逻辑，应逐步迁出为"规则 + 引擎"结构。
