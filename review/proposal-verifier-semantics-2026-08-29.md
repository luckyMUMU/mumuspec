# 提案：Verifier 语义收紧 —— 约束可验证性一等化

> 版本：v0.1.0（draft，待评审）　日期：2026-08-29
> 关联：`review/nl-bytecode-gap-analysis-2026-08-29.md`（P0 项的单独立项）
> 性质：设计提案，未改动任何源码。按 AGENTS.md「外部契约变更须逐项征询」，§八列出全部需用户裁决的契约变更点。

---

## 0. 结论先行

**核心主张：不可验证的约束不是约束。** 字节码的 verifier 在加载时拒绝结构不合法的字节码；MumuSpec 的 verifier 目前却对「无法验证的 SHALL / SHALL NOT」只报一条可被丢弃、可被强制越过的 WARN（E-SPEC-004）。本提案把「可验证性」从隐含假设升级为一等语义：

1. **四分类**：每条 SHALL/SHALL NOT 判定为 `enforced-strong` / `enforced-weak` / `manual` / `unverifiable`；
2. **极性不对称**：SHALL NOT（红线）`unverifiable` = 格式缺陷，新码 **E-SPEC-015**，恒 block、不可强制；SHALL（目标）保持 WARN 但**不再被强度折叠丢弃**；
3. **manual 保留字落地**：`enforcement: manual` 在错误提示文案里存在、在代码中不存在——本提案让它成为真语义，并绑定 verify 阶段的 evidence 义务；
4. **正交性**：可验证性 × 强度是两个独立维度——强度回答「违规时多严重」，可验证性回答「这条约束算不算数」；
5. **覆盖率一等化**：validate / check / MCP 返回 `enforcement_coverage` 计量。

**哲学对位**（呼应用户目标「为目标增加限制但不限制过程」）：本提案加的是**对 spec 质量的元约束**（每条约束必须声明自己如何被验证），不是对 agent 过程的约束——它是 CHG-5「结果约束优先」在 verifier 层的落实：无验证声明的结果约束只是愿望。

**与现状的关键差异（一句话）**：今天 Enforcement 节的自由文本**从未被执行过**，它事实上是 manual 验证的愿望描述；本提案让这个事实显式化、可计量、可门禁。

---

## 一、现状事实链（全部已核实）

| # | 事实 | 证据 |
|---|---|---|
| F1 | E-SPEC-004 `SPEC_ENFORCEMENT_MISSING`：severity=WARN，**forceable: true** | `src/core/errors.ts:40-47` |
| F2 | E-SPEC-004 抛出点：spec.md / tech.md 的 Requirement 有约束但无 Enforcement 节 | `src/spec/validator.ts:107-117, 381-391`；`src/guard/checker.ts:344-356`（逐条粒度）；drift 检测同码 WARN `checker.ts:724-732` |
| F3 | **Enforcement 内容从不执行**：解析结果仅 `{id, description, severity:'ERROR'(硬编码)}`，description 是自由文本，全仓无任何消费者执行它 | `src/spec/parser.ts:111-128`；`src/core/types-constraint.ts:39`（constraints.yaml `enforcement: string` 同样从不执行） |
| F4 | 真实执行通道只有两个：① frontmatter annotation → AST（4 个语义约束：no-mutable-state / enforce-idempotent / no-circular-imports / async-completeness）；② 正则兜底（引号词提取 + eval 模式）——**未注解的 SHALL NOT 仍走兜底**，故「真正不可验证」= 无 annotation + 无法提取引号词/eval/jsx 关键词 | `src/guard/checker.ts:567-646`；`src/guard/providers/typescript-provider.ts:48-61` |
| F5 | 强度折叠会**彻底丢弃** E-SPEC-004：metadata 为 `{TD, min_strength: medium}`，TD=low 时求值为 info → 从输出中删除 | `src/guard/checker.ts:31-32, 75-116`；`src/core/constraint-evaluator.ts:85-157` |
| F6 | `enforcement: manual` 是**文档幽灵**：只存在于 E-SPEC-004 的 fixSteps 文案中，代码无任何识别逻辑 | `src/core/errors.ts:45`（全仓 grep 仅此一处） |
| F7 | verify 阶段对约束验证证据的检查仅是「verify.md 是否包含 SHALL 字样」的 WARN | `src/guard/phase-guard.ts:589-599`（W-VERIFY-001） |
| F8 | 自动注解存在语义错配：「禁止样板代码/DRY」被映射为 `no-side-effect`（样板 ≠ 副作用），制造虚假的 enforced-strong | `src/spec/annotation.ts:26-29` |
| F9 | **dogfooding 基线**：mumuspec 自身 104 个 spec 文件、128 个 Requirement 块，含 Enforcement 节的仅 72（**56%**）；113 块含 SHALL、62 块含 SHALL NOT | 2026-08-29 全仓扫描脚本实测 |

