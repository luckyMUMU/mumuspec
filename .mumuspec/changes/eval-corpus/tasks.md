# Implementation Tasks: eval-corpus

> 依据：design.md（三层单向依赖）+ test-cases/layer-{0,1,2}-cases.md（已锁定，hash 136aef5dd387a5ab）
> 实现顺序：L0 → L1 → L2（自深至浅）；每层 RED → lock-suite → GREEN → REFACTOR
> 测试不可变：test-cases 已锁定，Build 期间改测试 = W-GUARD-004

## Layer 0: runner 层（L0，先建）

- [x] T0-1 corpus.ts 纯函数模块（commit 0c09722；tests/eval/corpus.test.ts 18 tests）
  - 文件: `src/eval/corpus.ts`（新增）
  - 内容: COVERAGE_FIELDS/CoverageVector/FixtureSignals/collectCodes/findCoverage/diffSignals/wilsonInterval/makeRatio/FixtureExpectation/ProbeName/PROBE_ARGS/loadFixtureExpectation
  - 测试: `tests/eval/corpus.test.ts`（新增）—— L0-C01~C14（Wilson 边界 / makeRatio / collectCodes 递归 / findCoverage 双形态 / diffSignals 四态 / loadFixtureExpectation）
  - 验收: L0-C01~C14 全绿（RED 先行：先写测试确认失败）

- [x] T0-2 runner.ts 扩展（corpus 分支 + custom 修复 + loadScenario + runAllEvals）（commit 0c09722）
  - 文件: `src/eval/runner.ts`（修改）
  - 内容: EvalScenario 加 `corpus`/`corpusDir`/`corpusExpect`；CorpusFixtureResult/CorpusScenarioReport 新类型；EvalResult.corpus 可选字段；EvalReport.corpusReports 可选字段；switch 加 `case 'custom': break`（assertions-only 零 warning）与 `case 'corpus'`（8 步流程）；loadScenario 解析 corpusExpect 嵌套段；runAllEvals 收集 corpusReports
  - 测试: `tests/eval/runner.test.ts`（扩充）—— L0-C15~C32
  - 验收: L0-C15~C32 全绿；`tests/eval/runner-enhance.test.ts` 既有 custom 语义回归绿

- [x] T0-3 锁定 L0 测试套件（suite hash e2f327a879b3e069；state layer 0 done）
  - 命令: `mumuspec test-cases lock-suite eval-corpus --layer 0`
  - 验收: suites_hash[0] 写入；`state layer eval-corpus 0 done` 成功

## Layer 1: 评估器层（L1，后建）

- [x] T1-1 verifiable-ratio 评估器（commit b8596e4）
  - 文件: `src/core/metrics/verifiable-ratio.ts`（新增）
  - 内容: defaultWeight=0；spawn `npx mumuspec validate --json`（win32 shell）；取顶层 coverage.strong_ratio；nullResult 条件（spawn error / 无 JSON / coverage 缺失 / total<=0）；rawData 含四分类计数 + declared_ratio
  - 测试: `tests/core/metrics/verifiable-ratio.test.ts`（新增）—— L1-C01~C08（三态 + nullResult）
  - 验收: 全绿

- [x] T1-2 fail-open-count 评估器（commit b8596e4）
  - 文件: `src/core/metrics/fail-open-count.ts`（新增）
  - 内容: defaultWeight=0；FAIL_OPEN_CAP=10；读 `.mumuspec/audit.log`，跳过坏行，`result!=='success'` 计数 + byAction 分组 + entries 清单；value=1-min(1,total/10)；nullResult 仅限文件缺失/空
  - 测试: `tests/core/metrics/fail-open-count.test.ts`（新增）—— L1-C09~C16
  - 验收: 全绿

