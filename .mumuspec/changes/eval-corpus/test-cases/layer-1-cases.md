# Test Cases — Layer 1（评估器层）

> 变更：eval-corpus ｜ 层：L1 评估器 ｜ 依据：design.md §2.2 / §3（L1）/ §4（L1）/ §5，DS-EVAL-003
> 被测源码：`src/core/metrics/verifiable-ratio.ts`（新增）、`src/core/metrics/fail-open-count.ts`（新增）、`src/core/metrics/auto-evaluate.ts::registerBuiltInEvaluators()`（+2 行注册）
> 测试代码落点（Build 阶段）：新增 `tests/core/metrics/verifiable-ratio.test.ts`、`tests/core/metrics/fail-open-count.test.ts`（风格对齐 `constraint-density.test.ts`：`vi.mock('node:child_process')` / tmp `audit.log`）
> 说明：非测试代码；本文件为**用例定义**，供 BP-8 锁定。

## 覆盖矩阵

| 依据 | 覆盖用例 |
|---|---|
| DS-EVAL-003 SHALL（verifiable-ratio weight=0、取四分类占比、rawData 计数） | L1-C01~C03、L1-C07、L1-C08 |
| DS-EVAL-003 SHALL（fail-open-count weight=0、读 audit.log 计数分组） | L1-C09、L1-C10、L1-C15、L1-C16 |
| DS-EVAL-003 SHALL NOT（不改 composite 权重和/阈值/窗口） | L1-C16、L1-C17、L1-C18 |
| DS-EVAL-003 SHALL NOT（数值非 LLM/手写） | L1-C01~C03（确定性数值）、L1-C09~C10 |
| DS-EVAL-003 Enforcement（注册三重断言） | L1-C17 |
| C-1（weight=0 注册） | L1-C08、L1-C15、L1-C17 |
| C-3（只读消费，不改 check/validate schema） | L1-C07（argv 断言） |
| R-5（严格取 validate --json 顶层 coverage） | L1-C07 |
| Q4-002（无分母兜底 nullResult） | L1-C03 |
| nullResult 条件（spawn 失败 / 无 JSON / 缺 coverage / audit.log 缺失或空） | L1-C03、L1-C04、L1-C05、L1-C12、L1-C13 |
| 「零非 success 不是 null」（决策 D-eval 语义） | L1-C14 |

## 用例清单（摘要）

| ID | 名称 | 优先级 | 隔离方式 |
|---|---|---|---|
| L1-C01 | verifiable-ratio 全 strong → value=1 | P0 | mock spawn |
| L1-C02 | verifiable-ratio 部分 strong（三态） | P0 | mock spawn |
| L1-C03 | verifiable-ratio 无分母 total<=0 → nullResult | P0 | mock spawn |
| L1-C04 | verifiable-ratio spawn 失败 → nullResult | P0 | mock spawn |
| L1-C05 | verifiable-ratio 无 JSON 输出 → nullResult | P0 | mock spawn |
| L1-C06 | verifiable-ratio value 钳制 [0,1] | P1 | mock spawn |
| L1-C07 | verifiable-ratio argv/cwd 正确（严格 validate --json） | P0 | mock spawn |
| L1-C08 | verifiable-ratio defaultWeight===0 | P0 | 纯属性 |
| L1-C09 | fail-open-count 全 success → value=1, total=0 | P0 | tmp audit.log |
| L1-C10 | fail-open-count 混合 fail 按 action 分组 | P0 | tmp audit.log |
| L1-C11 | fail-open-count 坏 JSON 行跳过 | P0 | tmp audit.log |
| L1-C12 | fail-open-count audit.log 缺失 → nullResult | P0 | tmp |
| L1-C13 | fail-open-count audit.log 空 → nullResult | P0 | tmp |
| L1-C14 | fail-open-count 零非 success 不是 null | P0 | tmp audit.log |
| L1-C15 | fail-open-count defaultWeight===0 | P0 | 纯属性 |
| L1-C16 | fail-open-count value 有界（cap=10） | P1 | tmp audit.log |
| L1-C17 | 注册三重断言（名字 / weight=0 / 权重和===1.0） | P0 | 纯注册 |
| L1-C18 | 注册后 loop composite 不受影响（weight=0 贡献 0） | P0 | 纯注册 + mock |