**问题定性**：F3+F5+F6 合起来意味着——一条 SHALL NOT 红线可以既无执行通道、无人工验证声明，又在 low 强度项目里不留任何痕迹地存在。这正是差距分析所指「不可验证的约束在字节码世界等于不存在的约束」的代码级呈现。

---

## 二、目标与非目标（本提案自身的 SHALL / SHALL NOT）

### SHALL（做什么）

| # | 目标 | 判定标准（结果约束） |
|---|---|---|
| S1 | 定义可验证性四分类及确定性判定规则 | 任意一条 SHALL/SHALL NOT 输入分类器，输出唯一类别；无歧义重叠 |
| S2 | SHALL NOT unverifiable 恒 block（E-SPEC-015） | 任何强度配置下 block；`--force` 不可越过 |
| S3 | SHALL 无验证声明恒可见（E-SPEC-004 修订） | 任何强度配置下保留为 warning，不被折叠丢弃 |
| S4 | `manual` 保留字解析 + verify 阶段 evidence 义务 | manual 约束在 verify_to_archive 时逐条检查验证记录，缺失即不通过 |
| S5 | 覆盖率计量输出（CLI + MCP） | `enforcement_coverage` 五桶计数 + ratio，结构化返回 |
| S6 | 修复 F8 注解错配 | 「样板/DRY」不再映射 no-side-effect |

### SHALL NOT（不做什么）

| # | 禁止 | 理由 |
|---|---|---|
| N1 | **不新增执行引擎**（不实现 test:/command: 引用、不扩 AST provider 到新语言） | YAGNI——本提案只管「分类与语义」，引擎扩展是后续提案（tree-sitter 多语言已在 STATUS.md 缺口清单） |
| N2 | **不定义未使用的语法**（不引入 regex:/test:/command: 结构化引用） | 同上；正则兜底已隐式存在，显式化留待 P1「统一 IR 格式」提案一并设计 |
| N3 | **不改变 SHOULD 的任何语义** | SHOULD 从不要求 enforcement（现状 F2 已如此） |
| N4 | **不用 coverage threshold 做门禁**（如 min_enforced=0.8 阻断） | 数据先行；阈值门禁是策略，属用户决策，P2 再议 |
| N5 | **不惩罚存量自由文本 enforcement 行** | 迁移期一律视为隐式 manual（见 §四判定规则 R4），只计量不阻断 |

---

## 三、设计

### 3.1 可验证性四分类（Verifiability Class）

对每条约束（Requirement 块内的每条 SHALL / SHALL NOT，以及 constraints.yaml 每条 ConstraintEntry）按以下**固定顺序**判定，首个命中即停：

| 序 | 类别 | 判定条件（全部基于现状已有机制，零新引擎） | 语义 |
|---|---|---|---|
| R1 | `enforced-strong` | 该条 SHALL NOT 存在 frontmatter annotation（type ≠ custom），或文本带 `ast:` 前缀 | AST 通道真实执行（F4①） |
| R2 | `enforced-weak` | 该条 SHALL NOT 可被正则兜底提取（文本含引号词 / eval / 动态执行 / jsx 关键词） | 词法匹配真实执行，但语义弱（F4②） |
| R3 | `manual` | Enforcement 节含 `manual(<reason>)` 保留字声明；**或**存在自由文本 enforcement 行（存量兼容，见 N5/R4） | 人工验证，verify 阶段负 evidence 义务 |
| R4 | `unverifiable` | 以上皆无 | **格式缺陷**：约束既无执行通道、也无验证声明 |

