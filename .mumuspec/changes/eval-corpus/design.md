# Design: eval-corpus — M1 评测基座

> 变更：eval-corpus ｜ 阶段：design ｜ 依赖：proposal / DS-EVAL-001~004 / cognitive-map / impact-analysis
> 设计依据：`review/evaluation-metrics-implementation-plan-2026-09-13.md`（M1 表）、`review/evaluation-metrics-probe-results-2026-09-13.md`（多信号 kill 口径与语料位置一手证据）
> 参考实现（复用既有模式，不自建第二通道）：`src/eval/runner.ts`、`src/cli/commands/eval.ts`、`src/core/metrics/{types,evaluator-registry,drift-score,spec-compliance,design-build-first-pass,constraint-density,auto-evaluate}.ts`
> 格式基准：`.mumuspec/changes/archive/2026-09-13-bp-into-graph/design.md`

---

## 0. 设计约束（硬红线，来自提案 + 用户裁决）

| # | 约束 | 落点 |
|---|---|---|
| C-1 | 新评估器一律 `weight=0` 注册；loop composite 权重和不变（1.0）、阈值 0.85、稳定窗口 3 轮均不动 | §2.2 |
| C-2 | 不引入新依赖（Ponytail L3-L5），复用既有工具/模式 | 全篇 |
| C-3 | 不改变 `check` / `validate` 命令的既有 JSON schema；评估器只读消费 | §2.2 |
| C-4 | 语料放 `.eval-corpus/` 隐藏目录（`findSpecDirs` 天然跳过 `name.startsWith('.')`）；`eval --report` 仅 stdout（不落盘） | §2.3 |
| C-5 | corpus kill 判定必须多信号 diff：新增错误/警告码 ∪ coverage 五字段（total/enforced_strong/enforced_weak/manual/unverifiable）任一变化 | §2.1.3 |
| C-6 | `EvalReport` 只新增维度（`corpusReports`），既有 `total/passed/failed` 语义不变 | §2.1.1 |
| C-7 | 依赖方向 report → evaluators → runner 单向；三层 L0/L1/L2（GM-001 已确认） | §2.0 |

---

## 1. 高层设计（L2 消费层视角）

### 1.1 `eval --report` 输入输出契约

`--report` 是 `eval run` 子命令上的**新增布尔旗标**，纯增量、不改变既有 `run` 行为：

- 输入：无（复用 `run` 已解析的 workspace）；`--json` 与之组合决定形态。
- 输出（**仅 stdout，不落盘**，Q1-007 / TEMP-4 红线）：
  - 文本形态：四段可读汇总 —— ① 各 corpus 场景 recall/noise + Wilson 95% CI（`n<3` 标注「置信不足」）；② A1 可验证率（strong_ratio + 四分类计数）；③ B4 fail-open 计数（按 action 分组 + 清单）；④ 测试覆盖率引用（B6 阈值 + 采集命令）。
  - JSON 形态（`--report --json`）：冻结为 `EvalSummaryReport`（§2.3.1），含 `version: 1` 字段。
- 退出码：**不改既有语义** —— `run` 的 exit code 仍由 `report.failed` 决定；corpus 场景自身的 `corpusExpect` 断言失败会体现为该场景 `passed=false`，从而计入 `failed`。

### 1.2 corpus 场景的用户可见语义

用户在 `.mumuspec/evals/<name>.yaml` 声明一条 corpus 场景：

```yaml
name: eval-corpus-b1
type: corpus
corpusDir: .eval-corpus          # 相对项目根；缺省即 .eval-corpus
corpusExpect:                    # 聚合级断言（可选）
  minRecall: 0.9
  maxNoise: 0
  recallBySeverity:
    veto: 1.0
```

runner 对该场景的行为：把 `corpusDir` 下**每个 fixture 子目录当作独立 projectRoot**，各自 spawn 校验器命令，聚合输出 **recall（坏样本检出率）** 与 **noise（净样本误报率）** 两比值，并给出每格 Wilson 95% CI。用户可见的是「校验器自身召回/噪声」的量化建档，不触碰任何既有命令输出。

### 1.3 与既有场景类型的关系

| 类型 | 引擎动作 | 产出维度 |
|---|---|---|
| `compliance` | 进程内 `checkCompliance` | 单场景 passed/errors/warnings（既有） |
| `drift` | 进程内 `detectDrift` | 同上（既有） |
| `phase-guard` | 进程内 `runPhaseGuard` | 同上（既有） |
| `custom` | **无引擎动作**，仅跑 assertions（本次修复，§2.1.4） | 同上（既有） |
| `corpus`（新增） | 每 fixture spawn CLI 探针（§2.1.3） | `EvalResult.corpus` 新维度 + `EvalReport.corpusReports` 聚合 |

四类既有类型的产出结构不变；`corpus` 是**第 5 类**，与前三类并列（`custom` 从死端转为可用）。

---

## 2. 底层设计

### 2.0 分层与依赖方向（L0 → L1 → L2）

```
L2 消费层  src/cli/commands/eval.ts（--report）  +  .eval-corpus/ 语料  +  tests/eval/fixture-location.test.ts
             │  依赖（只读）
             ▼
L1 评估器层 src/core/metrics/verifiable-ratio.ts · fail-open-count.ts · auto-evaluate.ts（注册）
             │  依赖（只读）
             ▼
L0 runner 层 src/eval/runner.ts（corpus 分支 + custom 修复）  +  src/eval/corpus.ts（纯函数：Wilson/信号/聚合）
```

单向依赖，无回环：L0 不 import L1/L2；L1 不 import L2；L2 只读消费 L0/L1。

---

### 2.1 L0 — runner 层

#### 2.1.0 新增纯函数模块 `src/eval/corpus.ts`

把「纯计算」从 runner 编排中剥离，便于直接单测（无 IO、无 spawn）：

```ts
// src/eval/corpus.ts
import type { EnforcementCoverage } from '../core/types-workflow.js';

/** coverage 五字段（DS-EVAL-001 多信号口径） */
export const COVERAGE_FIELDS = [
  'total', 'enforced_strong', 'enforced_weak', 'manual', 'unverifiable',
] as const;
export type CoverageField = (typeof COVERAGE_FIELDS)[number];
export type CoverageVector = Record<CoverageField, number>;

/** 一次 fixture 运行的原始信号 */
export interface FixtureSignals {
  codes: string[];                 // 去重后的码集合（error ∪ warning，跨域）
  coverage: CoverageVector | null; // 探针未输出 coverage 时为 null
}

/** 从任意校验器 JSON 输出递归收集所有 {code:string}（域无关，兼容 validate/check/guard） */
export function collectCodes(node: unknown, out: Set<string> = new Set()): Set<string>;

/** 从任意 JSON 输出中定位 EnforcementCoverage（首个含 total+四分类数值的对象） */
export function findCoverage(node: unknown): CoverageVector | null;

/**
 * 多信号 diff（C-5）：返回相对基线的「新增码」与「coverage 变化字段」。
 * - newCodes = fixture.codes − baseline.codes
 * - changedCoverageFields = baseline/fixture 双侧均有 coverage 时，数值不等的字段名
 * - killed = newCodes.size > 0 || changedCoverageFields.length > 0
 */
export function diffSignals(baseline: FixtureSignals, fixture: FixtureSignals): {
  newCodes: string[];
  changedCoverageFields: CoverageField[];
  killed: boolean;
};

export interface WilsonInterval {
  lower: number; upper: number; n: number; confidence: 0.95; insufficient: boolean;
}

/** Wilson 95% 置信区间；n<=0 返回 null（Q4-002 除零兜底）；n<3 置 insufficient=true */
export function wilsonInterval(successes: number, n: number, z?: number): WilsonInterval | null;

export interface RatioReport {
  value: number | null;            // 分子/分母；分母为 0 → null（不做 0/0）
  n: number;                       // 有效分母（recall = killed + missed；errored 已排除，见 D-corpus-5）
  ci: WilsonInterval | null;
  excluded?: number;               // 新增：被排除出分母的数量（recall 时 = errored；noise 时缺省）
}

/** 由成功数/总数构造比值报告 */
export function makeRatio(successes: number, n: number): RatioReport;

/** 期望信号（fixture expected.yaml 解析结果） */
export interface FixtureExpectation {
  kind: 'baseline' | 'bad-case' | 'clean';
  severity?: 'veto' | 'error' | 'warn';   // bad-case 分档
  probe: ProbeName;                       // 缺省 'validate'
  change?: string;                        // guard/archive 探针所需的变更名
  mustContain: string[];
  mustNotContain: string[];
}

export type ProbeName = 'validate' | 'check' | 'guard' | 'archive';

/** 固定 argv 模板（白名单枚举，杜绝命令注入；不做任意命令字符串） */
export const PROBE_ARGS: Record<ProbeName, (change?: string) => string[]> = {
  validate: () => ['validate', '--json'],
  check: () => ['check', '--json'],
  guard: (c) => ['guard', c ?? '', 'verify', '--json'],
  archive: (c) => ['archive', c ?? '', '--confirm'],  // archive 是顶层命令（非 `change archive` 幽灵命令）；--confirm 触发 DELTA_MERGE_INCOMPLETE → E-CHANGE-022
};
```

