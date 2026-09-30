# 核心收敛与实现度补齐改进计划（2026-09-30）

**Goal:** 把"实现度 100%"从"把所有曾设想的功能写完"重定义为"声明、实现、消费者三者闭合"，并以此口径完成减法收敛、三项点名能力补齐与图表化呈现增强。

**Architecture:** 以既有装载面为骨架做增量——设计文档定契约、schema 与 gate 承载判定（代码）、skill 承载规则声明（LLM）、渲染器从图数据确定性推导。不新增引擎、不新增运行时依赖、不新增第二套分类判定。

**Tech Stack:** TypeScript 5.8 strict / Node ≥20 / vitest 3（覆盖率四轴 95%）/ commander / yaml / @modelcontextprotocol/sdk。

**Spec（本计划据此论证，执行时两份同读）：**
- `docs/design/spec-layer.md` §8 起草覆盖面扩展模型（含安全）
- `docs/design/change-layer.md` §11 初始架构偏好选型
- `docs/design/contract-layer.md` §11 复用机制
- `docs/design/diagram-rendering.md` 图表化呈现层（新建）
- `.mumuspec/roadmap/items/R-0014.md` .. `R-0021.md`

## Global Constraints

- 包版本与 `src/cli.ts` 版本必须一致；每次变更批次完成后 bump（红线：变更后不更新版本号禁止）。
- 运行时依赖上限保持现状四项：`@modelcontextprotocol/sdk`、`commander`、`typescript`、`yaml`。不引入 tree-sitter / ts-morph / better-sqlite3 / graphviz 二进制。
- 判定归代码、规则归 LLM、校验归代码（KP-0060）。相对固定的执行逻辑不得由 LLM 现场发挥。
- 不得为 SHALL 另立检查逻辑或词法 weak 层；不得复用之外的第二套分类判定序。
- 新评估器不得进入 loop composite：权重之和、收敛阈值、稳定窗口三者不动（红线同源）。
- 指标值与 hash 类字段一律确定性推导，禁止 LLM 计算或手写。
- 门禁断言（行为门指针）不得悬空：声称把守者必须有校验器。
- 占位实现不得返回成功；动作未实现时的正确行为是失败并给出理由。
- `.mumuspec/` 结构受白名单约束；新增条目须同步 `.mumuspec/index.yaml` 与对应 BOUNDARY.md。
- 改 `.mumuspec/` 规范面后必须 `node scripts/regen-rules.mjs`（E-AGENTS-001）。
- 文档不得记录思考过程、生成元信息、对齐说明类元注释；过期无效内容删除而非注释保留。
- 实施按单一 umbrella 变更承载：`mumuspec new core-consolidation --workflow full`，Design 阶段锁定 test-cases 后方可 Build。批次内的逐步 TDD 步骤落在该变更的 `tasks.md`（本文件不重复登记步骤，避免双源）。

---

## 一、实现度口径

"100%" 由三条可机械核验的等式定义，任一不等式为即即缺口，缺口的正确处置是**删声明或补实现**，不含第三种：

| 等式 | 含义 | 违反即 | 现有违反点（本计划实测） |
|---|---|---|---|
| E1 声明 ⊆ 实现 | config 字段、文档断言、CLI 帮助、错误码所指能力均确有实现 | 假承诺 | `knowledge.code_graph.storage: sqlite`、hyperplan 能力面、`bundle publish`、`team clarify` |
| E2 实现 ⊆ 消费 | 每个产出物有消费者 | 死端 | `state.hyperplan_result` 仅被归档提取消费而无引擎；28 个 companion 无一可达；BOUNDARY 幻影符号清单 |
| E3 门 ⊆ 事实 | 每个门禁把守其所称的东西 | 悬空指针 | Q4 门只数行数不认维度；`worktree_isolation` 有 RG 维度无创建路径；STATUS 断言核对单向 |

**度量落点**：新增确定性指标 `declaration_conformance`（三比值：E1/E2/E3 通过项 / 声明项），由代码遍历 config schema、命令注册表、错误码表、`docs/STATUS.md` 断言集推导；仅作为独立上报指标接入 `mumuspec check --json` 的 `compliance.declaration_conformance` 与 `mumuspec drift` 输出，**不并入 loop composite**。当前基线值由 Batch 0 实测产生。