---

## A. verifiable-ratio（`src/core/metrics/verifiable-ratio.ts`）

> 全部用例 mock `node:child_process` 的 `spawnSync`（**不真跑 CLI**，对齐 `constraint-density.test.ts`）；ctx 形如 `{projectRoot, changeName:'', roundHistory:[]}`。

### L1-C01 · verifiable-ratio 全 strong → value=1
- **验证目标**：design §2.2.1 / §4 L1；DS-EVAL-003 SHALL（value=strong_ratio，rawData 含四分类计数）
- **前置**：mock `spawnSync` 返回 `validate --json` 输出 `{coverage:{total:10,enforced_strong:10,enforced_weak:0,manual:0,unverifiable:0,strong_ratio:1,declared_ratio:1}}`
- **步骤**：`await verifiableRatioEvaluator.evaluate(ctx)`
- **期望**：`result.name==='verifiable-ratio'`；`result.value===1`；`result.weight===0`；`result.rawData` 含 `{total:10,enforced_strong:10,enforced_weak:0,manual:0,unverifiable:0}`
- **优先级**：P0 ｜ **隔离**：mock spawn

### L1-C02 · verifiable-ratio 部分 strong（三态）
- **验证目标**：design §4 L1「0/全/部分三态」；DS-EVAL-003 SHALL
- **前置**：mock 覆盖 `total=8, enforced_strong=4, enforced_weak=2, manual=1, unverifiable=1, strong_ratio=0.5`
- **步骤**：`evaluate(ctx)`
- **期望**：`value≈0.5`（等于 `strong_ratio`）；`rawData.enforced_strong===4` 等四分类计数逐一匹配；`weight===0`
- **优先级**：P0 ｜ **隔离**：mock spawn

### L1-C03 · verifiable-ratio 无分母 total<=0 → nullResult
- **验证目标**：design §2.2.1 nullResult 条件；**Q4-002**（无分母即跳过）
- **前置**：分别 mock `{coverage:{total:0,...}}` 与 `{coverage` 缺失的 `{}`
- **步骤**：`evaluate(ctx)`（两次）
- **期望**：两次均 `value===0`、`weight===0`、`details` 含 `unavailable`（`— metric skipped` 后缀）；**不抛异常**
- **优先级**：P0 ｜ **隔离**：mock spawn

### L1-C04 · verifiable-ratio spawn 失败 → nullResult
- **验证目标**：design §2.2.1 nullResult 条件（spawn error）
- **前置**：mock `spawnSync` 返回 `{error: new Error('ENOENT')}`
- **步骤**：`evaluate(ctx)`
- **期望**：`value===0`、`details` 含 `failed to start`；不抛异常
- **优先级**：P0 ｜ **隔离**：mock spawn

### L1-C05 · verifiable-ratio 无 JSON 输出 → nullResult
- **验证目标**：design §2.2.1 nullResult 条件（无 JSON）
- **前置**：mock `spawnSync` 返回 `{status:0,stdout:'no json here',stderr:''}`
- **步骤**：`evaluate(ctx)`
- **期望**：`value===0`、`details` 含 `no JSON`
- **优先级**：P0 ｜ **隔离**：mock spawn

### L1-C06 · verifiable-ratio value 钳制 [0,1]
- **验证目标**：design §2.2.1 `Math.max(0,Math.min(1,strong_ratio))` 防御
- **前置**：mock 返回 `strong_ratio:1.4` 与 `strong_ratio:-0.2`（各一次）
- **步骤**：`evaluate(ctx)`
- **期望**：分别 `value===1` 与 `value===0`（钳制到边界）
- **优先级**：P1 ｜ **隔离**：mock spawn

### L1-C07 · verifiable-ratio argv/cwd 正确（严格 validate --json）
- **验证目标**：design §2.2.1 数据源 / **C-3** / **R-5**（严格取 `validate --json` 顶层 coverage，非 check 运行时 coverage）
- **前置**：mock `spawnSync` 成功返回；ctx `projectRoot='<tmp>'`
- **步骤**：`evaluate(ctx)`；读 `mockSpawn.mock.calls[0]`
- **期望**：`argv[1]` 为 `['validate','--json']`（命令为 `validate`，**非** `check`）；`options.cwd===ctx.worktreePath||ctx.projectRoot`；`options.encoding==='utf-8'`；`options.timeout===30000`
- **优先级**：P0 ｜ **隔离**：mock spawn

