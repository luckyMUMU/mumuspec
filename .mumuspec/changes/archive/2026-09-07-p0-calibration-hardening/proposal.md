# Proposal: p0-calibration-hardening

> 来源：review/spec-code-calibration-2026-09-05.md P0 清单（doc-governance-decisions 已消解其中 TEMP 矛盾与 GLOSSARY 路径两项）。

## Why
2026-09-05 spec↔代码逐条校准发现 6 项 P0 缺口，其中 2 项已由 doc-governance-decisions（0.19.2-alpha.8）修复。剩余 4 项为 spec 硬性 SHALL 与实现的差距，需立项收敛，否则规范链对代码的约束声明失真。

## What（剩余 P0 项）

### P0-A: Capability Tier 整块未实现
spec「命令能力分层（Capability Tier）」整块无代码：无 CommandMetadata 类型、无 `mumuspec capability` 命令、无全局 dry-run 框架、不可逆确认用 --confirm 标志而非输入变更名称。
决策输入：spec/overview 开放问题 #5 已提示"实现或从 spec 降级删除"——需裁决实现 or 降级 spec。

### P0-B: loader 硬编码 max 3 层
src/spec/loader.ts:358-376 selectLayersToLoad 硬编码 3 层；max_layer_depth 配置传入后命名 _maxDepth 未使用。违反 spec「SHALL NOT hardcode a fixed number of layers」。

### P0-C: 32KiB Rules 容量断言缺失
分发层 ENF-3（生成产物 ≤ 32KiB）全仓无实现。

### P0-D: finalize-archive 四项缺口
无原子性/回滚（FA-1）、code-graph snapshot 占位空实现（finalize-archive.ts:322-330）、cache/indexed.yaml 陈旧项仅计数不删、无防重跑标记（E-CHANGE-011 后状态与目录不一致风险——doc-governance-decisions 归档时已实际踩中）。

## Impact Scope
- src/spec/loader.ts、src/cli/index.ts（P0-B）
- src/install/rules-generator.ts + 容量断言测试（P0-C）
- src/cli/commands/finalize-archive.ts、src/change/archive.ts（P0-D）
- src/guard/、src/rules/、tests/（P0-A，若裁决实现）

## Workflow
full

## 前置决策（Open 阶段待用户签收）
1. P0-A 实现还是降级 spec？（建议：先实现最小 CommandMetadata + capability 查询命令，dry-run 框架二期）
2. P0-D 防重跑以 finalize-completed 标记实现？
3. 分期建议：P0-B + P0-D 先行（风险最高），P0-A/P0-C 随后。
