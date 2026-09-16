# 评测项目改进计划（深度分析版）

日期：2026-09-13
前置：review/evaluation-metrics-research-2026-09-13.md（14 项提案）
性质：实现计划（未改动任何引擎代码）

## 一、深度分析结论（代码级核实）

对 14 项提案逐项核实数据源后，**原提案需三处修正**，另发现两个既有缺陷：

### 1.1 数据源核实矩阵（14 项 → 三档）

| 档位 | 评测项 | 核实结果 |
|---|---|---|
| **数据已就绪，仅缺出口**（6 项） | A1 可验证率 | validate coverage 已输出 declared_ratio/strong_ratio（四分类量化完备） |
| | A2 首过率 | design-build-first-pass.ts 已实现（含北极星 0.8），但存在 1.3 纯度缺陷 |
| | A6 约束密度 | constraint-density.ts 已实现（DENSITY_CAP=150，weight=0） |
| | B6 测试覆盖率 | vitest v8 四维 95 阈值已配置 |
| | D2 skill 双面 hash | skill-drift.ts 已接入 check drift 通道 + CI 门禁（Check 4）——**提案重复，撤项** |
| | B4 fail-open 计数 | audit.log 已有结构化 `action/result/error` 字段，fail-open 点位以 `result:'failed'` 入账 |
| **数据部分就绪，需小字段增量**（5 项） | A3 返工比 / A4 溯源 | rollback_count/rebuild_count 已有；`rollback_history[]` 条目已含 `{from,to,reason,timestamp,counted,event}`——reason 是自由文本，A4 只需追加**结构化 attribution 枚举字段**，不必新建工件 |
| | C1 变更前置时间 | `created_at`/`updated_at` 已有，**无 archived_at**（archive.ts 只更新 updated_at）→ 需加 1 字段 |
| | C2 阶段回退率 | rollback_history + 状态机计数已覆盖，纯读侧 |
| | C3 verify 一次通过 | verify_result 四态已有（pending/pass/pass-with-deviations/fail），但**被覆盖写、无尝试次数记录**→ 需加 verify_attempts 计数 |
| **机制缺失，需新场景类型**（3 项） | B1 召回 / B2 噪声 | eval runner 支持 `projectRoot`（fixture 目录可行），但**无 corpus 聚合类型**：EvalReport 是扁平 total/passed/failed，算不出"召回率/噪声率"比值 |
| | B3 隐式约束 | checkCompliance 只校验 checker 自身，**agent 行为不可由此验证**——原提案口径错误，须重定义为 dogfood 探针或延后（见裁决 D5） |

另有 D1（文档漂移）、D3（错误码闭环）属脚本级：cmd-audit.mjs 在 `.workbuddy/`（仓外），D3 可用静态扫描 `MumuSpecError('E-…')` 字面量 vs `ERROR_CODES` 键实现，均为新增脚本，无引擎改动。

### 1.2 提案修正

- **撤 D2**：skill-drift 已是 check 通道既有能力，单独列评测项违反"不得为同一语义保留两条权威源"。
- **重定 B3**：隐式约束通过率不是 checker 评测，是 agent 行为评测，eval runner 的 compliance/drift/phase-guard/corpus 类型均无法承载。降级为 M4 裁决项。
- **A4 简化**：不新建溯源工件，扩展既有 rollback_history 条目（加 `attribution?: 'spec-ambiguous'|'spec-missing'|'spec-wrong'|'impl-defect'`），写入点在 state-machine rollback 路径，校验器在 evaluator 读侧校枚举合法性。

### 1.3 新发现的既有缺陷（纳入计划）

- **F1 first-pass 纯度缺陷**：design-build-first-pass 扫 `changes/archive/` 直接子目录，而 discard 保留至 `archive/discarded/`——被废弃变更（state.phase='discarded'）**计入分母**，系统性压低北极星值。修法：phase==='discarded' 跳过（语义修正，见裁决 D3）。
- **F2 eval custom 类型死端**：`runScenario` 的 `custom` 类型落入 default 分支仅发 warning（runner.ts L191），"存在产出物无消费者"的活例。随 corpus 类型一并处置（实现或删除，见裁决 D6）。
- **F3 语料存放位置风险**：bad-case 语料含**故意违规**的假 spec。`.mumuspec/` 下内容会被规范 walker/validate 扫描（根 temp/ 含 .mumuspec/ 教训同源）→ 语料**必须放 `.mumuspec/` 之外**。**〔探测 4 修订〕**tests/fixtures/ 同样被 findSpecDirs 递归扫描（仅排除隐藏目录与 node_modules），clean 语料也污染 coverage 计量（实测 327→331）→ 语料改放**隐藏目录（如 `.eval-corpus/`）或独立项目根用独立 cwd 运行**；备选增强：给 findSpecDirs 加排除配置。详见 review/evaluation-metrics-probe-results-2026-09-13.md。