### L1-C08 · verifiable-ratio defaultWeight===0
- **验证目标**：design §2.2.1 / **C-1**；DS-EVAL-003 SHALL（weight 0 注册）
- **前置**：无
- **步骤**：读 `verifiableRatioEvaluator.defaultWeight`
- **期望**：`===0`
- **优先级**：P0 ｜ **隔离**：纯属性

---

## B. fail-open-count（`src/core/metrics/fail-open-count.ts`）

> 全部用例在 tmp `.mumuspec/audit.log` 上构造数据（真实文件读取，不 mock fs），`getMumuSpecDir(ctx.projectRoot)` 指向 tmp。

### L1-C09 · fail-open-count 全 success → value=1, total=0
- **验证目标**：design §2.2.2 / §4 L1「全 success」；DS-EVAL-003 SHALL
- **前置**：audit.log 每行 `{"action":"x","result":"success","ts":"..."}`
- **步骤**：`await failOpenCountEvaluator.evaluate(ctx)`
- **期望**：`result.value===1`（`1 - min(1,0/10)`）；`rawData.total===0`、`rawData.byAction` 为 `{}`、`entries` 为 `[]`；`weight===0`
- **优先级**：P0 ｜ **隔离**：tmp audit.log

### L1-C10 · fail-open-count 混合 fail 按 action 分组
- **验证目标**：design §2.2.2 计数口径 + 分组 / §4 L1「混合 fail 分组」；DS-EVAL-003 SHALL（按 action 分组输出计数与清单）
- **前置**：audit.log 含 `result:'success'`×2、`result:'fail'` action=a ×2、`result:'bypassed'` action=b ×1、缺 `result` 字段 ×1
- **步骤**：`evaluate(ctx)`
- **期望**：`rawData.total===4`（非 success 计数）；`rawData.byAction` 为 `{a:2,b:1,'(unknown)':1}` 形式（缺 action 归 `(unknown)`）；`rawData.entries` 含每条 `{action, ts, error}`；`value===1-Math.min(1,4/10)===0.6`
- **优先级**：P0 ｜ **隔离**：tmp audit.log

### L1-C11 · fail-open-count 坏 JSON 行跳过
- **验证目标**：design §2.2.2（`catch { continue }` 坏行不污染计数）
- **前置**：audit.log 混入 `not json`、`{bad}` 等非法行 + 合法 `result:'fail'` 行
- **步骤**：`evaluate(ctx)`
- **期望**：坏行被跳过（不改 `total`，不抛异常）；`total` 仅统计可解析且非 success 的行
- **优先级**：P0 ｜ **隔离**：tmp audit.log

### L1-C12 · fail-open-count audit.log 缺失 → nullResult
- **验证目标**：design §2.2.2 nullResult 条件（audit.log 不存在）；§4 L1
- **前置**：tmp `.mumuspec/` 下**无** audit.log
- **步骤**：`evaluate(ctx)`
- **期望**：`value===0`、`details` 含 `not found`；`rawData` 为 `{total:0,cap:10,byAction:{},entries:[]}`；不抛异常
- **优先级**：P0 ｜ **隔离**：tmp

### L1-C13 · fail-open-count audit.log 空 → nullResult
- **验证目标**：design §2.2.2 nullResult 条件（完全为空）
- **前置**：audit.log 存在但为空文件（或仅空白行）
- **步骤**：`evaluate(ctx)`
- **期望**：`value===0`、`details` 含 `empty`；不抛异常
- **优先级**：P0 ｜ **隔离**：tmp

