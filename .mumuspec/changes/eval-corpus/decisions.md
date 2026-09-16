# Decision Log: eval-corpus


## [open] 2026-09-14T14:24:24.762Z

BP-2 拆分判定：不拆分。M1 为单一批次能力（corpus 类型+语料库+2评估器+report 出口），M2/M3/M4 已在实施计划中各自独立成批，天然满足独立交付。

## [open] 2026-09-14T14:24:56.942Z

范围裁决（Round 1 Q&A，用户确认）：语料位置采用 .eval-corpus/ 隐藏目录（探测 4 实锤 tests/fixtures 被扫描）；custom 类型实现 assertions-only（消除死端）；checker 三盲区 B-1/B-2/fence-W 不入本变更挂 M2 评审；变更名 eval-corpus 经用户确认。

## [open] 2026-09-14T14:25:10.036Z

降级记录：brainstorming skill 不可用按 Fallback A 以 AskQuestion 两轮澄清；gitnexus-impact-analysis 不可用按 Fallback B 手动影响分析；using-git-worktrees 不可用且本会话 shell 无 git，保留 new 自带 branch 隔离。知识加载 0 页；契约 0 项全兼容；base_ref=23484ad；new 的 unborn-HEAD 怪癖复现已切回 master。

## [design] 2026-09-15T12:47:47.872Z

架构设计（高见远）：三层单向依赖 L0 runner（corpus.ts 纯函数 + runner 编排 + custom 修复）/ L1 评估器（verifiable-ratio + fail-open-count + auto-evaluate 注册）/ L2 消费层（eval --report 双形态 + .eval-corpus 语料 + fixture-location 断言）。关键决策 D-corpus-1 baseline 参照系多信号 diff（跨域探针自动降级纯码检测）/ D-corpus-2 noise 只计码不计 coverage 结构差异 / D-corpus-3 probe 白名单枚举防注入 / D-corpus-4 cwd 只接受绝对路径 / D-eval-1 fail-open-count 限计数+分组（4 类静默点位比对挂 M2）。Fallback F 五角度自审：hard_constraints 6 / decisions 7 / risks 7 / open_questions 0。

## [design] 2026-09-15T12:47:54.062Z

BP-7 用户裁决（2026-09-15）：① Hyperplan 门禁通过（open_questions=0，Fallback F 替代 5 成员对抗团队）；② 跨域码 fixture 范围——E-GUARD-010 与 E-CHANGE-022 各建 1 例（change-scoped fixture，接受成本）；③ M1 定位明示为建档非定标——每码 1 例（n<3）输出普遍标注「置信不足」属正常特征，非回归缺陷。认知框架收敛：Q1×8 / Q3×4 confirmed（含 grill-me GM-001 分层与 GM-002 expected.yaml 形态）/ Q4×3 盲区全部有兜底；build_layers 三层已入状态机。

## [design] 2026-09-15T13:23:16.441Z

测试用例设计（严过关）：三层 66 例（L0 32 / L1 18 / L2 16，P0 58），每例含 ID/目标（引用 design 章节+DS 条目+风险号）/前置/步骤/可断言期望/优先级/隔离方式；覆盖 DS-EVAL-001~004 与 R-1~R-7 全覆盖矩阵。BP-8 用户确认锁定。

## [design] 2026-09-15T13:23:17.627Z

BP-8 四项口径裁决：① corpusExpect M1 留空不设硬阈值（用户确认，n<3 高波动；report 仅展示 + 可选声明路径保留）；② 权重和断言用 toBeCloseTo(1.0,10) 不做实现侧归一化（既有 6 评估器浮点和 0.9999999999999999 为事实）；③ E-SPEC-015 severity 纳入 veto 档（与 forceable:false 一票否决红线一致）；④ L2-C07 位置隔离测试用临时重命名 + finally 复原。

## [build] 2026-09-15T13:54:41.661Z

