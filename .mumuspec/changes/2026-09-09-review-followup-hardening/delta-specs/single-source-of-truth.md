# Delta Spec: 二评遗留硬化（单一真相）

## Requirement: 评估器权重单一权威源

内置评估器权重必须只有一处定义，消除 map 与 defaultWeight 双源漂移。

### SHALL

- 删除 `DEFAULT_EVALUATOR_WEIGHTS` 导出常量（src/core/metrics/types.ts），确认全仓零消费者后移除。
- evaluator `defaultWeight` 属性为唯一权威源（auto-evaluate 经 MetricResult.weight 消费，现状即如此）。
- 新增不变量测试：所有内置活跃评估器（defaultWeight > 0）的权重之和 = 1（容差 1e-9）；weight=0 的调节信号（constraint-density）不参与求和但必须存在且为 0。

### SHALL NOT

- SHALL NOT 在 types.ts 或任何共享模块中保留可与之漂移的权重副本。
- SHALL NOT 引入运行时从注册表动态推导 map 的机制（评估器集合可变，动态推导无稳定语义）。

### Enforcement

- ENF-1: enforced-strong(单元测试：遍历 registerBuiltInEvaluators 后的注册表，断言权重和与调节信号存在性)

## Requirement: archive 幂等化

归档操作在部分失败后重试不得产生重复副作用。

### SHALL

- `archiveChange` 步骤顺序调整为：spec 合并/校验等只读或可重入步骤 → 目录 rename（成功即归档事实成立）→ 版本 bump / CHANGELOG / 知识提取等可观测副作用。
- `renameSync` 失败（EPERM/EXDEV）时降级为 copy+delete 回退，回退成功视为 rename 成功。
- 版本 bump 幂等：同一变更重复归档调用只 bump 一次（以变更目录内幂等标记或版本归属判定），CHANGELOG 单变更单条目。

### SHALL NOT

- SHALL NOT 在 rename 前执行版本 bump、CHANGELOG 写入、知识提取等一次性副作用。
- SHALL NOT 用 try/catch 吞掉副作用失败（失败必须中断并留 audit 记录）。

### Enforcement

- ENF-2: enforced-strong(单元测试：构造 rename 失败夹具（占用目标路径），断言版本号未被 bump 且 audit 有记录；重试成功路径断言仅 bump 一次)

## Requirement: 模块注册判定标准统一

index_drift 检查与 index 构建必须采用同一模块判定标准。

### SHALL

- 判定标准统一为："目录含 `.mumuspec` 且 `.mumuspec` 内存在 prd.md 或 tech.md"。
- checker（src/guard/checker.ts index_drift 检测）与 rebuildIndexYaml（finalize-archive）双方按此标准对齐，实现上以共享的判定函数为准（禁止两处各写一份判定逻辑）。

### SHALL NOT

- SHALL NOT 仅以 `.mumuspec` 存在性判定模块（BOUNDARY-only 目录不是已注册模块）。
- SHALL NOT 在 checker 与 builder 中保留语义不一致的独立实现。

### Enforcement

- ENF-3: enforced-strong(单元测试：BOUNDARY-only 夹具目录 → checker 不再报 index_drift 且 builder 不收录；含 prd.md 夹具 → 双方均收录)