## 二、改进计划（四批，每批一个 CHG）

### M1 — CHG eval-corpus（P0，零引擎语义改动，纯增量）

| # | 事项 | 实现位置 | 验收标准 |
|---|---|---|---|
| E1 | eval runner 新增 `corpus` 场景类型：`corpusDir` 下每个 fixture 子目录 = 独立 projectRoot，附 `expected.yaml`（mustContain/mustNotContain codes）| `src/eval/runner.ts` 新增分支 + `EvalScenario` 扩展字段 | 聚合输出 `recall`（坏样本全检出比例）与 `noise`（净样本误报比例）两比值；EvalReport 增加 per-scenario 维度；**kill 判定必须多信号 diff：新增码 ∪ coverage 五字段 delta（探测 1 实证：O2 强度降级与 O4 围栏走私仅落 coverage 计数，单看错误码会全部误判存活）** |
| E2 | bad-case 语料库：覆盖 E-SPEC-001~015、W-SPEC-016、E-GUARD-010、E-CHANGE-022 至少各 1 例（正式评测扩样 + Wilson CI 报告）；clean-corpus：真实 spec + 无违规微缩 fixture | **隐藏目录（如 `.eval-corpus/`）或独立项目根**（探测 4 实锤，tests/fixtures/ 位置作废，见 F3 修订） | B1 分档召回（一票否决码 1.0 / ERROR ≥0.9 / W 码 ≥0.8）与 B2 噪声=0 首次建档并跑通 |
| E3 | A1 可验证率评估器（weight=0）：spawn `validate --json` 取 coverage 四分类占比 | `src/core/metrics/verifiable-ratio.ts` + 注册 | value=strong_ratio；rawData 含四分类计数；单测覆盖 0/全/部分三态 |
| E4 | B4 fail-open 计数评估器（weight=0）：读 audit.log，统计 `result!=='success'` 条目按 action 分组；与 design.md 固化的 4 类静默点位清单比对差异 | `src/core/metrics/fail-open-count.ts` | 输出计数+清单；静默点位外的新增 failed action 触发 suggestion |
| E5 | `mumuspec eval --report`：汇总报告（文本+JSON，含 corpus recall/noise、A1、B4、B6 引用） | `src/cli/commands/eval.ts` | 报告消费面闭环（先消费者同批交付，避免死端） |
| E6 | F2 处置：custom 类型随 E1 重构一并实现（仅 assertions，无引擎动作）或删除 | runner.ts | 不再落入 default 分支 |

### M2 — CHG state-metrics（P1，小字段增量，先校验器后消费者）

| # | 事项 | 实现位置 | 验收标准 |
|---|---|---|---|
| S1 | 新增 `archived_at` 字段：archive 成功路径写入 | `src/change/archive.ts` + state schema | C1 评估器：lead time = archived_at − created_at，输出中位数/P90（weight=0） |
| S2 | 新增 `verify_attempts` 计数：verify_result 首次写入与每次 fail 重写时自增（`state set` 保护字段路径内） | state 写入路径 | C3 评估器：attempts==1 且 pass 的占比 ≥0.7（weight=0） |
| S3 | `rollback_history[].attribution` 枚举扩展 + 读侧校验（非法值告警 W-新码） | state-machine rollback 路径 | A4 溯源分布评估器：四类占比报告（advisory）；空值不计入分布、计入"未归因"桶 |
| S4 | A3 返工比评估器：rollback/rebuild>0 的变更中，被重写设计层数据聚合 | 读侧 | 输出 ratio + 明细；>0.3 suggestion |
| S5 | F1 修复：first-pass 分母排除 phase==='discarded' | design-build-first-pass.ts L61-70 | 新增单测：discarded 变更不计数；既有 104 测试回归通过 |

