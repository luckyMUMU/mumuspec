# Proposal: loop-auto-evaluate (R-0002)

## Why

当前 Loop 模式的收敛判断完全依赖人工输入 `progress` 和 `goal_achieved`，缺乏自动化指标驱动的收敛判断能力。这导致：
1. 用户需要手动评估每轮进展，增加认知负担
2. 收敛判断主观性强，不同标准不一致
3. 无法利用历史数据优化收敛策略

DGM（Sakana AI）通过经验验证在 SWE-bench 实现 20%→50% 跃升的核心就是自动化收敛判断。R-0003（AST Guard）已交付语义级约束检测能力，为"drift score"和"spec compliance rate"提供技术基础。

## What

### 核心交付
- **指标采集模块** (`src/core/metrics/`) — test pass rate、drift score、spec compliance rate、code delta ratio
- **`auto-evaluate` 模式** — 基于指标阈值自动判断收敛（替代人工 goal_achieved 输入）
- **`hybrid-evaluate` 模式** — 客观指标为主（70% 权重）+ 人工确认为辅（30% 权重）
- **评估报告 HTML 导出** — 每轮指标变化趋势可视化
- **与 `detectStagnation()` 深度整合** — 自动回退机制

### 不包含
- 基于 LLM-as-Judge 的主观质量评估（过于主观，不稳定）
- 跨变更基准对比（需要数据积累，留作后续）
- 完全无人值守的 CI/CD 自动化循环（长期愿景）

## Impact Scope

### 修改文件
- `src/core/loop-engine.ts` — 扩展 Loop 执行引擎，添加自动评估分支
- `src/cli/commands/loop.ts` — 添加 `--auto-evaluate` 和 `--hybrid-evaluate` flag

### 新建文件
- `src/core/metrics/evaluator.ts` — Evaluator 接口 + 注册表
- `src/core/metrics/test-pass-rate.ts` — 测试通过率采集器
- `src/core/metrics/drift-score.ts` — 基于 AST Guard 的漂移分数
- `src/core/metrics/spec-compliance.ts` — 规范合规率采集器
- `src/core/metrics/code-delta.ts` — 代码变更比率采集器
- `src/core/metrics/html-reporter.ts` — HTML 报告生成
- `tests/core/metrics/` — 测试目录

### 依赖
- R-0003 AST Guard（已完成）— `checkAstViolation()` 语义分析能力

## Capacity Estimate

`capacity_cost`: 5（≈ 10-15 人天）

| 子任务 | 预估（人天） |
|--------|-------------|
| 指标采集模块（含 AST-based drift） | 3 |
| 自动收敛判断器 | 3 |
| HTML 报告生成 | 2 |
| hybrid 模式加权逻辑 | 2 |
| 与 detectStagnation 整合 | 2 |
| 测试 + 文档 | 3 |

---

> 关联: depends_on [R-0003 ✅] | supersedes R-0007 | capacity_cost: 5
