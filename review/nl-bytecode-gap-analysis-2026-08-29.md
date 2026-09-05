# 自然语言字节码：MumuSpec 差距分析

> 日期：2026-08-29　性质：纯分析文档，未改动任何源码
> 目标命题：将 MumuSpec 的持久化 spec 变成 vibecoding 中类似 Java 字节码的「自然语言中间表示（IR）」——提供给 agent 对代码进行管理，**为目标增加限制，但不限制过程**。
> 证据来源：代码实现走查（src/ 全量）、设计文档走查（docs/ + skills/）、主流方案调研（Spec Kit / Kiro / OpenSpec / mronus-spec / arXiv）。

---

## ⚠️ 定位修正（2026-08-29，用户裁决，后置于全文生效）

用户已对本目标命题作出修正：**持久化 spec 应当被视为一门 DSL（领域特定语言），而非完全参考字节码的设计**。本文的「字节码」类比自即日起仅作为 verifier 语义的启发式出处，不作为设计定位。已登记知识层决策页：`.mumuspec/knowledge/decisions/global/KP-0059-spec-as-dsl-not-bytecode.md`。

修正要点：

- **放弃**：「中间表示」定位——spec 不是从需求编译来、向代码编译去的中介产物，而是作者直接书写的一等语言；
- **保留**：加载时 verifier、平台无关、不约束执行路径三个性质（已由 P0 提案实现）；
- **改写**：§五 P1「统一 IR 格式」→「统一 DSL 语言规范」（grammar + semantics + diagnostics 三件套）；
- 正文保留原命题表述作为分析过程记录，不回溯改写。

---

## 结论先行

**MumuSpec 是目前主流方案中最接近「自然语言字节码」定位的一个**——它的差异化（spec-as-runtime-constraint）正是该目标的方向；但它当前是一个「混合态」：**约束层（字节码本体）已成形，而一层厚重、不可校验的过程层（编译器前端）仍压在它身上**。

「为目标增加限制、不限制过程」在 MumuSpec 里已有理论定型（CHG-5 原则、0.20.0 强度降级），缺的是最后一公里：

1. 把过程约束从强制面出清；
2. 把约束条目统一成单一良构格式；
3. 把验证器覆盖率当成一等指标。

后续建议按 P0-P2 列于 §五；**P0（verifier 语义收紧）已单独立提案**：`review/proposal-verifier-semantics-2026-08-29.md`。

---

## 一、现状：MumuSpec 实际上是什么

从实现看，持久化 spec 由三层构成：

### 1.1 本体层（字节码的候选者）

树状分布的 `.mumuspec/` 目录，每个作用域目录可含：

| 工件 | 形态 | 角色 |
|---|---|---|
| `spec.md` / `prd.md` / `tech.md` | Markdown + frontmatter | 业务约束与技术设计（SHALL/SHALL NOT 三段式单元 + Enforcement 关联） |
| `prohibitions.md` | Markdown | SHALL NOT 汇总 |
| `constraints.yaml` | YAML | forward/reverse × td/rg 四桶，每条含 `id/content/min_strength/enforcement/category` |
| `config.yaml` / `index.yaml` | YAML | 配置与渐进披露索引 |
| `knowledge/` | MD + frontmatter v2 | WHY 层（决策/模式/风险/教训） |

子层继承父层，**可收紧不可放宽**（relax 非法并 WARN），冲突时高层级优先——`src/core/config-tree.ts:21-148`。

### 1.2 验证层（verifier）

三层检查：pre-commit（<5s，只查 SHALL NOT + drift）→ CI（<5min 全量）→ phase guard（<30s，工件完整性）。实现上注解驱动 AST 路由优先（TS Compiler API 实现 `no-mutable-state` / `enforce-idempotent` / `no-circular-imports` / `async-completeness` 四个语义约束，`src/guard/providers/typescript-provider.ts:48-61`），AST 失败降级为正则。约束经 `src/core/constraint-evaluator.ts:85-157` 求值为 block/warn/info。

### 1.3 消费层（分发机制）

- `mumuspec context` 渐进披露：只加载 root+parent+target 最多 3 层（`src/spec/loader.ts:359-376`）；
- 约 30 个 MCP 工具（`src/mcp-server.ts:68-491`）；
- 生成的 AGENTS.md / CLAUDE.md / .cursorrules 带 agents-hash 漂移检测（`src/guard/checker.ts:862-932`）；
- knowledge 层（WHY）+ code graph（代码与 spec 的 GOVERNED_BY 绑定，`src/knowledge/graph-builder.ts:246-299`）。

### 1.4 关键设计资产：CHG-5 原则

`docs/design/constraint-strength.md` §1.3 区分**行为约束**（约束过程 HOW）与**结果约束**（约束达成 DONE）。判定规则：结果可客观验证（文件存在、测试通过、hash 匹配）→ 结果约束；只有过程可观察 → 行为约束；冲突时结果约束优先。0.20.0 起已把 Q1-Q4 认知框架、TDD 红绿循环从 block 降为 advisory，只保留「测试全绿、工件完备、SHALL NOT 不违反」等结果约束为 block。

