# Test Cases — Layer 0（runner 层）

> 变更：eval-corpus ｜ 层：L0 runner ｜ 依据：design.md §2.1 / §3 / §4（L0）/ §5，DS-EVAL-001、DS-EVAL-002
> 被测源码：`src/eval/corpus.ts`（纯函数，新增）、`src/eval/runner.ts`（corpus 分支 + custom 修复 + loadScenario 扩展 + runAllEvals 收集）
> 测试代码落点（Build 阶段）：`tests/eval/runner.test.ts`（扩充）、`tests/eval/runner-enhance.test.ts`（回归）、新增 `tests/eval/corpus.test.ts`（纯函数）
> 说明：非测试代码；本文件为**用例定义**，供 BP-8 锁定。每个用例给 ID / 名称 / 验证目标 / 前置 / 步骤 / 期望 / 优先级 / 隔离方式。

## 覆盖矩阵

| 依据 | 覆盖用例 |
|---|---|
| DS-EVAL-001（corpus 场景 + 多信号 kill + Wilson） | L0-C01~C13、L0-C15~C30 |
| DS-EVAL-002（custom 死端消除） | L0-C31、L0-C32 |
| C-5 多信号 diff 并集 | L0-C08、L0-C09、L0-C10、L0-C11、L0-C17、L0-C18 |
| C-6 corpusReports 新维度不改既有语义 | L0-C29、L0-C30 |
| R-1 / Q4-001（无 cwd 依赖） | L0-C26 |
| R-2 / Q4-002（Wilson 除零 / 空目录） | L0-C01、L0-C04、L0-C19 |
| R-4（baseline 强校验 fail-fast） | L0-C21、L0-C22 |
| R-6（spawn 成本，mock 不真跑） | 全部集成用例（L0-C15~C30）标注 mock |
| R-7 / D-corpus-1（跨域码、coverage-diff 降级） | L0-C10、L0-C17、L0-C24 |
| D-corpus-2（noise 只计码） | L0-C25 |
| D-corpus-3（探针白名单） | L0-C14 |

## 用例清单（摘要）

| ID | 名称 | 优先级 | 隔离方式 |
|---|---|---|---|
| L0-C01 | wilsonInterval n≤0 返回 null | P0 | 纯函数 |
| L0-C02 | wilsonInterval n=2 → insufficient | P0 | 纯函数 |
| L0-C03 | wilsonInterval n≥3 CI 符合公式 + 上界钳制 | P0 | 纯函数 |
| L0-C04 | makeRatio n=0 → value/ci 双 null | P0 | 纯函数 |
| L0-C05 | makeRatio n>0 值与 CI | P1 | 纯函数 |
| L0-C06 | collectCodes 递归收集 + 去重 | P0 | 纯函数 |
| L0-C07 | findCoverage 定位五字段（validate/check 双形态） | P0 | 纯函数 |
| L0-C08 | diffSignals — code-only 检出 | P0 | 纯函数 |
| L0-C09 | diffSignals — coverage-only 检出 | P0 | 纯函数 |
| L0-C10 | diffSignals — 单侧 coverage=null → 降级纯码 | P0 | 纯函数 |
| L0-C11 | diffSignals — 无变化 → killed=false | P0 | 纯函数 |
| L0-C12 | loadFixtureExpectation 全字段解析 | P0 | tmp 文件 |
| L0-C13 | loadFixtureExpectation kind 目录名推断 | P0 | tmp 文件 |
| L0-C14 | PROBE_ARGS 白名单模板（无注入面） | P1 | 纯函数 |
| L0-C15 | corpus 检出态 → killed=true 计入 recall | P0 | tmp + mock spawn |
| L0-C16 | corpus 漏检态 → killed=false | P0 | tmp + mock spawn |
| L0-C17 | 多信号并集：coverage-only fixture → killed=true | P0 | tmp + mock spawn |
| L0-C18 | 多信号并集：code-only fixture → killed=true | P0 | tmp + mock spawn |
| L0-C19 | 空 corpusDir → warning + ratio.value=null + 不抛 | P0 | tmp |
| L0-C20 | corpusDir 不存在 → resultErrors | P0 | tmp |
| L0-C21 | 缺 _baseline → resultErrors（不静默） | P0 | tmp |
| L0-C22 | _baseline 不干净 → fail-fast 报错 | P0 | tmp + mock spawn |
| L0-C23 | fixture 缺 expected.yaml → 不视为 fixture | P0 | tmp |
| L0-C24 | 跨域码经 stderr 通道捕获（E-CHANGE-022） | P0 | tmp + mock spawn |
| L0-C25 | noise 只计码：clean 结构性 coverage 差异 → falsePositive=false | P0 | tmp + mock spawn |
| L0-C26 | 无 cwd 依赖：runProbe cwd 为绝对 fixture 路径 | P0 | tmp + mock spawn |
| L0-C27 | corpusExpect 断言违反 → resultErrors | P1 | tmp + mock spawn |
| L0-C28 | loadScenario 解析 corpusDir + corpusExpect | P0 | tmp 文件 |
| L0-C29 | runAllEvals 收集 corpusReports | P0 | tmp + mock spawn |
| L0-C30 | EvalResult.corpus 与 corpusReports 引用一致 | P1 | tmp + mock spawn |
| L0-C31 | custom 断言通过/失败两态 + 零 warning | P0 | 纯 runner |
| L0-C32 | default 分支仅对真正未知类型告警 | P0 | 纯 runner |

