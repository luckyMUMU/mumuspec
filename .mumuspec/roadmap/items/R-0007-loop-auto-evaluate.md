---
id: "R-0007"
title: "Loop 自动化评估：从人工收敛判断到客观指标驱动"
status: planning
priority: P0
scope: "src/core/loop, src/cli/commands"
created_at: "2026-08-06"
target_date: "2026-09-30"
owner: ""
depends_on: ["R-0001", "R-0002"]
mutex_with: []
excludes: []
capacity_cost: 4
---

# R-0007: Loop 自动化评估

## 背景

> 当前 Loop 模式收敛判断完全依赖人工输入 LoopEvaluation.progress 和 goal_achieved，
> 缺乏 DGM（Sakana AI）式的自动化 benchmark 评估能力。
> 调研发现：DGM 通过经验验证在 SWE-bench 上实现 20%→50% 跃升的核心原因就是自动化收敛判断。
> Loop 模式若要脱离"人类辅助"升级为"半自动化收敛"，必须补齐评估自动化短板。

## 范围

### 包含（Includes）
- 评估指标体系定义：test pass rate、drift score、spec compliance rate、code delta ratio
- `auto-evaluate` Loop 模式：收敛判断基于指标阈值而非人工确认
- `hybrid-evaluate` 模式：客观指标为主 + 人工确认为辅的加权判断
- 评估报告 HTML 导出（每轮指标变化可视化）
- 与现有 `detectStagnation()` 机制的整合

### 不包含（Excludes）
- 基于 LLM-as-Judge 的质量评估（过于主观）
- 跨变更基准对比（需要数据积累）
- 完全无人值守的 CI/CD 自动化循环（留作长期愿景）

## 验收标准（DoD）

| # | 验收条件 | 验证方法 |
|---|---------|---------|
| 1 | `mumuspec loop --auto-evaluate` 基于客观指标自动判断收敛 | 给定指标阈值后 3 轮内宣布完成 |
| 2 | 客观指标全部达标且连续 3 轮无 drift 时自动收敛 | 连续 3 轮达标后 progress=1.0 |
| 3 | `hybrid-evaluate` 模式下人工仍可覆盖自动判断 | 人工设置 goal_achieved=true 立即收敛 |
| 4 | 评估报告包含每轮指标趋势 | HTML 文件包含 test/drift/compliance 图表 |
| 5 | 至少 5 个单元测试覆盖评估逻辑 | vitest 测试通过 |

## 工作量预估

`capacity_cost`: 4（≈ 8-12 人天）

| 子任务 | 预估（人天） |
|--------|-------------|
| 指标采集模块 | 2 |
| 自动收敛判断器 | 3 |
| 评估报告生成（HTML） | 2 |
| hybrid 模式加权逻辑 | 2 |
| 测试 + 文档 | 3 |

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 指标阈值过松导致虚假收敛 | 中 | 高 | 保守初始阈值 + 允许用户微调 |
| 指标采集性能开销过大 | 低 | 中 | 异步采集 + 按需启用 |
| 与现有 Rollback 机制冲突 | 低 | 高 | 自动化评估触发的回走也走标准 Rollback 流程 |

---

> **关联**: depends_on [R-0001, R-0002] | mutex_with [] | excludes [LLM-as-Judge, 全无人值守]
