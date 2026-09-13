# Proposal: bp-into-graph

## Why

MumuSpec 的 18 个人工阻塞点（BP-1..BP-18）中只有 3 个（BP-3 / BP-4 / BP-17）作为边属性锚定在阶段图中，
其余 15 个只存在于 phase skill 的 prose 里。`graph verify` / dashboard 无法机器判定"某阶段的决策点
清单是否齐备"，编排契约不完备——这是评估报告（review/skill-cli-dag-evaluation-2026-09-13.md）
识别的"图完备性无法被校验"缺陷，也是引擎缺陷同构（动作执行了却没留下可判定事实）的又一例。

## What

1. 引擎 workflow 配置的 `workflows.<wf>` 段支持可选 `phase_bps` 键：phase → 该阶段人工决策点（BP id）列表。
2. `graph verify` 能报告各 workflow 的 BP 清单（full 覆盖全部 18 个 BP）。
3. `graph verify` 增加"skill 侧声明的 BP ↔ 引擎 phase_bps"一致性检查，不一致发 `W-GRAPH-001` 告警（fail-open，不阻断）。
4. skill 侧 workflow.yaml 的 design 阶段补齐 BP-4.5 声明（作为一致性检查的正向对照样本）。

## Impact Scope

- `src/change/phase-graph.ts`（WorkflowConfig 类型扩展）
- `src/change/phase-graph-loader.ts`（校验：phase 合法、BP id 全局唯一、格式 `BP-<num>[.<num>]`）
- `src/change/workflow.default.yaml`（full/hotfix/tweak/loop 增加 phase_bps）
- `.mumuspec/workflow.yaml`（项目级 override 同步）
- `src/cli/commands/graph.ts`（graph verify 报告 + 一致性检查）
- `src/core/errors.ts`（注册 W-GRAPH-001）
- `skills/mumuspec/workflow.yaml`（design 补 BP-4.5）
- 测试：loader 校验用例 + graph verify 输出用例

## 非目标

- 不改变任何 BP 的存在性、触发方式或人工确认机制。
- 不把 rollback_limit / rebuild_limit 入图（per-change 状态是正确归属，E3 明确不做）。
- 不在 dashboard / state check --recover 消费 phase_bps（`status` ready-actions 已覆盖引导需求，延后评估）。
- 不删除 skill 侧 workflow.yaml 的 graph/presets 段（S2b 待本变更归档后单独执行）。

## Workflow

full