**SHALL 与 SHALL NOT 的判定差异**：R1/R2 仅适用于 SHALL NOT（annotation 与正则兜底都是 SHALL NOT 专用通道，`checkProhibitionViolation` 只消费 shallNot，F4）。SHALL 的类别只在 `manual` / `unverifiable` / （未来）`enforced` 之间判定——SHALL 当前没有自动执行通道，这是诚实的现状，不粉饰。

**对 constraints.yaml 的适用**：ConstraintEntry 的 `enforcement: string` 字段沿用同一分类——值为 `manual(...)` 即 manual；非空自由文本按 R4 存量规则视为隐式 manual；空串 unverifiable。constraints.yaml 与 spec.md 对同一约束的双轨表达按现状派生关系（sync 单向）对齐，不做去重（N1 边界内）。

**标注**：F8 修复后，自动注解只产出能真实执行的类别；「样板/DRY」类 SHALL NOT 在 R2/R3/R4 中重新归位（大概率 R4，从而被 E-SPEC-015 暴露——这是期望行为，不是回归）。

### 3.2 `manual` 保留字语法（向后兼容）

Enforcement 节行语法扩展（`src/spec/parser.ts` 解析层）：

```markdown
### Enforcement
- ENF-1: manual(由人工在 code review 中核对 —— 无法用正则/AST 表达业务语义)
- ENF-2: <自由文本>        ← 存量：视为隐式 manual，coverage 计入 manual 桶
```

- 解析规则：description 匹配 `/^manual\((.+)\)$/` → `EnforcementRule { id, kind: 'manual', reason }`；其余 → `kind: 'implicit-manual'`（存量）。
- `EnforcementRule` 类型新增 `kind` 字段（`src/core/types-spec.ts`），新增字段向后兼容（旧消费者忽略）。
- 显式 manual 与隐式 manual 的**语义相同**（都要求 verify evidence），差异仅在 coverage 报告中显式 manual 视为「已声明」，隐式 manual 在 validate 输出中提示升级（info 级，一次性迁移提示）。

### 3.3 错误码语义变更表

| 码 | 现状 | 变更后 | 理由 |
|---|---|---|---|
| **E-SPEC-015**（新增）`SPEC_SHALL_NOT_UNVERIFIABLE` | — | **ERROR**，`forceable: false`，GUARD_CHECK_METADATA 注解 `{ dimension: 'requirement_goals', min_strength: 'high', always_enforce: true }`（类比 E-GUARD-003 红线注解，`checker.ts:30`） | SHALL NOT 是加载即须验证的红线（字节码 verifier 类比）；verifier 不提供「跳过校验」，只提供「声明人工验证」（降级为 manual 即不再触发）。触发条件：R4 判定且极性为 SHALL NOT |
| **E-SPEC-004**（修订）`SPEC_ENFORCEMENT_MISSING` | WARN，forceable: true，可被 TD=low 折叠丢弃（F5） | 语义收窄为「**SHALL** 无验证声明（R4 且极性为 SHALL）」；severity 维持 WARN，但 metadata 改为 `always_enforce: true` → 任何强度下保留为 warning 不被丢弃；`forceable: false` | SHALL 是必达目标，无验证声明至少要恒可见；不升 ERROR 是因为 SHALL 的自动执行通道尚不存在（N1），一刀切 block 会让所有项目立即红且无修复路径 |
| **W-VERIFY-001**（修订） | verify.md 包含「SHALL」字样即通过（F7） | 拆分：字样检查保留为 info；新增 **E-VERIFY-003** `MANUAL_EVIDENCE_MISSING`：verify.md 中缺少任一 manual 类约束的验证记录 → **ERROR**（forceable: true，走既有 accept-deviations 旁路） | manual 的 evidence 义务是本提案换取「不升 ERROR」的对价：不声明通道可以，但归档前必须证明验证过 |
| E-SPEC-005 / E-SPEC-012 | SHALL 实现存在性检测 | **不变**（本提案不动 drift 语义） | 边界最小化 |

错误码定义改动后由 `npm run prebuild` 的 `scripts/gen-error-codes-doc.mjs` 自动再生成 `docs/reference/error-codes.md`（该文件禁止手改）。

### 3.4 与强度系统的正交性（修订 constraint-strength.md §9）

现状求值顺序（`constraint-evaluator.ts:85-157`）：例外清单 → workflow override → capability override → 按强度映射。本提案在**文档与代码两处**把可验证性前置为一个与强度无关的独立判定：