### M3 — CHG anchor-coverage + 生态脚本（P1）

| # | 事项 | 实现位置 | 验收标准 |
|---|---|---|---|
| C1 | A5 约束锚点-测试映射率：复用 delta-channels 的 `listCarriedConstraintItems` + `isRegexCheckable`，对每条 enforced 约束的词法锚点在 `tests/` 全文检索命中 | `src/core/metrics/anchor-test-coverage.ts`（weight=0） | 输出命中率 + 未命中约束清单；单一权威源复用，不重建解析 |
| C2 | D3 错误码闭环扫描：`MumuSpecError\('E-…'\)` 字面量 ↔ ERROR_CODES 双向比对 | `scripts/error-code-audit.mjs` | 未注册抛出点=0、未消费注册码清单输出 |
| C3 | D1 文档漂移指标化：cmd-audit.mjs 从 `.workbuddy/` 移植/包装进 `scripts/`，输出 JSON 计数 | `scripts/` + package.json scripts | 新增漂移=0 可被 CI 通道读取（独立通道，不并入 Check 4） |
| C4 | B5 性能 P95：corpus 类型扩展 timing 模式，对 check/validate/drift 在中规模 fixture 上计时 | eval runner | 基线数值建档（不定阈值，观测期） |

### M4 — 观测期收尾（P2，裁决后执行）

- O1 阈值定标：A1/A3/C1-C3 等观测 3 个窗口后，评审是否从 weight=0 升级为计权项（须单独评审，不动既有 composite 权重和）。
- O2 B3 处置：按 D5 裁决执行（推荐 dogfood 探针文档化，不入引擎）。
- O3 报告增强：评测汇总 HTML 化，复用 `metrics/html-reporter.ts`。

## 三、待裁决项（D1-D6）

| # | 问题 | 推荐默认 |
|---|---|---|
| D1 | A4 attribution 枚举粒度：4 类（spec-ambiguous/missing/wrong/impl-defect）还是补第 5 类 tool-other（工具/环境问题）？ | 5 类 + `not-triaged`（与 B2b 处置枚举对齐） |
| D2 | ~~bad-case 语料位置：`tests/fixtures/eval-corpus/`~~ **已被探测 4 推翻**——改隐藏目录/独立根，是否同步给 findSpecDirs 加排除配置（默认跳过 tests/、temp/） | 加排除配置（对用户生态同价值） |
| D3 | F1 first-pass 纯度修复是语义变更（北极星值会上升）——直接修还是挂 M2 批次说明后修？ | 挂 M2 修（S5），release note 标注 |
| D4 | D3 错误码闭环是否进 CI 硬门禁（类似 Check 4） | 先观测，不入硬门禁 |
| D5 | B3 隐式约束：dogfood 探针 / 延后 / eval 新增 agent 场景类型 | dogfood 探针 |
| D6 | eval custom 类型：实现（E6）还是删除 | 实现（assertions-only 足够小） |
| D7 | 探测 1 新增 checker backlog 三项（B-1 Enforcement 数量映射 / B-2 SHALL 内容合理性 / fence 吞约束 W 码）入哪个批次 | 随 M1/M2 评审顺带立项 |

## 四、红线兼容性核对

- 全部新评估器 weight=0 注册，composite 权重和不变（仍为 1.0），阈值/窗口不动。
- 指标全部由代码确定性计算；A4 attribution 为人工/签收填写项，评估器只做枚举合法性校验，不代填。
- S1/S2/S3 字段写入器与消费评估器同批交付（M2 内闭环），无死端。
- E2 语料、E5 报告均在同一 CHG 内闭环消费面。
- 约束密度维持观测信号；D2 撤项避免双权威源。

## 五、规模估计与排期

- M1：新场景类型 + 语料库 + 2 评估器 + 报告，约 6-8 文件、12-15 测试用例，单 CHG 可收。
- M2：3 个状态字段 + 4 评估器 + 1 语义修复，涉及 state schema，需迁移兼容（旧 state 无新字段时按缺省值处理，评估器 nullResult 不误报）。
- M3：锚点映射 + 3 个脚本级项，无状态改动。
- 排期建议：M1 → M2 串行（M2 依赖 M1 的报告出口），M3 可与 M2 并行，M4 观测 3 窗口后收尾。