Wilson 公式（实现即此，工程照抄）：

```ts
export function wilsonInterval(successes: number, n: number, z = 1.96): WilsonInterval | null {
  if (!Number.isFinite(n) || n <= 0) return null;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    n, confidence: 0.95, insufficient: n < 3,
  };
}
```

`loadFixtureExpectation(filePath): FixtureExpectation` 用与 `loadScenario` 同款**行式解析**（不引新依赖），字段留空时给出缺省：`probe='validate'`、`mustContain=[]`、`mustNotContain=[]`；`kind` 缺失时按目录名约定推断（`_baseline`→baseline，`clean-*`→clean，其余→bad-case）。

#### 2.1.1 类型定义（`src/eval/runner.ts`）

```ts
export interface EvalScenario {
  name: string;
  description?: string;
  type: 'compliance' | 'drift' | 'phase-guard' | 'custom' | 'corpus';  // + corpus
  projectRoot?: string;
  changeName?: string;
  targetPhase?: string;
  corpusDir?: string;                 // 新增：相对 projectRoot，缺省 .eval-corpus
  corpusExpect?: {                    // 新增：聚合级断言（可选）
    minRecall?: number;
    maxNoise?: number;
    recallBySeverity?: Partial<Record<'veto' | 'error' | 'warn', number>>;
  };
  expected?: { /* 既有字段保持不变 */ };
  assertions?: string[];
}

/** 单个 fixture 的结果（新增，挂在 EvalResult 新字段） */
export interface CorpusFixtureResult {
  name: string;
  kind: 'baseline' | 'bad-case' | 'clean';
  severity?: 'veto' | 'error' | 'warn';
  errored?: boolean;              // 新增三态：探针启动失败/输出不可解析 → errored（不进 recall 分母，D-corpus-5）
  killed?: boolean;               // bad-case：是否检出（errored 时 undefined；false = missed）
  falsePositive?: boolean;        // clean：是否误报（有码即判误报）
  newCodes: string[];             // 相对基线的新增码
  changedCoverageFields: string[]; // 相对基线变化的 coverage 字段
  mustContainSatisfied: boolean;  // 期望码是否全部命中（精度校验）
  unexpectedCodes: string[];      // 命中 mustNotContain 的码（精度违规）
  errors: string[];               // 该 fixture 运行/解析错误（errored 时非空）
}

/** corpus 场景聚合报告（新增；三态 killed/missed/errored，见 D-corpus-5） */
export interface CorpusScenarioReport {
  scenario: string;
  corpusDir: string;
  total: number;                  // fixture 总数（不含 _baseline）
  counts: { killed: number; missed: number; errored: number };  // 新增：bad-case 三态 tally
  errored: number;                // 新增：errored fixture 总数（bad-case + clean）
  erroredFixtures: string[];      // 新增：errored fixture 名（场景 warning 列明用）
  recall: RatioReport;            // 坏样本检出率；分母 = killed + missed（errored 排除）
  recallBySeverity: Record<'veto' | 'error' | 'warn', RatioReport>;
  noise: RatioReport;             // 净样本误报率；分母 = 有效 clean（errored 排除）
  precision: { mustContainSatisfied: number; mustContainTotal: number; ratio: number | null };  // 新增：精度聚合（仅展示，不设阈值）
  baseline: { codes: string[]; coverage: CoverageVector | null } | null;
  fixtures: CorpusFixtureResult[];
}

export interface EvalResult {
  scenario: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
  details: string;
  duration: number;
  corpus?: CorpusScenarioReport;  // 新增可选字段（向后兼容）
}

export interface EvalReport {
  total: number;                  // 既有语义不变
  passed: number;                 // 既有语义不变
  failed: number;                 // 既有语义不变
  results: EvalResult[];
  duration: number;
  corpusReports?: CorpusScenarioReport[];  // 新增聚合维度（C-6）
}
```

#### 2.1.2 探针信号提取（域无关）

corpus 不硬编码每个命令的 schema，而是**通用提取**：

1. spawn `npx mumuspec <PROBE_ARGS[probe](change)>`，`cwd = 绝对 fixture 路径`，`shell = process.platform === 'win32'`（对齐 drift-score/spec-compliance 的 win32 修复），`encoding:'utf-8'`，`timeout: 30_000`。
2. `codes = collectCodes(parseJsonFrom(stdout))` **∪** `regexCodes(stdout + '\n' + stderr)`，其中 `regexCodes` 用 `/\b[EW]-[A-Z]+-\d{3}\b/g` —— 覆盖 JSON 之外的通道（如 `archive` 抛错经 stderr 打印 `E-CHANGE-022`）。
3. `coverage = findCoverage(parsed)`：`validate --json` 顶层 `coverage`、`check --json` 的 `compliance.coverage` 均可被同一游走命中；`guard`/`archive` 无 coverage → `null`。

> 复用 `drift-score.ts` 的 `parseJsonFrom`（整段解析失败则从首个 `{`/`[` 切片）——同一份工具语义，不重写。

#### 2.1.3 corpus 运行流程（`runScenario` 新增分支）