**核心能力面（收敛后）**：约束 DSL 与可验证性四分类、树状分层与渐进披露、变更状态机与 Phase Guard、Rules/MCP/Skill 分发、知识层检索与上下文注入、契约注册与漂移。其余为可选面，按 §三 裁决处置。

---

## 二、代码与文档差异对账

实测方式：读源码 + `node dist/cli.js check --json` + `graph verify` + 静态计数。`dist/` 已过期（6 个 src 文件晚于构建），故 §2.1 数值须在 Batch 0 重建后复测确认。

### 2.1 文档低估实现（应上调，非缺口）

| 位置 | 文档断言 | 代码事实 | 处置 |
|---|---|---|---|
| `docs/STATUS.md:138` | 43+ 命令可用 | 58 顶层命令（`npm run docs:audit` 实测）；嵌套与叶子可调用数 Batch 0 复测（`src/cli/index.ts:437-472` 注册 36 个 register 入口） | 改为实测数，断言核对改双向（Batch 4） |
| `docs/STATUS.md:139` | 25+ MCP 工具 | 35 工具且 35 handler（`src/mcp/tools.ts`） | 同上 |
| `docs/STATUS.md:109` | 10 agent 分发 | 11（`src/install/installer-registry.ts:245-258`） | 同上 |
| `docs/STATUS.md:125` | Phase 4 0% | `.github/workflows/ci.yml` + `ci-check` / `docs-audit` / `enforcement-check` / `gen-error-codes-doc` 四 npm script + 归档知识提取 D1–D8 + `runAllEvals` 已接线 | Phase 4 改为分项进度，未做项单列 |
| `docs/STATUS.md:126` | Phase 5 0% | 9 个 SKILL.md 编排器 + `skills/mumuspec/workflow.yaml` 分发图 + BP 已入图数据（`src/change/phase-graph.ts:65`、`workflow.default.yaml` 20 处 BP） | 仅 Hyperplan 缺席，其余按实 |
| `docs/STATUS.md:136` | 图谱后端"未启用 Code-graph" | `code-graph search/trace/structure` 已接线（`src/cli/commands/code-graph.ts:43`） | 措辞改"内存实现，无持久化后端" |
| `docs/STATUS.md:135` | declared_ratio 100%（180 条，strong 0） | 384 条，strong 4、weak 21、manual 359、unverifiable 0；`strong_ratio` 实为 1.0%（`validate` 实测；过期 `dist/` 跑出 368 条，差异本身即 Batch 0 立基线的理由） | 数字校正 + 把 `strong_ratio` 提为一级指标（Batch 4） |
| `.mumuspec/goal.md:62` | 实现进度约 87% | 与 STATUS 的 ~90% 无共同口径 | 两处统一引用 §一 的三等式口径 |

### 2.2 文档高估实现（真缺口或假承诺）

