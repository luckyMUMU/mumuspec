# Design: 自由度最小度量回路

设计策略：自上而下。四层：采集层（两个新 evaluator）→ 注册/权重层 → 建议层（advisory 反哺）→ 测试层。

## 1. 决策层（关键语义裁决）

### D1: constraint-density 不参与收敛 composite

框架 `autoEvaluate` 对 weight > 0 的指标归一化并计入 progress。约束密度是**调节信号**而非进度信号：若计入 composite，高密度会拉低 progress，perversely 激励 loop 删减 Spec。故裁决：

- `constraint-density.defaultWeight = 0`：仍被采集（进入 `AutoEvaluateResult.metrics`，details/rawData 可观测），但被 `weight > 0` 过滤器排除在 composite 之外。
- 自由度语义：value = 归一化约束密度（0=无约束，1=最大密度），密度越低自由度越大。

### D2: design-build-first-pass 参与收敛 composite（defaultWeight 0.20）

一次通过率是真实质量信号（goal.md 北极星），与 test-pass-rate 同类，纳入 composite。权重表显式重排使和为 1：

| evaluator | 旧权重 | 新权重 |
|---|---|---|
| test-pass-rate | 0.35 | 0.30 |
| drift-score | 0.25 | 0.20 |
| spec-compliance | 0.25 | 0.20 |
| code-delta | 0.15 | 0.10 |
| design-build-first-pass | — | 0.20 |
| constraint-density | — | 0（不参与） |

（框架最终会归一化，此处显式归一以便人工审查直观。）

### D3: 建议阈值常量化（YAGNI）

- first-pass 目标 0.8（goal.md）；放宽线：first-pass < 0.8 且 density > 0.7；收紧线：first-pass ≥ 0.9 且 density < 0.3。
- 阈值为模块内常量并透出 rawData；不做配置项，待有真实调节需求再外化。

### D4: 建议仅进 AutoEvaluateResult，不改 html-reporter

`AutoEvaluateResult` 新增 `suggestions: string[]`。JSON/文本输出自然携带；html-reporter 不动（范围控制，后续单列）。

## 2. 采集层

### 2.1 constraint-density（src/core/metrics/constraint-density.ts）

- 数据源：spawn `mumuspec context <scope> --json`，解析 layers[].tech.requirements[] 统计 SHALL 与 SHALL NOT 条目数（与 spec-compliance 同一 CLI-first spawn 纪律——架构边界不变量：src/core 禁止相对导入上层域，故不能进程内调用 loadSpecContext）。
- 纯函数 `extractConstraintCounts` / `normalizeDensity` 导出直测；spawn 用 vi.mock 单测。
- 归一化：`value = min(1, count / DENSITY_CAP)`，DENSITY_CAP = 150（经验上限，防止单点爆表；rawData 记录原始 count）。
- scope 来源：读变更 `.mumuspec.yaml` 的 `affected_scopes`（路径计算留在 core 内），空则退化为项目根 `.`。
- 失败路径：context 命令失败 / 无 JSON / 零约束 → nullResult（遵循 spec-compliance 的"不假设满分"纪律）。

### 2.2 design-build-first-pass（src/core/metrics/design-build-first-pass.ts）

- 数据源：遍历 `.mumuspec/changes/archive/*/.mumuspec.yaml` 与 `.mumuspec/changes/*/.mumuspec.yaml`（活跃变更），解析 `rollback_count` / `rebuild_count`。以**存在 .mumuspec.yaml 为准**，不依赖目录命名（含 discarded 等特殊目录自动跳过）。
- 计算：`firstPass = count(rollback_count==0 && rebuild_count==0)`；`value = firstPass / total`；rawData = { firstPass, total, sampleChanges: total }。
- total = 0（无任何变更）→ nullResult（不虚构 100%）。
- YAML 解析：复用项目既有 yaml 依赖（Ponytail L5），禁止引入新依赖。

## 3. 注册/权重层

- `registerBuiltInEvaluators()`（auto-evaluate.ts）追加两个注册。
- `DEFAULT_EVALUATOR_WEIGHTS`（types.ts）按 D2 重排。
- 两个 evaluator 取数均为进程外 CLI spawn / 本地文件读取，无对上层域（spec/change）的进程内导入（架构边界不变量）。

## 4. 建议层（advisory 反哺）

`autoEvaluate` 第 5 步后新增 `buildSuggestions(metrics): string[]`：

- 按 name 查找本轮 constraint-density 与 design-build-first-pass 的 MetricResult；任一缺失则不产出对应建议（禁止引用 stale 数值）。
- 规则（D3 阈值）：
  - 放宽建议：`一次通过率 {x} 低于目标 0.8 且约束密度 {y} 高于 0.7 → 建议评估放宽约束强度（须人工签收后生效）`
  - 收紧建议：`一次通过率 {x} 达标且约束密度 {y} 低于 0.3 → 建议评估收紧约束强度（须人工签收后生效）`
- 建议文本必须内插本轮数值（ENF-3：禁止绕过 evaluator 采样）。
- 不修改 constraint_strength 配置——无写文件逻辑，静态断言守护。

## 5. 测试层（TDD，红→绿）

| 测试 | 夹具 | 断言 |
|---|---|---|
| constraint-density.test.ts | tmp 规范链（已知条目数） | count / value / weight=0 / rawData 明细 |
| design-build-first-pass.test.ts | tmp changes 目录（含/不含 rollback 记录、空集） | 占比 / 样本量 / 空集 nullResult / 不依赖目录名 |
| auto-evaluate-suggestions.test.ts | 低通过+高密度 / 高通过+低密度 / 指标缺失 | 建议含"放宽"/"收紧"且含数值 / 无建议；配置文件字节不变 |
| 既有 auto-evaluate 测试 | — | 权重重排后归一化语义回归 |

## 6. 不做清单（YAGNI 边界）

- 不新增 CLI 命令（度量经既有 loop 命令触发）
- 不改 phase-guard / 状态机 / html-reporter
- 不做阈值配置化 / 不做历史趋势存储（history 机制已有）
- 不做 constraint_strength 自动调节（红线：无签收不放行）
