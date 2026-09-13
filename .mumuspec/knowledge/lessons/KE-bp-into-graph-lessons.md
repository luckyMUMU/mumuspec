---
id: KE-bp-into-graph-lessons
title: Lessons from bp-into-graph decisions
type: lesson
status: confirmed
scope: bp-into-graph
created_at: 2026-09-13
tags:
  - auto-extracted
  - lesson
  - decisions
  - bp-into-graph
graph_bindings: []
---
> Auto-extracted from bp-into-graph/decisions.md

# Decision Log: bp-into-graph


## [open] 2026-09-13T13:09:55.804Z

方案已评审授权：用户确认执行批次3（CHG-8 BP 入图），D1-D5 推荐默认全部采纳；scope 限定引擎 schema/loader/graph verify/skill 侧 workflow.yaml；dashboard 与 state check 消费明确列为非目标（status ready-actions 已覆盖）；workflow=full；就地开发（平台嵌套 ref 限制，branch 声明以 master 为准）

## [design] 2026-09-13T13:11:37.005Z

设计裁决 D-E1a：phase_bps 挂在 workflows.<wf> 层（非独立顶段），可选键向后兼容；D-E1b：一致性检查落在 graph verify（W-GRAPH-001 WARN fail-open），dashboard/state check 消费延后（ready-actions 已覆盖）；D-E1c：BP-18 归入 hotfix/tweak 的 build 阶段（预设升级触发最常见落点）；D-E1d：full.workflow 的 design 含 BP-4.5，skill 侧 workflow.yaml 同步补齐作为正向对照样本

## [build] 2026-09-13T13:26:12.086Z

TDD 实现：新增 src/change/phase-bps.ts（collectWorkflowBps/unionBps/collectSkillBps/compareBps 纯函数）；loader 校验 phase_bps（键合法/id 格式/workflow 内唯一）；graph verify 新增 BP 报告与 W-GRAPH-001 一致性检查（fail-open）；errors.ts 注册 W-GRAPH-001（113 码/21 域）；两份 workflow YAML 与 skill 侧 BP-4.5 同步。过程发现并修复两处预存缺陷：loader 首版误设全局唯一（fail-safe 拦截后改为 workflow 内唯一）；skill workflow.yaml design 段缩进损坏（4 空格，此前无人解析该文件，已修复并解析通过）
