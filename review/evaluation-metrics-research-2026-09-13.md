# 评测项目调研与提案：为 MumuSpec 建立质量评价标准

日期：2026-09-13
性质：调研提案（未改动任何引擎代码）

## 一、调研结论摘要

- 引擎已具备完整的评测**基座**：6 个评估器（`src/core/metrics/evaluator-registry.ts`，R-0002）、场景式评测引擎（`src/eval/runner.ts`，R-0005 相邻）、三条门禁命令（check / validate / drift）、四分类完备性（verifier-classify）与 meta-evolution 评分。
- 缺口不在"能不能算"，而在**评测覆盖面**：现有评估器全部围绕"单次变更收敛"设计，缺少①规范质量本身的量化评价、②校验器自身的召回/噪声评测、③生命周期级交付效率评测、④生态一致性评测。
- 业界可对标口径已收敛：spec-driven 工程度量（首过接受率 / 返工比 / 缺陷溯源）、ISO 25010 产品质量模型、DORA 交付性能五指标、SpecBench 类"隐式约束"基准。其中约半数所需数据源在引擎中已存在，只缺汇总与评分出口。

## 二、现状盘点（已有评测基座）

| 机制 | 位置 | 现状 |
|---|---|---|
| 评估器注册表 | `src/core/metrics/` | 6 评估器：test-pass-rate(0.3) / drift-score(0.2) / spec-compliance(0.2) / design-build-first-pass(0.2) / code-delta(0.1) / constraint-density(0，仅观测) |
| loop evaluate | `src/change/loop-engine.ts` | composite 阈值 0.85、minAcceptable 0.5、稳定窗口 3 轮；hybrid 0.7/0.3 |
| 场景评测 | `src/eval/runner.ts` + `cli/commands/eval.ts` | YAML 场景 + expected 阈值 + JS assertions → EvalReport{total/passed/failed}，**是最贴近"评测项目"的现有载体** |
| 四分类完备性 | `verifier-classify.ts` | enforced-strong / weak / manual / unverifiable + coverage 比例（declared_ratio / strong_ratio），量化已具备 |
| 约束有效性 | `meta-evolution/scoring.ts` | `passRate × (1 − falsePositiveRate × 1.5)` 按窗口分组 |
| 测试基座 | vitest + v8 coverage | 约 110 测试文件，branches/functions/lines/statements 全 95 阈值 |
| 一致性审计 | `.workbuddy/cmd-audit.mjs` / `link-check.mjs` | 基线 58 顶层命令，文档-命令面漂移人工巡检 |

## 三、业界参考与取舍

1. **Spec-driven 工程度量**（TechLevity 2026）：首过接受率（70–80% 为健康区间，>90% 提示过度规范化）、返工比（>30% 提示规范传达失效）、缺陷溯源（spec 缺陷 vs 工具缺陷）、规范到交付全周期时间。→ 全部可由引擎既有状态数据推导，直接采纳。
2. **ISO 25010**：产品质量八特征。对 CLI 工具取维护性、可靠性、性能效率三个子集。→ 转译为引擎自身质量评测项。
3. **DORA 五指标**（dora.dev 2024+ 版：change lead time / deployment frequency / recovery time / change fail rate / rework rate）：适配到变更生命周期为"变更前置时间 / 阶段回退率 / verify 一次通过率"。
4. **SpecBench / SeClaw 启示**：评测应含"隐藏约束"类负样本（agent 不可见但须隐式通过的检查项），防 reward hacking；且 LLM-as-judge 漏检率约 26%，评测判定必须以确定性代码为准——与本项目"指标不得 LLM 手写"红线同源。

## 四、评测项目提案（4 类 14 项）

### A 类：规范质量评测（Spec Quality）

| # | 评测项 | 口径 | 数据源 | 判定 | 优先级 |
|---|---|---|---|---|---|
| A1 | 规范可验证率 | enforced-strong / (SHALL+SHALL NOT 总数)，分四分类输出占比 | verifier-classify + validate coverage | 量化，strong_ratio 目标 ≥0.8 | P0（已有数据，仅缺独立出口） |
| A2 | 首过通过率（北极星） | rollback=0 且 rebuild=0 的变更占比 | design-build-first-pass 评估器 | 已有，维持北极星 ≥0.8 | P0（已存在） |
| A3 | 返工比 | 存在 rollback/rebuild 的变更中，被重写设计/测试的层占比 | `.mumuspec.yaml` 状态历史 | 量化观测，>0.3 告警 | P1 |
| A4 | 缺陷溯源分布 | verify 失败归因四分：spec 歧义 / spec 缺失 / spec 错误 / 实现缺陷 | verify_result + decisions（须人工归因标注，LLM 不得代填） | 结构化工件 + 人工签收，advisory | P1（新增字段，先校验器后消费者） |
| A5 | 功能点覆盖率 | constraints 条目 ↔ test_cases 的映射率（每条 enforced 约束至少 1 个用例锚点） | constraints/ + suites hash 数据 | 量化，目标 ≥0.9 | P1 |
| A6 | 约束密度信号 | 已有，cap 150 | constraint-density 评估器 | 仅观测，不入复合 | P0（已存在，红线：不作质量分） |

