# Test Cases — Layer 2（消费层）

> 变更：eval-corpus ｜ 层：L2 消费 ｜ 依据：design.md §1 / §2.3 / §3（L2）/ §4（L2）/ §5，DS-EVAL-004
> 被测源码：`src/cli/commands/eval.ts`（`--report` 文本 + JSON，`buildSummaryReport`）、`.eval-corpus/` 语料库（`_baseline` + bad-case + clean）、新增 `tests/eval/fixture-location.test.ts`
> 测试代码落点（Build 阶段）：新增 `tests/cli/commands/eval-handler.test.ts`（report 双形态 + JSON 契约冻结）、`tests/eval/fixture-location.test.ts`（位置隔离）；语料内容校验 `tests/eval/corpus-fixtures.test.ts`
> 说明：非测试代码；本文件为**用例定义**，供 BP-8 锁定。

## 覆盖矩阵

| 依据 | 覆盖用例 |
|---|---|
| DS-EVAL-004 SHALL（`--report` 文本 + JSON 双形态，聚合四段） | L2-C01、L2-C02、L2-C04、L2-C05、L2-C16 |
| DS-EVAL-004 SHALL（语料隐藏目录 `.eval-corpus`；覆盖码清单） | L2-C06、L2-C08、L2-C13 |
| DS-EVAL-004 SHALL NOT（语料不在 tests/temp 等被扫描路径） | L2-C07、L2-C08 |
| DS-EVAL-004 SHALL NOT（report 不改 check/validate JSON schema） | L2-C09、L2-C10 |
| DS-EVAL-004 Enforcement（fixture-location 断言） | L2-C06、L2-C07 |
| DS-EVAL-004 Enforcement（report 渲染单测快照） | L2-C01、L2-C02、L2-C03 |
| R-3 / Q4-003（version=1 冻结契约） | L2-C03 |
| R-2（n=0 消费不崩溃） | L2-C16 |
| C-4 / C-6 / Q1-007（仅 stdout 不落盘 / 退出码不变） | L2-C10、L2-C11 |
| §4 L2 回归（验收场景 5） | L2-C12 |
| 探测 4（327→331 污染基线） | L2-C07 |
| severity 分档（§2.3.2） | L2-C14 |
| metrics 同源（§2.3.1 进程内调用） | L2-C15 |
| **DS-EVAL-004 SHALL（report 汇总附 corpus 聚合精度，仅展示不设阈值）** | L2-C17 |
| **BP-12：report 只加字段不改既有（precision 新增 + version 仍 1）** | L2-C17 |
| **BP-12：文本渲染 errored fixture 提示 + 「置信不足」** | L2-C05、L2-C18 |
| **BP-12：已声明阈值而分母为 0 → resultErrors（fail-closed，场景层可见）** | L2-C19 |
| 语料覆盖目标收敛为 **15 个可发射码**（E-SPEC-005/007/012 → registered-but-not-emitted，M1 出范围） | L2-C13 |

## 用例清单（摘要）

| ID | 名称 | 优先级 | 隔离方式 |
|---|---|---|---|
| L2-C01 | report 文本形态四段 | P0 | mock report 数据 |
| L2-C02 | report JSON 形态 EvalSummaryReport 结构 | P0 | mock report 数据 |
| L2-C03 | R-3 JSON 契约冻结 version===1 + 字段集 | P0 | 快照 |
| L2-C04 | coverageRef 四维阈值 + command 指针 | P0 | mock 数据 |
| L2-C05 | n<3 文本标注「置信不足」 | P0 | mock 数据 |
| L2-C06 | fixture-location：仓库根 total 不含 .eval-corpus | P0 | 仓库根集成 |
| L2-C07 | fixture-location：有/无语料两次 total 相等 | P0 | 仓库根集成 |
| L2-C08 | 语料位于隐藏目录、不在被扫描路径 | P0 | 仓库根集成 |
| L2-C09 | report 不改 check/validate JSON schema | P0 | 仓库根集成 |
| L2-C10 | report 仅 stdout 不落盘 | P0 | CLI 集成 |
| L2-C11 | 退出码语义不变 | P0 | CLI 集成 |
| L2-C12 | 全量回归绿（custom 兼容） | P0 | 全量 vitest |
| L2-C13 | 语料覆盖码清单完整（15 个可发射码） | P0 | 语料枚举 |
| L2-C14 | severity 分档由 expected.yaml 声明 | P1 | 语料枚举 |
| L2-C15 | report.metrics 与评估器同源 | P1 | mock 数据 |
| L2-C16 | 空 corpus 场景消费不崩溃 | P0 | mock 数据 |
| L2-C17 | report JSON 新增 precision 聚合字段（version 仍 1） | P0 | mock 数据 |
| L2-C18 | report 文本渲染 errored fixture 提示 + 「置信不足」 | P0 | mock 数据 |
| L2-C19 | 已声明阈值而分母为 0 → resultErrors（fail-closed 场景层可见） | P0 | mock/runner |