```
求值顺序（修订后 §9.1）：
  0. 可验证性判定（新增）：
     - SHALL NOT + unverifiable → block（E-SPEC-015，格式不变量，不入例外清单——它先于强度存在）
     - SHALL + unverifiable → warn（E-SPEC-004，恒可见）
  1. 例外清单 / always_enforce → block（不变）
  2. workflow override（不变）
  3. capability override（不变）
  4. 按当前强度 block/warn/info（不变）
```

**二维语义表**（设计说明，非实现）：

| | high | medium | low |
|---|---|---|---|
| enforced-strong/weak 违规 | block | block/warn（按维度） | warn/info（按维度） |
| manual 缺 evidence（verify 阶段） | block | block | block（verify 是结果门禁，随 BP-17 入例外清单语义，不随强度降级） |
| unverifiable（SHALL NOT） | **block** | **block** | **block** |
| unverifiable（SHALL） | warn | warn | warn |

> 「可验证性回答算不算数，强度回答多重」——unverifiable 不是「低强度下可容忍的违规」，而是「进入强度讨论前的格式前提」，故置于求值序 0。

### 3.5 覆盖率计量（`enforcement_coverage`）

`mumuspec validate` / `mumuspec check` 输出末段 + MCP `validate_specs` / `check_compliance` 返回体新增字段：

```json
{
  "enforcement_coverage": {
    "total": 128,
    "enforced_strong": 18,
    "enforced_weak": 31,
    "manual": 41,
    "unverifiable": 38,
    "declared_ratio": 0.70,   // (total - unverifiable) / total
    "strong_ratio": 0.14      // enforced_strong / total
  }
}
```

- `declared_ratio` 是主指标（差距分析所称「可验证覆盖率」）；`strong_ratio` 用于观察注解化进度，不做门禁（N4）。
- CLI 人类可读输出同时列出 unverifiable 明细（文件 + Requirement 名 + 约束文本前 60 字符），作为迁移清单的直接来源。

### 3.6 数据格式示例（before / after）

现状（ unverifiable 的 SHALL NOT，任何配置下无痕存在）：

```markdown
## Requirement: 依赖管理
### SHALL NOT
- 禁止引入未被请求的抽象层与第三方依赖
```

收紧后的三条合法出路：

```markdown
# 出路 1：annotation 化（enforced-strong）
---
prohibitions:
  - text: "禁止引入未被请求的抽象层与第三方依赖"
    annotation: { type: no-new-dependency, scope: module }
---

# 出路 2：显式 manual（本提案新保留字）
### Enforcement
- ENF-1: manual(依赖清单在 code review 逐项核对)

# 出路 3：改写文本使正则兜底可提取（enforced-weak）
- 禁止引入 `lodash` 等未被请求的第三方依赖     ← 引号词可提取
```

---

## 四、影响分析（对外契约变更——**需逐项征询**）

按 AGENTS.md 外部契约流程，以下均为对外可见变更，**未经用户逐项同意不得实施**：

| # | 契约面 | 变更 | breaking? | 兼容措施 |
|---|---|---|---|---|
| C1 | `docs/reference/error-codes.md`（npm 发布物） | E-SPEC-004 语义修订 + E-SPEC-015/E-VERIFY-003 新增 | 文档级 | 自动再生成 + CHANGELOG 声明 |
| C2 | MCP `validate_specs` / `check_compliance` 返回体 | 新增 `enforcement_coverage` 字段 | 否（纯新增） | 旧客户端忽略未知字段 |
| C3 | `mumuspec validate` / `check` CLI stdout | 末段新增 coverage 报告 + unverifiable 明细 | 否 | — |
| C4 | guard 行为：E-SPEC-015 启用后 SHALL NOT 无验证声明 → CI/验证红 | **是（行为 breaking）** | §五迁移门控：`specs.enforcement_strict` 开关分两版落地 |
| C5 | phase 流行为：verify_to_archive 新增 E-VERIFY-003 检查 | 是（门禁变严） | 同上门控 + accept-deviations 既有旁路 |
| C6 | `EnforcementRule` / `ConstraintEntry` 类型新增 `kind` 字段 | 否（纯新增） | 旧序列化忽略 |
| C7 | 受影响源码目录 | `src/core`（errors/types-spec/constraint-evaluator）、`src/spec`（parser/validator/annotation）、`src/guard`（checker/phase-guard）、`src/mcp-server.ts`、`src/cli/commands/spec.ts` | — | 见 §六边界清单 |

