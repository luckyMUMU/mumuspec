# Changelog

All notable changes to MumuSpec are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.46.0-alpha.1] — core-consolidation（2026-10-01）

### Added
- 起草覆盖面维度门（R-0014）：`src/spec/aspects.ts` 维度枚举单一事实源 + `classifyAspects`；Q4 收敛改按**维度身份**判定（三条同维度记录不再算覆盖），缺必需维度 `security-compliance` 直接点名；design-schema 增"安全与隐私"必填节（full）
- 架构偏好选型（R-0015）：`ARCH_PREFERENCE_PACKS` 五议题偏好包（含"暂不约束"合法态）+ `renderDesignSkeleton` 选型表渲染 + `mumuspec design-init <scope>`，E-SPEC-006 的修复步骤改指该真实命令
- 图数据确定性渲染（R-0019）：`src/graph/render.ts` 四视图（阶段×阻塞点泳道 / 含回退计数状态机 / 约束继承树 / 契约上下游）+ `mumuspec graph render --view … --format mermaid|dot|json`，未把守边与不可达节点必须可见，矛盾源数据失败不静默（E-GRAPH-002/003）
- 声明一致率（R-0016）：`mumuspec conformance` 输出 E1 声明⊆实现 / E2 实现⊆消费 / E3 门⊆事实 三比值，六探针全部由仓库事实确定性推导（fixSteps 命令存在性、命令模块注册可达、声明实现集合、MCP 工具-分发配对、错误码发射点、门指针引用），独立上报不并入 loop composite；未建探针类与待裁决项显式列出，不以空集充当绿灯
- 发射面探针首跑发现 17 个无发射点错误码：6 项三处（装载面/规范文档/测试）均无引用属纯残留，已删除（E-CHANGE-005、E-GUARD-007、E-PONYTAIL-003/004、E-KNOWLEDGE-002/003）；R-0020 完成其余三分类裁决——8 码声明保留（注册表 `reserved` 字段为唯一事实源，生成文档呈现「无发射点 + 现由哪条通道承担」，语料若期望其中任一码则探针判违反，声明不是免检通道）、2 码补发射点、1 码撤回（E-PONYTAIL-002：依赖必要性需意图判断，机械不可判定，注册 ERROR 码即假强制）。同批修正含 E-DESIGN-009：文档宣称缺失节返回错误码，引擎实际发射 W-DESIGN-009 建议级
- 敏感信息扫描（`src/guard/sensitive-info.ts`）：`.mumuspec/` 规范工件与 decisions.md 按固定模式集（凭据赋值 / Bearer Token / 私网 IP / 内网域名 / 数据源连接串）扫描，每文件一条 W-SECURITY-001 建议级告警、摘录掩码不回显原值、`audit.log` 留 `security.sensitive_info_scan` 记录；挂在 `mumuspec check` 全量模式，不提供配置开关（prohibitions 将其列为不可关闭例外）
- 选型表进阶段门：`findIncompleteSelections` 判定含"未决标记"与"手工丢失决策字段"两态（无选型字样的 `###` 块不误报），design→build 守卫以 W-DESIGN-012 建议级列出未决议题；`design-init` 出口文案的"选定后方可进入 Build"改述为实际档位，`docs/design/change-layer.md` §11.3 处置表按实际判定重写
- 覆盖面门读取伴生能力接线：Q4 缺 `security-compliance` 维度时守卫探测 `security-and-hardening` 可达性，不可达则告警文案点名"敏感信息扫描兜底、盲区判断仍缺"并写 `aspect.security.degraded` 审计记录（降级留痕而非静默替换）；`mumuspec skill companions` 输出区分 `[引擎接线]` 与只读环境事实报告（JSON 增加 wired 字段，判定源 `WIRED_COMPANIONS` 单源）
- 第七探针 always-enforce-exception（E3）：例外清单条目必须是求值面可见的 check id；实测 `BUILTIN_CONSTRAINT_EXCEPTIONS` 9 条目在折叠路径一次都不被命中（该路径的 id 取值是错误码或 hook 自建 id），已立 R-0021 承载裁决——改名对齐属强度收紧，需人工签收
- BOUNDARY 判定源降格：`sync --check` 从"导出全集 ⊆ 文档"（18 模块每轮数百条未记录导出，常年全红等于无门禁）改为"声明 ⊆ 代码"——全仓不存在的声明记 WARN（幻影），仅存在于兄弟模块的声明记 INFO（归属错位）；符号采集识别生成器导出与再导出，注释行不再算声明。18/18 模块对齐、幻影清零；被遮蔽的遗留 BOUNDARY 双份（change/guard/install）删除，team 的遗留单份迁入 `.mumuspec/`；`src/graph` 补边界文档并注册 index.yaml；无消费者的 team 引擎立 R-0022 裁决（不得以占位命令面凑可达性）
- 探针引用面口径固化：`.mumuspec/knowledge/**`（导入快照）、`.mumuspec/changes/**`（历史工件）、`docs/appendix/**`（冻结研究）不计为承诺；`.eval-corpus` 的期望按"期望与发射面脱钩即违反"处理，不当作承诺
- 变更原文槽位：`mumuspec new --request "<原文>"` 落 `request.md`（逐字节，不带选项时行为零变化）
- 活跃变更容量门：关闭单一活跃变更后按 `workflow.max_active_changes` 阻断（E-CHANGE-013）
- 复用机制（R-0018）：`mumuspec contract import --from <scope> [--id] [--to]` 复用既有注册与审计路径并标注来源注册表位置；`mumuspec constraints reuse --id [--from] [--to] [--tighten]` 经 `src/spec/reuse.ts` 纯规划并继承既有出处通道。缺上游来源拒（E-SPEC-016）、放宽强度拒（E-SPEC-017）、来源不存在即失败并列出可选项，不返回空成功
- 渲染能力接入 MCP：只读工具 render_diagram 与 CLI 共用 `src/graph/facts.ts` 适配层，并登记进路径校验表（其 `path` 参数受既有目录安全门约束）
- 文档审计新增阻塞点对账：docs 中出现的门禁编号必须存在于工作流图数据（默认与项目级 override 并集），不一致报出；WARN 起步，不影响退出码
- 图示结构对账落地：`docs/reference/workflow-diagrams.md` 由 `src/graph/doc-page.ts` 从图数据生成（四视图，不含变更状态以免随阶段抖动），`npm run build` 末段重生成，`npm run docs:audit` 以同一投影比对并定位首个差异行