---

## A. `eval --report` 汇总输出（`src/cli/commands/eval.ts`）

> 用构造好的 `EvalReport`（含 `corpusReports` + 既有 results）直接调 `buildSummaryReport` / `renderSummaryText`，避免真跑子进程（R-6）。

### L2-C01 · report 文本形态四段
- **验证目标**：design §1.1 文本形态 / §2.3.1 文本渲染 / §4 L2「report 文本快照」；DS-EVAL-004 SHALL
- **前置**：构造 `EvalReport`（1 个 corpus 场景 + 既有场景），corpus 报告含 recall/noise/Wilson CI、四分类计数、fail-open 分组、coverageRef
- **步骤**：`renderSummaryText(buildSummaryReport(report, root))`
- **期望**：文本含四段可读内容 —— ① `recall=`、`noise=`、`n=` 与 CI 区间；② A1 可验证率（`strong`/`strong_ratio` 或等价四分类展示）；③ B4 fail-open 计数（按 action 分组）；④ 测试覆盖率引用（B6 阈值 + 采集命令）。逐场景打印 `recall=x (n=k, CI=[l,u]) / noise=y / precision=z`
- **优先级**：P0 ｜ **隔离**：mock report 数据（纯渲染）

### L2-C02 · report JSON 形态 EvalSummaryReport 结构
- **验证目标**：design §2.3.1 `EvalSummaryReport` 契约 / §4 L2「report JSON 快照」；DS-EVAL-004 SHALL
- **前置**：同上
- **步骤**：`JSON.parse(JSON.stringify(buildSummaryReport(report, root)))`
- **期望**：顶层含 `version`、`generatedAt`（ISO 8601）、`evals{total,passed,failed,duration}`、`corpus[]`（来自 `report.corpusReports`）、`metrics{'verifiable-ratio','fail-open-count'}`（各含 `value/weight/details`，可选 `rawData`）、`coverageRef{metric,thresholds,command}`、`precision{mustContainSatisfied,mustContainTotal,ratio}`（BP-12-2，仅展示）
- **优先级**：P0 ｜ **隔离**：mock report 数据

### L2-C03 · R-3 JSON 契约冻结 version===1 + 字段集
- **验证目标**：design §2.3.1 冻结契约 / §4 L2 **Q4-003** / **R-3**（只加字段、不改既有字段类型/语义）
- **前置**：同上
- **步骤**：`Object.keys(summary).sort()`；读 `summary.version`
- **期望**：`summary.version===1`（number，非 string）；顶层字段集**恰好**为冻结集 `['corpus','coverageRef','evals','generatedAt','metrics','precision','version']`（BP-12-2 新增顶层 `precision`，仍 version 1；快照断言 `toEqual`）；`metrics` 子键集恰为 `['fail-open-count','verifiable-ratio']`。任何字段增删或改名都会使本用例红
- **优先级**：P0 ｜ **隔离**：快照