| 位置 | 文档断言 | 代码事实 | 处置 |
|---|---|---|---|
| `docs/design/change-layer.md:40,223,469-479` | Worktree 隔离为 Design 步骤 7，失败有回退树 | `src/core/git.ts:167` 明示 createWorktree/mergeWorktree 已移除；仅 `loop-engine.ts:611`、`eval/experiment-engine.ts:396` 自建；`src/guard/` 无 worktree 强制 | 补最小创建路径（Batch 3）+ 门禁登记，二者不得缺一 |
| `docs/overview.md:149` | 自动 worktree 操作开发中 | Change Layer 无该代码路径 | 随 Batch 3 转实或删句 |
| `.mumuspec/config.yaml` + `src/core/config-io.ts:27` | code_graph storage sqlite、db_path `graph/index.db` | `src/knowledge/code-graph.ts:4` 内存 Map 实现；依赖表无 sqlite 驱动 | 声明改 `builtin`，删 db_path 键（E1） |
| `docs/appendix/directory-structure.md:97` | 存在 `index.db` | 无该文件、无产生路径 | 删条目 |
| `docs/design/constraint-strength.md:910` | init 默认 strict | `config-io.ts:94-95` 为 technical_design medium / requirement_goals high | 改文档为实默认；若确需 strict 起步则改代码并补测试 |
| `.mumuspec/roadmap/archive/2026-Q3/R-0004.md:38` | 引导式问答（项目类型/团队规模/严格度） | `knowledge-onboard.ts:116-142` 零提问，preset 缺失时静默按 frontend（`:124-126`） | Batch 2 以偏好选型机制替代，并消除静默默认 |
| `src/core/errors.ts:91` | E-SPEC-006 出路为 `mumuspec add-spec <scope>` 创建 design.md | `src/cli/commands/spec.ts:185-250` 只写 spec.md 的 SHALL/SHALL NOT，无法产出 design.md | 修 fixSteps 指向新 `design init`（Batch 2） |
| `docs/reference/cognitive-framework.md:112-121` | Q4 八扫描维度（含并发安全、合规盲区） | `cognitive-map.ts:177` 仅按 quadrant 计数；`W-DESIGN-005` WARN + min_strength low（`errors.ts:1017-1025`），fixSteps 字面为"至少补充 3 个 entry" | Batch 1 把计数门改为维度身份门 |
| `.mumuspec/spec.md`、`prd.md:14,19,78`、`docs/overview.md:11,14` | 随意的自然语言 → 大模型起草 Spec ⇄ 追问补全 | 无 NL 输入面：`init` 从代码结构推导（`spec-scaffolder.ts:281`）、`add-spec` 要求字面 `--text`、`mumuspec new` 只收名称与 flag；MCP 35 工具中 `scaffold_boundary` 是唯一写者 | Batch 1 落实确定性槽位 + 覆盖面门；起草本体按 KP-0060 留在 skill 侧 |
| `docs/STATUS.md:20,107,122` | 缺口"主要在 Worktree isolation、Code-graph 后端" | 另有：BOUNDARY 导出面漂移（`sync --check` 14/14 模块告警、幻影符号 `foo/Bar/IBar/MyType/baz`）、Spec 层无任何 AST 模块、`src/contract/constants.ts:17` 注册表文件名与 config 不一致且注册表文件不存在 | Batch 3/4 逐项收口 |
| `improvement-plan.md:3,17-19,27,166` | 4702 用例 / 86 失败 / 失败率 1.8%，Phase 1 修复清单 | 实为约 5335 用例、0 skip/todo；所引 7 个测试路径中 3 个（installer-ops、state-handler、guard-audit）已不存在 | 本文取代，旧文件按归档纪律退役 |
| `templates/design-schema.yaml:5`、`templates/.mumuspec/prd.md:15,19` | 缺失必填节"返回 E-DESIGN-009 错误" | 实际发射点为 `src/guard/phase-guard.ts:441` 的 W-DESIGN-009 建议级告警（CHG-5 过程约束不阻断）；E-DESIGN-009 注册但装载面无发射点 | 两处模板文本改指实际码；残余 16 个无发射点码交 R-0020 三分类裁决 |
| `src/core/errors.ts`（错误码表） | 118 个注册码 | 其中 17 个无发射点却仍被规范文档、模板或测试引用 | `mumuspec conformance` 的 error-code-emitted 探针持续上报为待裁决项（不计入比值，也不计为通过） |

---

## 三、必要性裁决（减法优先）

每条给出证据、裁决与所依据的项目红线。裁决为「删」者不进入实现阶段。