**dogfooding 成本**（F9）：128 块中 56 块当前 unverifiable（44%）。其中预计大部分可通过引号化（出路 3）或 manual 声明（出路 2）低成本迁移；E-SPEC-015 启用前必须完成自身迁移——**mumuspec 是自己的第一个用户**。

---

## 五、迁移策略（三阶段，每阶段独立可交付）

| 阶段 | 内容 | 默认行为 | 出口条件（结果约束） |
|---|---|---|---|
| **M1 分类与计量** | 分类器 + coverage 输出 + E-SPEC-004 修订（恒可见）+ F8 修复 + manual 保留字解析 | 全部非阻断（warn/info）；`specs.enforcement_strict` 默认 `false` | dogfooding `declared_ratio ≥ 0.9`（56 块存量迁移完成）；测试全绿 |
| **M2 红线门禁** | E-SPEC-015 启用 ERROR；E-VERIFY-003 verify 门禁 | 门控默认仍 `false`，**发布一个 minor 提前公告** | 下一 minor 翻为默认 `true`；`declared_ratio = 1.0` |
| **M3 缺口收官** | `mumuspec validate --annotate` 交互式迁移助手（对 unverifiable 逐条建议出路 1/2/3，复用既有 `mumuspec annotate` 命令骨架） | 随 M2 发布 | 迁移人工时长 < 1 小时（dogfooding 实测） |

**回滚设计**：门控 `specs.enforcement_strict: false` 一键回到 M1 行为（E-SPEC-015/E-VERIFY-003 静默为 info），不需要代码回滚。

---

## 六、边界与实现顺序（Top-Down / Bottom-Up）

**设计阶段（自顶向下，先写 BOUNDARY.md 再动代码）**：

1. `src/.mumuspec/BOUNDARY.md` — mcp-server 返回结构（C2）
2. `src/core/.mumuspec/BOUNDARY.md` — E-SPEC-015/E-VERIFY-003 定义、EnforcementRule.kind、求值序 0（C1/C6）
3. `src/spec/.mumuspec/BOUNDARY.md` — 分类器、manual 解析、validator 三处抛出点变更
4. `src/guard/.mumuspec/BOUNDARY.md` — GUARD_CHECK_METADATA 注解、phase-guard verify 检查（C4/C5）
5. `src/cli/commands/.mumuspec/BOUNDARY.md` — validate/check 输出面（C3）

**实现阶段（自底向上，同级兄弟全部完成才向上归档）**：

```
core/types-spec.ts (kind 字段)
  → core/errors.ts (两个码) + core/constraint-evaluator.ts (序 0)
    → spec/parser.ts (manual 解析) + spec/annotation.ts (F8 修复)
      → spec/verifier-classify.ts (新文件：四分类纯函数，零 I/O)
        → spec/validator.ts + guard/checker.ts + guard/phase-guard.ts
          → cli/commands/spec.ts + mcp-server.ts (coverage 输出)
            → docs 再生成 (gen-error-codes-doc.mjs) + constraint-strength.md §9 修订
```

> 分类器独立成纯函数模块（`spec/verifier-classify.ts`），与 evaluator 同风格（no I/O，可单测）——复用 checker 现有提取逻辑（引号词正则等）时抽为共享函数，避免两处正则漂移。

---

## 七、测试用例设计（红绿 TDD：测试是 Design 产出，Design 定稿后锁定）

