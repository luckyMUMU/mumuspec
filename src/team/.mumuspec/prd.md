---
layer: 2
scope: "src/team"
last_updated: "2026-09-08"
doc_type: prd
---

# Product Requirements: team

## 模块职责 (What this module does)

MumuSpec 的多角色协作执行框架。

- `TeamEngine` — 团队执行状态机：initialize / confirmSelection / getStatusSummary / canContinue / isBarMet / isTerminal
- `MockRuntimeAdapter` — 无外部依赖的运行时适配器（测试与本地模拟）
- `loadTeamConfig()` / `saveTeamConfig()` / `validateTeamConfig()` / `buildDefaultTeamConfig()` — 团队配置的持久化、校验与默认构造

## 存在理由 (Why it exists)

复杂变更需要多角色（架构、实现、评审）协作。team 模块把「谁做什么、何时放行、
达标线是否满足」建模为显式状态机，使协作过程可审计、可中断、可恢复。

## 用户场景 (User scenarios)

1. **初始化团队**：为变更 buildDefaultTeamConfig 并 saveTeamConfig 落盘
2. **驱动执行**：TeamEngine.initialize 装载配置，逐阶段推进并在达标线处等待确认
3. **状态查询**：getStatusSummary 输出某变更的协作状态摘要
4. **配置校验**：validateTeamConfig 在装载时拦截非法角色/阶段组合

## Requirement: State Machine Discipline

### SHALL
- 团队执行必须经 TeamEngine 状态机推进，达标线（bar）未满足时 canContinue 返回 false
- 状态与事件必须可查询（getState / getEventLog），事件可审计

### SHALL NOT
- 禁止绕过状态机直接改写团队状态

### Enforcement
- TEAM-1: 状态变更仅经 TeamEngine 方法
- TEAM-2: getEventLog 覆盖全部状态转移

## Requirement: Config Validation Gate

### SHALL
- loadTeamConfig 装载前必须经 validateTeamConfig 校验

### SHALL NOT
- 禁止保存未通过校验的团队配置

### Enforcement
- TEAM-3: saveTeamConfig 前置 validateTeamConfig

## 验收标准 (Acceptance criteria)

- 状态机含终态判定（isTerminal）与达标线判定（isBarMet）
- 配置读写对称：save 后 load 可还原
- MockRuntimeAdapter 支撑无外部依赖测试