```
runScenario(scenario)  case 'corpus':
  1. corpusDir = resolve(projectRoot, scenario.corpusDir ?? '.eval-corpus')
     if (!existsSync(corpusDir)) → resultErrors.push('corpus dir not found: ...')；返回
  2. 枚举 corpusDir 直接子目录（hasMumu = 含 .mumuspec/ ；hasExpected = 含 expected.yaml）：
     - fixture = hasMumu && hasExpected
     - hasMumu && !hasExpected → orphanDirs.push(name)（P5：随后 warning 列明数量，不进分母）
     - fixture 为空 → 记 warning 'corpus dir empty'，corpus 报告 n=0，ratio.value=null，**不抛异常**（Q4-002）
     - 无 _baseline → resultErrors.push('corpus requires _baseline fixture')；返回（fail-fast，禁止静默）
  3. baseline = runProbe(join(corpusDir,'_baseline'), loadFixtureExpectation(...))
     - baseline errored（启动失败/输出不可解析）→ resultErrors.push('baseline probe errored: ...')；返回（fail-fast）
     - baseline.codes.length > 0 → resultErrors.push('baseline must be clean but produced codes: ...')
  4. for bad-case fixtures:
       sig = runProbe(absFixturePath, exp)
       if (sig.errored) → counts.errored += 1；erroredFixtures.push(name)；记 killed=undefined；**不进 recall 分母**
       else:
         { newCodes, changedCoverageFields, killed } = diffSignals(baseline, sig)
         killed ? counts.killed += 1 : counts.missed += 1
         mustContainSatisfied = exp.mustContain ⊆ sig.codes
         unexpectedCodes = sig.codes ∩ exp.mustNotContain
       记录 CorpusFixtureResult；按 severity 分桶三态 tally
  5. for clean fixtures:
       sig = runProbe(absFixturePath, exp)
       if (sig.errored) → erroredFixtures.push(name)（不进 noise 分母）
       else { falsePositive = sig.codes.length > 0  // noise 只计「码」误报（见下方决策）
              if (sig.codes ∩ exp.mustNotContain 非空) 记 unexpectedCodes }
  6. 聚合（三态）：
       recall              = makeRatio(counts.killed, counts.killed + counts.missed)  // errored 排除（D-corpus-5）
       recallBySeverity[s] = makeRatio(killed_s, killed_s + missed_s)                 // 各自分母，errored 排除
       noise               = makeRatio(ΣfalsePositive, nCleanEffective)               // errored clean 排除
       precision           = { mustContainSatisfied: Σsat, mustContainTotal: Σexp.mustContain.length,
                               ratio: mustContainTotal > 0 ? sat/total : null }        // 仅展示，不设阈值（BP-12-2）
  7. 断言（fail-closed，D-corpus-6）：
       if (!scenario.corpusExpect) → warning('corpusExpect not declared — report-only mode')   // P1，不改 passed
       else for each declared field (minRecall / recallBySeverity[.*] / maxNoise):
             denominator === 0        → resultErrors.push('empty denominator for <field> — configuration error')
             else 违反阈值            → resultErrors.push('<field> ... below/above expected ...')
  8. 场景 warning（列明，不阻断）：
       erroredFixtures 非空 → warning('N fixture(s) errored (excluded from recall denominator): <names>')  // BP-12-1
       orphanDirs 非空       → warning('M subdir(s) with .mumuspec but no expected.yaml (excluded): <names>')  // P5
     EvalResult { ..., corpus: report }；runAllEvals 收集 report.corpus 到 EvalReport.corpusReports
```

**关键决策（决策记录，非开放问题）**

- **D-corpus-1（baseline 语义）**：覆盖信号 diff 的参照系是 `_baseline` fixture（探测 1 的「干净基线 vs 变体」方法论）。因此坏样本语料应被设计为 `_baseline` 的**单点变异**（同约束骨架），使 coverage 五字段可比。若某 fixture 的探针与基线探针输出形态不可比（如 `guard`/`archive` 无 coverage），则 coverage-diff 自动禁用（`baseline.coverage===null || sig.coverage===null` → `changedCoverageFields=[]`），检测退化为**纯码信号**——这正覆盖 E-GUARD-010 / E-CHANGE-022 两个跨域码。
- **D-corpus-2（noise 只计码）**：净样本误报**只以诊断码判定**（有码即误报），不计 coverage 差异。理由：coverage.total 与 spec 结构强相关，不同 clean spec 的 total 天然不同，把它计为噪声会把「结构性差异」误报为「校验器误报」，与验收场景 1（clean 语料 → noise=0）冲突。
- **D-corpus-3（探针白名单）**：`probe` 是枚举而非任意 argv，杜绝经由数据文件注入命令。
- **D-corpus-4（cwd 无关，Q4-001）**：`runProbe` **只接受绝对路径**（`resolve(projectRoot, fixtureName)`）作为 `cwd`，绝不依赖 `process.cwd()` 或 `findProjectRoot` 的向上查找推断。单测锁死（§4 L0）。
- **D-corpus-5（errored 三态，BP-12-1）**：聚合区分 `killed` / `missed` / `errored`；探针启动失败或输出不可解析的 fixture 记为 **errored**，**不计入 recall 分母**（分母 = killed + missed），并以场景 warning 列明。`missed` 与 `errored` 严格区分：missed = 探针成功返回但零信号（真漏检）；errored = 探针未产出可用信号（衡量器故障）。依据：衡量器不得静默污染，与 fail-open 纪律同源。
- **D-corpus-6（空分母 fail-closed，BP-12-4）**：被声明的聚合阈值（`minRecall` / `recallBySeverity[.*]` / `maxNoise`）对应分母为 0 时，一律视为**配置错误 → resultErrors**（fail-closed）。消除 maxNoise 静默跳过与另两处的不对称。未声明 `corpusExpect` 时不触发此规则（改为 D-corpus-7 的 report-only warning）。
- **D-corpus-7（report-only 提示，BP-12-3）**：未声明 `corpusExpect` 时输出一条场景 warning，提示 report-only 模式（恒绿可能被误读为达标），不改变 `passed` 语义。
- **D-corpus-8（孤儿目录，BP-12-5）**：`corpusDir` 下含 `.mumuspec/` 但缺 `expected.yaml` 的子目录输出 warning 并列明数量，不进任何分母（防分母静默缩水）。

#### 2.1.4 custom 分支修复（消除死端，DS-EVAL-002）

现状：`custom` 落入 `switch` 的 `default` 分支 → 推入 `warnings: ['Unknown scenario type: custom']`（死端：有产出无消费者，且污染的 warning 语义）。

修复：在 `switch` 中显式加 `case 'custom': break;` —— 仅执行断言（`expected` 检查 + `assertions` 求值，由 switch 之后既有公共段完成），**无引擎动作、零 warning**。`default` 分支保留，仅对真正未知类型告警（既有测试 `unknown scenario type` 用 `'nonexistent-type'`，不受影响）。

```ts
switch (scenario.type) {
  case 'compliance': /* 既有 */ break;
  case 'drift':      /* 既有 */ break;
  case 'phase-guard':/* 既有 */ break;
  case 'custom':     // ADDED：assertions-only，无引擎动作、无警告
    break;
  case 'corpus':     // ADDED：见 §2.1.3
    /* corpus 分支填充 corpus report */
    break;
  default:
    resultWarnings.push(`Unknown scenario type: ${scenario.type}`);
}
```

#### 2.1.5 `loadScenario` 扩展

在既有行式解析器中：
- 顶层标量 `corpusDir`（走既有 `parseScalar`）。
- 新增嵌套段 `corpusExpect`（与 `expected` 同构：缩进行按 `key: value` 解析）。

`expected.yaml` 的解析走独立的 `loadFixtureExpectation`（§2.1.0），与 scenario 解析解耦（schema 不同，避免污染既有解析路径）。

---

### 2.2 L1 — 评估器层

#### 2.2.1 `verifiable-ratio`（A1，`src/core/metrics/verifiable-ratio.ts`，新增）

```ts
export const VERIFIABLE_RATIO_NAME = 'verifiable-ratio';

export const verifiableRatioEvaluator: Evaluator = {
  name: VERIFIABLE_RATIO_NAME,
  defaultWeight: 0,                     // C-1：weight=0，不进 composite
  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const cwd = ctx.worktreePath || ctx.projectRoot;
    try {
      const r = spawnSync('npx', ['mumuspec', 'validate', '--json'],
        { cwd, encoding: 'utf-8', timeout: 30_000, shell: process.platform === 'win32' });
      if (r.error) return nullResult(`validate failed to start: ${r.error.message}`);
      const parsed = parseJsonFrom(r.stdout ?? '');          // 复用同一工具
      if (parsed === null) return nullResult('validate produced no JSON output');
      const cov = (parsed as { coverage?: Partial<EnforcementCoverage> }).coverage;
      if (!cov || typeof cov.total !== 'number' || cov.total <= 0)
        return nullResult('validate coverage.total unavailable');   // Q4-002 同款兜底
      const value = Math.max(0, Math.min(1, cov.strong_ratio ?? 0));
      return {
        name: VERIFIABLE_RATIO_NAME, value, weight: 0,
        details: `strong ${cov.enforced_strong}/${cov.total} (strong_ratio ${value.toFixed(3)}); ` +
                 `weak ${cov.enforced_weak} manual ${cov.manual} unverifiable ${cov.unverifiable}`,
        rawData: { total: cov.total, enforced_strong: cov.enforced_strong, enforced_weak: cov.enforced_weak,
                   manual: cov.manual, unverifiable: cov.unverifiable,
                   declared_ratio: cov.declared_ratio ?? 0, strong_ratio: cov.strong_ratio ?? 0 },
      };
    } catch (err) { return nullResult(`verifiable-ratio failed: ${String(err)}`); }
  },
};
function nullResult(details: string): MetricResult {
  return { name: VERIFIABLE_RATIO_NAME, value: 0, weight: 0, details: `${details} — metric skipped` };
}
```