| # | 项 | 证据 | 裁决 | 依据 |
|---|---|---|---|---|
| V1 | 多语言 AST / tree-sitter（R-0003 框架、STATUS 的"缺多语言 AST"） | `src/spec/` 无 AST 模块；`ILanguageProvider` 抽象已在 `src/guard/types-constraint-ast.ts:74` + `language-provider-registry.ts`，但 `ast-checker.ts:12,55,101,133` 与 `contract/ast-analyzer.ts:31,148,256` 绕过注册表直调 `ts.createSourceFile`；`project-analyzer.ts:228` 只产 TS/JS | **降级为登记非目标** | 新增解析引擎违反 no-new-engines；引依赖违反"标准库/已有依赖已满足时不引新依赖"；核心能力是约束 DSL 不是代码解析器。改为：把两处旁路收进注册表（E3），js provider 消除与 ts 的复制展开，并把多语言写进 `.mumuspec/prd.md` 非目标表 |
| V2 | Code-graph 持久化后端（SQLite） | 内存图 217 行 + builder 368 行；无驱动依赖；无消费者要求跨进程复用 | **删声明保留实现** | E1 假承诺；YAGNI L1 |
| V3 | Hyperplan 能力面 | 无引擎：仅 `lifecycle.ts:107` state 字段 + `archive.ts:801-816` 提取 + `errors.ts:598,606` 码 + `config.ts:63,228` override 键；其 Q3/Q4 职责已由 cognitive-map 承担 | **整面删除** | "以占位实现返回成功"禁止 + "未被注册的命令模块"禁止 + 同语义双权威源禁止 |
| V4 | `mumuspec team` 用户面 | `team.ts:60-62` 固定 `MockRuntimeAdapter`，`engine.ts:449` 产 `[Mock Brief] <request>`，用户侧零提示 | **删 CLI 面，留引擎与测试** | 同上；且 `team clarify` 与 cognitive-map Q2 语义重复 |
| V5 | `bundle publish` | `packager.ts:249,272` 已 fail-closed、`E-BUNDLE-001`（`errors.ts:1211`）、`bundle.ts:135` 帮助自陈未实现；`bundle plugin` 覆盖分发 | **删命令与错误码** | fail-closed 是正确的过渡处置，长期保留即 E1 假承诺 |
| V6 | 28 个 companion skill | `skill-companions.ts:1-10` 记录历史 0/28 可达；现为全非必需、仅文件系统探测、缺失不阻断；唯一消费者 `mumuspec skill companions`（`skill.ts:13,29`） | **收缩至确有接线者** | E2 死端。Batch 1 把 `security-and-hardening` 接进覆盖面门后，该项入表；其余条目删除，表为空时删能力面 |
| V7 | BOUNDARY 逐符号导出清单 | 25 份 BOUNDARY；`src/team` 仍用遗留路径；`src/change`/`guard`/`install` 新旧两份并存（双权威源）；`index.yaml` 32 子项中 9 项无 BOUNDARY；`sync --check` 扫 17 项对每模块报数百未记录导出 | **降格为"职责+边界"，导出真值源归代码** | 门禁常年全红等于无门禁（E3）；双份 BOUNDARY 触双源禁止。契约消费者需要的符号改由 `contract register` 显式声明 |
| V8 | Worktree 隔离 | 设计文档细则齐备且 config/RG 维度/归档清理三面都指向它，唯独创建端缺失（`git.ts:167` 明示已移除，`archive.ts:274-275` 清理已接线） | **保留并补最小实现** | "悬空的行为门指针进入强制面"禁止——已有三处承诺，删除成本高于补创建 |
| V9 | 起草覆盖面扩展（含安全） | 维度枚举仅 TD/RG 两值（`types-constraint.ts:29`）；`design-schema.yaml` 八节无安全节；`ponytail.ts:97` 的"安全性"与 `plugin-manifest.ts:62` 的 security 均不在同一语义面 | **保留（用户点名）** | 是 prd.md 核心不变量"追问补全 → 完备性判定"的落点，Batch 1 |
| V10 | 初始架构偏好选型 | init 全程零 prompt（`src/cli/index.ts:100-434`，仓库内唯一交互循环是 `grill-me.ts`）；design.md 仅三节且只回填探测结论（`init-templates.ts:274-290`）；根 design.md 不受 schema 校验 | **保留（用户点名）** | E-SPEC-006 的 prescribed 出路断裂、设计决策记录缺位，Batch 2。init 的"全自动、不交互"红线保持不动——选型发生在 Design 阶段而非 init |
| V11 | 组件化复用 | 契约 CRUD/漂移/影响分析齐备但无导入或复用到新变更的命令；知识页已随 `loader.ts:184-193` 注入 SpecContext 但无组合写路径；bundle 只分发 skills | **收缩为两个机制** | 不做"模板库"（Phase 5 空承诺，无消费者）。保留：契约跨范围导入 + 约束复用带 provenance（`src/spec/constraint-provenance.ts` 已是事实源，且红线要求约束必须有上游来源），Batch 3 |
| V12 | 图表化呈现 | `graph` 仅有 `verify`（`graph.ts:39-44`），PhaseGraph 边已带 BP 元数据；文档内 21 处手写 mermaid 无任何对账；src 无渲染代码 | **保留并加强（用户点名）** | 图数据已是单一事实源，渲染为确定性推导，符合"确定性归代码"；手写图与图数据的漂移即 E3 类缺口，Batch 4 |
| V13 | `scripts/cleanup-temp.mjs` | 空文件，无引用、未挂 npm script | **删除** | 死文件；TEMP-4 归档清理若需脚本支撑则在实现时重做 |
| V14 | 根 `.cursorrules` | 项目红线明令禁止生成该遗留格式，仓库内仍存 3.6 KB 实体 | **删除** | 与自身规范矛盾的存量 |

