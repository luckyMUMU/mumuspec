# 评测方案深度分析与业界横向比较

日期：2026-09-13
前置：evaluation-metrics-research-2026-09-13.md（14 项提案）、evaluation-metrics-implementation-plan-2026-09-13.md（M1-M4 计划）
方法：五方业界框架对标（mutation testing / OpenAI evals 分层 grader / Google 静态分析纪律 / Clippy 实证研究 / SDD 生态）→ 批判性再分析 → 计划修订
角色分工：PM 定调研范围 → 架构师分析 → QA 验证假设（SoftwareCompany 工作流）

## 一、调研范围（PM 层）

本轮调研补齐上一版方案的三个方法论盲区：

| 盲区 | 为什么关键 | 对标框架 |
|---|---|---|
| B1/B2 召回/噪声的科学基础 | "每码 1 例手写语料"缺乏统计学与方法论依据 | Mutation testing（Stryker/PIT/mutmut 生态） |
| 评测判定的分层架构 | 确定性代码 vs LLM 判定的职责边界需要外部验证 | OpenAI evals trace grading 实践 |
| 噪声的口径定义 | "clean corpus 零误报"可能漏掉用户感知层面的噪声 | Google《Software Engineering at Google》静态分析章节 + Clippy ICSE 2024 实证 |

## 二、五方对标结果

### 2.1 Mutation Testing（与 B1/B2 完全同构）

B1 校验器召回率 = mutation score（killed/total mutants），bad-case 语料 = mutant 集。业界成熟结论：

- **统计口径**：100% mutation score 不可达也不值得追（equivalent mutants 固有存在）；核心模块 70-85% 即强信号。
- **生成方式**：不手写 mutant，用**变异算子**系统化生成（边界翻转 `>`→`>=`、逻辑连接词替换、常量翻转、删除 return 等），按算子类别统计存活分布。
- **AI 特有风险**：AI 生成测试存在"覆盖率幻觉"——100% 行覆盖可能只有 4% mutation score（Codex 知识库 2026 实测案例）；AI 代码引入 bug 率 1.7× 于人写代码（CodeRabbit 2025 分析）。
- **CI 模式**：全量运行过慢，业界用增量模式（只 mutate 变更文件）+ 周期性全量（夜间/发布前）双轨。
- **Goodhart 边界**：用 mutation score 作团队 KPI 会催生"为杀 mutant 而写的测试"——业界明确列为反模式。

### 2.2 OpenAI evals 分层 grader（架构同构验证）

- **核心实践**："deterministic graders 做硬门（CI gate），model graders 做软门（质量评估）"——与 MumuSpec"机械四分类一票否决 + LLM advisory"双轨**完全同构**。MumuSpec 的架构选型获得业界头部实践的外部验证。
- **Data flywheel**：每个生产 agent 错误必须转为永久回归用例（"Grow the dataset by converting every production agent mistake into a permanent regression case"）——语料库需要生长机制，不是一次性交付物。
- **LLM judge 漂移**：grader 模型升级后分数漂移，需 pin 版本 + 重标定基线——佐证 MumuSpec "LLM 判定 advisory 化 + 工件化 + 人签收"的既有红线。
- **成本分层**：rule-based 全量（免费可复现）+ LLM judge 10% 抽样审计——可用于 A4 溯源的人工签收成本优化设计。

### 2.3 Google 静态分析纪律（B2 口径升级依据）

- **"有效误报"（effective false positive）**：技术上正确但开发者未采取行动的告警，用户反应等同于误报。**只部署低 FP 率的工具**；actionable findings 比率 <70% 时开发者弃用工具。
- Clippy ICSE 2024 实证：全 crates.io 生态平均 21 warnings/KLOC；用户两大关切 = 误报 + 自动修复能力。
- 对 MumuSpec 的映射：58 命令认知负担背景下，W- 告警的实际处置率直接决定 checker 体系的用户信任度——**技术噪声率（clean corpus 误报）≠ 有效噪声率（告警被处置比例）**，需分层度量。

### 2.4 基准规模与统计功效

- Spec-Agent benchmark 581 任务、VistaBench 多条件矩阵、SpecBench 周期性刷新隐藏测试集（防 pattern-match）。
- 关键数字：**每错误码 1 例语料，检出率 1.0 的 95% 置信区间下限仅 ~0.05**（二项分布 n=1）——当前方案"覆盖 E-SPEC-001~015 各 1 例、目标召回 1.0"在统计上不成立，点估计无意义。

