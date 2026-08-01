# Decision Log: enhance-design-phase

## DEC-001: 模板强制字段分级策略
**Decision**: required_for 分三级：[full]、[full, tweak]、[full, hotfix, tweak]
**Rationale**: tweak 变更是小改动，不需要完整模板；full 需要严格约束
**Status**: confirmed
**Date**: 2026-08-01

## DEC-002: clarify 命令定位为可选增强
**Decision**: clarify 不阻塞设计流程，仅作为辅助工具
**Rationale**: 强制澄清会增加新手门槛；应让 AI 自主判断是否需要
**Status**: confirmed
**Date**: 2026-08-01

## DEC-003: AI 自审结果分级处理
**Decision**: CRITICAL 阻塞 + MAJOR 警告 + MINOR 提示
**Rationale**: 避免"警告疲劳"，确保关键问题必解决
**Status**: confirmed
**Date**: 2026-08-01

## DEC-004: 一致性检查放在 guard 中
**Decision**: 而非独立命令，随每次 guard 自动执行
**Rationale**: 集成度高，不会忘记运行
**Status**: confirmed
**Date**: 2026-08-01

## DEC-005: 任务粒度仅警告不阻塞
**Decision**: W-DESIGN-001 为 warning，不阻塞 verify
**Rationale**: 粒度判断主观性强，阻塞会引起效率下降
**Status**: proposed
**Date**: 2026-08-01