### L2-C04 · coverageRef 四维阈值 + command 指针
- **验证目标**：design §2.3.1 `coverageRef` 取自 `vitest.config.ts`；DS-EVAL-004（「测试覆盖率引用」= 指针非 embed 数值）
- **前置**：同上
- **步骤**：读 `summary.coverageRef`
- **期望**：`metric==='vitest-v8'`；`thresholds` 严格 `{lines:95,branches:95,functions:95,statements:95}`；`command` 为非空字符串（采集命令，非数值嵌入）
- **优先级**：P0 ｜ **隔离**：mock 数据

### L2-C05 · n<3 文本标注「置信不足」
- **验证目标**：design §1.1「n<3 标注置信不足」/ §2.3.1；DS-EVAL-001/004
- **前置**：构造 corpus 报告 recall `n=2`（`insufficient:true`）
- **步骤**：`renderSummaryText(...)`
- **期望**：对应场景行含「置信不足」；`n>=3` 场景行**不**含该标注
- **优先级**：P0 ｜ **隔离**：mock 数据

### L2-C16 · 空 corpus 场景消费不崩溃
- **验证目标**：design §2.1.3 step2 / §1.1；**R-2**（n=0 消费端优雅降级）
- **前置**：构造 corpus 报告 `total:0`，`recall.value:null`、`noise.value:null`、`ci:null`
- **步骤**：`renderSummaryText(...)` 与 `buildSummaryReport(...)`
- **期望**：渲染显示 `n=0` 且不抛异常；JSON 中 `corpus[0].recall.value===null`；不出现 `NaN`/`Infinity` 文本
- **优先级**：P0 ｜ **隔离**：mock 数据

### L2-C15 · report.metrics 与评估器同源
- **验证目标**：design §2.3.1（进程内直接调用 `verifiableRatioEvaluator.evaluate` / `failOpenCountEvaluator.evaluate`，与 `metrics` 命令同源）
- **前置**：mock 评估器依赖（spawn / audit.log）
- **步骤**：比较 `summary.metrics['verifiable-ratio']` 与直接调用评估器返回的 `MetricResult`
- **期望**：`value` / `weight`（===0）/ `details` 一致；无二次 spawn 自建通道
- **优先级**：P1 ｜ **隔离**：mock 数据

---

## B. fixture-location 断言（新增 `tests/eval/fixture-location.test.ts`，DS-EVAL-004 Enforcement）

> 在**仓库根**集成运行（真实 `validate --json` 或进程内 `validateAllSpecs`），对照探测 4 的 327→331 污染基线。

### L2-C06 · fixture-location：仓库根 total 不含 .eval-corpus
- **验证目标**：design §2.3.3 / **DS-EVAL-004 Enforcement** / SHALL NOT（语料不在被扫描路径）
- **前置**：仓库根存在 `.eval-corpus/` 全套语料
- **步骤**：仓库根运行 `validate --json`（或 `validateAllSpecs`），读取 `coverage.total` 与参与扫描的 spec 路径清单
- **期望**：参与计量的 spec 路径**不含**任何 `.eval-corpus/` 下的条目；`total` 不受语料存在影响
- **优先级**：P0 ｜ **隔离**：仓库根集成

### L2-C07 · fixture-location：有/无语料两次 total 相等
- **验证目标**：design §2.3.3（对照探测 4 的 327→331）；**DS-EVAL-004** SHALL NOT（防止语料挪入被扫描路径的回归）
- **前置**：记录**有** `.eval-corpus/` 时的 `coverage.total`
- **步骤**：临时将 `.eval-corpus/` 移出（或改名）→ 复测 `coverage.total` → 恢复
- **期望**：两次 `total` **严格相等**（探测实证：语料若落被扫描路径会使 total 327→331；本用例锁死位置隔离，一旦语料挪进 `findSpecDirs` 扫描路径即红）
- **优先级**：P0 ｜ **隔离**：仓库根集成

### L2-C08 · 语料位于隐藏目录、不在被扫描路径
- **验证目标**：design §2.3.2 / **C-4**（`findSpecDirs` 天然跳过 `name.startsWith('.')`）/ DS-EVAL-004 SHALL + SHALL NOT
- **前置**：仓库根语料目录 `./.eval-corpus/`
- **步骤**：断言语料目录基名以 `.` 开头（隐藏）；断言 `tests/`、`temp/` 下无会被规范 walker 扫描的语料 fixture（含 `.mumuspec/prd.md` 的目录）
- **期望**：语料仅位于 `.eval-corpus/`；`tests/`、`temp/` 路径下无语料 fixture
- **优先级**：P0 ｜ **隔离**：仓库根集成