---

## 四、批次与任务

任务右尺寸：一个任务 = 一轮可独立评审的测试周期。测试锚点给到文件与断言级别，逐步骤（写失败测试 → 跑 → 最小实现 → 跑 → 提交）在变更 `tasks.md` 展开。

### Batch 0 — 基线复位（前置，无则后续全部测量失真）

**Files:** 重建 `dist/`；删除 `scripts/cleanup-temp.mjs`、根 `.cursorrules`、`tests/.mumuspec/`（未跟踪残留）；处置 `tests/guard/behavior-gate.test.ts`、`tests/spec/strip-channel-marker.test.ts`、`.mumuspec/evolution/stats.jsonl` 三处未提交改动。

- [ ] 确认三处未提交测试属既往 lock 批次遗产还是待收工作；前者提交入当前分支，后者 stash 保留，禁止直接丢弃。
- [ ] `npm run build` 后复测：`node dist/cli.js check --json`、`mumuspec drift`、`npx tsc --noEmit`、`npx vitest run` 全量绿。记录用例数与 `strong_ratio` 作为 §一 基线。
- 验收：工作树干净、`dist/` 不早于任何 `src/` 文件、基线数写入变更 `proposal.md`。

### Batch 1 — 覆盖面维度门（V9 + V6 接线）

**Files:** `templates/design-schema.yaml`、`src/guard/phase-guard.ts:99-135`、`src/cli/commands/cognitive-map.ts:170-201`、`src/core/errors.ts`（`W-DESIGN-005` 修订 + 新码 `E-DESIGN-*` 段位）、`src/core/types-knowledge.ts:109`（`dimensions?: string[]` 收敛为受控枚举）、`skills/mumuspec/phase-open/SKILL.md`、`skills/mumuspec/phase-design/SKILL.md`。

**Interfaces:**
- Produces：`Q4_ASPECTS: readonly string[]`（`src/spec/aspects.ts` 新建，单一事实源，含 `security-compliance`）；`classifyAspects(entries: CognitiveMapEntry[]): AspectCoverage`（纯函数，`{covered: string[], missing: string[], count: number}`）；`checkQ4AspectCoverage(cov, min): Finding[]`。
- Consumes：既有 `state.cognitive_framework`、`artifact-validator.ts:27` 的 schema 校验通道、`W-DESIGN-009（建议级）` 的节缺失判定。

- [ ] 写失败测试：`tests/spec/aspects.test.ts` —— 三条 Q4 记录同 category 时 `missing` 必含 `security-compliance`，`converged` 必为 false（锁定"数行不认维度"这一现网缺陷）。
- [ ] 写失败测试：design.md 缺 `## Security & Privacy` / `## 安全与隐私` 节且 workflow 为 full ⇒ 触发 W-DESIGN-009（建议级），hotfix/tweak 不触发。
- [ ] `templates/design-schema.yaml` 增 Security & Privacy 节，`required_for: [full]`，patterns 与既有八节同构；`consistency_checks` 增 `security_aspect`（severity: error）。
- [ ] 实现 `src/spec/aspects.ts` + `classifyAspects`，`cognitive-map.ts` 的 `converged` 与 `sync` 改用维度身份而非行数；`W-DESIGN-005` 描述与 fixSteps 同步改写为缺失维度名。
- [ ] `mumuspec new` 增可选 `--request "<terse natural language>"`：原文落入变更目录 `request.md` 作为起草输入槽位（不解析、不扩写、判定归门）。测试：无 `--request` 时行为与现网逐字节一致（兼容面零变化）。
- [ ] skill 侧规则文本：`phase-open` 增"目标→非目标→范围边界→关键未知→验收场景→**安全与合规**"六段扩写清单；`phase-design` 的 Q4 表指向 `Q4_ASPECTS` 同源（引用而非复制，避免双权威源）。
- [ ] `security-and-hardening` companion 接入：覆盖面门在缺该维度且该 companion 不可达时，输出降级留痕（不静默替换），并把该项列入 companion 表的"已接线"集合；V6 的其余条目删除。
- 验收：`tests/spec/aspects.test.ts` + `tests/guard/*` 全绿；本仓库自身 cognitive-map 复跑结果与门一致；`npm run enforce` 无新增旁路。