### 2.5 SDD 生态评测面（空白确认）

复用 2026-09-13 生态对比报告：Spec Kit（converge 是修复动作非度量）、OpenSpec（findings 报告是结构 diff 非质量分）、BMAD/Kiro（均无量化评测）。**头部 SDD 工具全部没有量化评测体系**。MumuSpec 落地评测面后将成为品类唯一"measured enforcement"工具——护城河从 enforcement 扩展到可度量的 enforcement，这是战略级差异化资产。

## 三、批判性再分析（架构师层）

### 论点 1：B1/B2 应从"手写语料"升级为"变异算子生成"（M1 修订）

手写固定语料有三重结构性缺陷：统计功效不足（2.4）、Goodhart 过拟合（checker 对固定语料特化，SpecBench 教训）、维护成本随 111 错误码线性增长。修法：对干净基线 spec 实施**规范文本变异算子**——

| 算子 | 注入变换 | 应命中的码 |
|---|---|---|
| O1 通道剥夺 | 删除块级 Enforcement 声明 | E-GUARD-010 |
| O2 强度降级 | SHALL → SHOULD / 删 SHALL NOT | 四分类 R3 化、E-SPEC-015 |
| O3 语义模糊 | 注入无界限定词（合理/必要时…） | W-SPEC-016 |
| O4 围栏走私 | 把约束移入 fenced code block | stripFencedBlocks 回归 |
| O5 结构破坏 | 占位符文本 / 越权约束 / 路径上溯 | E-SPEC-00x / E-CONSTRAINT-001 |
| O6 hash 篡改 | 修改锁定字段内容 | E-CHANGE-007/022 |

每算子可参数化生成 N 个变体（换文件、换约束条目、换限定词），语料规模按需扩展，统计功效随算子变体数增长。手写种子语料保留（覆盖算子无法表达的语义场景），双轨并行。

### 论点 2：B1 目标值必须分档，"召回 1.0"过理想化（M1 修订）

- 一票否决类 ERROR 码（E-SPEC-015 / E-GUARD-010 / E-CHANGE-022 / E-CHANGE-007）：目标 1.0 硬门禁（漏检任何一例 = checker 存在放行缺陷，属 fail-open 性质）。
- 其余 ERROR 码：≥0.9 观测（配 Wilson 置信区间报告）。
- W 类码（W-SPEC-016 等）：≥0.8 观测——W 码漏检的代价是不当告警缺失而非放行缺陷。
- EvalReport 必须输出 **Wilson 置信区间**而非裸点估计；n<3 的码标注"置信不足"。

### 论点 3：B2 拆双层，引入"有效噪声率"（新增 B2b，M2）

- B2a 机械噪声率（保留）：clean corpus + 变异算子的"存活负例"（即注入合法变更不应报错）误报数，目标 0。
- **B2b 有效噪声率（新增）**：W- 告警在后续变更中被处置（修复/显式豁免/决策记录）的比例，由 audit.log + decisions 推导，观测项。Google 纪律：actionable 比率 <70% 即用户信任崩塌线。W-SPEC-016 语料零命中是警示案例——技术上零噪声，但零命中同时意味着规则可能无实际价值，须由 B2b 数据裁决"收紧为 ERROR"还是"保留"。

### 论点 4：B6 覆盖率存在"覆盖率幻觉"盲区（新增 B7 观测项）

v8 coverage 95 阈值度量的是执行覆盖，不是验证强度。AI 生成测试的逻辑镜像问题（agent 写实现又写测试、共享同一套假设）在 MumuSpec dogfood 场景真实存在。test-cases lock-suite + design_content_hash 绑定是部分对冲，但无法排除"测试断言弱"的情形。**新增 B7：mutation score 观测指标**——Stryker（TS 原生支持、增量模式、v9.6 有 TS checker 集成）对 `src/guard/` + `src/spec/` 高价值模块建档，先观测不设阈值。若 95% 覆盖之下 mutation score <70%，则证明覆盖率指标失效，B6 须降权或 B7 升格。

### 论点 5：评测架构获外部验证，但缺"data flywheel"生长机制（M1 修订）