---

## C. schema 不变与产物约束

### L2-C09 · report 不改 check/validate JSON schema
- **验证目标**：design §1.1 / **C-3** / §1.3；DS-EVAL-004 SHALL NOT（report 不改变 check/validate 既有 JSON schema）
- **前置**：分别运行 `validate --json`、`check --json`（report 启用/未启用两次）
- **步骤**：比较两次输出的顶层键集合与既有字段类型
- **期望**：`validate`/`check` 的 JSON 顶层 schema 在 `--report` 前后**完全一致**（无新增/删除/改名）；report 只读消费
- **优先级**：P0 ｜ **隔离**：仓库根集成

### L2-C10 · report 仅 stdout 不落盘
- **验证目标**：design §1.1 / **C-4** / Q1-007（仅 stdout，不落盘）
- **前置**：记录仓库根文件快照（mtime / 文件清单）
- **步骤**：运行 `mumuspec eval run --report`（文本）与 `--report --json`
- **期望**：输出仅到 stdout；仓库根**无新增报告文件**（无 `*.json`/`report*` 产物落盘）
- **优先级**：P0 ｜ **隔离**：CLI 集成

### L2-C11 · 退出码语义不变
- **验证目标**：design §1.1（`run` 退出码仍由 `report.failed` 决定；corpusExpect 失败 → 该场景 `passed=false` → 计入 `failed`）
- **前置**：构造一个 corpus 场景使其 `corpusExpect` 违反
- **步骤**：运行 `eval run`；读退出码
- **期望**：`failed>0` 时退出码 `1`；全通过时退出码 `0`；`--report` 不改变该语义
- **优先级**：P0 ｜ **隔离**：CLI 集成

---

## D. 语料内容校验（DS-EVAL-004 覆盖目标）

### L2-C13 · 语料覆盖码清单完整（收敛为 15 个可发射码）
- **验证目标**：design §2.3.2 覆盖目标 / §1.2；**DS-EVAL-004** SHALL；用户裁决（2026-09-15）
- **前置**：枚举 `.eval-corpus/` 下所有 fixture 目录及其 `expected.yaml`
- **步骤**：解析每个 bad-case 的 `mustContain`，汇总覆盖率清单
- **期望（覆盖目标 = 15 个可发射码，各 ≥1 例）**：
  - **E-SPEC 域 12 个**：`E-SPEC-001` / `002` / `003` / `004` / `006` / `008` / `009` / `010` / `011` / `013` / `014` / `015` 各被 ≥1 个 bad-case fixture 的 `mustContain` 覆盖（probe: validate/check）
  - **W-SPEC-016** ≥1 例（probe: validate/check）
  - **E-GUARD-010** ≥1 例（probe: guard + change）
  - **E-CHANGE-022** ≥1 例（probe: archive + change）
  - `_baseline` 恰 1 个；`clean-*` ≥1 个
  - `_baseline` 骨架 **spec.md 优先**：含 `.mumuspec/spec.md`（prd.md-only 实测 `coverage.total=0`；coverage 仅由 classifyRequirements 汇总，spec.md 与 V2 tech.md 是唯二喂入点），确保 baseline 产出 `coverage.total>0` 以支撑 coverage-diff
  - 命名规则符合 `_baseline` / `bad-<domain>-<code>` / `clean-<seq>`
- **期望（M1 出范围，防误建）**：
  - `E-SPEC-005` / `E-SPEC-007` / `E-SPEC-012` 为 **registered-but-not-emitted**：三码仅存在于 `src/core/errors.ts`（注册表），全仓无 push 点（`E-SPEC-007` 的 index 检查在 `validator.ts` 为空实现 stub）→ M1 **不为其建 mustContain 语料**（建则必然 missed，污染 recall/precision，违背 D-corpus-5）
  - 断言：三码**不出现在**任何 fixture 的 `mustContain`（一旦有人误建即红）