BP-12 用户裁决（2026-09-15，Build 期规范增量，六项静默边界修订）：① 探针 infra 失败三态化——killed/missed/errored 三分，错误 fixture 不计入 recall 分母且在场景 warning 列明（衡量器不静默污染）；② report 增聚合精度字段（mustContainSatisfied 比率，仅展示无阈值）；③ P1 未声明 corpusExpect 时发 warning（防恒绿误读）；④ P2 空分母口径统一为配置错误 resultErrors（fail-closed，与 minRecall/recallBySeverity 现状对齐）；⑤ P5 corpusDir 下无 expected.yaml 的子目录发 warning 列明；⑥ 工件更新路径=增量修订不走 Design 回退（design.md §2.1.3/§10 + delta-spec DS-EVAL-001/004 + tasks.md 追加；已锁定 test-cases 文档不改，新边界由 QA 测试代码覆盖）。

## [build] 2026-09-15T13:54:43.090Z

Build 进展与验证（2026-09-15）：L0 commit 0c09722（32/32 用例、231 测试绿、suite hash e2f327a879b3e069）；L1 commit b8596e4（18/18 用例、309 测试绿、RED 证据已补、suite hash 已锁），QA 独立复验两轮均无源码缺陷（对抗探针 12 项通过）。QA 发现 spec-compliance.ts 仍有本地 parseJsonFrom（单一权威源仅部分闭合）→ 已派工程师迁移。已知环境问题：git 子进程需 PATH 注入 PortableGit cmd；仓库存在 9-13 前的 pack 损坏（fsck exit 32，248 pack entry 错误，reflog 曾断链）——不阻断开发，repack 属破坏性操作需 .git 备份 + 非沙箱 shell，暂缓并上报用户。

## [build] 2026-09-15T14:04:12.529Z

BP-12 追加裁决（2026-09-15，语料覆盖目标与基线骨架，用户确认）：① 方案 A——语料覆盖目标收敛为可发射集共 15 例（E-SPEC-001/002/003/004/006/008/009/010/011/013/014/015 + W-SPEC-016 + E-GUARD-010 + E-CHANGE-022）；E-SPEC-005/007/012 记 registered-but-not-emitted，M1 出范围（对齐 E-DESIGN-001/002/009 前例），DS-EVAL-004 与 L2-C13 同步修订。依据：三码全仓仅 errors.ts 注册表定义、无任何 push 点（lead 双向核实 + 工程师隔离 trial 实测矩阵），强行建 fixture 必然 missed 并污染 recall/precision，违背 D-corpus-5 诚实纪律。② _baseline 骨架改为 spec.md 优先（原始格式、含 Enforcement + 词法锚定 SHALL NOT），实测 spec.md 骨架 coverage.total>0 而 prd.md-only 恒为 0——coverage 仅由 classifyRequirements 汇总，spec.md 与 V2 tech.md 是唯二喂入点，validatePrdFile 不参与；V2 prd/tech.md 作为可选补充承载 008/009/010/011。

## [build] 2026-09-15T14:04:13.912Z

评测器首个战果（byproduct finding）：语料建设过程实测暴露 3 个死错误码——E-SPEC-005（SPEC_DRIFT_DETECTED）、E-SPEC-007（SPEC_INDEX_OUTDATED，validator.ts 的 freshness 检查为空实现 stub）、E-SPEC-012（DIST_SPEC_SHALL_UNIMPLEMENTED）注册于 errors.ts 但全仓无发射点。这正是原调研提案 D3「错误码闭环率」指标要抓的对象（注册码 ↔ 发射点双向覆盖），M2/M3 批次可直接以本发现为初始数据。另：E-SPEC-015 的 Enforcement 是块级作用域（块内有 Enforcement 即降为 manual 不再触发）——语料设计须依此构造。

## [build] 2026-09-15T14:14:51.835Z