### Fixed
- 三个悬空行为门指针补上真消费者：`workflow.worktree_isolation`（`createWorktree` 回归 + `ensureWorktreeIsolation` 按强度档创建或降级留痕 + E-GUARD-014/E-CHANGE-014）、`workflow.max_active_changes`、`workflow.tdd_enforced`（强制档下 tdd_mode 不一致升级为 error，默认档维持 WARN ⇒ 默认行为零变化）
- 删除 code-graph 持久化假声明（`storage: sqlite` / `db_path` 退出配置类型、默认值与项目配置；文档 `index.db` 条目改述实际形态）
- `onboard quickstart` 不再静默套用 frontend 模板：缺 `--preset` 即失败并列出可选值
- STATUS 数量断言核对改双向（此前只拦"实际<声称"，"43+ 命令/25+ 工具"的长期低估静默通过）；进度文档按实测复位（384 约束 / strong 4 / weak 21、59+ 命令、35+ 工具、11 agent、Phase 4/5 实际形态）
- MCP 工具缺失 schema 中 required 的 path/dir 参数此前落入 `resolve(root, undefined)` 抛 Node TypeError，现返回 E-SECURITY-003 与修复步骤
- 知识页面必填字段缺失的 organize 发现挂上 E-KNOWLEDGE-001，注册档位由 ERROR 改为 WARN 与实际告警一致；glossary 的 DESIGN 域示例改指发射中的 W-DESIGN-001

### Removed
- 死文件 `scripts/cleanup-temp.mjs`（空、无引用）与遗留规则文件 `.cursorrules`（项目规范自身禁止生成）
- 无引擎的多角色评审能力面：`hyperplan_result` 状态字段、两条永不发射的错误码（E-GUARD-005/006）、归档 D4 提取分支、配置键与伴生项、grill-me 中恒不触发的架构质询（该字段初始即 true，质询形同虚设）
- 占位命令面 `mumuspec bundle publish` 与 `publishBundle`（连同 E-BUNDLE-001、BOUNDARY 中失真的 `Promise<void>` 签名声明）；`mumuspec team *` 命令面（默认适配器返回占位简报并以成功形态呈现，引擎保留待真实适配器接入后重新暴露）
- 第二套并行 AST 判定面：`checkAstConstraints` 与其 eval/new-Function 识别链在 src 内零消费者，且 `no-eval`/`no-new-function` 未在任何注解映射、约束类型表或禁令正文中声明；AST 判定回归 provider 注册表单一来源

### Docs
- 设计增量：`docs/design/spec-layer.md` §8 起草覆盖面模型、`change-layer.md` §11 初始架构偏好选型、`contract-layer.md` §11 复用机制、新建 `docs/design/diagram-rendering.md`；skill 侧 Q4 表与 open 阶段扩写清单改为引用维度事实源
- 改进计划与目标登记：`review/2026-09-30-core-consolidation-plan.md`、`.mumuspec/roadmap/items/R-0014`–`R-0021`；过期 `roadmap/improvement-plan.md` 改为取代指针

## [0.46.0-alpha.0] — archive auto-bump (2026-09-20)

### Added
- behavior-gate 注解通道（契约变更）：type 联合 + gate_ref（error-code:/corpus: 两形态），静态核验门禁存在与语料杀伤证据，命中计 strong，悬空发射 E-GUARD-013（forceable:false、always_enforce）；tech.md 契约节界定 gate 语义
- doctor legacy 词法兜底 advisory；翻闸决策文档 review/legacy-flip-decision-2026-09-20.md（本轮默认值不动）
- 语料 bad-gate-001/clean-05/clean-06（n=17 满杀伤）

### Fixed
- 通道标记剥离归一（stripChannelMarker）：ast:/lex: 前缀不再改变豁免与扫描路由，根治批1 的 15 误报与系统行为条目假强制两端

### Changed
- 归档自动升版：变更 engine-consolidation（full workflow）归档触发

## [0.45.0-alpha.0] — archive auto-bump (2026-09-19)