- **依赖/一致性（已核对 2026-09-15）**：本清单与 **DS-EVAL-004 已同步一致** —— SHALL line 11 逐字列出同一 15 码集；SHALL line 12 明列 `E-SPEC-005/007/012` 为 registered-but-not-emitted（M1 出范围）；SHALL line 14 附「聚合精度仅展示、不设阈值」；SHALL NOT line 19 禁止「为无发射点的码建立必须命中的语料」。措辞完全对齐，无残留旧的全含区间表述
- **优先级**：P0 ｜ **隔离**：语料枚举

### L2-C14 · severity 分档由 expected.yaml 声明
- **验证目标**：design §2.3.2 severity 分档指引（veto/error/warn，由语料作者显式声明，不硬编码映射）
- **前置**：同上
- **步骤**：读每个 bad-case 的 `severity`
- **期望**：每个 bad-case 的 `severity ∈ {veto,error,warn}`；导出的 `recallBySeverity` 三桶按声明分档计数（`veto` 含 E-GUARD-010/E-CHANGE-022 等 fail-closed 码；`W-` 码为 `warn`）；无未声明/非法分档
- **优先级**：P1 ｜ **隔离**：语料枚举

---

## E. 回归护栏

### L2-C12 · 全量回归绿（验收场景 5）
- **验证目标**：design §3 / §4 L2「回归」/ §6⑤；DS-EVAL-001/002/003/004 收口
- **前置**：完整测试套件
- **步骤**：运行 `vitest run`（全量）
- **期望**：
  - 全绿（含 `runner.test.ts` / `runner-enhance.test.ts` 的 custom 语义兼容 —— 既有 custom 用法本就 assertions-only，不因 `case 'custom'` 修复而红）
  - 覆盖率四维 ≥ 95（`vitest.config.ts` 阈值），否则套件红
- **优先级**：P0 ｜ **隔离**：全量 vitest

---

## F. BP-12 修订验证点（用户 2026-09-15 采纳 QA 边界）

> 背景：QA 在 L0 验证中提出的三条边界 + 精度聚合已由用户采纳（BP-12）。此处增列 **L2 消费侧**验证点。
> **不在此文档**的 runner/评估器侧新边界（三态聚合、errored fixture 不进分母、三条 warning）属 **L0 锁定范围**，由验证阶段以**测试代码**覆盖（QA 上轮提议的 L0-C33~C35 以代码而非文档形式落地），L2 实现落地后由 team-lead 正式派单。

### L2-C17 · report JSON 新增 precision 聚合字段（version 仍 1）
- **验证目标**：**DS-EVAL-004 SHALL**（report 汇总附 corpus 聚合精度，仅展示不设阈值）/ **BP-12-2** / design §2.3.1 冻结契约 / **R-3**（只加字段不改既有）
- **前置**：构造 corpus 报告（fixture 的 `mustContainSatisfied` 命中与 `mustContain` 总数已知）
- **步骤**：`buildSummaryReport(report, root)` → 读 `precision`
- **期望**：
  - report JSON 含 `precision` 聚合字段，至少含三子字段：`mustContainSatisfied`（命中数，跨场景求和）、`mustContainTotal`（分母，`Σ exp.mustContain.length`）、`ratio`（命中/分母）；分母为 0 时 `ratio===null`（非 `NaN`、非 `0/0`）
  - `precision` **仅展示、不设阈值**：不参与 `passed` / `resultErrors`，不触发 `corpusExpect` 违反（与 DS-EVAL-004「仅展示、不设阈值」一致）
  - **位置以 design 为准**：`precision` 为 `EvalSummaryReport` **顶层**字段（跨场景求和，design §2.3.2 / line 478·488·586），同时存在于每个 `CorpusScenarioReport.precision`（line 229）——两处断言
  - `version` 仍严格 `===1`（BP-12 为**加字段**、非 breaking）；`corpus[]` 既有字段（recall/noise/fixtures）类型与语义不变
  - 与 L2-C03 交互：L2-C03 顶层冻结集已同步补入 `precision`（7 字段），两用例一致