### 1.5 关键病灶：过程层虚胖

8/28 内部评审（`review/goal-todo-assessment-2026-08-28.md`）已量化：18 个 BP（阻塞点）里**代码层只硬强制 3 个**（BP-3/4/17，恰好都是用户确认/终态类），其余 15 个纯靠 skill 指令承载——agent 可绕过，违规无法观测。同时自评首要劣势是「专有概念过多、认知负荷高」（`docs/appendix/competitive-analysis-chapter.md:217`）。

---

## 二、与主流方案对比

| 方案 | spec 形态 | 持久性 | 强制力 | 过程/结果取向 |
|---|---|---|---|---|
| **GitHub Spec Kit** | 每变更 6 份 markdown（constitution/spec/plan/tasks…） | 变更级工件 | checklist + 阶段命令，无 runtime 校验 | 过程门禁 |
| **Kiro (AWS)** | requirements.md（EARS 半形式化句式）/design.md/tasks.md | 变更级 | IDE 审批门禁，锁 IDE | 过程门禁 |
| **OpenSpec** | 轻量变更提案 → 归档合并 | 变更级 | 弱，靠 LLM 自觉 | 过程 |
| **Superpowers / BMad** | 纯 markdown 流程文档 | 无 | 无 runtime | 纯过程 |
| **mronus/spec** | 全结构化 Spec IR（contract/module/types/tests） | 持久 | 验证协议未实现（v0.2 草案） | 结果（理想态） |
| **MumuSpec** | 树状 YAML+MD 双约束 | **持久化树** | guard/CI/hooks/MCP runtime 校验 | **混合态** |

三个对比结论：

1. **主流全是「过程派」**：Spec Kit 与 Kiro 保正确性的方式是把过程切阶段、设审批门禁、给模板；spec 是一次性工件，过程结束即沉睡。MumuSpec 是唯一把 spec 当**持久化运行时约束**的——双向约束（SHALL NOT）、树继承收紧、契约漂移检测在主流里没有等效物（自评定位 "spec-as-runtime-constraint" vs "spec-as-artifact"，`docs/appendix/competitive-analysis-chapter.md` §5.1）。

2. **「Spec 即 IR/字节码」已是行业成形中的共识**：pre.dev 提出 spec 是 AI 的编译中间表示；mronus/spec 直接做了语言无关 Spec IR（原则 "Describe WHAT, not HOW"，由外部语言 agent「编译」成实现）；arXiv 2412.04590 从学术侧验证 NL-spec 作为 IR 的可行性。但 mronus 走全结构化路线离实用很远——**MumuSpec 的「YAML 骨架 + Markdown 血肉」混合形态恰好是这条光谱上工程化最完整的落点**。

3. **Kiro 的 EARS 句式值得借鉴**：`WHEN <trigger> THE SYSTEM SHALL <response>` 是「可被正则/LLM 稳定提取验证的自然语言」，比自由 prose 的可验证性高一个量级——这是自然语言通往字节码的可行桥。

---

## 三、「自然语言字节码」的性质拆解

字节码之所以是字节码，靠六个性质。逐一映射：

| 字节码性质 | NL spec 对应物 | MumuSpec 现状 |
|---|---|---|
| 稳定的规范格式（JVM spec） | 约束条目的良构 schema | ⚠️ constraints.yaml 有雏形，但与 spec.md 双轨并存、语义靠约定 |
| 加载时 verifier（不通过则拒绝加载） | spec 良构校验 + 实现 vs spec 一致性校验 | ✅ 有骨架（71 个错误码、三层 guard），但覆盖弱：E-SPEC-004「SHALL 无 Enforcement」仅 WARN 且可强制跳过 |
| 平台无关（一次编写处处运行） | 模型/宿主无关（MCP + rules 生成 + context） | ✅ **优势项**，与 Kiro 的 IDE 锁定形成对照 |
| 链接语义（linkage） | 树继承收紧 + GOVERNED_BY 代码绑定 | ✅ 继承完备；绑定是 MVP（内存图 + glob） |
| **不约束执行路径**（字节码只定义签名/类型/不变量，JIT 随便优化） | 结果约束 block，过程约束 advisory | ⚠️ CHG-5 理论已定型，但实践中过程层仍厚：15 个过程性 BP 不可校验地压在 skill 层 |
| 工具生态（instrument/debug/rewrite） | drift 检测 / trace / code graph / 知识提取 | ✅ 雏形齐备，竞品普遍没有 |

**核心洞察**：字节码的成功恰恰在于它**只定义「是什么」（类型、签名、不变量），绝不定义「怎么执行」**——执行路径的自由让 JVM 能不断 JIT 优化而不破坏兼容。对应到 vibecoding：spec 只应约束 WHAT/验收/红线，把 HOW 完全留给 agent 即时优化。本目标与 CHG-5 完全同构——**问题不是方向，是执行没有走完**。