---

## A. corpus.ts 纯函数（无 IO、无 spawn）

### L0-C01 · wilsonInterval n≤0 返回 null
- **验证目标**：design §2.1.0 公式 / §4 L0 Wilson；DS-EVAL-001；**R-2 / Q4-002**（除零兜底）
- **前置**：无。直接 import `wilsonInterval`
- **步骤**：调用 `wilsonInterval(0, 0)`、`wilsonInterval(1, 0)`、`wilsonInterval(0, -1)`、`wilsonInterval(0, Number.NaN)`
- **期望**：四者均返回 `null`；不抛异常
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C02 · wilsonInterval n=2 → insufficient=true
- **验证目标**：design §2.3.2「n<3 置信不足」/ §4 L0 Wilson；DS-EVAL-001
- **前置**：无
- **步骤**：`wilsonInterval(2, 2)`、`wilsonInterval(1, 2)`
- **期望**：返回对象 `{confidence:0.95, insufficient:true, n:2}`；`lower>=0 && upper<=1`；`lower<=upper`
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C03 · wilsonInterval n≥3 CI 符合公式 + 上界钳制
- **验证目标**：design §2.1.0 Wilson 公式；DS-EVAL-001（Wilson 95%）
- **前置**：无
- **步骤**：`wilsonInterval(6, 10)`、`wilsonInterval(3, 3)`
- **期望**：
  - `(6,10)`：`insufficient:false`，`n:10`，`confidence:0.95`，`lower≈0.3127`、`upper≈0.8318`（容差 ±0.001，按公式独立计算校验）
  - `(3,3)`：`upper===1`（被 `Math.min(1,·)` 钳制），`lower≈0.4385`
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C04 · makeRatio n=0 → value/ci 双 null
- **验证目标**：design §2.1.0 `RatioReport` / §4 L0；**R-2 / Q4-002**（不做 0/0）
- **前置**：无
- **步骤**：`makeRatio(0, 0)`
- **期望**：`{value:null, n:0, ci:null}`；不抛异常
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C05 · makeRatio n>0 值与 CI
- **验证目标**：design §2.1.0；DS-EVAL-001
- **前置**：无
- **步骤**：`makeRatio(2, 3)`、`makeRatio(2, 2)`
- **期望**：`(2,3)` → `value≈0.6667`、`ci.n===3`、`ci.insufficient===false`；`(2,2)` → `value===1`、`ci.insufficient===true`
- **优先级**：P1 ｜ **隔离**：纯函数直测

### L0-C06 · collectCodes 递归收集 + 去重
- **验证目标**：design §2.1.0 `collectCodes` / §2.1.2 通用提取；DS-EVAL-001
- **前置**：无
- **步骤**：对深度嵌套对象（含数组、多层 `{code}`、重复码、无 `code` 的 coverage 对象、`null` 项）调用 `collectCodes`
- **期望**：返回 `Set<string>`，含全部出现过的唯一 `code`（跨域、跨层级）；重复码只出现一次；无 `code` 字段的对象被忽略；不因 `null`/原始值类型抛异常
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C07 · findCoverage 定位五字段（validate/check 双形态）
- **验证目标**：design §2.1.0 `findCoverage` / §2.1.2 step3；DS-EVAL-001；**R-5**（两种 coverage 均可提取）
- **前置**：无
- **步骤**：分别传
  1. `{coverage:{total:5,enforced_strong:1,enforced_weak:1,manual:2,unverifiable:1}}`（validate 顶层）
  2. `{compliance:{coverage:{total:5,enforced_strong:1,enforced_weak:1,manual:2,unverifiable:1}}}`（check 嵌套）
  3. `{passed:true}`（guard 无 coverage）
  4. `{coverage:{total:5}}`（缺四分类）