### Batch 2 — 初始架构偏好选型与 design.md 出路（V10）

**Files:** `src/core/init-templates.ts:274-372`、`src/core/spec-scaffolder.ts`、`src/cli/commands/spec.ts:185-250`、`src/cli/index.ts:100-434`、`src/core/errors.ts:86-91`、`templates/design-schema.yaml`、`src/cli/commands/knowledge-onboard.ts:114-142`、`docs/design/change-layer.md`。

**Interfaces:**
- Produces：`design init <scope>` 子命令（补齐 E-SPEC-006 的 prescribed 出路，写受 schema 约束的 design.md 骨架）；`ARCH_PREFERENCE_PACKS`（声明式偏好包：分层/数据流/状态管理/持久化/边界策略，每项含 2-4 个互斥选项 + 默认推断依据）；`renderDesignSkeleton(analysis, picks)` 纯函数。
- Consumes：`analyzeProject` 结果、`templates/design-schema.yaml` 节定义、`require_design_doc` 配置。

- [ ] 写失败测试：`tests/core/design-skeleton.test.ts` —— 任一偏好项未选定 ⇒ 该节渲染为显式 `【待定】` 且被 schema 校验计为缺失；选定后必须含"未选方案 + 理由"两项，否则校验失败（锁定"决策记录必须含备选与理由"）。
- [ ] 写失败测试：`design init src/x` 在 `require_design_doc` 下产出可通过 E-SPEC-006 校验的骨架；`errors.ts:91` 的 fixSteps 与该命令名一致（防再次断裂）。
- [ ] 实现偏好包与渲染器：init 保持全自动（红线：Init SHALL NOT require user interaction），产出的 design.md 以"选型表 + 未决项"形态呈现，选定动作发生在 Design 阶段由人签收。
- [ ] `onboard quickstart --preset` 消除静默默认：preset 缺失时报错并列出可选值；`--interactive` 缺实现时 fail-closed，不得零提问即称引导完成。
- 验收：E-SPEC-006 的 fixSteps 可被机器验证为真实命令（新增回归断言）；根 `.mumuspec/design.md` 保持索引职责、不内联细节（红线：根级规范不得定义模块实现细节）。

### Batch 3 — 减法执行 + Worktree 最小实现 + 复用机制（V1–V8、V11）

**Files（删除面）：** `src/team/`（保留 engine 与测试，删 CLI 注册 `src/cli/index.ts` 对应 register 与 `src/cli/commands/team.ts`）、`src/bundle/packager.ts:249-280` 与 `src/cli/commands/bundle.ts:134-160` 与 `errors.ts:1211` 的 E-BUNDLE-001、hyperplan 全链（`lifecycle.ts:107`、`archive.ts:801-816`、`errors.ts:598,606`、`config.ts:63,228`、`constraint-evaluator.ts:116`、`.mumuspec/config.yaml` 与 `docs/` 引用）、`src/core/config-io.ts:27` 的 `storage: sqlite` 与 `db_path`、`docs/appendix/directory-structure.md:97`。

**Files（新增/改动）：** `src/core/git.ts`（补 `createWorktree`）、`src/change/lifecycle.ts`、`src/guard/checker.ts`、`src/spec/constraint-provenance.ts`、`src/cli/commands/contract.ts`、`src/contract/constants.ts:17` 与 `config-io.ts:146` 的注册表文件名统一。