- **数据源**：`validate --json` 顶层 `coverage`（字段契约 Q1-006：`{total,enforced_strong,enforced_weak,manual,unverifiable,declared_ratio,strong_ratio,unverifiable_items}`）。
- **只读消费**：不改 `validate` 输出 schema（C-3）。
- **nullResult 条件**：spawn error / 无 JSON / `coverage` 缺失 / `total<=0`（无分母即跳过，与 spec-compliance 同款诚实语义）。

#### 2.2.2 `fail-open-count`（B4，`src/core/metrics/fail-open-count.ts`，新增）

```ts
export const FAIL_OPEN_COUNT_NAME = 'fail-open-count';
export const FAIL_OPEN_CAP = 10;   // 有界归一化上限（同 constraint-density cap 思维）

export const failOpenCountEvaluator: Evaluator = {
  name: FAIL_OPEN_COUNT_NAME,
  defaultWeight: 0,
  async evaluate(ctx: EvaluatorContext): Promise<MetricResult> {
    const logPath = join(getMumuSpecDir(ctx.projectRoot), 'audit.log');
    if (!existsSync(logPath)) return nullResult('audit.log not found');
    const lines = readFileSync(logPath, 'utf8').split('\n').filter(l => l.trim());
    const byAction: Record<string, number> = {};
    const entries: Array<{ action: string; ts?: string; error?: string }> = [];
    let total = 0;
    for (const line of lines) {
      let e: { action?: unknown; result?: unknown; ts?: unknown; error?: unknown };
      try { e = JSON.parse(line); } catch { continue; }        // 坏行跳过，不污染计数
      if (e.result === 'success') continue;                    // 「非 success」= fail/bypassed/undefined（探针 3：fail-open 以 result!=='success' 入账）
      total += 1;
      const action = typeof e.action === 'string' ? e.action : '(unknown)';
      byAction[action] = (byAction[action] ?? 0) + 1;
      entries.push({ action, ts: e.ts as string, error: e.error as string });
    }
    if (lines.length === 0) return nullResult('audit.log is empty');   // 无数据源 ≠ 零 fail-open
    const value = 1 - Math.min(1, total / FAIL_OPEN_CAP);       // 越高越健康（weight=0，不影响 composite）
    return {
      name: FAIL_OPEN_COUNT_NAME, value, weight: 0,
      details: `${total} non-success audit entr${total === 1 ? 'y' : 'ies'} across ${Object.keys(byAction).length} action(s)`,
      rawData: { total, cap: FAIL_OPEN_CAP, byAction, entries },
    };
  },
};
function nullResult(details: string): MetricResult {
  return { name: FAIL_OPEN_COUNT_NAME, value: 0, weight: 0, details: `${details} — metric skipped`,
           rawData: { total: 0, cap: FAIL_OPEN_CAP, byAction: {}, entries: [] } };
}
```

- **计数口径**：「result 非 success」= `e.result !== 'success'`（字符串比较，兼容 `'fail'` 与审计里出现的 `'bypassed'` 等）。
- **分组**：按 `action` 分桶，`rawData.byAction` 给计数、`rawData.entries` 给清单（含 ts/error）。
- **nullResult 条件**：`audit.log` 不存在 / 完全为空（无数据源）；**零非 success 条目不是 null**（0 fail-open 是健康态，value=1）。
- **范围边界（决策 D-eval-1）**：实施计划 E4 提到的「与 design.md 固化的 4 类静默点位清单比对差异」**不在 M1** —— 该清单的权威来源依赖 M2 的 `check.warn` 入账事件（探测 3 结论：当前 audit.log 零告警事件，B2b 不可推导）。M1 只交付 DS-EVAL-003 明文要求的「计数 + 分组清单」。这是**范围决策**（open_questions=0），非悬置项。

#### 2.2.3 注册（`src/core/metrics/auto-evaluate.ts`）与权重不变式

在 `registerBuiltInEvaluators()` 内追加两行：

```ts
registerEvaluator(verifiableRatioEvaluator);   // ADDED
registerEvaluator(failOpenCountEvaluator);     // ADDED
```

- 二者 `defaultWeight = 0` → 活跃权重和仍为 1.0（`freedom-suggestions.test.ts` 的不变式不受影响）。
- **与 impact-analysis 的调和**：impact-analysis 把 `evaluator-registry.ts` 列为 MODIFIED；实际注册点是 `registerBuiltInEvaluators()`（位于 `auto-evaluate.ts`），`evaluator-registry.ts` 作为注册表 API **原样消费、无需改动**。本设计据此把真实改动落在 `auto-evaluate.ts`，并在 §4 用 `evaluator-registry 注册断言单测` 覆盖 delta-spec 的 Enforcement 要求（断言「注册名存在 / weight=0 / 权重和不变」三重校验）。

---

### 2.3 L2 — 消费层

#### 2.3.1 `eval --report`（`src/cli/commands/eval.ts`）

```ts
evalCmd.command('run [name]')
  .option('--workspace-path <path>', 'workspace path', '.')
  .option('--verbose', 'show detailed output')
  .option('--report', 'print aggregated eval summary (corpus + A1 + B4 + coverage ref)')
  .option('--json', 'with --report: emit machine-readable JSON')      // ADDED
  .action(async (name, options) => { /* 既有 run 逻辑不变 */ 
      if (options.report) {
        const summary = buildSummaryReport(report, root);           // 见下
        console.log(options.json ? JSON.stringify(summary, null, 2) : renderSummaryText(summary));
      }
  });
```

汇总构造（`buildSummaryReport`，同文件内）：

```ts
export interface EvalSummaryReport {
  version: 1;                       // 冻结契约（Q4-003）
  generatedAt: string;              // ISO 8601
  evals: { total: number; passed: number; failed: number; duration: number };
  corpus: CorpusScenarioReport[];   // 来自 report.corpusReports
  precision: { mustContainSatisfied: number; mustContainTotal: number; ratio: number | null };  // ADDED（BP-12-2，仅展示，不设阈值）
  metrics: {
    'verifiable-ratio': { value: number; weight: number; details: string; rawData?: unknown };
    'fail-open-count':   { value: number; weight: number; details: string; rawData?: unknown };
  };
  coverageRef: { metric: 'vitest-v8'; thresholds: { lines: 95; branches: 95; functions: 95; statements: 95 }; command: string };
}
```

- `metrics` 由**进程内直接调用** `verifiableRatioEvaluator.evaluate(ctx)` 与 `failOpenCountEvaluator.evaluate(ctx)` 得到（`ctx = { projectRoot: root, changeName: <active|''>, roundHistory: [] }`）——只读、无副作用、与 `metrics` 命令同源。
- `precision` 汇总各 corpus 场景的 `mustContainSatisfied/mustContainTotal`（跨场景求和）；**仅展示，不设阈值**（BP-12-2），对 `version:1` 为纯加字段（不改既有字段类型/语义）。
- `coverageRef.thresholds` 取自 `vitest.config.ts` 的 `coverage.thresholds`（四维 95）；`command` 为采集命令字符串（B6「引用」= 指针，不 embed 数值）。
- 文本渲染：四段，corpus 段逐场景打印 `recall=x (n=k, CI=[l,u]) / noise=y / precision=z`，`n<3` 追加「（置信不足）」，`errored>0` 追加「（N errored 已排除分母）」。

