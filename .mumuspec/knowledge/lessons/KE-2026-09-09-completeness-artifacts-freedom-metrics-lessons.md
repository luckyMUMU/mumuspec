---
id: KE-2026-09-09-completeness-artifacts-freedom-metrics-lessons
title: Lessons from 2026-09-09-completeness-artifacts-freedom-metrics decisions
type: lesson
status: confirmed
scope: 2026-09-09-completeness-artifacts-freedom-metrics
created_at: 2026-09-09
tags:
  - auto-extracted
  - lesson
  - decisions
  - 2026-09-09-completeness-artifacts-freedom-metrics
graph_bindings: []
---
> Auto-extracted from 2026-09-09-completeness-artifacts-freedom-metrics/decisions.md

# Decision Log: 2026-09-09-completeness-artifacts-freedom-metrics


## [design] 2026-09-09T12:59:03.347Z

范围重裁定：经代码核实 T1 完备性门禁已随 2026-09-05-goal-p0-dispatch-gate 落地（artifact-validator + phase-guard 双签），原评价结论过时并已勘误；CHG 范围收窄为 T2 度量回路——constraint-density evaluator、design-build-first-pass evaluator、advisory 反哺建议，复用既有 auto-evaluate 框架不新增 CLI 命令

## [design] 2026-09-09T13:57:55.564Z

签收 OQ-1~3：D1 密度 evaluator weight=0 不参与 composite（调节信号）；D2 权重重排 test 0.30/drift 0.20/compliance 0.20/delta 0.10/first-pass 0.20；D3 建议阈值常量化（0.8/0.7/0.3）rawData 透出

## [design] 2026-09-09T13:58:01.057Z

签收 AS-1~3：state 工件以存在 .mumuspec.yaml 识别、YAML 解析复用既有依赖、建议仅进 AutoEvaluateResult 不改 html-reporter

## [design] 2026-09-09T14:21:32.858Z

实现期裁决：constraint-density 取数改为 spawn 'mumuspec context --json'（原设计为进程内 loadSpecContext），因 arch-boundaries 不变量禁止 src/core 导入上层域；与 spec-compliance 的 spawn 纪律一致，纯函数 extractConstraintCounts/normalizeDensity 导出直测
