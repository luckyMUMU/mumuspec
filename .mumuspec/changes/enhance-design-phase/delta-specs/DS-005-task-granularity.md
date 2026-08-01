---
title: Task Granularity Specification
id: DS-005
scope: src/guard/phase-guard.ts
status: proposed
priority: P2
---

# Delta Spec: 任务粒度规范

## Current Behavior
hyperplan_result 任务可任意大小，无约束。

## New Behavior
guard checkBuildToVerify 中增加粒度检查。

## Rules
- 单个 task 预估时间 > 15 min → W-DESIGN-001 警告
- 建议拆分方案（按文件/按逻辑单元）

## Warning Code
- W-DESIGN-001: 任务粒度过大（>15 min），建议拆分