- **优先级**：P0 ｜ **隔离**：mock 数据

### L2-C18 · report 文本渲染：errored fixture 提示 + 「置信不足」
- **验证目标**：**BP-12-1**（文本渲染 errored fixture 提示）/ design §2.3.1（n<3「置信不足」）/ §4 L2；DS-EVAL-004 SHALL
- **前置**：构造 corpus 报告：① 某 fixture `errors` 非空（探针运行/解析失败）；② 某场景 recall `n<3`（`ci.insufficient===true`）
- **步骤**：`renderSummaryText(...)`
- **期望**：
  - corpus 段逐场景行含 `precision=z`（design line 490 渲染契约）
  - 渲染中**显式提示**运行出错的 fixture：`errored>0` 时追加「（N errored 已排除分母）」，使 infra 失败与「漏检」可区分
  - `n<3` 场景行追加「（置信不足）」
  - 两类提示各自独立呈现、互不吞没
- **优先级**：P0 ｜ **隔离**：mock 数据（纯渲染）

### L2-C19 · 已声明阈值而分母为 0 → resultErrors（fail-closed，场景层可见）
- **验证目标**：BP-12-4 / **D-corpus-6**（空分母口径统一 fail-closed）/ design §2.1.3 step7（修订）/ DS-EVAL-004
- **前置**：构造 corpus 场景声明 `corpusExpect` 阈值，但对应分母为 0（零坏样本 / 零 clean / 零 veto）
- **步骤**：`runScenario(corpus)` → 读 `result.passed` 与 `result.errors`；再经 `buildSummaryReport` / `eval run` 观察 `failed` 与退出码
- **期望**：
  - 声明 `minRecall` / `maxNoise` / `recallBySeverity.*` 而对应**分母为 0** → 该场景 `passed=false`，`result.errors` 含明确的「分母为 0 / 无样本」fail-closed 信息（**统一三阈值口径**，消除原 `maxNoise` 空分母被跳过的不对称）
  - 该 fail-closed 在**场景层可见**（`resultErrors`），并如实反映到 report 的 `failed` 计数与退出码（非仅 report 展示）
  - 反向：未声明阈值时不受此约束（与 L2-C11 退出码语义一致）
  - 备注：runner 实现属 L0 锁定范围，实证由**验证阶段测试代码**覆盖；本用例锁定其**消费侧可观测契约**
- **优先级**：P0 ｜ **隔离**：mock/runner

---

## F. 已知约束 / 提示（供 BP-8 与 Build）

| 项 | 说明 |
|---|---|
| 语料规模 | M1 覆盖 **15 个可发射码**（E-SPEC 12：001/002/003/004/006/008/009/010/011/013/014/015 + W-SPEC-016 + E-GUARD-010 + E-CHANGE-022），每码 1 例 → 多为 `n<3`，Wilson 标注「置信不足」；M1 定位**建档非定标**。E-SPEC-005/007/012 registered-but-not-emitted，M1 出范围 |
| `_baseline` 骨架 | **spec.md 优先**（`.mumuspec/spec.md`）：prd.md-only 实测 `coverage.total=0`；coverage 仅由 classifyRequirements 汇总，spec.md 与 V2 tech.md 是唯二喂入点 |
| precision 字段 | report JSON 新增 `precision`（mustContainSatisfied / mustContainTotal / ratio），**仅展示不设阈值**；`version` 仍 1（BP-12） |
| 跨域 fixture 成本 | E-GUARD-010 / E-CHANGE-022 需 change-scoped fixture（probe + change 显式声明），coverage-diff 自动降级为纯码检测（D-corpus-1 / R-7） |
| spawn mock 纪律 | L0/L1 集成用例一律 mock `node:child_process`，不真跑 CLI（R-6：~20 fixture 子进程开销 + win32 shell 更慢） |
| report 快照 | L2-C03 顶层字段集冻结断言为**强快照**，后续扩展只允许「加字段」 |