**必须诚实面对的悖论**：字节码无歧义，自然语言有歧义，所以「自然语言字节码」的字面形态不成立。出路只有一条：**结构化骨架（可验证的部分）+ 自然语言血肉（给 LLM 的上下文部分）**——这正是 MumuSpec 的 YAML+MD 混合形态已在做的事。缺的不是形态，是骨架的一致性与可验证性。

---

## 四、MumuSpec 已具备 / 缺口清单

**已具备（字节码性质已落地）**：

1. 持久化 + git 版本化；
2. 双向约束（SHALL/SHALL NOT）——独有；
3. 强度分级（block/warn/info）——verifier 的严重性分级；
4. 渐进披露（context ≤3 层 + MCP）；
5. 树继承 + 收紧不可放宽（链接语义）；
6. drift 检测（agents-hash + contract drift）；
7. 知识层（WHY）+ code graph（HOW 绑定）；
8. 归档合并（delta-specs → scope）。

**缺口（通往字节码化）**：

1. **单一良构 IR 格式缺失**：spec 是自由 Markdown+frontmatter，多文件分工语义靠约定；「字节码级」的良构定义不存在（design-schema.yaml 只管 design.md 的 section 正则）。
2. **验证器覆盖不足**：guard 靠正则 + 4 个 AST 约束（仅 TS）；无 enforcement 的 SHALL 可强制通过——「不可验证的约束」在字节码世界等于不存在的约束。
3. **目标约束与过程约束未分离干净**：15 个过程性 BP 不可校验地占据强制面（skill 层），既厚又无效。
4. **token 经济是启发式**：渐进披露靠层数/页数上限，无显式预算计量。
5. **反向通道（代码→spec）不完整**：GOVERNED_BY 绑定是 MVP，未接入 drift 检测一等公民。

---

## 五、方向性建议

| 优先级 | 建议 | 说明 |
|---|---|---|
| **P0** | **verifier 语义收紧** | 无 enforcement 的 SHALL 不应仅 WARN 且可强制通过；让「可验证覆盖率」成为 spec 质量一等指标。**已单独立提案：`review/proposal-verifier-semantics-2026-08-29.md`** |
| P1 | 统一 IR 格式，消灭双轨 | 以 constraints.yaml 条目结构为唯一 IR 格式（id/维度/极性/target/强度/验证器/溯源），Markdown 降级为渲染视图；RG 维度验收条件采用 EARS 句式 |
| P1 | 过程层出清 | 15 个不可校验的过程性 BP 移出强制面；保留且只保留结果面人机契约（BP-3/4/17）；phase skills 重新定位为「可选编译器前端」 |
| P2 | 按 target 的 JIT 式加载 | 按「本次要动的代码」查询 GOVERNED_BY 拉相关约束子集，把 code graph 绑定变成 context 主入口；token 预算显式计量 |
| P2 | 反向通道升一等公民 | code graph 绑定接入 drift 检测（spec target 变了但代码未动 → 漂移） |
| 保持 | 四项差异化不动 | 双向约束、树继承收紧、漂移检测、模型无关——主流空白区，不为易用性牺牲 |

---

## 六、一句话收束

主流方案在教 agent「按步骤办事」，MumuSpec 在做（且独有）的是给 agent「一张可验证的边界图」。把它字节码化不是加东西，而是**减法**：删掉那层学来的、厚重的过程编排（javac），留下并加固那个独有的、可验证的约束本体（JVM）——0.20.0 的 CHG-5 已经指路，剩下的是走完。

---

## 附：外部参考

- [github/spec-kit](https://github.com/github/spec-kit) · [Spec Kit 文档](https://github.github.com/spec-kit/)
- [Kiro Feature Specs](https://kiro.dev/docs/specs/) · [Introducing Kiro](https://kiro.dev/blog/introducing-kiro/)
- [Specs as the compiler pass for AI code (pre.dev)](https://pre.dev/blog/specs-as-the-compiler-pass-for-ai-code/)
- [mronus/spec — 语言无关 Spec IR](https://github.com/mronus/spec)
- [Specification-Driven Code Translation Powered by LLMs (arXiv 2412.04590)](https://arxiv.org/html/2412.04590v2)

## 附：内部证据索引

| 主题 | 文件 | 位置 |
|---|---|---|
| 约束树合并/继承 | `src/core/config-tree.ts` | :21-148 |
| AST 语义约束（4 个） | `src/guard/providers/typescript-provider.ts` | :48-61 |
| 强度求值顺序 | `src/core/constraint-evaluator.ts` | :85-157 |
| 渐进披露层数选择 | `src/spec/loader.ts` | :359-376 |
| MCP 工具面 | `src/mcp-server.ts` | :68-491 |
| GOVERNED_BY 绑定 | `src/knowledge/graph-builder.ts` | :246-299 |
| agents-hash 漂移 | `src/guard/checker.ts` | :862-932 |
| CHG-5 行为/结果约束 | `docs/design/constraint-strength.md` | §1.3 |
| BP 强制力体检 | `review/goal-todo-assessment-2026-08-28.md` | §1.2 |
| 自评首要劣势 | `docs/appendix/competitive-analysis-chapter.md` | :217 |