**冻结契约（Q4-003）**：JSON 形态自本版起为事实契约；后续只**加字段**、不改既有字段类型/语义。

#### 2.3.2 `.eval-corpus/` 语料库结构与 fixture 命名

```
.eval-corpus/                             # 隐藏目录：findSpecDirs 跳过 name.startsWith('.')（C-4）
  _baseline/                              # 干净基线（必需，唯一）
    .mumuspec/config.yaml                 # 最小项目骨架
    .mumuspec/spec.md                     # 约 20 条约束的干净 spec（0 错 0 警；spec.md 是 coverage 分类器唯一喂入源，见下方骨架要点）
    expected.yaml                         # kind: baseline
  bad-spec-004/                           # 坏样本：_baseline 的单点变异
    .mumuspec/spec.md
    expected.yaml                         # kind: bad-case, severity: error, mustContain: [E-SPEC-004]
  bad-spec-016/                           # …（W 码）
  bad-guard-010/                          # 跨域码：probe: guard, change: <name>
  bad-change-022/                         # 跨域码：probe: archive, change: <name>
  clean-01/ clean-02/ clean-03/           # 净样本（≥2；建议 ≥3 以脱离「置信不足」）
    .mumuspec/spec.md
    expected.yaml                         # kind: clean
```

**骨架要点（实证修订，Task B 实测）**：
- 约束载体必须是 `.mumuspec/spec.md`（或 V2 `tech.md`）——`validatePrdFile` 从不调用 `classifyRequirements`（validator.ts:184/435 仅 `validateSpecMd` / `validateTechFile` 喂分类器），纯 `prd.md` 骨架的 `coverage.total=0`，会使 C-5 的 coverage 五字段 diff 恒等失效、coverage-only kill 用例不成立、E-SPEC-004/015/016 无从触发。`prd.md` 仅在需要 prd 域码（如 E-SPEC-008）时作为附加文件。
- E-SPEC-015 触发条件：SHALL NOT 须位于**无 Enforcement 块的 Requirement**中（Enforcement 块级生效，块内任一条目都会转为 manual，不再触发 015）。
- W-SPEC-016 词表仅中文（合理/适当/必要时/尽量/尽可能/酌情/视情况）；英文措辞不触发。

**命名规则**：`_baseline`（保留名，唯一基线）｜`bad-<domain>-<code>`（如 `bad-spec-004`、`bad-guard-010`、`bad-change-022`）｜`clean-<seq>`。每个 fixture 目录**必须**含 `expected.yaml`；无者不视为 fixture。

**`expected.yaml` schema**：

```yaml
kind: bad-case        # baseline | bad-case | clean
severity: error       # veto | error | warn（bad-case 用；分档）
probe: validate       # validate | check | guard | archive（缺省 validate）
change: some-change   # guard/archive 探针所需（可选）
mustContain: [E-SPEC-004]   # 期望出现的码（recall 精度 ground truth；coverage-only 缺陷留空）
mustNotContain: []          # 必须缺席的码（noise ground truth）
```

**覆盖目标（DS-EVAL-004，BP 裁决方案 A）**：**可发射集 15 码**各至少 1 例 —— `E-SPEC-001/002/003/004/006/008/009/010/011/013/014/015`（12 个）+ `W-SPEC-016`（probe: validate/check）+ `E-GUARD-010`（probe: guard）+ `E-CHANGE-022`（probe: archive）；`E-SPEC-005/007/012` 为 **registered-but-not-emitted**（M1 出范围，对齐 errors.ts 中 E-DESIGN-001/002/009 前例），**不建必须命中语料**。外加 ≥1 净样本。M1 每码 1 例（Q1-008，约 15-18 fixture），n<3 → Wilson 标注「置信不足」，M1 定位为**建档非定标**。

**severity 分档指引**：`veto` = 一票否决/fail-closed 类（如 E-GUARD-010、E-CHANGE-022、严格模式 E-SPEC-015）；`error` = 其余 `E-` 码；`warn` = `W-` 码。分档由语料作者在 `expected.yaml` 显式声明（不硬编码映射，避免双权威源）。

#### 2.3.3 fixture-location 断言（DS-EVAL-004）

新增单测 `tests/eval/fixture-location.test.ts`：在仓库根运行 `validate --json`（或进程内 `validateAllSpecs`），断言 `coverage.total` **不含** `.eval-corpus/` 下的语料条目。以「有语料 vs 无语料」两次 `total` 相等，锁死位置隔离（对照探测 4 的 327→331 污染基线，`tests/fixtures/` 实证被 `findSpecDirs` 递归扫描）。防回归：一旦有人把语料挪进被扫描路径，单测即红。

---

## 3. build_layers（自深至浅）

### Layer 0 — runner 层（先建）

**先建**：`src/eval/corpus.ts`（纯函数：`collectCodes` / `findCoverage` / `diffSignals` / `wilsonInterval` / `makeRatio` / `loadFixtureExpectation` / `PROBE_ARGS`）→ `src/eval/runner.ts`（`EvalScenario`/`EvalResult`/`EvalReport` 扩展、`corpus` 分支、`custom` 修复、`loadScenario` 扩展、`runAllEvals` 收集 `corpusReports`）。
**TDD 用例先行**：`tests/eval/runner.test.ts`（+ 既有 `runner-enhance.test.ts`）先补红——corpus 检出/漏检/errored 三态、多信号（仅码 / 仅 coverage）两态、Wilson n=0 与 n<3、空分母 fail-closed、三条场景 warning、custom 零警告、无 cwd 依赖。

### Layer 1 — 评估器层（后建）

**先建**：`src/core/metrics/verifiable-ratio.ts`、`src/core/metrics/fail-open-count.ts` → `src/core/metrics/auto-evaluate.ts` 注册两行。
**TDD 用例先行**：`tests/core/metrics/verifiable-ratio.test.ts`、`tests/core/metrics/fail-open-count.test.ts`（mock `node:child_process` / 真 audit.log 临时文件）——0/全/部分三态、nullResult 条件、注册三重断言（名字/weight=0/权重和不变）。

### Layer 2 — 消费层（最后建）

**先建**：`src/cli/commands/eval.ts` 的 `--report`（文本 + JSON）；`.eval-corpus/` 全套语料（`_baseline` + bad-case + clean）。
**TDD 用例先行**：`tests/cli/commands/eval-handler.test.ts`（report 文本/JSON 快照、JSON 契约冻结）、`tests/eval/fixture-location.test.ts`（位置隔离）。

依赖链：L0 → L1 → L2（严格单向；L1/L2 均只读消费 L0）。L1 与 L2 之间无反向依赖——L2 通过 import L1 的评估器实例完成 report 聚合。

---

## 4. 测试策略（锁定于 `test-cases/`，供 QA 展开）

> 本节只给**层级与关键验证点**，具体用例由 QA 写入 `test-cases/`。

