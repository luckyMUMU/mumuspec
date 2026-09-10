# Delta Spec: 自由度度量回路接通

分析见 `review/middleware-positioning-evaluation-2026-09-10.md`。

## Requirement: advisory 建议必须抵达消费者

`buildSuggestions()` 产出的约束强度调整建议必须进入可被人与 agent 读取的输出面，
不得在环节转换处被静默丢弃。

### SHALL

- `LoopEvaluation` SHALL 保留 `suggestions` 字段，由 `autoEvaluate()` 结果直传，不得在转换层丢弃。
- `MetricsSnapshot` SHALL 持久化当轮 `suggestions`，保证历史轮次建议可追溯。
- `mumuspec loop evaluate` SHALL 在建议非空时打印建议段，并标注"须人工签收后生效"。
- 建议 SHALL 经 CLI 写入变更 decisions.md 的 advisory 条目（`mumuspec decisions append`），不手工编辑。

### SHALL NOT

- SHALL NOT 存在产出物无消费者的死端（产出物与消费面必须同批交付）。
- SHALL NOT 自动应用建议——`constraint_strength` 配置不得被建议逻辑改写（红线 bp_04 同源）。

### Enforcement

- ENF-1: enforced-strong(单元测试：构造含建议的评估结果，断言 LoopEvaluation.suggestions 非空且与输入一致)
- ENF-2: enforced-strong(单元测试：断言 metrics snapshot 保留 suggestions；配置文件字节不变)

## Requirement: 自由度信号在非 loop 路径可达

goal.md 北极星指标"Design→Build 一次通过率 ≥ 80%"对全项目生效，
其度量不得只在 loop 工作流可计算。

### SHALL

- 新增只读命令 `mumuspec metrics [change] [--json]`，在任意工作流（含 full）下计算并展示指标与建议。
- 该命令 SHALL 复用既有 `Evaluator` 接口与 `evaluator-registry`，不得另建一套度量实现。
- 命令 SHALL 为纯只读：不写变更状态工件、不触发阶段转换、可安全重复执行。

### SHALL NOT

- SHALL NOT 使自由度指标仅在 loop 工作流可计算。
- SHALL NOT 因新增命令而改变既有 `loop evaluate` 的收敛语义（composite 权重与阈值不动）。

### Enforcement

- ENF-3: enforced-strong(单元测试：非 loop 变更下 `metrics` 返回约束密度与一次通过率两项)
- ENF-4: enforced-strong(单元测试：执行 `metrics` 后变更 state 文件字节不变)

## Requirement: 信号进入 agent 契约面

agent 必须能读取自由度信号，而非仅由引擎内部消费。

### SHALL

- `mumuspec metrics --json` SHALL 输出结构化字段（`metrics[]` 含 name / value / details，`suggestions[]`）供 agent 解析。
- AGENTS.md 速查 SHALL 含该入口，由命令注册表注入（单一事实源），随新增命令自动出现。

### SHALL NOT

- SHALL NOT 在 AGENTS.md 中内联指标数据（渐进式披露职责归命令与 MCP，Rules 文件受 32KiB 预算约束）。

### Enforcement

- ENF-5: enforced-strong(单元测试：`--json` 输出可解析且字段完整)
- ENF-6: enforced-weak(实跑断言：AGENTS.md 速查含 metrics 条目，全文 ≤ 32KiB)

## Requirement: 元数据事实源对齐

中间层自身的事实源不得漂移——进度类元数据同样需要一致性锁定。

### SHALL

- `docs/STATUS.md` 声明的当前包版本 SHALL 与 `package.json` 的 version 一致。
- `.mumuspec/config.yaml` 的 `ai.rules_files` SHALL NOT 含已停止生成的遗留目标（`.cursorrules` / `.windsurfrules`）。

### SHALL NOT

- SHALL NOT 以"下游硬过滤兜底"替代事实源自身干净（兜底是防线，不是许可）。

### Enforcement

- ENF-7: enforced-strong(单元测试：断言 STATUS.md 当前包版本字符串等于 package.json version)
- ENF-8: enforced-strong(单元测试：断言 config.yaml ai.rules_files 不含遗留目标)
