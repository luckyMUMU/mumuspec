---
layer: 1
scope: ".changes/shall-annotation-channel"
last_updated: "2026-09-18"
doc_type: prd
change: shall-annotation-channel
parent_prd: ..\..\..\prd.md
---

## Requirement: Feature Goals

### SHALL
- SHALL 约束与 SHALL NOT 约束的分类判定对极性中立：同一机读注解或 `ast:` 前缀对两种极性等价路由到既有 AST 机器通道。
- 带机读注解或 `ast:` 前缀的 SHALL 约束由 guard 执行注解对应检查，命中时报告 E-GUARD-012 并定位文件行。
- 无通道 SHALL 与 SHALL NOT 的既有判定路径保持不变（E-SPEC-004 / E-SPEC-015）。

### SHALL NOT
- 禁止为 SHALL 引入新的检查引擎（仅复用既有 `MachineReadableAnnotation.type` 与 AST provider）。
- 禁止改变无通道约束的既有判定（E-SPEC-004 恒可见告警、E-SPEC-015 strict 阻断语义不变）。

## Requirement: User Scenarios

### SHALL
- 用户可：为 SHALL 条目在 frontmatter 声明机读注解后，guard 全量检查对其进行机器执行并报告违规位置。

### Enforcement
- PRD-shall-annotation-channel-1: 分类对称与执行语义由 verifier-classify / checker 测试锁定
- PRD-shall-annotation-channel-2: 无通道回落与 E-SPEC-004/015 行为由回归测试锁定