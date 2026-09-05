# === 标识 ===
id: "KP-0059"
title: "持久化 spec 是 DSL，不是字节码：一门带 verifier 的领域特定语言"
type: decision
status: confirmed
scope: "global"
created_at: "2026-08-29T00:00:00Z"
updated_at: "2026-08-29T00:00:00Z"
verified_at: "2026-08-29T00:00:00Z"

# === 来源 ===
source_change: "verifier-semantics-p0"
source_phase: "design"
source_artifact: "review/proposal-verifier-semantics-2026-08-29.md#十三"

# === 图谱关联 ===
graph_bindings:
  - src/spec/verifier-classify.ts
  - src/spec/parser.ts
  - src/core/errors.ts
  - src/guard/checker.ts

# === 索引 ===
tags: ["dsl", "verifier", "spec-language", "design-philosophy", "bytecode-analogy", "goal"]
related_pages:
  - "KP-0012"
  - "KP-0024"

## 决策

用户裁决（2026-08-29）：MumuSpec 的持久化 spec 应当被视为一门 **DSL（领域特定语言）**，而非完全参考 Java 字节码的设计。

背景：`review/nl-bytecode-gap-analysis-2026-08-29.md` 曾以「自然语言字节码」作为目标命题组织分析。该类比在三个性质上仍然成立并被 P0 提案（verifier 语义收紧）落地：

1. **加载时 verifier**：不满足静态语义的 spec 拒绝通过（E-SPEC-015 恒 block，forceable: false）；
2. **平台无关**：同一份 spec 经 MCP / rules 生成 / context 被任意模型与宿主消费；
3. **不约束执行路径**：CHG-5 原则——结果约束 block，行为约束 advisory，agent 的 HOW 自由。

被放弃的是「中间表示」这一半：spec **不是**从上游需求编译而来、再向下游编译而去的中介产物。它是作者（人 + LLM 协作）直接书写的一等语言：

- **语法面**：`## Requirement:` 块结构、`### SHALL / SHALL NOT / SHOULD / Enforcement` 节、`manual(原因)` 保留字、frontmatter（layer/scope/prohibitions annotation）、constraints.yaml 条目 schema、树状继承（子层可收紧不可放宽）；
- **语义面**：极性（shall / shall-not）× 维度（TD / RG）× 强度（high / medium / low）× 可验证性四分类（enforced-strong / enforced-weak / manual / unverifiable，见 constraint-strength.md §9.0）；
- **诊断面**：`E-SPEC-*` 错误码即编译诊断（E-SPEC-015 = 「红线约束未声明验证方式」相当于类型错误）；
- **链接器与加载器**：渐进披露（context ≤3 层）是加载策略，GOVERNED_BY 绑定与 drift 检测是链接期检查。

## 影响

1. 后续「统一 IR 格式」（差距分析 P1）应重新表述为**统一 DSL 语言规范**：grammar（结构 schema）+ semantics（判定规则）+ diagnostics（错误码）三件套。
2. 文档与对外表述中，「spec 是字节码」的说法不应再出现；字节码类比仅可作为 verifier 语义的启发式出处。
3. DSL 定位强化了 spec.md 作为「人可读可写的一等源文件」的地位——可读性、可写性与诊断质量（fixSteps）是语言设计的一等约束，而非事后附加。
