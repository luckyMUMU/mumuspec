---
id: KE-loop-signal-bandwidth-lessons
title: Lessons from loop-signal-bandwidth decisions
type: lesson
status: confirmed
scope: loop-signal-bandwidth
created_at: 2026-09-12
tags:
  - auto-extracted
  - lesson
  - decisions
  - loop-signal-bandwidth
graph_bindings: []
---
> Auto-extracted from loop-signal-bandwidth/decisions.md

# Decision Log: loop-signal-bandwidth


## [build] 2026-09-12T15:35:19.690Z

P1-1（E11）信号带宽回填：auto/hybrid 分支 issues/needs_user_input 不再硬覆盖——透传调用方信号，并主动采集 runPhaseGuard(change,'build') 的 error.code 以 [guard:<code>] 标记拼入 issues（按 code+message 去重，只读采集失败不影响主流程）；manual 模式行为不变。恢复流程说明：实施期间工作树被外部 unborn 分支 skill-plugin-standard 劫持，经用户批准备份-强制 checkout master-恢复三文件后在本分支重做。全量 266 文件/5061 tests 全绿，check/validate 通过
