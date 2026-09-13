---
id: DS-CHANGE-001
layer: 0
scope: src/change
delta: ADDED
---

## Requirement: phase_bps 可选段

### SHALL
- SHALL 支持 `workflows.<workflow>.phase_bps` 可选键，值为 phase 名到 BP id 字符串数组的映射。
- SHALL 在 loader 校验中检查 phase_bps：键必须是已知 phase，BP id 必须匹配 `BP-<数字>[.<数字>]` 格式，且在单个 workflow 内唯一。
- SHALL 在配置含合法 phase_bps 时保持图边（edges）解析行为不变。

### SHALL NOT
- SHALL NOT 在 workflows 段缺少 `phase_bps` 时改变既有解析与校验行为（向后兼容，缺省合法）。
- SHALL NOT 因 phase_bps 非法而崩溃——必须走既有 fail-safe 路径（`console.warn` + 内置默认配置）。

### Enforcement
Enforcement: manual —— 由测试机械验证
- PHASE_BPS_LOADER: tests/change/phase-graph-loader-bps.test.ts TC-L0-01..06（合法解析/缺省兼容/未知 phase/坏 id 格式/workflow 内重复 id/fail-safe 回退）

## Requirement: graph verify 报告与一致性检查

### SHALL
- SHALL 让 `mumuspec graph verify` 输出当前 workflow 的 phase_bps 清单（逐 phase 列出 BP id）。
- SHALL 在 skills/mumuspec/workflow.yaml 存在时，将其 phases/presets 声明的 BP 集合与引擎 phase_bps 集合对比，差异以 `W-GRAPH-001` 告警逐条列出（缺声明 / 多声明）。
- SHALL 使全部 workflow 的 phase_bps 并集覆盖 BP-1 至 BP-18（full 覆盖 BP-1..17，BP-18 属预设路径）。

### SHALL NOT
- SHALL NOT 在 skill 侧 `workflow.yaml` 缺失或不可解析时阻断 graph verify——只跳过一致性检查（fail-open）。
- SHALL NOT 让 `W-GRAPH-001` 以 error 级别抛出（一律 WARN，不阻断流程）。

### Enforcement
Enforcement: manual —— 由测试机械验证
- PHASE_BPS_VERIFY: tests/change/phase-bps.test.ts TC-L1-01..06（报告清单/18 BP 并集/一致 0 告警/缺声明触发 W-GRAPH-001/skill 缺失跳过/错误码注册 WARN）
