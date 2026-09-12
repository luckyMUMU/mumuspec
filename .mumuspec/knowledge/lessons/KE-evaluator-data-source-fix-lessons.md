---
id: KE-evaluator-data-source-fix-lessons
title: Lessons from evaluator-data-source-fix decisions
type: lesson
status: confirmed
scope: evaluator-data-source-fix
created_at: 2026-09-12
tags:
  - auto-extracted
  - lesson
  - decisions
  - evaluator-data-source-fix
graph_bindings: []
---
> Auto-extracted from evaluator-data-source-fix/decisions.md

# Decision Log: evaluator-data-source-fix


## [build] 2026-09-12T15:20:56.743Z

E17 数据源重设计：spec-compliance 改读 check --json（coverage.total 为运行时约束总数作分母、compliance.errors 为失败数——原 guard --json 输出 passed:boolean 无计数恒 1.0 假满分）；drift-score 改读 drift --json（顶层 DriftResult[] 数组，新语义 violations 按 DRIFT_SATURATION=10 有界归一化——原 totalViolations/totalChecks 不存在恒 NaN）。统一修复：npx spawn 加 shell:win32（E17 第三层）、stdout 支持多行美化 JSON 与数组解析、status!=0 但含 payload 时照常计算（低分不是跳过）。此修复使 spec-compliance/drift-score 首次真正进入 composite。顺带 STATUS.md 版本对齐 0.23.0-alpha.2。全量 266 文件/5058 tests 全绿，check/validate 通过