- **期望**：1、2 均返回含 `total/enforced_strong/enforced_weak/manual/unverifiable` 的 `CoverageVector`；3 → `null`；4 → `null`（要求 total 与四分类齐备）
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C08 · diffSignals — code-only 检出
- **验证目标**：design §2.1.0 `diffSignals` / **C-5**；DS-EVAL-001
- **前置**：无
- **步骤**：`diffSignals({codes:[],coverage:null}, {codes:['E-SPEC-004'],coverage:null})`
- **期望**：`{newCodes:['E-SPEC-004'], changedCoverageFields:[], killed:true}`
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C09 · diffSignals — coverage-only 检出
- **验证目标**：design §2.1.0 / **C-5** / D-corpus-1；DS-EVAL-001；复现探测 1 的 O2/O4（纯 coverage 变化、零诊断码）
- **前置**：无
- **步骤**：baseline coverage `{total:20,enforced_strong:10,enforced_weak:4,manual:4,unverifiable:2}`；fixture 仅 `total:19` 变（其余同）
- **期望**：`{newCodes:[], changedCoverageFields:['total'], killed:true}`（证明 diff 是码 ∪ coverage 的**并集**）
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C10 · diffSignals — 单侧 coverage=null → 降级纯码
- **验证目标**：design **D-corpus-1** / §2.1.3 决策；**R-7**（guard/archive 无 coverage）
- **前置**：无
- **步骤**：
  1. `diffSignals({codes:[],coverage:null}, {codes:[],coverage:{total:5,...}})`
  2. `diffSignals({codes:['E-GUARD-010'],coverage:null}, {codes:['E-GUARD-010','E-GUARD-011'],coverage:null})`
- **期望**：1 → `changedCoverageFields:[]`、`killed:false`（coverage 不可比时不产生差分信号）；2 → `newCodes:['E-GUARD-011']`、`killed:true`（退化为纯码检测仍可检出）
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C11 · diffSignals — 无变化 → killed=false
- **验证目标**：design §2.1.0；DS-EVAL-001（漏检态语义）
- **前置**：无
- **步骤**：baseline 与 fixture signals 完全相同（码集合与 coverage 五字段全同）
- **期望**：`{newCodes:[], changedCoverageFields:[], killed:false}`
- **优先级**：P0 ｜ **隔离**：纯函数直测

### L0-C12 · loadFixtureExpectation 全字段解析
- **验证目标**：design §2.1.0 `loadFixtureExpectation` / §2.3.2 `expected.yaml` schema；DS-EVAL-001
- **前置**：tmp 目录写 `expected.yaml`：`kind: bad-case` / `severity: error` / `probe: guard` / `change: c1` / `mustContain: [E-GUARD-010]` / `mustNotContain: [W-SPEC-016]`
- **步骤**：调 `loadFixtureExpectation(file)`
- **期望**：`{kind:'bad-case', severity:'error', probe:'guard', change:'c1', mustContain:['E-GUARD-010'], mustNotContain:['W-SPEC-016']}`
- **优先级**：P0 ｜ **隔离**：tmp 文件

### L0-C13 · loadFixtureExpectation kind 目录名推断与缺省
- **验证目标**：design §2.1.0（缺省 `probe='validate'`、数组为空、kind 目录名约定）/ §2.3.2
- **前置**：三处目录 `_baseline/`、`clean-01/`、`bad-spec-004/`，各自 `expected.yaml` 不含 `kind`/`probe`/数组字段
- **步骤**：分别调 `loadFixtureExpectation`
- **期望**：kind 依次推断为 `baseline` / `clean` / `bad-case`；`probe` 缺省 `'validate'`；`mustContain`/`mustNotContain` 缺省 `[]`
- **优先级**：P0 ｜ **隔离**：tmp 文件