- [x] T1-3 注册两评估器 + 权重不变式（commit b8596e4）
  - 文件: `src/core/metrics/auto-evaluate.ts`（修改，registerBuiltInEvaluators 追加两行）
  - 测试: 注册三重断言（名字存在 / defaultWeight=0 / 活跃权重和 toBeCloseTo(1.0,10)）—— L1-C17~C18
  - 验收: 全绿；`mumuspec metrics` 输出含两新指标且 composite 收敛语义不变

- [x] T1-4 锁定 L1 测试套件（suite hash 61a6dfcacb4698d0；state layer 1 done）
  - 命令: `mumuspec test-cases lock-suite eval-corpus --layer 1`
  - 验收: suites_hash[1] 写入；`state layer eval-corpus 1 done` 成功

## Layer 2: 消费层（L2，最后建）

- [ ] T2-0 BP-12 六项修订实现（三态聚合/分母排除/三条 warning/空分母 fail-closed/精度聚合）（规格：design.md §2.1.1/§2.1.3 D-corpus-5~8/§2.3.1/§10）
- [ ] T2-1 eval --report（文本 + JSON 双形态 + precision 字段）
  - 文件: `src/cli/commands/eval.ts`（修改）
  - 内容: `--report` 与 `--json` 旗标；EvalSummaryReport{version:1, generatedAt, evals, corpus, metrics(两评估器进程内调用), coverageRef}；文本四段渲染（corpus recall/noise + CI + 置信不足标注 / A1 / B4 / coverage 引用）
  - 测试: `tests/cli/commands/eval-handler.test.ts`（扩充）—— L2-C01~C13（双形态 + version 冻结 + 四段）
  - 验收: 全绿；报告仅 stdout 不落盘（TEMP-4）

- [ ] T2-2 .eval-corpus/ 语料库
  - 文件: `.eval-corpus/`（新增目录）—— `_baseline` + `bad-*`（**可发射集 15 码**各 1 例：E-SPEC-001/002/003/004/006/008/009/010/011/013/014/015 + W-SPEC-016 + E-GUARD-010 + E-CHANGE-022；E-SPEC-005/007/012 为 registered-but-not-emitted，M1 出范围）+ `clean-01..03`
  - 内容: 每 fixture 含 `.mumuspec/`（config.yaml + prd.md）与 `expected.yaml`（kind/severity/probe/change/mustContain/mustNotContain）；bad-case 为 `_baseline` 的单点变异；跨域码 fixture 使用 guard/archive 探针
  - 测试: L2-C14~C15（语料覆盖与 severity 分档断言）
  - 验收: `mumuspec eval run`（含 corpus 场景声明）跑通；baseline 零码；veto 档 recall 记录
  - 注意: 场景 YAML 不声明 corpusExpect 阈值（M1 建档口径，用户裁决）

- [ ] T2-3 fixture-location 位置隔离断言
  - 文件: `tests/eval/fixture-location.test.ts`（新增）
  - 内容: 仓库根 validate --json 的 coverage.total 不含 .eval-corpus/ 语料条目；临时重命名 + finally 复原（对照探测 4 的 327→331 污染基线）
  - 验收: 全绿（L2-C16）

- [ ] T2-4 全量回归 + 三层门禁
  - 命令: `node node_modules/vitest/vitest.mjs run`（全量）→ `mumuspec check` → `mumuspec validate` → Ponytail 合规（check 通道）
  - 验收: 全量绿；check exit 0；validate 0 错；无 E-PONYTAIL-* 新增

- [ ] T2-5 锁定 L2 测试套件 + 层完成
  - 命令: `mumuspec test-cases lock-suite eval-corpus --layer 2` → `state layer eval-corpus 2 done`
  - 验收: 三层全 done；`mumuspec status` 就绪动作指向 verify

## 提交纪律

- 按层提交：L0 / L1 / L2 各至少一次提交；提交前 `state check` 与 `state layer` 一致性核验
- 环境：git 需 PATH 注入 `C:/Users/linxi/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd`（本会话 shell 无 git）
- 禁止修改 `test-cases/**`（已锁定）；禁止改 delta-specs（如需变更走 BP-12）