### L0（runner）
- corpus 检出态：坏样本 fixture 产生新增码 → `killed=true`，recall 计入分子。
- corpus 漏检态：坏样本 fixture 零信号（复现探测 1 的 O1 单条删除/`- XXX` 占位零信号）→ `killed=false`。
- 多信号：`coverage-only` fixture（无码、仅 coverage 五字段变化）→ 仍判 `killed=true`；`code-only` fixture → 亦 `killed=true`；两者证明 diff 是并集。
- Wilson：`n=0`（空 corpus）→ `wilsonInterval=null`、`ratio.value=null`、无异常（**Q4-002**）；`n=2` → `ci.insufficient=true`；`n≥3` → CI 数值符合公式。
- custom：断言通过 / 失败两态 + **零 warning**（DS-EVAL-002）。
- 无 cwd 依赖（**Q4-001**）：在 `process.cwd()` 与被测 fixture **不同**的前提下（测试用 tmp 目录 + 显式 `projectRoot`），corpus 仍能正确定位 fixture；单测断言 `runProbe` 收到的 `cwd` 为绝对 fixture 路径。
- 三态分母排除（**BP-12-1 / D-corpus-5**）：errored fixture（探针 mock 为 spawn 失败或输出不可解析）→ `counts.errored++`、`recall.n === killed + missed`（errored 不在分母）、场景出现「N fixture(s) errored」warning；并断言 errored **未被**计入 `missed`（探针错误 ≠ 漏检）。
- 三条场景 warning（**BP-12-1/3/5**）：errored 列明 / 未声明 `corpusExpect`（report-only 提示）/ 含 `.mumuspec/` 但缺 `expected.yaml` 的子目录列明；三者均**不改变** `passed`。
- 空分母 fail-closed（**BP-12-4 / D-corpus-6**）：声明 `minRecall`（或 `recallBySeverity` / `maxNoise`）但对应有效分母为 0 → `resultErrors`（`passed=false`）；未声明 `corpusExpect` 时不报错（仅 warning）。
- 精度聚合（**BP-12-2**）：`precision.mustContainSatisfied/mustContainTotal/ratio` 正确汇总（全命中 / 部分命中 / 无 mustContain 三类）；无任何阈值断言。

### L1（评估器）
- verifiable-ratio：0 约束（无分母）/ 全 strong / 部分 strong 三态；`rawData` 含四分类计数；缺少 `coverage` → nullResult。
- fail-open-count：全 success（→ 0 非 success，value=1）/ 混合 fail 分组 / 坏行跳过 / audit.log 缺失 → nullResult。
- 注册三重断言：`getEvaluator('verifiable-ratio')` 与 `'fail-open-count'` 存在；`defaultWeight=0`；`registerBuiltInEvaluators()` 后活跃权重和 === 1.0。

### L2（消费层）
- report 文本与 JSON 双形态快照（含 corpus/A1/B4/coverageRef 四段）。
- **Q4-003**：JSON 快照断言 `version===1` 且字段集冻结（新增字段只加不改）。
- 精度聚合字段（**BP-12-2**）：report JSON 含顶层 `precision`（`mustContainSatisfied`/`mustContainTotal`/`ratio`），为纯加字段、`version` 仍为 1。
- fixture-location：仓库根 `coverage.total` 不含 `.eval-corpus/` 条目；有/无语料两次 total 相等（对照 327→331 污染基线）。
- 回归：既有全量测试（含 `runner.test.ts` / `runner-enhance.test.ts` 的 custom 语义）全绿（验收场景 5）。

---

## 5. 风险

| # | 风险 | 兜底 |
|---|---|---|
| R-1（Q4-001） | corpus fixture 运行触发 `findProjectRoot` 向上查找，命中错误根 | `runProbe` 只接受绝对路径作为 cwd；单测断言无 cwd 依赖（§4 L0） |
| R-2（Q4-002） | Wilson CI 在 n=0（空语料目录）除零 | `wilsonInterval` n<=0 返回 null；`ratio.value=null`；空目录记 warning 不抛异常 |
| R-3（Q4-003） | report JSON 被 CI/外部脚本消费，未来扩展破坏兼容 | `version:1` 冻结；只加字段不改性；快照单测锁死 |
| R-4（架构师补充） | `_baseline` 自身不干净 → 所有 coverage-diff 失真 | runner 强校验 `baseline.codes.length===0`，否则 corpus 场景直接报错 fail-fast（禁止静默失真） |
| R-5（架构师补充） | coverage 语义混淆：`validate --json` 的 spec-verifier coverage vs `check --json` 的 runtime coverage | verifiable-ratio 严格取 `validate --json` 顶层 coverage（DS-EVAL-003 明文）；corpus 用通用 `findCoverage` 游走，两种都可被正确提取 |
| R-6（架构师补充） | 每 fixture 一次 spawn，~20 fixture + baseline → 子进程开销（win32 shell 更慢） | 单探针单次 spawn（validate/check 一次即同时产出码与 coverage）；30s timeout；测试 mock spawnSync 不真跑；语料规模 M1 限 15-20 |
| R-7（架构师补充） | 跨域码（E-GUARD-010 / E-CHANGE-022）需构造 change-scoped fixture，成本高于纯 spec 变异 | 探针 + `change` 字段显式声明；覆盖 diff 自动降级为纯码检测（D-corpus-1）；M1 各 1 例建档 |
| R-8（实证，Task B 实测；已裁决） | DS-EVAL-004 曾要求 `E-SPEC-005/007/012` 各 ≥1 例，但三码全仓无发射点（grep 仅命中 errors.ts 注册表 + docs + dist；E-SPEC-007 的 index 检查在 validator.ts 为空实现）→ 建必须命中语料必为零信号（missed），污染 recall/precision | **已裁决（方案 A）**：DS-EVAL-004 收敛为可发射集 15 码；`005/007/012` 标注 registered-but-not-emitted（M1 out of scope），对齐 errors.ts 中 E-DESIGN-001/002/009 前例 |
| R-9（实证，Task B 实测） | 基线/语料若仅用 `prd.md` 承载约束 → `coverage.total=0`，C-5 多信号 diff 与 coverage-only kill 用例失效 | 骨架固定为 `.mumuspec/spec.md`（详见 §2.3.2 骨架要点） |

---

## 6. Fallback F 五角度自审（hyperplan 不可用时的自我审查）

> 每角度 1-3 条洞察，按 hard_constraints / decisions / risks / open_questions 归置。

### ① 层间依赖 / 调用链
- **[hard_constraints]** L0←L1←L2 严格单向，`src/core/**` 不得 import `src/cli/**`（既有 arch-boundaries 不变式）；corpus 编排（`src/eval`）不 import 评估器。
- **[decisions]** L2 的 report 直接进程内调用 L1 两个评估器实例（而非 spawn `mumuspec metrics`），避免二次 spawn 与「自建第二解析通道」；与 `metrics` 命令同源同实现。
- **[risks]** `corpusReport` 同时挂在 `EvalResult.corpus` 与 `EvalReport.corpusReports`，需保证两者引用一致（同一对象，不深拷贝错位）。

### ② 安全（路径注入 / 绝对路径）
- **[hard_constraints]** `probe` 为**白名单枚举**，argv 由 `PROBE_ARGS` 固定模板生成，绝不接受数据文件里的任意命令字符串；spawn 用数组形式（非 shell 拼接），`shell` 仅在 win32 为真（对齐既有评估器）。
- **[decisions]** `corpusDir` 经 `resolve(projectRoot, corpusDir)` 解析后，**fixture 名仅取 `readdirSync` 的直接子目录名**，不接受 `../` 逃逸；`runProbe` 的 cwd 必须是 `corpusDir` 的绝对子路径。
- **[risks]** 语料本身含**故意违规的假 spec**——必须留在 `.eval-corpus/` 隐藏目录（C-4），否则污染 `findSpecDirs` 计量（探测 4 实证）。

### ③ 性能（子进程 spawn 次数 / 语料规模）
- **[decisions]** 每 fixture **单探针单次 spawn**：`validate/check --json` 一次输出即同时含码与 coverage，避免「码一次、coverage 一次」翻倍 spawn；baseline 只跑一次并复用。
- **[risks]** ~20 fixture × 1 spawn ≈ 20 次子进程（win32 经 shell 更慢）；30s timeout 兜底；语料规模 M1 锁定 15-20，不扩样。