### L1-C14 · fail-open-count 零非 success 不是 null
- **验证目标**：design §2.2.2 决策（「无数据源 ≠ 零 fail-open」；零非 success 为健康态）
- **前置**：audit.log 含多行 `result:'success'`（`lines.length>0` 但非 success 计数为 0）
- **步骤**：`evaluate(ctx)`
- **期望**：`value===1`（**非** 0、**非** nullResult）；`details` 含 `0 non-success audit entr`；与 L1-C13（空文件 → null）形成对照
- **优先级**：P0 ｜ **隔离**：tmp audit.log

### L1-C15 · fail-open-count defaultWeight===0
- **验证目标**：design §2.2.2 / **C-1**；DS-EVAL-003 SHALL
- **前置**：无
- **步骤**：读 `failOpenCountEvaluator.defaultWeight`
- **期望**：`===0`；`FAIL_OPEN_CAP===10`
- **优先级**：P0 ｜ **隔离**：纯属性

### L1-C16 · fail-open-count value 有界（cap=10）
- **验证目标**：design §2.2.2 `1 - Math.min(1,total/FAIL_OPEN_CAP)`；`FAIL_OPEN_CAP` 有界归一化
- **前置**：audit.log 含 15 条非 success 行（超过 cap）
- **步骤**：`evaluate(ctx)`
- **期望**：`value===0`（`total/10 > 1` → 钳制到 1）；`rawData.cap===10`；`total===15`
- **优先级**：P1 ｜ **隔离**：tmp audit.log

---

## C. 注册与权重不变式（`auto-evaluate.ts::registerBuiltInEvaluators()`）

### L1-C17 · 注册三重断言（名字 / weight=0 / 权重和===1.0）
- **验证目标**：design §2.2.3 / §4 L1「注册三重断言」；DS-EVAL-003 **Enforcement**；C-1
- **前置**：`clearEvaluatorRegistry()` 后调 `registerBuiltInEvaluators()`
- **步骤**：
  1. `getEvaluator('verifiable-ratio')`、`getEvaluator('fail-open-count')`
  2. 读二者 `defaultWeight`
  3. 计算 `getActiveEvaluators()` 的 `defaultWeight` 之和
- **期望**：
  - 1 → 二者均非 `null`（名字存在）
  - 2 → 二者 `defaultWeight===0`
  - 3 → 活跃权重和 **=== 1.0**（既有 6 个评估器之和，未被 +2 注册改变）
- **浮点提醒**：既有 6 评估器权重（`test-pass-rate 0.3`＋`drift-score 0.2`＋`spec-compliance 0.2`＋`code-delta 0.1`＋`design-build-first-pass 0.2`＋`constraint-density 0`）之浮点和为 `0.9999999999999999` → 断言须用 `toBeCloseTo(1.0, 10)`（或与注册前求和值比较），**不可**用 `toBe(1)` 严格相等。若实现侧有归一化，则以归一化后值断言。
- **优先级**：P0 ｜ **隔离**：纯注册（无 IO）

### L1-C18 · 注册后 loop composite 不受影响（weight=0 贡献 0）
- **验证目标**：design §2.2.3「活跃权重和仍为 1.0」/ **DS-EVAL-003 SHALL NOT**（不改 composite 权重和、阈值 0.85、稳定窗口 3 轮）；与 `freedom-suggestions.test.ts` 不变式一致
- **前置**：注册全部内置评估器；mock 既有评估器返回确定值
- **步骤**：调 `autoEvaluate(ctx)`，比较「含新评估器」与「不含新评估器」两次 `progress`
- **期望**：两次 `progress` 完全相等（新增 weight=0 评估器对加权 progress 贡献 0）；阈值 0.85 与稳定窗口 3 轮常量不变（沿用既有断言）
- **优先级**：P0 ｜ **隔离**：纯注册 + mock 评估器

---

## D. 回归护栏

| 回归项 | 断言 | 依据 |
|---|---|---|
| `auto-evaluate.test.ts` TC-05/06/07/08 全绿 | 权重归一化、收敛窗口、权重重分配语义不变 | DS-EVAL-003 SHALL NOT |
| `weight-single-source.test.ts` / `freedom-suggestions.test.ts` | 权重单一权威源不变式（`weight=defaultWeight`）不受新评估器影响 | C-1 / §2.2.3 |
| `data-source-contract.test.ts` | 新评估器取数契约（spawn 命令）与既有契约一致 | C-3 / R-5 |