| # | 用例 | 断言 |
|---|---|---|
| T1 | SHALL NOT + annotation(type≠custom) | 分类 enforced-strong；E-SPEC-015 不触发 |
| T2 | SHALL NOT 无 annotation，文本含引号词 | 分类 enforced-weak；E-SPEC-015 不触发 |
| T3 | SHALL NOT 无 annotation，纯自由文本无引号词 | 分类 unverifiable；strict 开启时 E-SPEC-015 = ERROR |
| T4 | SHALL NOT + `manual(理由)` | 分类 manual；E-SPEC-015 不触发 |
| T5 | SHALL 无 Enforcement 节 | E-SPEC-004 warning，**TD=low 时仍存在**（回归 F5） |
| T6 | SHALL + 自由文本 enforcement 行 | 分类 implicit-manual；E-SPEC-004 不触发；coverage 计入 manual |
| T7 | coverage 计数 | 五桶计数与 ratio 对 3 条样例约束精确匹配 |
| T8 | E-SPEC-015 在所有强度组合下 block | TD/RG × high/medium/low 九宫格全部 block |
| T9 | E-SPEC-004 在 TD=low 下保留为 warning | 不被折叠丢弃 |
| T10 | verify_to_archive + manual 约束 + verify.md 无该条记录 | E-VERIFY-003 = ERROR |
| T11 | verify_to_archive + manual 约束 + verify.md 含锚点记录 | 通过 |
| T12 | 旧格式 spec.md（无 doc_type）中 unverifiable SHALL NOT | strict=false 时仅 info（门控回归） |
| T13 | 「禁止样板代码」文本 | 不再产出 no-side-effect 注解（F8 回归） |
| T14 | constraints.yaml `enforcement: ""` | 分类 unverifiable，计入 coverage |

---

## 八、成功指标（全部可测，对齐 `.mumuspec/goal.md` 度量口径）

| 指标 | 基线（F9） | M1 末 | M2 末 |
|---|---|---|---|
| dogfooding `declared_ratio` | 56% | ≥ 90% | 100% |
| dogfooding `unverifiable` 计数 | 56 块 | ≤ 13 块 | 0 |
| E-SPEC-015 误报率（分类判定 vs 人工复核） | — | < 5% | < 5% |
| manual 约束 verify evidence 完整率（dogfooding） | 无此检查 | 100% | 100% |

---

## 九、开放问题（请评审逐项裁决）

| # | 问题 | 建议 | 备选 |
|---|---|---|---|
| Q1 | E-SPEC-015 是否对旧格式 spec.md（无 doc_type）grandfather？ | **不 grandfather**——正则兜底对两格式同样有效，且门控已提供缓冲 | grandfather 至 M3 |
| Q2 | SHALL NOT 允许 manual 吗（红线人工验证）？ | **允许**——敏感信息人工审查等红线本就无法自动验证；evidence 义务（E-VERIFY-003）已兜底 | 禁止 manual，逼全注解化（迁移成本显著上升） |
| Q3 | regex: / test: / command: 结构化 enforcement 引用 | **本提案不做**（N1/N2），与 P1「统一 IR 格式」提案合并设计 | 本提案带上 regex:（正则兜底显式化） |
| Q4 | coverage threshold 门禁（min_enforced） | **不做**（N4），M3 后看数据再议 | M2 直接上 0.9 门禁 |
| Q5 | F8 注解错配修复是否随本提案 | **随本提案**（一行改动，且不修会让 coverage 的 strong 桶虚高） | 独立提交 |
| Q6 | `specs.enforcement_strict` 门控放 config.yaml 还是 config-tree 分层？ | **分层**（`constraint_strength.enforcement_strict`），子层可收紧不可放宽，与既有树语义一致 | 平铺 config.yaml specs 节 |

---

## 十、评审通过后的落地路径

| 优先级 | 工作量估计 | 内容 |
|---|---|---|
| P0-a | 0.5 人日 | §六 5 份 BOUNDARY.md 变更 + 文档同步（constraint-strength.md §9 / spec-layer.md enforcement 节定义） |
| P0-b | 2 人日 | M1 全部（分类器 + coverage + E-SPEC-004 修订 + F8 + manual 解析 + T1-T14 红绿） |
| P0-c | 1 人日 | dogfooding 56 块存量迁移（--annotate 助手 + 人工确认） |
| P0-d | 1 人日 | M2 门控启用 + E-VERIFY-003 + CHANGELOG/公告 |

**在 M1 的测试（T1-T14）锁定之前，不进入任何编码阶段**（四步工作流规则）。

---

## 十一、实施记录（2026-08-29，实施完毕）

> 状态：M1 + P0-a 已实施，门控默认关闭（M2 观察态）。开放问题按 §九建议项裁决执行。

### 落地清单