### L0-C14 · PROBE_ARGS 白名单模板（无注入面）
- **验证目标**：design §2.1.0 `PROBE_ARGS` / **D-corpus-3** / §6② 安全约束；R-7
- **前置**：无
- **步骤**：读取 `PROBE_ARGS.validate()`、`.check()`、`.guard('c1')`、`.archive('c1')`
- **期望**：严格等于 `['validate','--json']`、`['check','--json']`、`['guard','c1','verify','--json']`、`['archive','c1','--confirm']`；返回数组为固定模板（无字符串拼接进 shell 的任意命令面）
- **优先级**：P1 ｜ **隔离**：纯函数直测

---

## B. runner corpus 编排（tmp 目录 + mock `node:child_process`）

> 本节全部用例 mock `spawnSync` 返回预置 stdout/stderr（**不真跑子进程**，规避 R-6 开销与 flake）；corpusDir 用 tmp 目录构造，显式传 `projectRoot`。

### L0-C15 · corpus 检出态 → killed=true 计入 recall
- **验证目标**：design §2.1.3 step3-6 / §4 L0「检出态」；DS-EVAL-001
- **前置**：tmp `corpusDir` 含 `_baseline/expected.yaml`（kind:baseline）+ `bad-spec-004/expected.yaml`（kind:bad-case, mustContain:[E-SPEC-004]）；mock：baseline 探针输出干净（无码、无 coverage），bad 探针输出含 `{code:'E-SPEC-004'}` 的 JSON
- **步骤**：`runScenario({name,type:'corpus',projectRoot,corpusDir})`
- **期望**：`result.corpus.fixtures` 中 `bad-spec-004` 的 `killed===true`、`newCodes` 含 `E-SPEC-004`、`mustContainSatisfied===true`；`result.corpus.recall.value===1`、`recall.n===1`
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C16 · corpus 漏检态 → killed=false
- **验证目标**：design §4 L0「漏检态」；DS-EVAL-001；复现探测 1 的 O1 单条删除 / O5 `- XXX` 占位零信号
- **前置**：tmp `corpusDir` 含 `_baseline` + `bad-spec-004`；mock：baseline 与 bad 探针输出**完全相同**（码集合与 coverage 五字段均无变化）
- **步骤**：`runScenario(...)`
- **期望**：`bad-spec-004.killed===false`、`newCodes:[]`、`changedCoverageFields:[]`；`recall.value===0`、`recall.n===1`
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C17 · 多信号并集：coverage-only fixture → killed=true
- **验证目标**：design §4 L0「多信号」/ **C-5**；D-corpus-1；复现 O2/O4
- **前置**：tmp corpusDir 含 `_baseline` + `bad-spec-002`；mock：bad 探针**零码**、仅 coverage 五字段中 `total`/`enforced_weak` 与 baseline 不同
- **步骤**：`runScenario(...)`
- **期望**：`bad-spec-002.killed===true`、`newCodes:[]`、`changedCoverageFields` 非空
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C18 · 多信号并集：code-only fixture → killed=true
- **验证目标**：同 L0-C17（并集另一支）
- **前置**：tmp corpusDir 含 `_baseline` + `bad-spec-016`；mock：bad 探针仅含 `{code:'W-SPEC-016'}`，**无 coverage**（两侧 coverage=null）
- **步骤**：`runScenario(...)`
- **期望**：`bad-spec-016.killed===true`、`newCodes` 含 `W-SPEC-016`、`changedCoverageFields:[]`
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C19 · 空 corpusDir → warning + ratio.value=null + 不抛
- **验证目标**：design §2.1.3 step2 / §4 L0 / **R-2 / Q4-002**
- **前置**：tmp `corpusDir` 存在但无任何含 `expected.yaml` 的子目录（或仅空目录）
- **步骤**：`expect(() => runScenario(...)).not.toThrow()`
- **期望**：`result.warnings` 含 `'corpus dir empty'`；`result.corpus.total===0`；`recall.value===null`、`recall.n===0`、`noise.value===null`；不抛异常
- **优先级**：P0 ｜ **隔离**：tmp

### L0-C20 · corpusDir 不存在 → resultErrors
- **验证目标**：design §2.1.3 step1
- **前置**：`projectRoot` 下无 `corpusDir` 指向路径
- **步骤**：`runScenario(...)`
- **期望**：`result.passed===false`；`result.errors` 含 `'corpus dir not found'`；`result.corpus` 为空（不产出误导性报告）
- **优先级**：P0 ｜ **隔离**：tmp

