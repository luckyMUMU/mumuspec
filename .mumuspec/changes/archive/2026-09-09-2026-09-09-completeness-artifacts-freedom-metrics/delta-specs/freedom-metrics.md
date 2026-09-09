# Delta Spec: 自由度最小度量回路

## Requirement: 约束密度度量

auto-evaluate 框架必须能度量变更影响域的约束密度，作为实现自由度的代理指标。

### SHALL

- 新增 `constraint-density` evaluator，实现既有 Evaluator 接口（name / defaultWeight / evaluate）。
- 统计范围：活跃变更影响域命中规范链中 SHALL 与 SHALL NOT 条目总数，按目录层深归一化到 [0,1]。
- 注册进 evaluator-registry 并在 metrics types 权重表中登记默认权重。

### SHALL NOT

- SHALL NOT 将约束密度直接判定为"好/坏"质量分（密度是调节信号，质量判定归 spec-compliance / drift-score）。

### Enforcement

- ENF-1: enforced-strong(单元测试：给定固定规范链输入，断言归一化值与 rawData 明细)

## Requirement: Design→Build 一次通过率追踪

goal.md 北极星指标"Design→Build 一次通过率 ≥ 80%"必须有客观采集通道。

### SHALL

- 新增 `design-build-first-pass` evaluator：扫描归档与活跃变更的 state 工件，统计 rollback_count = 0 且 rebuild_count = 0 的变更占比，归一化 [0,1]。
- 指标仅由 CLI 代码从 state 工件推导，附带样本量（变更数）写入 rawData。

### SHALL NOT

- 禁止 LLM 自行计算或手写该指标值（与 hash 类字段同一纪律：确定性推导归代码）。

### Enforcement

- ENF-2: enforced-strong(单元测试：构造含/不含 rollback 记录的变更目录夹具，断言占比与样本量)

## Requirement: 反哺建议（advisory）

度量结果必须回流为约束强度调节建议，形成最小闭环。

### SHALL

- auto-evaluate 汇总时在报告中输出约束强度调整建议段：一次通过率低于目标（< 0.8）且约束密度高于阈值 → 建议评估放宽；反之建议评估收紧。
- 建议仅以 advisory 文本进入报告与 decisions 建议条目，标注"需人工签收后生效"。

### SHALL NOT

- 禁止自动修改 constraint_strength 配置（无人工签收不放行，红线 bp_04 同源）。
- 禁止建议逻辑绕过 evaluator 结果自行采样（建议必须引用本轮 metric 数值）。

### Enforcement

- ENF-3: enforced-strong(单元测试：低通过率+高密度夹具 → 断言建议文本含"放宽"；配置文件字节不变断言)