| 项 | 内容 | 文件 |
|---|---|---|
| 边界 | 5 份 BOUNDARY.md 变更记录 + 白名单文档同步 | `src/.mumuspec`、`src/core`、`src/spec`、`src/guard`、`src/cli/commands` |
| 分类器 | 四分类纯函数 + 共享正则提取 + evidence 匹配 | `src/spec/verifier-classify.ts`（新） |
| 错误码 | E-SPEC-015（ERROR/forceable:false）、E-VERIFY-003（ERROR/forceable:true）；E-SPEC-004 修订（语义收窄 + forceable:false） | `src/core/errors.ts`；`docs/reference/error-codes.md` 再生（71→73 码，新增 VERIFY 域） |
| 门控 | `constraint_strength.enforcement_strict`（默认 false） | `src/core/config.ts`（deepMerge 自动透传） |
| 解析 | `manual(...)` 保留字 + 序列化 round-trip + `EnforcementRule.kind` | `src/spec/parser.ts`、`src/core/types-spec.ts` |
| 发射 | validator/checker 双入口：E-SPEC-015 门控分桶（strict→ERROR / 非严格→warning）、E-SPEC-004 恒可见（metadata `always_enforce`，实现 §9.0 前置判定，无新增求值分支——复用既有例外清单通道） | `src/spec/validator.ts`、`src/guard/checker.ts` |
| evidence | verify_to_archive 逐条 manual evidence 检查（strict 门控） | `src/guard/phase-guard.ts` |
| 计量 | `GuardResult.coverage?: EnforcementCoverage` 五桶 + 迁移清单；`mumuspec validate` 人类可读报告；`check --json` 聚合面透传（含 folding 透传修复） | `src/core/types-workflow.ts`、`src/cli/commands/spec.ts`、`src/guard/checker.ts` |
| F8 | 移除「样板/DRY → no-side-effect」错配 | `src/spec/annotation.ts` |
| 测试 | T1-T14 + 强度正交回归（37 个新用例）+ 6 个旧语义用例更新到新锁定语义 | `tests/spec/verifier-classify.test.ts`、`tests/spec/verifier-strict.test.ts`、`tests/guard/verify-evidence.test.ts`、`tests/guard/checker-deep.test.ts`、`tests/guard/checker.test.ts` |

### 与提案的偏差（均已按 Ponytail 规则标注或记录）

| # | 偏差 | 理由 |
|---|---|---|
| D1 | Q6 门控落地为根级 `constraint_strength.enforcement_strict`（非树分层） | YAGNI——按层收紧暂无真实需求方；`ponytail:` 注释已标注，树分层留给 P1 IR 统一提案 |
| D2 | T12「仅 info」落地为 warning 桶（GuardResult 无 info 桶） | 门控关闭时 E-SPEC-015 进 warnings（可见、不阻断），消息带「将在 strict 模式下阻断」标注 |
| D3 | §9.0 前置判定通过既有 `always_enforce` 通道实现，未新增求值分支 | Ponytail 第 2 级（复用已有实现）；语义等价且文档已说明 |
| D4 | E-VERIFY-003 对旧格式（无 doc_type frontmatter 的 tech.md）静默跳过 | parseTechFile 无 frontmatter 即抛错，收集器容错跳过；权威验证在 `mumuspec validate` |
| D5 | P0-c 存量迁移**无需执行** | 机器可见宇宙（活跃规范层、可解析 Requirement 块）实测 180 条约束 declared_ratio=100%（170 manual + 10 enforced-weak + 0 strong + 0 unverifiable）。提案 §一 F9 的 56% 基线是块级近似，混入了归档变更工件（`.mumuspec/changes/archive/**`，validator 按设计不扫描点目录内层）与旧格式文件。M1 出口条件以更大余量满足；后续可观察 `strong_ratio`（当前 0%）作为注解化（`mumuspec spec annotate`）的牵引指标 |
| D6 | 驱动性修复（超出提案范围的预存在缺陷） | ① `mumuspec init` 创建 `knowledge/rationale`（单数）而白名单与其余代码均用 `rationales`，且 init 创建的 `.mumuspec/skills/` 未入白名单——新初始化项目立即报 E-SPEC-013（`tests/cli.test.ts should validate specs` 在 master 即红，已用 HEAD 基线工作树验证）；② 同法验证 `cli-smoke mumuspec check` 失败亦为预存在（根 spec 共存禁令 vs demo 夹具内容），**未修**，留待用户裁决 demo 内容或根规范 |