- [ ] 删除前逐项确认无消费者：`mumuspec contract boundary check`、`sync --check`、grep 三重核对；删除必须同批移除测试与文档引用，不留幽灵引用（红线：迁移后不得保留旧名称的幽灵引用）。
- [ ] 写失败测试：`tests/guard/worktree-gate.test.ts` —— `workflow.worktree_isolation` 有效值为强制档时，变更目录缺 worktree ⇒ 阻断并给出降级路径提示；`default_isolation: branch` 时降为 warn 且留痕。
- [ ] 实现 `createWorktree`（复用 `getWorktreePath`/`hasWorktree` 既有语义），接入 `new`→`design` 转换点，失败时按 `change-layer.md:469-479` 的既定回退处置（config 允许 branch 则降级留痕，否则阻断），不得 try/catch 吞失败。
- [ ] 复用机制一：`contract import --from <scope> [--id <API-NNN>]`，复用既有 `loader.ts:111 loadAllContracts` + `manager.ts` 注册与审计路径，不新增第二套持久化。测试：导入后 `contract verify` 绿且审计链含来源。
- [ ] 复用机制二：`add-spec --reuse-from <scope>#<requirement>`，写入时经 `constraint-provenance` 打来源戳并落 `source_specs`；缺来源声明时拒绝（红线：不得存在无上游来源的约束）。
- [ ] BOUNDARY 降格：`sync --check` 的判定对象改为"被契约消费的符号"；消除 `src/change`/`src/guard`/`src/install` 的新旧双份；`src/team` 迁至新路径。幻影符号清单（`foo/Bar/IBar/MyType/baz`）删除。
- [ ] AST 旁路收口：`ast-checker.ts` 与 `contract/ast-analyzer.ts` 改走 `language-provider-registry`，javascript provider 不再展开复制 typescript provider；`src/spec/` 不新增 AST 模块（V1 已降级为非目标，须同步写入 `prd.md` 非目标表）。
- 验收：`graph verify` 与 `check --json` 绿；`strong_ratio` 因分母收缩而上升者须在报告里区分"变好"与"删项"，禁止用删声明掩盖真缺口。

### Batch 4 — 图表化呈现层（V12）

**Files:** 新建 `src/graph/render.ts`、`src/cli/commands/graph.ts`（新增 `render` 子命令）、`src/mcp/tools.ts`（新增只读工具 `render_diagram`）、`scripts/docs-audit.mjs`（新增 mermaid 对账）、`docs/design/diagram-rendering.md`。

**Interfaces:**
- Consumes：`PHASE_ORDER`、`PhaseEdge.blockingPoint`、`phase-bps.ts` 的 `collectWorkflowBpIds`/`compareBps`、`SpecLayerContext` 继承链、`loadAllContracts`、`state` 的 rollback/rebuild 计数。
- Produces：`renderPhaseGraph(graph, opts): string`、`renderConstraintTree(ctx): string`、`renderContractGraph(contracts): string`、`renderAspectMatrix(change): string`，格式枚举 `mermaid | dot | json`（纯文本输出，无外部渲染器依赖）。

- [ ] 写失败测试：`tests/graph/render.test.ts` —— 同一 `workflow.yaml` 两次渲染字节一致（确定性）；含回退环时 DOT 输出保留 `dir=back` 语义标注；BP 缺失边的节点必须可见（不得静默省略）。
- [ ] 写失败测试：render 输出不得由调用方传入任何字面标签以外的内容——标签全部取自图数据（锁定"指标与标识符不得手写"）。
- [ ] 实现四种视图：阶段×BP 泳道图（代理核心执行逻辑）、阶段状态机含回退计数（当前变更所处位置）、约束继承树（层间收紧关系）、契约上下游依赖图。`--format` 默认 mermaid，`--dot` 供 Graphviz 侧使用。
- [ ] 文档图对账：`docs-audit` 增加"设计文档内 mermaid 块与 `render` 输出结构一致性"检查，WARN 级起步（不阻断），把 21 处手写图的漂移变成可检测项。
- [ ] MCP 侧只读工具接入：查询型、可安全重复、不写状态工件（红线：命令 SHALL 为纯只读的适用范围）。
- 验收：`mumuspec graph render --change <name>` 在本仓库产出四视图；`docs:audit` 报出的漂移块数与人工核对一致。

