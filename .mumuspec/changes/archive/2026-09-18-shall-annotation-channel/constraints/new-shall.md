# New SHALL Constraints

## Requirement: SHALL 约束机器可验证性

- SHALL: SHALL/SHALL NOT 分类判定对极性中立，同一机读注解或 `ast:` 前缀对两种极性等价路由到既有 AST 通道。
- SHALL: 带注解或 `ast:` 前缀的 SHALL 约束执行注解对应检查，违规报 E-GUARD-012。

Enforcement:

- ENF-1: manual(测试锁定：分类对称 + ast: 通道执行 + 范围过滤)