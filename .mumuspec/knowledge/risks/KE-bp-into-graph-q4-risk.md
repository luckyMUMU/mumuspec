---
id: KE-bp-into-graph-q4-risk
title: Residual risks from bp-into-graph
type: risk
status: confirmed
scope: bp-into-graph
created_at: 2026-09-13
tags:
  - auto-extracted
  - q4
  - risk
  - bp-into-graph
graph_bindings: []
---
> Auto-extracted from bp-into-graph cognitive-map Q4

- **兼容性盲区——旧项目级 workflow.yaml（无 phase_bps）会怎样？**: phase_bps 为可选键，collectErrors 对缺失不报错；旧文件继续合法。测试锁定：缺 phase_bps 的配置解析结果与改造前一致。
- **消费者覆盖盲区——还有谁读 WorkflowConfig？**: guard/state/loop 等消费 edges 与 workflows.phases，不感知 phase_bps；新增可选字段不进入其判定路径。graph verify 为唯一新消费者。
- **错误码纪律盲区——W-GRAPH-001 会不会隐形？**: 注册 errors.ts 后由 gen-error-codes-doc 生成文档、被 ci-check 收录；命名带数字后缀满足扫描面。
- **skill 侧同步盲区——workflow.yaml 与引擎漂移怎么防复发？**: graph verify 一致性检查本身即防复发机制；skill 侧 design 补 BP-4.5 后两侧闭合，S2b（删 skill graph/presets 段）在归档后另行执行。