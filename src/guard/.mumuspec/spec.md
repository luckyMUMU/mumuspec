---
layer: 1
scope: "src/guard"
last_updated: "2026-07-30"
---

## Requirement: 合规检查与阶段门禁

### SHALL
- 合规检查必须覆盖 SHALL、SHALL NOT、Ponytail 三类约束
- 漂移检测必须对比 spec.md 与代码实现
- 阶段门禁必须验证前置条件（文件存在性、hash 一致性）
- 强度降级必须遵循 STRENGTH_ACTION_MAP 映射

### SHALL NOT
- 禁止在 always_enforce 异常上应用强度降级
- 禁止门禁检查跳过用户确认（bp_03/bp_04/bp_17）
- 禁止合规检查忽略 SHALL NOT 违规

### Enforcement
- GUARD-1: 检查 SHALL NOT 违规返回 ERROR
- GUARD-2: 检查 always_enforce 异常始终阻断
- GUARD-3: 检查门禁条件满足才允许转换