### L0-C21 · 缺 _baseline → resultErrors（不静默）
- **验证目标**：design §2.1.3 step2 / **R-4**（fail-fast，禁止静默）
- **前置**：tmp corpusDir 含 `bad-spec-004` + `clean-01`，**无** `_baseline`
- **步骤**：`runScenario(...)`
- **期望**：`result.passed===false`；`result.errors` 含 `'corpus requires _baseline'`；不产出 recall/noise（不静默降级）
- **优先级**：P0 ｜ **隔离**：tmp

### L0-C22 · _baseline 不干净 → fail-fast 报错
- **验证目标**：design §2.1.3 step3 / **R-4**
- **前置**：tmp corpusDir 含 `_baseline`（mock：baseline 探针输出含 `{code:'E-SPEC-004'}`）+ 若干 fixture
- **步骤**：`runScenario(...)`
- **期望**：`result.passed===false`；`result.errors` 含 `'baseline must be clean but produced codes'`；**不基于被污染的 baseline 继续 coverage-diff**（禁止静默失真）
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C23 · fixture 缺 expected.yaml → 不视为 fixture
- **验证目标**：design §2.1.3 step2 / §2.3.2「每 fixture 目录必须含 expected.yaml」；DS-EVAL-001
- **前置**：tmp corpusDir 含 `_baseline`、`bad-spec-004`（有 expected.yaml）、`stray-dir`（无 expected.yaml）
- **步骤**：`runScenario(...)`
- **期望**：`corpus.fixtures` 不含 `stray-dir`；`corpus.total` 只统计含 `expected.yaml` 的非基线 fixture
- **优先级**：P0 ｜ **隔离**：tmp

### L0-C24 · 跨域码经 stderr 通道捕获（E-CHANGE-022）
- **验证目标**：design §2.1.2 step2（`regexCodes(stdout+stderr)` 覆盖 JSON 外通道）/ **R-7** / D-corpus-1；DS-EVAL-004（E-CHANGE-022 覆盖）
- **前置**：tmp corpusDir 含 `_baseline`（probe:archive，输出无码）+ `bad-change-022/expected.yaml`（probe:archive, change:cX, mustContain:[E-CHANGE-022]）；mock：`bad-change-022` 探针 stdout 无 JSON，**stderr 文本**含 `E-CHANGE-022`（复现 archive 抛错经 stderr 打印）
- **步骤**：`runScenario(...)`
- **期望**：`bad-change-022.newCodes` 含 `E-CHANGE-022`、`killed===true`；coverage 两侧为 null → `changedCoverageFields:[]`（纯码检出）
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C25 · noise 只计码：clean 结构性 coverage 差异 → falsePositive=false
- **验证目标**：design §2.1.3 step5 / **D-corpus-2**（noise 只计码）；DS-EVAL-001
- **前置**：tmp corpusDir 含 `_baseline` + `clean-01`（kind:clean）；mock：`clean-01` 探针**零码**，但 coverage.total 与 baseline 不同（结构性差异）
- **步骤**：`runScenario(...)`
- **期望**：`clean-01.falsePositive===false`；`corpus.noise.value===0`；`noise.n===1`（结构性 coverage 差异**不**计入噪声）
- **附**：另构造 `clean-02` 探针**产生一个码** → `falsePositive===true`，`noise.value===1`
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C26 · 无 cwd 依赖：runProbe cwd 为绝对 fixture 路径
- **验证目标**：design §2.1.3 step3 / §6② / §4 L0；**R-1 / Q4-001 / D-corpus-4**
- **前置**：tmp 项目，`process.cwd()` 与 fixture 路径**不同**；显式传 `projectRoot`；mock `spawnSync` 记录调用参数
- **步骤**：`runScenario({type:'corpus',projectRoot,corpusDir})`；读取 mock 调用
- **期望**：每次 `spawnSync` 的 `options.cwd` 为**绝对** fixture 路径（`resolve(projectRoot,corpusDir,fixtureName)`），严格等于期望绝对路径；**不等于** `process.cwd()`；不触发 `findProjectRoot` 向上推断
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C27 · corpusExpect 断言违反 → resultErrors
- **验证目标**：design §1.2 / §2.1.3 step7；DS-EVAL-001（聚合级断言）
- **前置**：scenario 声明 `corpusExpect:{minRecall:0.9, maxNoise:0, recallBySeverity:{veto:1.0}}`；mock 数据使 recall=0.5、clean 存在误报、veto 桶漏检
- **步骤**：`runScenario(...)`
- **期望**：`result.passed===false`；`result.errors` 分别含 minRecall / maxNoise / recallBySeverity 违反信息；反向：满足断言时 `passed===true`
- **优先级**：P1 ｜ **隔离**：tmp + mock spawn

