# Proposal: shall-annotation-channel

## Why

`classifyConstraint` 的 R1（enforced-strong）/R2（enforced-weak）判定仅在 `shall-not` 极性分支生效（src/spec/verifier-classify.ts L120-127）。SHALL 约束没有任何机器执行通道：无通道的 SHALL 回落 unverifiable 后仅产生 E-SPEC-004 恒可见告警（src/guard/checker.ts L425-443），无法被代码执行。结果 154 条 SHALL（约占约束总量 58%）全部落 manual/unverifiable，与"轻量路径为主路径"目标冲突。

## What

1. `classifyConstraint` 对 `shall` 极性开放 R1 判定（注解/`ast:` → `enforced-strong`）。首阶段仅复用既有 `MachineReadableAnnotation.type`（no-new-dependency / no-side-effect / pure-function / no-global-state / no-mutable-state / custom），不放宽 no-new-engines 契约，不另立检查逻辑。
2. SHALL 机器通道仅经注解或显式 `ast:` 前缀触达，分类为 `enforced-strong`（与 SHALL NOT 的 `ast:` 语义一致，L124 现状）；不给 SHALL 引入词法 weak 层（`enforced-weak`＝SHALL NOT 词法兜底语义，保持不变）。无通道 SHALL 仍回落 unverifiable，`checkShall` 的 E-SPEC-004（恒可见告警）/ E-SPEC-015 判定原样保留。
3. `checkShall` 驱动化：命中注解的 SHALL 从"仅 E-SPEC-004 告警"升级为执行注解对应检查，复用既有 AST 通道。

## Impact Scope

- .

## User Decisions

- [blocking] 存量带注解 SHALL 的检查结果从 E-SPEC-004 告警升级为注解对应检查的实测结果（相关错误码与通过率可能变化）；未带注解的 SHALL 行为不变

## Workflow

full