单一权威源验证与残留（QA 只读独立复验，2026-09-15）：spec-compliance 迁移 commit 912fc90 判定 PASS——QA 以 node 直读 .git 松散对象取迁移前后源码逐行比对（本机其沙箱无 git），确认 ① 全仓 function parseJsonFrom 仅剩 src/core/utils.ts:171 一处 ② 唯一语义岔口（切片后仍不合法：旧版抛错→外层 catch，新版返回 null）两条终态均为 nullResult(value 0/weight 0)，指标语义等价无回归 ③ tests/core/metrics 78 tests 全绿 + tsc 干净。**新发现（M1 出范围，记 M2/M3 backlog）**：constraint-density.ts:110-115 仍自带 indexOf+JSON.parse 切片实现，且为抛错语义变体、不支持 [ 起始，属语义不一致的重复实现（freedom-metrics loop 遗留，本变更未触及）——与「不得保留语义不一致的独立实现」纪律相关，建议 M2/M3 做单一权威源全量清扫时一并收敛。

## [build] 2026-09-15T14:26:46.824Z

Task B 语料库交付（commit 6b07840，18 fixture：_baseline + 15 bad-case + clean×3）：_baseline 改 spec.md 骨架后实测 coverage.total=20（enforced_weak=3/manual=17/unverifiable=0）、0 错 0 警；15 例 bad-case 覆盖可发射集 15 码中 14 个均实跑命中；clean×3 实测 0 码（noise=0）。**byproduct 缺陷 1（本变更内修复）**：src/eval/corpus.ts:211 与 design §2.1.0 line 160 的 PROBE_ARGS.archive 写成 ['change','archive',name]，但 archive 是顶层命令（正确形态 archive <name> --confirm；实测 archive <name> --confirm 可正确发射 E-CHANGE-022 DELTA_MERGE_INCOMPLETE，无 --confirm 则提示不可逆）——探针必然 errored、码永不命中，L2-C13 覆盖无法落实。裁决：并入 T2-0 修复（corpus.ts + L0-C14 测试代码断言 + design §2.1.0 同步），属事实性修正走 BP-12 小规模路径，无需用户裁决。**byproduct 缺陷 2（M2/M3 backlog）**：mumuspec check 的 walker 不像 findSpecDirs 那样跳过 SKIP_DIRS/点目录——temp/probe/**/.mumuspec 残留会让仓库根 check 报 E-SPEC-015/004 + index_drift 并压垮 cli-smoke dogfooding；两个 walker 的跳过策略不一致，建议 M2 统一。**C-4 位置隔离实证**：仓库根 validate coverage.total=337、check 均不含任何 .eval-corpus/ 条目（点目录双路均跳过）——语料位置设计成立。

## [build] 2026-09-15T14:40:32.722Z

锁定用例的事实性修正（2026-09-15，用户以「继续」放行推荐路径）：test-cases/layer-0-cases.md L168 的 L0-C14 期望值锁定的是幽灵命令形态 ['change','archive','c1']（源自 design §2.1.0 原笔误），而 archive 是顶层命令、正确形态 ['archive','c1','--confirm']。处置：走「增量修正 + 重锁」而非 Design 回退（BP-12 小规模路径）——① L168 改为正确 argv（用例意图「白名单模板、无注入面」不变）② test-cases lock-suite --layer 0 重锁（61a6dfcacb4698d0 → badb8c50a938fd94）③ 因文档变更使全量 hash 失配，一并执行 test-cases lock（136aef5dd387a5ab → 0aa5800753ae97b6），verify 已通过 ④ 同步修正测试代码断言与 src/eval/corpus.ts:211（并入 T2-0）。**机制教训（M2/M3 backlog 候选）**：用例锁定能防「为迁就实现而改测试」，但挡不住「从错误设计派生的错误断言」——锁定前缺少对可判定事实（如命令面 argv）的实跑核验。建议 M2/M3 评估为锁定流程增加一道「可判定事实抽样实跑」把关（与本变更语料建设暴露幽灵命令的方式同源）。

## [build] 2026-09-15T14:59:35.566Z

T2 批次交付与两处裁决（2026-09-15）：T2-1 eval --report（EvalSummaryReport version:1 顶层 7 键，进程内直调两评估器；文本四段含置信不足/errored 提示）、T2-3 位置隔离断言（4 例，含受控 temp 实验复现 tests/fixtures 污染对照）、T2-4 全量门禁（283 文件/5251 用例全绿；仓库根 validate/check 均 0 错 0 警且不含 .eval-corpus 条目）、T2-5 三层 done + suites_locked=true + verify 通过。提交链：ff356c1(T2-0) → a135fc3(PROBE_ARGS) → fe3de20(T2-1) → b2757a3(T2-3) → 3e4c0f4(T2-5)。**裁决 A（覆盖率门禁）**：不并入本变更——实测 package.json 的 devDependencies 未声明 @vitest/coverage-v8（NONE）且 node_modules/@vitest 下仅有 npm 中断残留目录 .coverage-v8-6lv7mK01，即 test:coverage 与 vitest.config.ts 四维 95 阈值在**任何环境**都不可运行（既有项目级缺陷，非本变更引入）；EvalSummaryReport.coverageRef 维持指针语义（DS-EVAL-004 只要求引用），不引入新依赖（Ponytail L3-L5）。**裁决 B（补齐用例）**：派工程师补 L2-C10/C11/C12/C13/C14/C19 测试代码（stdout-only / 退出码语义 / 全量回归证据 / 15 码枚举 + 005/007/012 反向断言 / severity 分档 / 空分母三处一致 fail-closed）。**新增 backlog 项**：覆盖率依赖缺失与残留目录（M2/M3）。

## [build] 2026-09-15T15:04:59.479Z

L2 用例补齐（commit 30905d0，+323/-2）与复核点闭环：C10 目录树快照前后相等证明 report 仅 stdout 不落盘；C11 退出码语义不受 --report 影响（无失败→0 / corpusExpect 违反→exit 1）；C12 以全量 283 文件 5251 用例绿 + runner-enhance 的 custom 断言为证据；C13 新建 tests/eval/corpus-fixtures.test.ts——枚举 .eval-corpus（1 baseline + 3 clean + 15 bad-case），15 可发射码各恰 1 例，**反向断言 005/007/012 不出现在任何 mustContain**；C14 veto 档恰为 [E-CHANGE-022, E-GUARD-010, E-SPEC-015]、warn 档恰为 [W-SPEC-016]；C19 空分母三处（minRecall/recallBySeverity/maxNoise）统一 fail-closed + 反向（未声明 corpusExpect 不触发）。**orphan warning 疑似重复的复核结论**：runner.ts L376 位于 runCorpusScenario 空语料早返回分支（fixtureNames.length===0 即 return），L635 位于正常路径 Step 8，二者由分支提前 return 隔开、每次运行至多命中其一——属**结构性冗余（同一文案两处）而非重复发射**。裁决：**不为此单独开提交**（YAGNI：仅文案重复、语义一致、L0 代码无必要改动；若后续因他事触碰该文件可顺手抽常量），作为 M2/M3 清理候选记录。

## [build] 2026-09-16T13:29:15.896Z

assumptions.yaml 落地与语义反转修正（2026-09-15/16）：初稿 8 条把「被证据推翻的原始信念」标成 status: accepted（note 却记述该信念被推翻），语义反向。查明 artifact-validator.ts:31 的枚举仅 ['open','resolved','accepted','deferred']（无 falsified/invalidated），故唯一忠实改法为「将 assumption 改写为设计实际依赖、已被证据确立的结论」，note/decision_ref/条目数/顺序均不动。修正后 guard eval-corpus verify 只读复验 ✓ 通过（E-GUARD-008 闭合）。**新 backlog 候选（M2/M3）**：完备性工件「语义核验」——门禁只校验结构/枚举 + resolution 链完整性（decision_ref 命中 decisions.md），对「assumption 文本极性是否与 note 结论一致」结构性不可见（fail-closed 于结构、fail-open 于语义）；建议轻量启发式（assumption 含 无须/不必/不得/只需 等限量词且 note 含 被推翻/实测确认/收敛为 时告警）+ 归档期一道人工/LLM 复核兜底（自由文本无法纯规则闭合）——与「锁定前实跑核验」同源教训：机检负责可判定项，语义项交复核闸。

## [build] 2026-09-16T13:29:17.005Z

参考场景交付裁决（用户确认，2026-09-16）：随本变更交付**report-only 参考场景** .mumuspec/evals/eval-corpus.yaml（type: corpus, corpusDir: .eval-corpus, **不带 corpusExpect**）——理由：当前仓库无任何 evals 场景、--report 特性对用户不可见；不带阈值可避免「未构建 dist → 探针 errored → 空分母 fail-closed 假红」。前置说明：引擎需先构建 dist 才能被 npx 解析（dist 为 gitignore 构建产物）。
