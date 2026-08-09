# Tasks: loop-auto-evaluate (R-0002)

## Test Cases (TC-01 ~ TC-10)

| ID | 测试用例 | 覆盖目标 |
|----|---------|---------|
| TC-01 | TestPassRateEvaluator 解析 vitest JSON 输出 | test-pass-rate.ts |
| TC-02 | DriftScoreEvaluator 调用 AST Guard 计算漂移 | drift-score.ts |
| TC-03 | SpecComplianceEvaluator 统计合规率 | spec-compliance.ts |
| TC-04 | CodeDeltaEvaluator 计算变更收敛度 | code-delta.ts |
| TC-05 | 加权计算：4 个指标权重归一化 | auto-evaluate.ts |
| TC-06 | 收敛判断：连续 3 轮 ≥ 0.85 触发 converged | auto-evaluate.ts |
| TC-07 | 降级：全部 Evaluator 失败时 fallback manual | auto-evaluate.ts |
| TC-08 | 权重动态调整：缺失指标权重重分配 | auto-evaluate.ts |
| TC-09 | HTML 报告生成：包含趋势图数据 | html-reporter.ts |
| TC-10 | CLI --auto flag 正确传递给 evaluateRound | loop.ts |

## Implementation Tasks

- [ ] T-001: 创建 `src/core/metrics/types.ts` — Evaluator 接口 + 类型定义
- [ ] T-002: 创建 `src/core/metrics/evaluator-registry.ts` — 注册中心
- [ ] T-003: 实现 4 个 Evaluator (test-pass-rate, drift-score, spec-compliance, code-delta)
- [ ] T-004: 实现 `auto-evaluate.ts` — 加权编排 + 收敛判断
- [ ] T-005: 修改 `loop-engine.ts` — 集成 auto/hybrid 分支
- [ ] T-006: 修改 `types-loop.ts` — 增加 evaluate_mode 字段
- [ ] T-007: 修改 `loop.ts` CLI — 增加 --auto / --hybrid flag
- [ ] T-008: 实现 `html-reporter.ts` — HTML 报告生成
- [ ] T-009: 编写测试用例 (≥ 8 个)
- [ ] T-010: 运行 guard + 修复问题 + 归档