### Batch 5 — 度量与文档对账收口

**Files:** `src/core/metrics/`（新 `declaration-conformance.ts`）、`src/guard/checker.ts`、`src/guard/status-assertion-checker.ts:122-128`、`docs/STATUS.md`、`docs/overview.md`、`.mumuspec/goal.md`、`docs/design/*.md`、`.mumuspec/roadmap/items/R-0014.md`..`R-0019.md`、`.mumuspec/roadmap/BOUNDARY.md`、`AGENTS.md`（regen 生成）、`CHANGELOG.md`。

- [ ] 写失败测试：`metrics/declaration-conformance` 的 E1/E2/E3 各一条违反 fixture 必须被计数；`.eval-corpus/` 增补对应语料子目录并在清单声明聚合阈值（无声明即丢弃是禁止行为）。
- [ ] `status_assertion` 通道改双向：既拦"实际 < 声称"，也拦"声称 < 实际"（现网 43+/25+ 属后者，静默通过）。
- [ ] §二 两表逐行处置：文档低估者按实测数改写；高估者随 Batch 1–4 的实现或删声明落地。`improvement-plan.md`（2026-08-22）按归档纪律退役，指向本文件。
- 验收：`check --json` 暴露 `declaration_conformance` 三比值；`strong_ratio` 基线值上升的归因在 verify.md 中逐条可追溯；`npm run docs:audit` 与 `regen-rules.mjs` 后 AGENTS.md 与规范面一致。

---

## 五、总验收

| # | 判据 | 验证方式 |
|---|---|---|
| 1 | E1/E2/E3 三比值均为 1.0 | `mumuspec check --json` + 语料断言 |
| 2 | §三 14 条裁决全部落地，删项无幽灵引用 | 全仓 grep + `contract boundary check` 0 悬空 |
| 3 | Q4 覆盖面门认维度不认行数 | `tests/spec/aspects.test.ts` + 本仓 cognitive-map 复跑 |
| 4 | design.md 有安全节要求且 E-SPEC-006 出路为真实命令 | `tests/core/design-skeleton.test.ts` + fixSteps 回归 |
| 5 | worktree 门与创建路径成对存在 | `tests/guard/worktree-gate.test.ts` |
| 6 | 四视图渲染确定性可复现 | `tests/graph/render.test.ts` 字节比对 |
| 7 | 文档与代码差异表清零 | §二 逐行走查 |
| 8 | 全量测试 + `tsc --noEmit` + `enforce` + `ci:check` 绿 | 门禁比对，禁止以削弱门禁换取变绿 |

## 六、风险与回退

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 减法误删仍有隐性消费者的面（hyperplan 归档提取、team 引擎测试） | 中 | 高 | 每条删除前跑三重消费者核对；删除与实现同批交付，不留半删状态 |
| `strong_ratio` 因分母收缩而虚高，被读作质量提升 | 高 | 中 | 密度是调节信号不是质量分（既有红线）；verify.md 逐条归因删项与真改进 |
| Q4 维度门从计数改身份使既有变更的 cognitive-map 集中阻断 | 中 | 中 | 先 WARN 观察一轮再入 high 档；不改 `enforcement_strict` 默认 |
| 渲染视图与手写文档图不一致引发大量 WARN | 高 | 低 | WARN 级起步、不阻断（W-GRAPH-001 同源纪律） |
| umbrella 变更跨面过宽，Design 锁定后返工成本高 | 中 | 高 | Batch 0/1 先独立复验基线；`tasks.md` 按批次划分可评审单元，批次间设检查点 |

## 七、执行顺序

```
Batch 0（基线复位）→ Batch 1（覆盖面门）→ Batch 2（选型与出路）
                                          ↘ Batch 3（减法+worktree+复用）→ Batch 5（度量对账）
                                          ↗ Batch 4（图表化，依赖 Batch 3 的注册表收口）
```

Batch 1 与 Batch 2 无相互依赖，可并行；Batch 4 的泳道图视图依赖 Batch 1 的 `Q4_ASPECTS`（AspectMatrix 需要它）。
