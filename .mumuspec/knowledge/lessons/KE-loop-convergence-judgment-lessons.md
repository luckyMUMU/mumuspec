---
id: KE-loop-convergence-judgment-lessons
title: Lessons from loop-convergence-judgment decisions
type: lesson
status: confirmed
scope: loop-convergence-judgment
created_at: 2026-09-12
tags:
  - auto-extracted
  - lesson
  - decisions
  - loop-convergence-judgment
graph_bindings: []
---
> Auto-extracted from loop-convergence-judgment/decisions.md

# Decision Log: loop-convergence-judgment


## [build] 2026-09-12T15:10:35.705Z

P1-2 三处同批实施：① auto-evaluate 删除模块级 historyMap，稳定窗口历史改从持久化 roundHistory（.mumuspec.yaml 中 loop.rounds[].evaluation.progress，与 progress_trend 同源）派生，跨进程有效——clearHistory 保留为 deprecated no-op；② loop-engine 去掉 || progress>=CONVERGENCE_THRESHOLD 单轮短路，converged 只由 goal_achieved 驱动（E16 一并修复，不再已收敛仍提交）；③ hybridEvaluate 与 autoEvaluate 统一三条件判据（threshold+allAboveMin+stable）。附带：initLoop 对 max_rounds<stabilityWindow(auto/hybrid) 告警。顺带收尾 STATUS.md 版本对齐 0.23.0-alpha.1。全量 265 文件/5048 tests 全绿，check/validate 通过
