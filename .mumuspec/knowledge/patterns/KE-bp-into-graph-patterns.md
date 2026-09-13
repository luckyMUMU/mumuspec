---
id: KE-bp-into-graph-patterns
title: Architecture patterns from bp-into-graph
type: pattern
status: confirmed
scope: bp-into-graph
created_at: 2026-09-13
tags:
  - auto-extracted
  - pattern
  - architecture
  - bp-into-graph
graph_bindings: []
---
> Auto-extracted from bp-into-graph/design.md

# Design: bp-into-graph — BP 全量入图（phase_bps）

## 高层设计（Level 1 — 消费层）

`mumuspec graph verify` 成为编排契约 BP 完备性的机器判定入口：

1. 输出当前 workflow 的 `phase_bps` 清单（逐 phase 列 BP id）。
2. 与 skill 侧声明对比：full 对照 `skills/mumuspec/workflow.yaml` 的 `phases.*.blocking_points`
   并集；hotfix/tweak 对照 `presets.*.blocking_points` 并集；loop 无 skill 声明则跳过。
   差异逐条报 `W-GRAPH-001`（WARN，fail-open：skill 侧文件缺失/不可解析时跳过检查，不阻断）。
3. 消费范围：**仅 graph verify**。dashboard / state check --recover 不消费 phase_bps
   （`status` ready-actions 已覆盖引导需求）——这是经裁决的非目标。

## 底层设计（Level 0 — 数据层）

### 类型（src/change/phase-graph.ts）

```ts
export interface WorkflowEntry {
  phases: ChangePhase[];
  skip_design?: boolean;
  phase_bps?: Partial<Record<ChangePhase, string[]>>;  // 新增可选
}
```

### 校验（src/change/phase-graph-loader.ts — collectErrors）

- `workflows.<wf>.phase_bps` 若存在：键必须是 CANONICAL_PHASES 成员；值是非空字符串数组；
  BP id 匹配 `/^BP-\d+(\.\d+)?$/`；BP id 在整个配置内全局唯一（跨 workflow / 跨 phase）。
- 违规报错文案进入既有 collectErrors 通道；缺失 phase_bps 不报错（向后兼容）。

### 数据（workflow.default.yaml 与 .mumuspec/workflow.yaml 同步）

| workflow | open | design | build | verify | archive-in-progress |
|---|---|---|---|---|---|
| full | BP-1,2,3 | BP-4,4.5,5,6,7,8 | BP-9,10,11,12,13 | BP-14,15,16 | BP-17 |
| hotfix | BP-3 | — | BP-18 | BP-14,16 | BP-17 |
| tweak | BP-3 | — | BP-18 | BP-14,16 | BP-17 |
| loop | — | — | BP-9,10,11,12,13 | BP-14,15,16 | BP-17 |

18 个 BP 由全 workflow 并集覆盖（full 覆盖 BP-1..17；BP-18 属预设路径）。
边属性 `bp: {id: BP-3/4/17}` 保持不动——边锚定是 phase_bps 的子集，两者不冲突。

### 错误码（src/core/errors.ts）

`W-GRAPH-001`（severity: WARN，GRAPH 域）：skill 侧 BP 声明与引擎 phase_bps 不一致，
message 含差异清单（缺声明 / 多声明），fixHint 指向两侧权威文件。

### skill 侧（skills/mumuspec/workflow.yaml）

design 阶段 blocking_points 补 `BP-4.5: grill-me 共识确认`（正向对照样本，闭合两侧差集）。

## build_layers

- Layer 0（先建）：数据层 —— 类型 + loader 校验 + 两份 workflow YAML 数据（TDD：loader 用例先行）
- Layer 1（后建）：消费层 —— graph verify 报告 + W-GRAPH-001 + errors.ts 注册 + skill 侧 BP-4.5（TDD：命令用例先行）

## 测试策略（锁定于 test-cases/）

- L0：合法 phase_bps 解析；缺 phase_bps 向后