### ④ 可维护性（API 稳定性 / 向后兼容）
- **[hard_constraints]** `EvalReport` 既有 `total/passed/failed` 语义不变，新维度全部走可选字段（C-6）；`check`/`validate` 输出 schema 零改动（C-3）。
- **[decisions]** `EvalSummaryReport.version=1` 起冻结，扩展只加字段；评估器 `rawData` 结构自本版固化，供 report 直接透传。
- **[risks]** 评估器数值全部由代码确定性计算，无 LLM / 手写值（DS-EVAL-001/003 的 SHALL NOT）。

### ⑤ 测试（边界 / 异常路径）
- **[decisions]** 纯函数（Wilson/diff/aggregate）与 IO（spawn/fs）分层，纯函数 100% 直测，IO 用 mock `node:child_process` + tmp 目录。
- **[risks/边界]** n=0、n<3、坏 JSON 行、audit.log 缺失、baseline 不干净、空 corpusDir、fixture 缺 expected.yaml —— 逐条在 §4 覆盖。
- **[hard_constraints]** 既有全量回归必须绿（验收场景 5）；`custom` 语义变更需与既有 `runner-enhance.test.ts` 兼容（既有 custom 断言用法本就 assertions-only）。

**归置计数**：hard_constraints = 6；decisions = 7；risks = 7；**open_questions = 0**。

---

## 7. Anything UNCLEAR / 假设（已按 Q1/Q3 收敛，无悬置项）

1. **impact-analysis 的 `evaluator-registry.ts`** —— 判定为「注册表 API 表面」，真实改动落在 `auto-evaluate.ts::registerBuiltInEvaluators()`；已按 delta-spec 的 Enforcement（注册断言单测）闭合（§2.2.3）。依据：既有注册模式与 `metrics` 命令事实源。
2. **corpus fixture 的 `probe` 与跨域码** —— E-GUARD-010 / E-CHANGE-022 不在 validate/check 域内，故以 `probe: guard|archive` + `change` 显式声明，覆盖 diff 自动降级为纯码检测。依据：探测 1 方法论（validate 为主）+ 源码定位（phase-guard.ts:755 / archive.ts:197）。收敛为决策 D-corpus-1。
3. **「测试覆盖率引用」的粒度** —— 判定为**指针**（阈值 + 采集命令），非 embed 数值。依据：Q1-007 仅 stdout、不落盘的产物约束；DS-EVAL-004 用词「引用」。
4. **Wilson 置信水平** —— 固定 95%（DS-EVAL-001 明文「Wilson 95%」），`insufficient` 阈值 n<3（Q1-005/Q1-008）。
5. **`fail-open-count` 的 value 方向** —— 取「越高越健康」（`1 - min(1,count/cap)`）；因 weight=0 不影响 composite，方向仅为可读性选择。依据：constraint-density 的「观测信号」定位。

---

## 8. Architecture Overview

`eval-corpus` 是**纯增量**变更，不引入新依赖、不改既有命令的 JSON schema，全部能力以三层**严格单向依赖**（L0 runner → L1 评估器 → L2 消费层，见 §2.0）叠加在既有 `eval` / `metrics` 体系之上：

```
L2 消费层  src/cli/commands/eval.ts（--report）  +  .eval-corpus/  +  tests/eval/fixture-location.test.ts
             │ 只读消费
             ▼
L1 评估器层 src/core/metrics/verifiable-ratio.ts · fail-open-count.ts · auto-evaluate.ts（registerBuiltInEvaluators 追加两行，weight=0）
             │ 只读消费
             ▼
L0 runner 层 src/eval/runner.ts（corpus 分支 + custom 修复）  +  src/eval/corpus.ts（纯函数）
```

**新增/改动模块清单**

| 层 | 文件 | 新增/改动 | 职责 |
|---|---|---|---|
| L0 | `src/eval/corpus.ts` | 新增 | 纯函数：`collectCodes` / `findCoverage` / `diffSignals` / `wilsonInterval` / `makeRatio` / `loadFixtureExpectation` / `PROBE_ARGS` |
| L0 | `src/eval/runner.ts` | 改动 | `EvalScenario` 扩展（`corpusDir`/`corpusExpect`）、`corpus` 分支、`custom` 修复、`EvalResult.corpus`、`EvalReport.corpusReports`、`loadScenario` 扩展 |
| L1 | `src/core/metrics/verifiable-ratio.ts` | 新增 | A1 可验证率评估器（weight=0） |
| L1 | `src/core/metrics/fail-open-count.ts` | 新增 | B4 fail-open 计数评估器（weight=0） |
| L1 | `src/core/metrics/auto-evaluate.ts` | 改动 | `registerBuiltInEvaluators()` 追加两行注册 |
| L2 | `src/cli/commands/eval.ts` | 改动 | `eval run --report [--json]` 汇总出口 |
| L2 | `.eval-corpus/` | 新增 | 语料库（`_baseline` + bad-case + clean，含各自 `expected.yaml`） |
| L2 | `tests/eval/runner.test.ts` | 改动 | corpus / custom 单测 |
| L2 | `tests/eval/fixture-location.test.ts` | 新增 | 语料位置隔离断言 |
| L2 | `tests/core/metrics/verifiable-ratio.test.ts` | 新增 | A1 三态单测 |
| L2 | `tests/core/metrics/fail-open-count.test.ts` | 新增 | B4 分组计数单测 |
| L2 | `tests/cli/commands/eval-handler.test.ts` | 改动 | report 文本/JSON 快照 |

**与既有体系的关系**：`corpus` 是 `eval` runner 的**第 5 类场景**（与 `compliance`/`drift`/`phase-guard`/`custom` 并列），产出走 `EvalResult.corpus` 新维度，不动既有场景结构；两个评估器经 `registerBuiltInEvaluators()` 与既有 6 个内建评估器同源注册，因 `defaultWeight=0` 而不进 loop composite（权重和仍 1.0）。`--report` 仅 **stdout**（不落盘），并在进程内直接调用两个评估器实例（与 `mumuspec metrics` 命令同源同实现），不与既有 `check`/`validate` 输出 schema 争权。

---

## 9. Data Flow

### 9.1 corpus 场景主链路（L2 → L0）

```
eval run --report
  → runAllEvals(projectRoot)                       # 既有编排
      → discoverScenarios → loadScenario(each)     # 解析 type=corpus / corpusDir / corpusExpect
      → runScenario(scenario)  [case 'corpus']
          → 枚举 corpusDir 直接子目录（hasMumu && hasExpected 视为 fixture；orphan 目录记 warning）
          → runProbe(corpusDir/_baseline)   → FixtureSignals{ codes, coverage }
          → for each bad-case fixture:
                runProbe(absFixturePath)    → FixtureSignals
                collectCodes(parsed) ∪ regexCodes(stdout+stderr)
                findCoverage(parsed)                     # validate 顶层 / check 的 compliance.coverage
                errored ? counts.errored++  :  diffSignals(baseline, sig)  → killed / missed
          → for each clean fixture:
                runProbe(absFixturePath)    → errored ? 记 errored : falsePositive = codes.length > 0
          → 聚合（三态）: makeRatio(killed, killed + missed)   +  recallBySeverity[veto|error|warn]
                  makeRatio(Σfp, nCleanEffective)          # errored 排除分母（D-corpus-5）
                  wilsonInterval(successes, n)              # n<3 → insufficient
                  precision = { mustContainSatisfied, mustContainTotal, ratio }
          → 断言：未声明 corpusExpect → report-only warning（P1）；已声明阈值分母=0 → resultErrors（fail-closed，D-corpus-6）
          → 场景 warning：errored 列明（BP-12-1）/ orphan 目录列明（P5）
          → EvalResult.corpus = CorpusScenarioReport
      → EvalReport.corpusReports = [ ...各 corpus 场景报告... ]
  → buildSummaryReport(report, root)                # 进程内直调 L1 两评估器
      → verifiableRatioEvaluator.evaluate(ctx)      → metrics['verifiable-ratio']
      → failOpenCountEvaluator.evaluate(ctx)        → metrics['fail-open-count']
      → EvalSummaryReport{ version:1, evals, corpus, precision, metrics, coverageRef }
  → stdout（文本 或 --json），不落盘
```