### B 类：引擎自身质量评测（ISO 25010 子集）

| # | 评测项 | 口径 | 数据源 | 判定 | 优先级 |
|---|---|---|---|---|---|
| B1 | 校验器召回率 | 对已知违规样本语料的检出率（四分类：应拦未拦 = fail） | eval runner 新增 bad-case 语料集 | 门禁，目标 1.0 | P0 |
| B2 | 校验器噪声率 | 对干净语料的误报数/总数（W-SPEC-016 语料 0 噪音为基线） | eval runner clean-corpus | 门禁，目标 0 | P0 |
| B3 | 隐式约束通过率（SpecBench 式） | 场景不含显式提示时 SHALL NOT 仍被遵守的比例 | eval runner 隐藏断言场景 | 量化观测 | P2 |
| B4 | fail-open 计数 | 容错路径 fail-open 点位数量 | audit.log 容错动作归集 | 门禁，目标 0（当前 4 类已知静默点位须清零或显式化） | P1 |
| B5 | 命令性能 P95 | check/validate/drift/evaluate 四命令在大仓语料上的 P95 耗时 | eval runner 计时场景 | 量化观测，基线待测 | P2 |
| B6 | 测试覆盖率 | 已有 vitest v8，四维 95 阈值 | `npm run test:coverage` | 已存在，纳入 eval 场景统一报告 | P0（已存在） |

### C 类：生命周期交付评测（DORA 适配）

| # | 评测项 | 口径 | 数据源 | 判定 | 优先级 |
|---|---|---|---|---|---|
| C1 | 变更前置时间 | new → archive-confirm 的时长中位数（按变更粒度，不跨项目比较） | changes 状态时间戳 | 量化观测 | P1 |
| C2 | 阶段回退率 | 发生 transition 回退的变更数 / 总变更数 | `.mumuspec.yaml` 状态历史 | 量化观测，趋势告警 | P1 |
| C3 | verify 一次通过率 | verify_result 首轮即 pass 的占比 | verify_result 字段 | 量化，目标 ≥0.7（低于 A2 阈值，verify 天然更严） | P1 |

### D 类：生态一致性评测

| # | 评测项 | 口径 | 数据源 | 判定 | 优先级 |
|---|---|---|---|---|---|
| D1 | 文档-命令面漂移率 | 文档引用但引擎不存在 / 引擎存在但文档未覆盖的命令数 | cmd-audit.mjs / link-check.mjs | 量化，纳入 eval 场景，目标新增漂移=0 | P1 |
| D2 | Skill 双面到期率 | A 面 skills/ 与已装副本 hash 不一致数 | 既有到期校验机制 | 门禁，目标 0 | P1 |
| D3 | 错误码闭环率 | errors.ts 注册码 ↔ 实际抛出/消费点的双向覆盖率 | ERROR_CODES 静态扫描 | 量化，目标 1.0 | P2 |

## 五、与既有红线的兼容性

- **不动收敛语义**：全部新指标初期 weight=0（观测期），不进入 loop composite 权重与阈值；升级为计权项须单独评审（对齐"不得因新增命令改变既有 loop evaluate 通道收敛语义"）。
- **确定性推导归代码**：所有指标由评估器代码计算，无 LLM 手写指标值；A4 溯源人工归因签收后入库。
- **先校验器后消费者**：A3/A4/C1-C3 需要新增状态字段（rollback/rebuild 原因、归因、时间戳），字段写入器与消费评估器同批交付，避免死端。
- **单一权威源**：B1/B2/B6/D1-D3 复用既有命令与脚本输出，不另建平行数据通道。
- **约束密度立场不变**：A6 维持观测信号定位，不升级为质量分。

## 六、落地路径建议

1. **第一批（P0，数据已就绪）**：以 `src/eval/runner.ts` 场景机制为统一出口，新增 eval 场景集承载 B1（bad-case 语料）、B2（clean-corpus）、A1（四分类占比阈值）、B6；产出 `mumuspec eval --report` 汇总报告。此批零引擎语义改动，只补语料与场景。
2. **第二批（P1，需少量状态字段）**：A3/A4/C1-C3/D1-D3——设计 rollback 原因标注与溯源字段（走 CHG 流程，先校验器后消费者），评估器以 weight=0 注册。
3. **第三批（P2，观测期成熟后）**：B3/B5/D3 与观测期指标的阈值定标；对连续 3 个窗口稳定的指标再评审是否计入 composite。
