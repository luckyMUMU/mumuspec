---
id: KE-p0-calibration-hardening-lessons
title: Lessons from p0-calibration-hardening decisions
type: lesson
status: confirmed
scope: p0-calibration-hardening
created_at: 2026-09-07
tags:
  - auto-extracted
  - lesson
  - decisions
  - p0-calibration-hardening
graph_bindings: []
---
> Auto-extracted from p0-calibration-hardening/decisions.md

# Decision Log: p0-calibration-hardening


## [design] 2026-09-06T16:00:51.613Z

D1(P0-A)用户签收最小版:仅CommandMetadata+capability查询命令;dry-run框架与名称二次确认为二期不在本变更

## [design] 2026-09-06T16:00:53.232Z

D2(P0-B)用户签收用config.specs.max_layer_depth(默认5),保留root+target,中间层按max_layer_depth-2截断

## [design] 2026-09-06T16:00:54.670Z

D3(P0-D)防重跑以归档目录.finalized标记实现,幂等跳过,--force覆盖;code-graph snapshot复用既有builder