### 9.2 L1 评估器数据源与调用路径

| 评估器 | 数据源 | 调用路径 | 产物 |
|---|---|---|---|
| `verifiable-ratio` | `npx mumuspec validate --json` 顶层 `coverage`（字段契约 Q1-006） | `--report` 进程内 `.evaluate(ctx)`；`mumuspec metrics` 经 `collectMetrics` 同一实例 | `value = strong_ratio`；`rawData` 含四分类计数 |
| `fail-open-count` | `.mumuspec/audit.log`（JSONL）中 `result !== 'success'` 条目 | 同上 | 按 `action` 分组的计数与清单；`value = 1 - min(1, count/10)` |

**方向约束**：数据自 L0 流向 L2（只读），L2 不写回 L0/L1；`corpus` 覆盖 diff 的参照系恒为 `_baseline`（§9.1），L1 两个评估器与 corpus 无数据耦合（各自独立数据源）。

---

## 10. Error Specification

| # | 条件 | 表现 | 处置 | 依据 |
|---|---|---|---|---|
| E-1 | `corpusDir` 不存在 | 无法枚举 fixture | `resultErrors.push('corpus dir not found: <path>')`，场景 `passed=false`，不进入后续步骤 | 防御性；Q4-001（路径显式解析） |
| E-2 | `corpusDir` 为空目录（fixture 集为空） | 无 fixture | 记 `warning('corpus dir empty')`，`recall.value=null` / `noise.value=null` / `ci=null`，**不抛异常**；若同时声明了 `corpusExpect` 阈值 → 由 E-18 转 resultErrors（fail-closed） | Q4-002 / BP-12-4 |
| E-3 | 缺 `_baseline` fixture | 无覆盖 diff 参照系 | `resultErrors.push('corpus requires _baseline fixture')`，**fail-fast** 返回 | R-4 / D-corpus-1（禁止静默失真）|
| E-4 | `_baseline` 不干净（产生码） | 基线非零，diff 失真 | `resultErrors.push('baseline must be clean but produced codes: ...')`，**fail-fast** | R-4 |
| E-5 | 子目录含 `.mumuspec/` 但缺 `expected.yaml` | 无法判定 ground truth | 记为 orphan 目录，**不视为 fixture**、不进任何分母；场景 `warning('M subdir(s) with .mumuspec but no expected.yaml (excluded): ...')` 列明数量（P5 / D-corpus-8）；既无 `.mumuspec/` 也无 `expected.yaml` 的子目录静默跳过 | §2.3.2 / BP-12-5 |
| E-6 | Wilson `n=0` | 0/0 除零 | `wilsonInterval` 返回 `null`；`RatioReport.value=null` | Q4-002 / §2.1.0 |
| E-7 | Wilson `n<3` | 样本不足以定标 | 正常计算 CI 但置 `ci.insufficient=true`，报告标注「置信不足」 | Q1-005 / Q1-008 |
| E-8 | 探针 `spawnSync` 报错 | 命令无法启动 | 该 fixture 记 **errored**（`counts.errored++`、`erroredFixtures.push`、`errors.push('probe failed to start: ...')`），**不进 recall 分母**；评估器侧则 `nullResult`（`weight=0`, `value=0`, 标注 `metric skipped`）| BP-12-1 / D-corpus-5 / R-6 |
| E-9 | 探针超时（>30s） | 子进程被 kill，status 非 0 | 同 E-8：fixture 记 **errored**（不进分母）；评估器 `nullResult('... failed to start / no JSON')` | BP-12-1 / D-corpus-5 / R-6 |
| E-10 | 探针输出不可解析（无 JSON，且 regex 兜底后仍无码、无 coverage） | 无可用信号 | 该 fixture 记 **errored**（不进分母）；若仅 JSON 缺失但 regex 从 stderr 捕到码，则按正常信号处理（covered by E-12 降级）；评估器侧 `nullResult('... produced no JSON output')` | BP-12-1 / D-corpus-5 / R-5 |
| E-11 | `audit.log` 缺失或完全为空 | 无数据源 | `fail-open-count` → `nullResult('audit.log not found' / 'audit.log is empty')`（**零非 success 条目 ≠ null**，为健康态 value=1） | §2.2.2 / D-eval-1 |
| E-12 | 覆盖 diff 不可比（单侧 `coverage=null`） | 探针未输出 coverage（如 guard/archive） | `changedCoverageFields=[]`，检测**自动降级为纯码信号** | D-corpus-1 / R-5 |
| E-13 | fixture `expected.yaml` 坏行/字段非法 | 解析异常 | `loadFixtureExpectation` 跳过坏行、缺省补齐（`probe='validate'`、码清单空）；不抛异常 | §2.1.0（容错解析）|
| E-14 | `validate` 无 `coverage` 或 `total<=0` | 无分母 | `verifiable-ratio` → `nullResult('validate coverage.total unavailable')` | Q1-006 / §2.2.1 |
| E-15 | 探针启动失败或输出不可解析的 fixture | 衡量器故障（非被测对象缺陷） | 记 **errored 三态**：`counts.errored++`、`erroredFixtures.push`；**不进 recall 分母**（分母 = killed + missed）；场景 `warning('N fixture(s) errored (excluded from recall denominator): ...')` 列明 | BP-12-1 / D-corpus-5 / R-6 |
| E-16 | 探针错误被误计为漏检 | 静默污染召回口径 | **禁止**：errored 与 missed 严格分离（missed 仅在探针成功返回且零信号时计）；单测断言 errored 不计入 `missed` | BP-12-1 / D-corpus-5（SHALL NOT）|
| E-17 | 场景未声明 `corpusExpect` | 恒 `passed=true` 可能被误读为达标 | 场景 `warning('corpusExpect not declared — report-only mode')`；**不改变 `passed` 语义** | BP-12-3 / D-corpus-7 |
| E-18 | 已声明聚合阈值（`minRecall` / `recallBySeverity[.*]` / `maxNoise`）对应分母为 0 | 配置错误（无法评估） | 一律 `resultErrors.push('empty denominator for <field> — configuration error')`，场景 `passed=false`（fail-closed）；统一三阈值处置，消除 maxNoise 静默跳过 | BP-12-4 / D-corpus-6 |
| E-19 | `corpusDir` 下含 `.mumuspec/` 但缺 `expected.yaml` 的子目录 | 分母可能静默缩水 | 记为 orphan，不进任何分母；场景 `warning('M subdir(s) with .mumuspec but no expected.yaml (excluded): ...')` 列明数量 | BP-12-5 / D-corpus-8 |
| E-20 | 聚合精度（`mustContainSatisfied` 比率） | 仅观测信号 | 汇总进 `CorpusScenarioReport.precision` 与 `EvalSummaryReport.precision`，**仅展示、不设阈值、不参与任何断言** | BP-12-2 |

> 处置语义统一：**warning** = 不阻断、计入细节、不改 `passed`；**resultErrors** = 只影响该场景 `passed`（不崩进程）；**fail-fast** = corpus 场景立即返回并报错（避免失真结论）；**errored** = fixture 级三态，探针未产出可用信号，排除出分母；**nullResult** = 评估器 `weight=0 / value=0 / `metric skipped``，不参与 composite。