### Changed
- 存量迁移（dogfood-migration-b1）：根 spec.md 50 + roadmap 23 + demo 25 条 implicit-manual → 显式 manual(原句)；45 条 enforced-strong 证据指针与 10 条 yaml 机器指针保持原样；legacy=false 演练绿；偏差登记：lex: 显式化取消（破坏系统行为豁免路径）
- validator：W-SPEC-017 不再对 enforced-strong( 指针文本误报
- 归档自动升版：变更 dogfood-migration-b1（full workflow）归档触发

## [0.44.0-alpha.0] — archive auto-bump (2026-09-19)

### Added
- enforcement-gap L1：`constraints.yaml` 条目机读注解通道——`ConstraintEntry.annotation`（复用 spec frontmatter 同一类型），分类判定序对齐 spec 条目（R1 注解/ast: → strong、显式 lex: → weak、enforcement → manual、legacy 词法受 `legacy_lexical_channel` 管辖）；条目经 `constraintEntryToItem` 投影并入 guard 执行流水线（forward→E-GUARD-012、reverse→E-GUARD-003）与 enforcement_coverage 五桶；`annotate` 追加 constraints.yaml 只读建议清单（`constraintsSuggestions`，回写须人工签收）。
- enforcement-gap L2：`status_assertion` 对账通道（`src/guard/status-assertion-checker.ts`）——STATUS.md 机器可核断言（包版本/能力层进度/命令与工具数量/更新日期）与仓库事实逐项对账，只拦矛盾不判好坏；E-DRIFT-016 注册（默认 WARN 恒可见，enforcement_strict 下 ERROR）；接入 `check` drift 数组（schema append-only）与 `ci:check`；`.eval-corpus/` 新增 bad-drift-001/clean-04（recall 1.0/precision 1.0，n=16）。

### Fixed
- doctor 强度建议通道对未配置 `constraint_strength` 的项目不再崩溃（`collectStrengthDeviations` 空值防御）。
- W-SPEC-017 不再对 `ast:`/`lex:` 机器通道 Enforcement 文本误报 legacy 建议。
- 对账通道上线即拦下并修正：STATUS.md「Contract Layer 0%」与 src/contract 实存实现的矛盾、STATUS/README 与 package.json 的版本漂移。

### Changed
- 归档自动升版：变更 enforcement-gap（full workflow）归档触发

## [0.43.0-alpha.0] — archive auto-bump (2026-09-18)

### Changed
- 归档自动升版：变更 strength-suggested（full workflow）归档触发

## [0.42.0-alpha.0] — archive auto-bump (2026-09-18)

### Changed
- 归档自动升版：变更 spec-context-projection（full workflow）归档触发

## [0.41.0-alpha.0] — archive auto-bump (2026-09-18)

### Changed
- 归档自动升版：变更 evaluator-inprocess（full workflow）归档触发

## [0.40.0-alpha.0] — archive auto-bump (2026-09-18)

### Changed
- 归档自动升版：变更 manual-explicit（full workflow）归档触发

## [0.39.0-alpha.0] — archive auto-bump (2026-09-18)

### Changed
- 归档自动升版：变更 annotation-primary-r2（full workflow）归档触发

## [0.38.0-alpha.0] — archive auto-bump (2026-09-18)

### Changed
- 归档自动升版：变更 shall-annotation-channel（full workflow）归档触发

## [0.37.0-alpha.0] — archive auto-bump (2026-09-18)

### Changed
- 归档自动升版：变更 lightweight-freeze-gate（full workflow）归档触发

## [0.36.0-alpha.0] — archive auto-bump (2026-09-17)

### Changed
- 归档自动升版：变更 install-trae-agents（full workflow）归档触发

## [0.35.0-alpha.0] — archive auto-bump (2026-09-17)

### Changed
- 归档自动升版：变更 eval-corpus（full workflow）归档触发

## [0.34.0-alpha.2] — legacy-cleanup-fix (2026-09-13)

### Fixed
- guard 对 affected_scopes 字符串值逐字符迭代的缺陷：新增 normalizeAffectedScopes 归一化（数组原样、字符串按逗号切分），消除 E-SECURITY-001 误触发与 E-VERIFY-003 记录面失真
- findSpecDirs 改用共享 SKIP_DIRS 集合：temp/ 等非规范目录下的 .mumuspec 不再进入规范扫描面（spec_drift 警告清零、validate unverifiable=0、agents-hash 口径恢复干净）

## [0.34.0-alpha.1] — bp-into-graph (2026-09-13)

### Added
- CHG-8: 引擎 workflow 配置新增 workflows.<wf>.phase_bps 可选段（phase → BP id 列表），loader 校验键合法、id 格式与 workflow 内唯一，缺省向后兼容
- graph verify 输出 phase_bps 清单，并对 skill 侧 workflow.yaml 声明做一致性检查（W-GRAPH-001，WARN fail-open）
- 新模块 src/change/phase-bps.ts（collectWorkflowBps / unionBps / collectSkillBps / compareBps）
- 新错误码 W-GRAPH-001（GRAPH 域，113 码 / 21 域）

### Changed
- skill 侧 workflow.yaml design 阶段补齐 BP-4.5 声明；修复其 design 段预存 YAML 缩进损坏
- workflow.default.yaml 与项目级 override 的 loop workflow 标注 experimental

## [0.34.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 bp-into-graph（full workflow）归档触发

## [0.33.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 workflow-tier-hint（full workflow）归档触发

## [0.32.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 drift-delta-preview（full workflow）归档触发

## [0.31.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 ready-action-guidance（full workflow）归档触发

## [0.30.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 delta-channel-gate（full workflow）归档触发

## [0.29.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 fail-open-audit（full workflow）归档触发

## [0.28.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 spec-fence-guard（full workflow）归档触发

## [0.27.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 shall-structure-lint（full workflow）归档触发

## [0.26.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 ci-drift-gate（full workflow）归档触发

## [0.25.0-alpha.0] — archive auto-bump (2026-09-13)

### Changed
- 归档自动升版：变更 enforcement-coverage（full workflow）归档触发

## [0.24.0-alpha.0] — archive auto-bump (2026-09-12)

### Changed
- 归档自动升版：变更 skill-plugin-standard（full workflow）归档触发

## [0.23.0-alpha.4] — archive auto-bump (2026-09-12)

### Changed
- 归档自动升版：变更 loop-signal-bandwidth（hotfix workflow）归档触发

## [0.23.0-alpha.3] — archive auto-bump (2026-09-12)

### Changed
- 归档自动升版：变更 evaluator-data-source-fix（hotfix workflow）归档触发

## [0.23.0-alpha.2] — archive auto-bump (2026-09-12)

### Changed
- 归档自动升版：变更 loop-convergence-judgment（hotfix workflow）归档触发

## [0.23.0-alpha.1] — archive auto-bump (2026-09-12)

### Changed
- 归档自动升版：变更 evaluator-weight-single-source（hotfix workflow）归档触发

## [0.23.0-alpha.0] — archive auto-bump (2026-09-12)

### Changed
- 归档自动升版：变更 self-improvement-loop-p0（full workflow）归档触发

## [Unreleased] — 设计与实现的视野正交性（I1 / I2 / I3）

把方法论"自顶向下设计，自下而上实现"落成三条可判定不变量。依据：
`review/design-build-orthogonality-plan-2026-09-12.md`。核心等式：**实现侧并行度 = 设计侧完备性的可测量投影**。

### Added
- **I1 设计向上闭合**（`design_to_build`）：覆盖 L*N* 必覆盖 L0..*N*-1，否则 `E-GUARD-009`；
  `workflow.top_down_design` 解析为 false 时降级为恒可见 `W-GUARD-009`。结论**恒写入** `state.design_coverage`。
- **I2 层间自下而上**：`mumuspec state layer` 写入时校验——低层未完成即拒绝把高层置 `done`（`--force` 可越过）。
- **I3 层内默认可并行**：同层 scope 之间存在直接调用边 → `W-BUILD-001`（可 force）。
- 新命令 `mumuspec state layers <name> [--json]`（层级 / 候选并行组 / 已声明并行组）。
- 新命令 `mumuspec state plan-parallel <name> [--apply]`（读 code-graph 派生并行组）。
- 新模块 `src/change/parallel-planner.ts`；新工件 `state.design_coverage`。
- `BuildLayer` 新增可选 `parallel_group?: number` / `depends_on?: string[]`。
- 根规范新增 Requirement「设计与实现的视野正交性」；`constraints.yaml` 登记 TD-R-003。

### Changed
- `mumuspec state layer` 改为按 `(layer, scope)` 定位：同层多 scope 不带 `--scope` 报歧义并列出候选，
  不再静默只改第一条（原 `find(l => l.layer === layer)` 的隐式串行假设）。
- `mumuspec state layers` 仅在并行组**尚未验证**时才提示 `plan-parallel`。
- `workflow.top_down_design` 从零消费者的死配置接入守卫判定；**不新增布尔配置，不改强度矩阵默认值**。

### Fixed
- **60 条 `E-GUARD-003` 假阳性清零**：改写 `.mumuspec/spec.md` 中"仅以 `.mumuspec` 存在性判定模块"的
  SHALL NOT 文本，去掉制造 R2 词法通道的 bare 目录名行内标记。`mumuspec check` 恢复 exit 0。
- **四份 phase skill 的出口门禁从未执行**：`guard <change> <phase>` 的 `<phase>` 是**目标**阶段，
  skill 里填成了当前阶段。已修正为 open→design / design→build / build→verify / verify→archive-in-progress。
- **错误码注册表闭合**：补注册 15 个"已发出但未注册"的告警码（`W-DESIGN-001..011`、`W-GUARD-001/004/009`、
  `W-VERIFY-001`），取值与既有回退默认一致 → **零行为变更**；`E-BUILD-PARALLEL` 按命名约定改名为 `W-BUILD-001`。
- **文档生成器与 CI 校验只认 `E-` 前缀**：`gen-error-codes-doc.mjs` 正则与拼接均硬编码前缀（渲染出畸形的
  `E-W-DESIGN`），`ci-check.mjs` 两侧同理，导致所有 `W-` 码对文档与 CI 双向隐形。已放宽为 `[EW]-`。
- `docs/reference/phase-guards.md` 按代码实况重写（并列出"非本守卫职责"）；认知框架检查的真实码为
  `W-DESIGN-001..006` 而非文档原先声称的 `E-DESIGN-*`。
- README 版本号与 `package.json` 对齐。

### Added (tests)
- `tests/guard/error-code-registry.test.ts`：守卫发出的每个码必须已注册、`W-DESIGN-001..011` 必须在册、
  **生成的 error-codes.md 必须覆盖注册表全部条目**。
- `tests/guard/design-build-orthogonality.test.ts`（I1 四种情形 / I3 耦合与跳过）。
- `tests/change/parallel-layers.test.ts`（同层定位、自下而上顺序、候选 vs 已声明并行组）。

## [Unreleased] — 自由度边界（设计与实现）

把"自由度"从标量代理指标（`constraint-density`）推广为**区间定义**：上游给出约束（下界），
界内的一切选择自由。设计 Level *N* 只受 Level 0..*N*-1 约束、层内自由；实现 Level *N* 只受
设计已声明的边界约束、界内自由。核心等式：**受上游约束，界内自由**——区别只在"上游"是谁。

### Added
- 根规范新增 Requirement「自由度边界（设计与实现）」：两类反面（**越权约束** = 无上游来源的约束；
  **越界实现** = 引用超出设计边界的符号）+ SHALL / SHALL NOT / ENF-1..3。
- 新模块 `src/spec/constraint-provenance.ts` — 把 `source_specs` 从**零消费者字段**变成可判定通道
  （与 `change/archive-consistency.ts` 同构）：`E-CONSTRAINT-001`（缺来源，越权约束）、
  `E-CONSTRAINT-002`（来源文件不存在）、`W-CONSTRAINT-003`（来源锚点未命中标题）。
- 新错误码域 CONSTRAINT（3 码），已注册进 `ERROR_CODES` 并进入生成的 `docs/reference/error-codes.md`。
- `constraints.yaml` 登记 `TD-F-005` / `TD-R-004`，其 `source_specs` 指向新 Requirement（自我 dogfooding）。

### Changed
- `mumuspec check` 的 drift 数组新增 `detectConstraintSourceDrift(root)`：约束来源不可解析时
  `check` 会 exit 1（此前约束写没写来源，无人核对）。
- `error-code-registry` 测试的扫描面从 `src/guard` 扩到 `src/guard` + `src/spec`——这条不变量
  属于"会发错误码的层"，不只属于一个目录。
- `docs/design/change-layer.md` 新增 §自由度边界；`docs/design/constraint-strength.md` §5.6.1
  补"约束树 tighten-only 是自由度边界在约束树上的实现形式"的挂钩说明。
- `src/spec/.mumuspec/BOUNDARY.md` 补新导出与新增内部依赖 `../core/constraints-loader.js`。

### Notes
- **锚点匹配刻意宽松**：归一化（忽略大小写与空白/连字符/下划线/间隔号）后子串匹配，
  使 `#流程执行载体` 命中 `## Requirement: 流程执行载体（CLI-first）`。锚点服务于"来源可追溯"，
  不是精确指针——误报比漏报更贵。
- 新增的 `SHALL NOT` 条目**故意不带行内代码标记**（判定目标是语义而非字面量出现），
  靠块级 Enforcement 落到 R3 manual；`mumuspec validate` 的 `unverifiable` 计数保持 0。

### Fixed
- **`mumuspec check` 的 drift 汇聚改为逐源隔离**：此前任一检测源抛出异常会把整个 check
  打进 `E-CHECK-001` 兜底——其余源已产出的发现全部丢弃，check 从"报告问题"退化为"自身崩溃"。
  现在每个源独立执行，失败源记为恒可见的 `W-CHECK-002 DRIFT_SOURCE_FAILED`（盲区必须上报，
  不许静默），其余源照常产出。该缺陷由接入 `detectConstraintSourceDrift` 后的守卫测试暴露。
- **`ci-check.mjs` 把两个无关的版本号相比**：原先拿 `.mumuspec/config.yaml` 的遗留 `version`
  （配置 **schema** 版本）比 `package.json` 版本，这条警告**永远无法合法消除**——长期琥珀色信号
  会训练读者忽略整个警告通道。改为与权威源 `CURRENT_SCHEMA_VERSION.config`
  （`src/core/schema-version.ts`，脚本内读取而非复制常量）比较；遗留格式降为**可行动**提示
  （指向 `mumuspec sync --migrate`）。同时把仓库自身 config 按 `migrateSchema` 的语义补齐
  `schema_version: 1.0.0`（该字段此前只在内存中自动迁移，从未落盘）→ CI 首次 **0 error / 0 warning**。

### Added (tests)
- `tests/spec/constraint-provenance.test.ts`（16 例：归一化匹配 / 三态反面 / 来源正确必须静默 /
  本仓库自我 dogfooding / 错误码在册）。

## [0.22.0-alpha.3] — archive auto-bump (2026-09-11)

### Changed
- 归档自动升版：变更 archive-state-integrity（hotfix workflow）归档触发

## [0.22.0-alpha.2] — archive auto-bump (2026-09-11)

### Changed
- 归档自动升版：变更 archive-prune-safety（hotfix workflow）归档触发

## [0.22.0-alpha.1] — archive auto-bump (2026-09-11)

### Changed
- 归档自动升版：变更 spec-lexical-channel-hygiene（tweak workflow）归档触发

## [0.22.0-alpha.0] — archive auto-bump (2026-09-10)

### Changed
- 归档自动升版：变更 freedom-metrics-loop-closure（full workflow）归档触发

## [0.21.0-alpha.0] — archive auto-bump (2026-09-09)

### Changed
- 归档自动升版：变更 2026-09-09-review-followup-hardening（full workflow）归档触发

## [0.20.0-alpha.0] — archive auto-bump (2026-09-09)

### Changed
- 归档自动升版：变更 2026-09-09-completeness-artifacts-freedom-metrics（full workflow）归档触发

## [Unreleased] — PRD ↔ 实现对齐（Agent 上下文链路）

分析依据：`review/spec-agent-integration-analysis-2026-09-08.md`；变更：`prd-alignment-agent-integration`。

### Fixed
- **渐进式披露通道修复**：`mumuspec context <path>` 文本渲染此前只输出遗留字段 `layer.spec` / `layer.design`，对 0.19 起的 prd.md/tech.md 新格式输出零条约束（7 行空输出）。现补齐 `layer.prd` / `layer.tech` 渲染，与 `--json` 通道同构（根路径输出 7 → 257 行）
- **根全局 charter 回归规范链**：根层 `spec.md` 此前被 loader 当作 `tech.md` 的回退文件跳过（根层同时存在 prd/tech 时永不加载）。现根层（level 0）额外加载 spec.md——Root spec.md 是全局 charter，与 prd/tech 共存为规范要求；模块层保持「spec.md 仅作 tech.md 回退」语义
- **AGENTS.md 规范链摘要为空**：`buildRuleGenContext` 改为结构摘要（层级 / scope / 文档类型 / SHALL·SHALL NOT 条数）+ 当前路径红线全文，不内联 SHALL 正文（遵守分发层「禁止内联全量规范」SHALL NOT）；init 与 install 两条链路均传入 specContext。摘要由空 → 56 条红线
- **CLI 速查与注册表脱钩**：AGENTS.md 速查此前硬编码 8 条，实际注册 56 条，CLI-first 关键命令（`state transition` / `decisions append` / `test-cases lock` / `state layer` / `capability`）agent 无从得知。新增 `renderCliCheatSheet(program)` 从命令注册表现场生成（CLI-first 命令置顶 + 子命令展开）；`setCliCheatSheet()` 依赖倒置注入，使 install 路径与 init 同源
- **归档 delta 合并污染根规范**：`prepareChangeSpecContent()` 剥离变更层 frontmatter（消除 `parent_prd` / `parent_tech` 未重定位导致的 E-SPEC-010 ×2）并拒绝合并未填写的 init 模板占位符；同步清理根 prd.md / tech.md 已入库的占位符块。`validate` 由 2 error → 0，unverifiable 2 → 0，declared_ratio 100%

### Added
- `tests/spec/agent-context-alignment.test.ts` — G1/G2/G3/G4 回归锁定（14 例）
- `tests/guard/check-validate-parity.test.ts` — G5 门禁结论一致性回归（3 例）
- `tests/guard/index-drift.test.ts` — G7b index 全树漂移检测回归（5 例）

### Fixed（P1 批次）
- **门禁结论不一致（G5）**：`checkCompliance` 全量模式并入 `validateAllSpecs` 的 error 级诊断（E-SPEC-* 全族，按 code+message 去重，warning 不升格）。此前 `check` 仅覆盖 E-SPEC-004/015，规范结构缺陷（如 E-SPEC-010 父引用断链）在 `check` 下静默通过而 `validate` 报 ERROR——违反「归档前必须通过 check 全量校验」；并入后 check 实测抓到 AGENTS.md↔spec 漂移（E-AGENTS-001）
- **规范-实现 API 名漂移（G6）**：`src/feedback/.mumuspec/prd.md` / `tech.md` 与 `manager.ts` 头部注释引用 3 个不存在的 API（`linkSession` / `listFeedbacks` / `getFeedbackContext`），`submitFeedback` 返回类型漂移。按 YAGNI 修文档对齐实际导出（9 个函数），不新增无调用方函数
- **index 漂移检测只扫一层（G7b）**：`checkIndexDrift` 此前仅枚举 projectRoot 一级子目录，深层模块「有 .mumuspec 却未注册」永远漏检。改为全树递归收集（排除 node_modules / dot 目录），上线即抓到 2 个漏检目录（src/contract/formatter、src/knowledge/scanners）
- **drift --fix 生成质量**：`autoFixDrift` 生成的 index 条目使用绝对路径且缩进错乱，已手工修正为相对路径统一格式（条目生成逻辑待后续修复）

### Added（P1 批次）
- **G7a 三模块规范层**：`src/mcp`（35 工具 / 4 写工具显式声明 / 传输-工具分离边界）、`src/meta-evolution`（评分 / 知识进化 / 技能推荐 / 影响分析 / stats 五子系统）、`src/team`（状态机 / 适配器分离 / 配置校验门）补齐 V2 格式 prd/tech 并注册 index——严格校验生效，约束总数 230 → 258，unverifiable 保持 0，declared_ratio 100%

## [Unreleased] — 自洽性修复批次（2026-09-05 全流程评审落地）+ Verifier 语义收紧（P0）+ Spec 即 DSL 定位修正 + CHG-5 LLM 自主性增强

设计提案：`review/proposal-verifier-semantics-2026-08-29.md`（含影响分析 C1-C7 与开放问题裁决 Q1-Q6）。
定位修正：`review/nl-bytecode-gap-analysis-2026-08-29.md` §定位修正，决策页 KP-0059。
本轮依据：`review/full-flow-consistency-ecosystem-2026-09-05.md`（全流程自洽性评审 × 生态对标）。

### Changed
- **归档自动升版口径定稿（保留 + 补 CHANGELOG）**：`bumpVersionForArchive` 保留既有规则（full: minor+1/prerelease 重置；tweak/hotfix: prerelease 计数 +1；无 prerelease: patch+1 转 alpha 基线），新增可选 `changeName` 参数——bump 成功时自动在 `CHANGELOG.md` 顶部插入 `## [<newVersion>] — archive auto-bump (<date>)` 条目（幂等，该版本标题已存在则跳过；无 CHANGELOG.md 或写失败均非致命）；`archiveChange` 传入 changeName 接通口径。文档口径见 `docs/reference/packaging-deployment.md` §3.4。经用户 2026-09-07 裁决保留该行为，人工不回滚版本
- **Dogfood 迁移（P0）**：根部 AGENTS.md/CLAUDE.md 从旧式全量生成迁移到 canonical-first 产物——AGENTS.md 为 canonical（规范链摘要 + Ponytail + CLI + MCP 四节），CLAUDE.md 为 `@AGENTS.md` 薄壳桥接；`buildRuleGenContext` 补齐对新格式 tech.md 层的读取（此前仅读 `layer.spec`，新格式项目生成空摘要）；demo/ 示例产物同步更新
- **CHG-7 dogfood**：本仓库创建 `.mumuspec/workflow.yaml`（当前与内置默认一致，启用项目级加载路径；差异化调整时在此修改）
- **CLI 去重（非破坏）**：`--change` 选项提升至 `mumuspec drift` 主命令；`drift detect` 降级为隐藏弃用别名（stderr 提示，下一 minor 移除）；`knowledge search` 升级为原 search2 的相关性评分增强引擎（兼容旧 `--tag`/`--type` 单值选项）；`search2` 降级为隐藏弃用别名
- **SKILL.md 开放标准对齐**：新增 `skills/mumuspec-workflow/SKILL.md`（agentskills.io 标准 frontmatter：name/license/metadata，installer `findMumuspecWorkflowSource` 首选路径）；`skills/mumuspec/en/SKILL.md`（无 frontmatter，不合规范）降级为资源文件 `en/orchestrator-en.md`
- 失效修复提示更正：`mumuspec rules generate` 命令已不存在，E-AGENTS-001 fixSteps 及 agents_drift fixHint 改为指向 `mumuspec init`

### Removed
- DS-005 任务粒度检查空壳占位（`phase-guard.ts` checkBuildToVerify 内 `void GranularityLimit` 死代码）：从未产出任何 warning 且无文档声明，按 YAGNI 移除；未来需要时基于 tasks 数据结构重新设计

### Added
- **CLI-first 三命令（0.20）**：`tasks next <name>`（tasks.md 首个未完成任务定位，替代 grep 手工步骤）、`test-cases lock-suite <name> --layer N`（逐层套件 hash 确定性写入 state.suites_hash，替代手写 suite-map.yaml）、`state layer <name> <N> <status>`（build_layers 状态确定性更新，替代手编 .mumuspec.yaml）
- 约束可验证性四分类（`enforced-strong` / `enforced-weak` / `manual` / `unverifiable`）：新增 `src/spec/verifier-classify.ts` 纯函数分类器，正则兜底提取逻辑与 guard 共享（消除双份正则漂移）
- `E-SPEC-015 SPEC_SHALL_NOT_UNVERIFIABLE`（ERROR，forceable: false）：SHALL NOT 红线无可验证通道时发射
- `E-VERIFY-003 MANUAL_EVIDENCE_MISSING`（ERROR，forceable: true）：verify_to_archive 逐条检查 manual 约束的验证记录（按 Enforcement ID 或约束原文锚定）
- `mumuspec validate` / MCP `validate_specs` 返回 `enforcement_coverage`（五桶计数 + `declared_ratio` / `strong_ratio` + unverifiable 迁移清单）；CLI 人类可读输出新增 Coverage 报告
- Enforcement 节新增 `manual(原因)` 保留字（parser 解析 + 序列化回写 round-trip）；`EnforcementRule.kind` 字段（`manual` / `implicit-manual`）

### Changed
- **CHG-5: LLM 自主性增强（过程约束全面降级）**：
  - 默认约束强度 `technical_design` 从 `high` 降为 `medium`（过程约束 advisory，结果约束仍 block）
  - 默认工作流规则 `top_down_design` / `tdd_enforced` 改为 `false`（LLM 可自主选择实现路径）
  - 默认 `require_brainstorming` 改为 `false`，`default_tdd_mode` 改为 `non-tdd`
  - `E-GUARD-001`（proposal.md 缺失等）从 RG high 降为 TD medium
  - `E-DESIGN-009`（设计模板缺失）从 ERROR 降为 WARNING（W-DESIGN-009）
  - hotfix 路径的 proposal.md/build_layers/test-cases 检查从 ERROR 降为 WARNING
  - full workflow 的 build_layers 检查从 ERROR 降为 WARNING
  - 核心原则：**Spec 只约束 WHAT（验收标准、红线），不约束 HOW（执行路径）**
- **M2 红线门禁默认启用（行为变更）**：`constraint_strength.enforcement_strict` 默认 `true`——SHALL NOT 无可验证通道即 ERROR（阻断 validate/check），manual 约束归档前必须有 verify evidence。**opt-out**：设 `enforcement_strict: false` 退回观察态（仅 warning）。经用户 2026-08-29 明确接受，随本次一并发布
- **E-SPEC-004 语义收窄与恒可见**：仅指 SHALL 无验证声明；`always_enforce` 注解使其不再被 TD=low 强度折叠丢弃（可验证性 ⊥ 强度，constraint-strength.md 新增 §9.0）；forceable 改为 false
- F8 修复：自动注解移除「样板/DRY → no-side-effect」语义错配（此前制造虚假的 enforced-strong 覆盖）

### Fixed
- **CLI 版本动态化（CHANGE-3 由构造保证）**：`src/cli/index.ts` 硬编码 `.version('0.19.1')` 与 package.json（0.19.2-alpha.0）漂移——`--version` 输出错误且 prebuild 阻断；现改为运行时读取 package.json，`prebuild-check` 识别动态读取模式
- **C3 遗留格式禁令 dogfooding 误报**：`禁止生成 .cursorrules/.windsurfrules` 的字面扫描命中 generator 硬过滤与 doctor 指引（约束自身的合法实现者）；扩展 `isAgentBehaviorConstraint` dogfooding carve-out 覆盖该约束（checker.ts）
- **skill 指令与 CLI 实现一致性修复（6 处）**：verify-fail/archive-reopen 两个无效状态机目标改为 `transition <name> build --reason`；`mumuspec archive` 补 `--confirm`；`decisions append` 补 `--text`；编排器 Guard/State 说明重写为当前审计语义；skill 接线既有命令（cognitive-map init/sync、grill-me run、test-cases init、decisions append）。分析见 `review/pipeline-cli-first-analysis-2026-08-29.md`
- `checkIndexDrift` 对比逻辑修复：此前将 index 子项 path（`src\core`）与目录名（`core`）互比，永不相交导致每个索引条目都产生假漂移警告；现按 path 探测 `.mumuspec` 存在性，仅报告真实陈旧项
- `serializeSpecFile` frontmatter 保真修复：此前 round-trip 会静默丢弃未知 frontmatter 字段（如 doc_type、parent_prd）；现按序保留（`mumuspec annotate` 等回写命令不再有数据丢失风险）
- 错误码注册表补全：登记 5 个有发射点但未注册的码（E-VERIFY-001/002、E-DESIGN-009/010、E-FINAL-001，新增 FINAL 域，共 78 码/16 域）
- 结构白名单补 `templates`（cognitive-map 查找路径、config `custom_dir`）与 `discarded`（discard 终态目的地）
- `mumuspec init` 创建的 `knowledge/rationale` 目录更正为 `rationales`（并补 `imports`）——修复新初始化项目立即报 E-SPEC-013 的自相矛盾（预存在缺陷）

### Documentation
- `docs/design/constraint-strength.md` 新增 §9.0 可验证性前置判定
- `docs/reference/error-codes.md` 自动再生（71 → 73 码，新增 VERIFY 域）
- README.md、overview.md、design.md、STATUS.md 全面更新：对齐 "Spec 即 DSL" 核心定位（KP-0059），"人工编写 spec 而不编写代码"

## [0.19.2-alpha.10] - 2026-09-07

### Added
- **P0-C 容量断言**：Rules 产物 32KiB 预算（`MAX_RULES_BYTES` + `assertRulesWithinBudget`），fail-closed；新增错误码 E-RULES-001
- **P0-A 命令能力分层（最小版）**：`CommandMetadata` + `mumuspec capability [command] [--json]`

### Changed
- **P0-B**：loader 渐进式披露层数改用 `config.specs.max_layer_depth`（默认 5），不再硬编码 3 层
- **P0-D**：finalize-archive code-graph snapshot 由占位改为真实快照（落 temp/codegraph.snapshot.json）

### Fixed
- **P0-D**：cleanStaleCache 陈旧归档项由「仅计数」改为实际删除；新增 `.finalized` 防重跑标记（幂等，--force 覆盖）

## [0.19.1] - 2026-08-22

### Security
- MCP HTTP 模式新增 Token 认证（`MUMUSPEC_MCP_TOKEN`）和 CORS 白名单（`MUMUSPEC_MCP_CORS_ORIGIN`）
- YAML 解析启用安全配置（maxAliasCount: 100）防止 YAML 炸弹攻击
- 归档操作的 appendFileSync 改为原子替换模式，防止重复追加

### Fixed
- 修复 discardChange/archiveChange 在 renameSync 失败后状态与文件不一致的数据完整性问题
- 修复 acquireLock 锁超时后静默放行改为抛出错误
- 修复 mergeDeltaSpecsToMain 幂等性问题（防止重复归档导致内容重复）
- 修复 readFileSync 读取超大 YAML 文件导致 OOM 的问题（限制 10MB）

### Added
- `mumuspec spec annotate` 命令：自动为 SHALL NOT 约束生成 machine-readable 注解
- `mumuspec gen:error-codes` 命令：自动生成错误码文档
- `mumuspec ci:check` 命令：版本一致性 + 文档漂移检测
- CI 管道新增版本一致性和错误码文档漂移检查步骤

### Documentation
- 错误码文档（docs/reference/error-codes.md）改为自动生成
- 统一版本号四处（package.json / README / STATUS.md / npm）为 0.19.1
- 修正 README 中未经实证的量化声称

## [0.16.0-beta.0] - Unreleased

### Added
- 测试覆盖为 guard/checker.ts、spec/validator.ts 新增单元测试（checker.test.ts、validator.test.ts），覆盖 applyStrengthToGuardResult、checkCompliance、detectDrift、validateAllSpecs 等核心守卫逻辑。

### Changed
- 规范层一致性修复：34 个分布式 prd.md/tech.md 补充 last_updated 字段。
- 契约层完整性修正：hooks/BOUNDARY.md、i18n/BOUNDARY.md 接口名与代码完全对齐；移除 core/BOUNDARY.md 中不存在的 migrateConfig 声明及虚假 contract/constants 依赖。
- 架构层补全：新增 src/change/index.ts barrel re-export，符合 spec.md 结构规范。

### Documentation
- CHANGELOG 补录 DCG 状态机重构、Dashboard 子项目、monolithic 拆分归档三项遗漏变更。

## [0.15.0-beta.0] - 2026-08-01

### Added
- Mode-aware Guard 层:检测到不同运行环境(Claude Code / Cursor / CatPaw)时,自动调整 MCP 工具与 Rules 文件输出。
- Spec Scaffolder:初始化时基于项目分析结果,按目录结构自动生成分布式 prd.md / tech.md 文档。
- Git 命令封装 (`mumuspec git commit/flow/push/tag`):git-master 风格的一站式 git 操作,内置状态校验。
- Dashboard 命令 (`mumuspec dashboard`):实时查看活跃变更、状态机位置与历史指标。
- Spec Incremental Diff (`mumuspec search`):正则表达式搜索代码/规范节点。

### Changed
- 初始化流程重构 (`2026-08-01-refactor-init-and-archive`):整合项目分析、自动导入现有文档/第三方规范、环境检测知识页面生成等步骤。
- 归档流程重构 (`2026-08-01-refactor-init-and-archive`):新增 `finalize-archive` 命令用于归档后清理(合并规范、更新索引、清理缓存)。
- 知识层持久化重构 (`2026-08-01-refactor-persistent-spec`):`loadSpecContext` 增加缓存与增量更新;变更归档后知识可持久化落盘。
- 移除 package.json 中的 `bundledDependencies`,`workspaces` 字段,与 monorepo 的 npm 全局安装无关配置。
- Design 阶段增强 (`2026-08-01-enhance-design-phase`):引入 Hyperplan 对抗式设计评审流程;Design Skill 增加 cognitive-map.yaml 产出要求。

### Fixed
- Spec 继承加载器修复重复解析同一文件问题。
- 零依赖模块 `src/i18n/locales.ts` 误用 `import type` 跨包引用错误。
- `mumuspec context` 在 Windows 路径分隔符场景下上下文层级判定错误。

## [0.15.0-alpha.2] - 2026-08-01

### Added
- TypeScript 严格性补全启用 `noImplicitReturns` 与 `noFallthroughCasesInSwitch`,与原有
  `noUnusedLocals`/`noUnusedParameters` 组成完整严格性家族。
- CLI 子命令参数校验 (`feedback submit/update`、`guard`、`state transition`)
  在调用核心函数前显式验证,替换原有的 `as any` 断言。

### Changed
- 移除 package.json 中自引用依赖 (`"mumuspec": "file:..."`)。
- 拆分 `src/change/manager.ts` (1212 行) 为 paths / listing / state / lifecycle / archive / decisions 六个子模块 + 转发 hub。
- 拆分 `src/knowledge/manager.ts` (977 行) 为 pages / index / freshness / analysis / organize 五个子模块 + 转发 hub。
- 修复 `src/change` ↔ `src/feedback` 循环依赖:feedback 改为直接从 `change/paths.js` 导入。

### Fixed
- 修复 `.mumuspec/index.yaml` 顶层重复的 `skills` 与 `feedback` 键。
- 修复零依赖模块 `src/core/env-detector.ts` 中误导入 yaml 库的问题。
- TypeScript 严格模式迁移:修复 24 个源文件中 81 处未使用变量/参数警告。

### Removed
- 清理根目录残留的 `mumuspec-0.13.0-alpha.1.tgz` 打包产物。
- 所有 7 处 `as any` 类型断言,改为精确的类型标注 (`as ChangePhase`、`as SubmitFeedbackOptions['type']` 等)。

## [0.13.0-alpha.2] - 2026-07-15

> ⚠ 此版本未发布到 npm,仅作为开发快照存在。

### Added
- 动态约束强度系统: 新增 `constraint_strength` 顶层配置字段,支持
  `technical_design` 与 `requirement_goals` 两个维度,每维 `high`/`medium`/`low` 三档。
- 树状分层约束解析: `resolveConstraintTree` 纯函数,支持 `.mumuspec/constraints.yaml`
  在目录树中分层声明、跳层继承、收紧验证。
- Bundle-based skill 系统: 14 个内置技能 (前端、后端、测试、DevOps) 通过 `mumuspec skills install/load` 分发。
- Env Detector: OS 检测、shell 识别、敏感环境变量过滤。
- Init Generator: 从 ESM/CJS monorepo 模板新建项目。
- Project Analyzer: 技术栈探测、目录结构评估。
- Doc Importer: 从现有 README/design 文档导入生成 spec。
- Knowledge base 扩展: imports/rationales/lessons/risks 四个新类型,imports 子目录 28 条存量导入。
- 14 个 src 模块内嵌 .mumuspec/{prd,spec,tech,design} 文档。
- 打包部署文档、用户反馈与 session 摘要流程、预发布版本管理脚本。
- package.json 新增 `files`/`publishConfig`/`homepage`/`repository`/`bugs` 字段。

### Changed
- 测试套件扩展至 13 文件 / 204 用例,覆盖 env/git/knowledge/parser/constraint 等模块。
- 版本号从 `0.10.0` 提升至 `0.13.0-alpha.2`。

## [0.10.0] - 2026-07-10

### Added
- 初始 MVP 设计: 六层架构 (Spec / Change / Guard / Knowledge / Contract / AI Integration)
- 树状分布双向约束 (SHALL / SHALL NOT)
- Ponytail 编码约束 (7 级优先级阶梯)
- 五阶段变更状态机 (Open → Design → Build → Verify → Archive)
- 知识层 (LLM-Wiki + PageIndex)
- MCP Server 与 CLI 入口
- demo 项目 (task-api) 演示完整流程

[Unreleased]: https://github.com/mumuspec/mumuspec/compare/v0.15.0-beta.0...HEAD
[0.15.0-beta.0]: https://github.com/mumuspec/mumuspec/compare/v0.15.0-alpha.2...v0.15.0-beta.0
[0.15.0-alpha.2]: https://github.com/mumuspec/mumuspec/compare/v0.13.0-alpha.2...v0.15.0-alpha.2
[0.13.0-alpha.2]: https://github.com/mumuspec/mumuspec/compare/v0.10.0...v0.13.0-alpha.2
[0.10.0]: https://github.com/mumuspec/mumuspec/releases/tag/v0.10.0
