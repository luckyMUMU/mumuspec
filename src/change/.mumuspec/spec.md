---
layer: 1
scope: "src/change"
last_updated: "2026-07-30"
---

## Requirement: 变更生命周期管理

### SHALL
- 状态转换必须通过状态机验证（canTransition）
- 回滚操作必须记录到 rollback_history
- 变更创建时必须初始化 build_layers 和 test_cases
- 归档操作必须将变更从 active 移到 archive 目录
- 决策日志必须支持按 phase 分类记录

### SHALL NOT
- 禁止绕过状态机直接修改 phase（必须通过 executeTransition）
- 禁止回滚次数超过 rollback_limit
- 禁止在 terminal 状态（archive-completed/discarded）继续转换
- 禁止创建同名活跃变更

### Enforcement
- CHANGE-1: 检查状态转换符合状态机规则
- CHANGE-2: 检查回滚不超限制
- CHANGE-3: 检查 single_active_change 不冲突