### 验证结果

- `tsc --noEmit` 干净；全量测试 4770/4771 通过，唯一失败为上述预存在的 dogfooding smoke（HEAD 基线复现，与本提案无关）
- `mumuspec validate` coverage 实测：180 条约束，declared_ratio 100%，strong_ratio 0%
- `mumuspec check --json` 的 compliance 载荷含 coverage 字段（C2 兑现）

### 遗留与后续

1. **M2 启用**：下一个 minor 将 `enforcement_strict` 默认翻 true（E-SPEC-015 转 ERROR、E-VERIFY-003 生效），发布说明提前公告。
2. **strong_ratio 牵引**：当前 0%——可用既有 `mumuspec spec annotate` 对 dogfooding 红线做注解化提升。
3. **预存在失败两项**（与本提案无关，需独立裁决）：① 上述 D6 的 demo/根规范共存冲突；② `E-VERIFY-001/002` 从未登记进 `errors.ts` 注册表（错误码文档缺此域条目）。
4. **P1 续接**：统一 IR 格式提案（差距分析 P1）应承接 D1 的树分层门控与 Q3 的结构化 enforcement 引用（test:/command:）。

---

## 十二、M2 翻闸记录（2026-08-29，同日执行）

用户裁决：**接受 M2，立即翻闸**（§五迁移策略中「发布一个 minor 提前公告」的缓冲被用户明确豁免，公告义务由 CHANGELOG【Unreleased】的 Changed 条目承接）。

| 项 | 内容 |
|---|---|
| 门控语义 | `enforcement_strict` 从 opt-in（缺省 off）翻为 **opt-out（缺省 ON）**：三处判定统一为 `!== false`（`validator.ts` / `checker.ts` / `phase-guard.ts`），无配置的既有项目即刻生效 |
| 效果 | E-SPEC-015 默认以 ERROR 阻断 validate/check；E-VERIFY-003 默认生效于 verify_to_archive |
| 退路 | 项目 `config.yaml` 设 `constraint_strength.enforcement_strict: false` 一键退回观察态 |
| 测试 | T12 / T12g 更新为 M2 语义（缺省 ON + 显式 opt-out 两用例）；全量回归通过 |
| dogfooding | 本仓库活跃规范层 unverifiable=0，翻闸后 validate/check 无新增错误 |

---

## 十三、定位修正：持久化 spec 是 DSL，不是字节码（2026-08-29，用户裁决）

用户对差距分析的目标命题作出修正：**MumuSpec 的持久化 spec 应当被视为一门 DSL（领域特定语言），而非完全参考字节码的设计**。知识层已登记为决策页 `.mumuspec/knowledge/decisions/global/KP-0059-spec-as-dsl-not-bytecode.md`。

对既有文档的影响口径（修订而非作废）：

| 字节码类比中的性质 | DSL 框架下的去向 |
|---|---|
| 加载时 verifier（不通过则拒绝） | **保留**——P0 已实现（E-SPEC-015 恒 block、可验证性 ⊥ 强度） |
| 平台无关（模型/宿主无关消费） | **保留**——MCP + rules 生成 + context |
| 不约束执行路径（结果约束优先） | **保留**——CHG-5，与 DSL 语义正交 |
| 字节码式「中间表示」定位（从上游编译来、向下游编译去） | **放弃**——spec 不是编译产物，而是**作者直接书写的一等语言**：`## Requirement:` 块语法、SHALL/SHALL NOT/Enforcement 结构、`manual(...)` 关键字、frontmatter annotation、constraints.yaml schema 构成其语法面；极性/维度/强度/可验证性构成其语义面；validate/check 构成其 verifier |
| 后续命名 | 差距分析 P1「统一 IR 格式」应重新表述为「**统一 DSL 语言规范**」：grammar（结构 schema）+ semantics（判定规则）+ diagnostics（错误码）三件套，而非 IR 中间格式 |

本提案（verifier 语义收紧）在两种框架下同样成立——它收紧的是 DSL 的**静态语义**（每条约束必须声明验证方式），这正是 DSL 相比自由文档的核心增值。
