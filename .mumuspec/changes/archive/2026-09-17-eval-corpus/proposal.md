# Proposal: eval-corpus

## Why

评测指标体系（review/evaluation-metrics-research-2026-09-13.md）经深度分析（evaluation-metrics-deep-analysis-2026-09-13.md）与 QA 探测实验（evaluation-metrics-probe-results-2026-09-13.md）验证后，第一批（M1）落地条件已成熟：数据源就绪、语料位置假设已实证、kill 判定口径已定稿。当前引擎缺少"校验器自身召回/噪声"的量化评测出口，B1/B2 两项核心评测项无法建档。

## What

M1 评测基座（零既有行为语义改动，纯增量）：

1. eval runner 新增 corpus 场景类型：corpusDir 下每个 fixture 子目录作为独立 projectRoot 运行校验器，聚合输出 recall/noise；kill 判定采用多信号 diff（新增码 ∪ coverage 五字段 delta，探测 1 实证口径）；样本输出 Wilson 95% CI，n<3 标注置信不足。
2. 修复 custom 场景类型死端：实现 assertions-only 语义（仅执行断言，无引擎动作）。
3. 新增 2 个 weight=0 评估器并注册：verifiable-ratio（A1，validate coverage 四分类占比）、fail-open-count（B4，audit.log result 非 success 条目分组）。
4. eval --report 汇总出口：文本 + JSON 双形态，聚合 corpus recall/noise、A1、B4 与覆盖率引用。
5. .eval-corpus/ 隐藏目录语料库：bad-case 变异语料（O1-O6 算子覆盖可发射集 15 码各至少 1 例：E-SPEC-001、E-SPEC-002、E-SPEC-003、E-SPEC-004、E-SPEC-006、E-SPEC-008、E-SPEC-009、E-SPEC-010、E-SPEC-011、E-SPEC-013、E-SPEC-014、E-SPEC-015、W-SPEC-016、E-GUARD-010、E-CHANGE-022；E-SPEC-005/007/012 为 registered-but-not-emitted，M1 出范围）+ clean 语料；位置隔离经 fixture-location 断言验证（探测 4 实锤：tests/fixtures/ 会污染 coverage 计量）。

## Impact Scope

- src/eval/runner.ts：EvalScenario 扩展（corpusDir 等字段）、runScenario 新增 corpus 分支与 custom 修复、runAllEvals 聚合维度
- src/cli/commands/eval.ts：--report 旗标与汇总渲染
- src/core/metrics/evaluator-registry.ts：注册 2 个新评估器
- src/core/metrics/verifiable-ratio.ts（新增）、src/core/metrics/fail-open-count.ts（新增）
- .eval-corpus/：语料 fixture 与 expected 声明（新增目录）
- tests/：runner corpus 单测、2 评估器单测、fixture-location 断言单测（新增）

## Non-goals

- 不修 checker 三盲区（B-1 Enforcement 数量映射 / B-2 SHALL 内容合理性 / fence 吞约束告警）——挂 M2 评审（用户裁决 2026-09-14）
- 不动 loop composite 权重与阈值、稳定窗口（新评估器一律 weight=0）
- 不做状态字段增量（archived_at / verify_attempts / attribution——M2）
- 不做锚点映射与生态脚本（M3）；不做 Stryker 接入（M4）
- 不改变 check / validate 命令既有 JSON schema

## Acceptance Scenarios

1. clean 语料跑 corpus 场景 → noise=0
2. bad-case 语料一票否决类码 recall=1.0（分档目标：一票否决码 1.0 / ERROR ≥0.9 / W 码 ≥0.8，Wilson CI 报告）〔recall 分母 = 可发射集（15 码）；veto 档含 E-GUARD-010 / E-CHANGE-022 / 严格模式 E-SPEC-015〕
3. eval --report 输出四指标可读汇总（文本与 JSON 双形态）
4. 仓库根 validate 的 coverage 计数不含语料（位置隔离实测，对照探测 4 的 327→331 污染基线）
5. 既有全量测试回归通过

## Workflow

full