MumuSpec 双轨制与 OpenAI 分层 grader 同构（确定性硬门 + LLM 软门），架构选型无需改动。缺口在语料库的生长机制：每个真实漏检/误报事件应转为语料条目（生产事故→永久回归用例）。落地点：B4 fail-open 评估器与 audit.log 已有结构化数据——**漏检/误报事件的语料化流程**作为 M1 的 E7 项（轻量：audit 事件 → 语料目录的 conversion 脚本 + 流程文档），配合 SpecBench 式"周期性刷新"防过拟合。

### 论点 6：战略结论——评测面本身是品类差异化资产

头部 SDD 工具全部没有量化评测体系。评测面落地后 MumuSpec 成为品类唯一"measured enforcement"工具。建议（P2）：在 README 定位段与生态对比材料中显性化"评测面"维度；`eval --report` 的输出设计面向可截图、可对外引用的形态（这对 14 项指标的命名与报告结构有约束：指标名需自解释）。

### 论点 7：对 M2-M4 的影响评估

- M2 不受本轮分析冲击（字段增量与 B2b 互补，attribution 枚举建议补第六值 `'not-triaged'` 与 B2b 口径对齐）。
- M3 的 C4（性能 P95）维持；A5 锚点覆盖率维持。
- M4 新增 B7 定标与 B2b 阈值评审；B3（隐式约束 dogfood）维持裁决 D5。
- 排期不变：M1（修订版）→ M2 → M3 并行 → M4。

## 四、计划修订汇总（对 implementation-plan 的 delta）

| 编号 | 修订 | 批次 |
|---|---|---|
| R1 | E2 语料改为"变异算子生成（O1-O6）+ 手写种子"双轨；算子实现为 fixture 生成脚本（确定性、可重复） | M1 |
| R2 | B1 目标分档：一票否决码 1.0 硬门 / 其余 ERROR ≥0.9 / W 码 ≥0.8；EvalReport 输出 Wilson CI，n<3 标注置信不足 | M1 |
| R3 | 新增 E7 data flywheel：audit 漏检/误报事件 → 语料条目的 conversion 流程（脚本 + 文档） | M1 |
| R4 | 新增 B2b 有效噪声率（audit + decisions 推导，观测项）；W-SPEC-016 去留由 B2b 数据裁决 | M2 |
| R5 | attribution 枚举补 `'not-triaged'` 值（原 D1 裁决从 5 类改 6 类） | M2 |
| R6 | 新增 B7 mutation score 观测（Stryker 接入 src/guard + src/spec，先建档不定阈值） | M4 |
| R7 | `eval --report` 指标命名自解释化、报告面向可对外引用形态 | M1 |

## 五、QA 验证假设清单（可立即执行的探测）

1. **变异算子杀伤分布**：对现库 327 约束基线跑 O1-O6 各 10 变体，统计存活分布——存活集中的算子即 checker 当前盲区清单（预期 O3/O4 存活率最低，因近期刚交付 W-SPEC-016 与 fence-guard）。
2. **B7 基线探测**：对 src/guard/ 跑一次 Stryker 增量 mutation，取 mutation score 基线——验证 95% 覆盖之下验证强度假设。
3. **B2b 历史回溯**：从既有 audit.log + decisions.md 回溯 W- 告警处置率——验证有效噪声率可推导性。
4. **语料位置再确认**：fixture 生成脚本产出目录在 tests/fixtures/ 下执行 validate 探针，确认零假阳性（F3 风险闭环）。

## 六、风险与边界

- **不变红线**：全部新指标 weight=0 观测期；LLM 不手写指标值；mutation score 不得作为 KPI（Goodhart 反模式，与"约束密度不作质量分"同源纪律）；composite 权重与阈值不动。
- **新增风险**：变异算子生成脚本自身成为需维护的代码面——限定 O1-O6 六算子起步，YAGNI 扩展；Stryker 引入为 devDependency，不进运行时。
- **统计边界**：Wilson CI 报告意味着小样本诚实性——初期多数码会显示"置信不足"，这是特性不是缺陷（防止虚高结论）。

## 附：信息来源

Stryker/PIT/mutmut 生态实践（stackpractices、raganmcgill、resumelens、helpmetest）；Codex 知识库 mutation testing 与 AI 测试质量分析（2026-04）；OpenAI 官方 evaluation best practices + evals 架构指南（theneuralbase、qaskills、openlayer）；《Software Engineering at Google》静态分析章节（abseil）；Clippy ICSE 2024 实证研究（arXiv 2310.11738）；Clang analyzer FP 处理文档；既有 SDD 生态对比报告（review/2026-09-13-sdd-ecosystem-comparison.md）。