### L0-C28 · loadScenario 解析 corpusDir + corpusExpect
- **验证目标**：design §2.1.5（顶层标量 `corpusDir` + 嵌套段 `corpusExpect`）；DS-EVAL-001
- **前置**：tmp 写 scenario yaml（`type: corpus` / `corpusDir: .eval-corpus` / `corpusExpect:` 三字段缩进）
- **步骤**：`loadScenario(file)`
- **期望**：`scenario.corpusDir==='.eval-corpus'`；`scenario.corpusExpect.minRecall===0.9`、`maxNoise===0`、`recallBySeverity.veto===1.0`；既有字段（含 `expected`/`assertions`）解析不受影响
- **优先级**：P0 ｜ **隔离**：tmp 文件

### L0-C29 · runAllEvals 收集 corpusReports
- **验证目标**：design §2.1.1 / §2.1.3 step8 / **C-6**（新增维度，`total/passed/failed` 语义不变）
- **前置**：tmp `.mumuspec/evals/` 放 1 个 corpus 场景 + 1 个 custom 场景；mock corpus 探针
- **步骤**：`runAllEvals(projectRoot)`
- **期望**：`report.corpusReports` 长度 1、内容为 corpus 场景报告；`report.total===2`、`passed+failed===2`（既有语义不受影响）；corpus 场景 `passed=false` 时计入 `failed`（§1.1 退出码语义）
- **优先级**：P0 ｜ **隔离**：tmp + mock spawn

### L0-C30 · EvalResult.corpus 与 corpusReports 引用一致
- **验证目标**：design §6①（避免深拷贝错位）；C-6
- **前置**：同 L0-C29
- **步骤**：取 `report.results` 中该 corpus 结果的 `.corpus`，与 `report.corpusReports[0]` 比较
- **期望**：二者为**同一对象引用**（`===`），内容一致
- **优先级**：P1 ｜ **隔离**：tmp + mock spawn

---

## C. custom 分支修复（DS-EVAL-002）

### L0-C31 · custom 断言通过/失败两态 + 零 warning
- **验证目标**：design §2.1.4 / §4 L0「custom」；**DS-EVAL-002** SHALL + SHALL NOT
- **前置**：无（直接构造 `EvalScenario`）
- **步骤**：
  1. `{name,type:'custom',assertions:['errors.length === 0']}` → 调 `runScenario`
  2. `{name,type:'custom',assertions:['errors.length === 99']}` → 调 `runScenario`
- **期望**：
  - 1 → `passed===true`、`errors.length===0`
  - 2 → `passed===false`、`errors` 含 `'Assertion failed'`
  - 两者 `warnings` **长度为 0**（不含 `'Unknown scenario type: custom'`）；无引擎动作副作用
- **优先级**：P0 ｜ **隔离**：纯 runner（无 IO）

### L0-C32 · default 分支仅对真正未知类型告警
- **验证目标**：design §2.1.4（`default` 保留，仅未知类型告警；既有 `runner.test.ts` `unknown scenario type` 用例不受影响）
- **前置**：无
- **步骤**：`runScenario({name,type:'nonexistent-type'})`（`as EvalScenario` 强转）；对照 `type:'custom'`
- **期望**：未知类型 → `warnings` 含 `'Unknown scenario type: nonexistent-type'`；`custom` → `warnings` 不含 `'Unknown'`（回归护栏：证明 custom 已从 default 脱离）
- **优先级**：P0 ｜ **隔离**：纯 runner（无 IO）

---

## D. 回归护栏（既有语义不变）

| 回归项 | 断言 | 依据 |
|---|---|---|
| `runner.test.ts` / `runner-enhance.test.ts` 全绿 | 既有断言不改、不红 | §4 L2 回归（验收场景 5） |
| `EvalReport` 既有 `total/passed/failed` | 非 corpus 场景路径下语义与既有完全一致 | C-6 |
| `loadScenario` 既有分支（`expected`/`assertions`/`default type=compliance`） | 解析结果不变 | §2.1.5 |
| `discoverScenarios` / `initEvalsDir` | 行为不变 | §2.1.1 |
