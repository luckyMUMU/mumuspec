# New SHALL NOT Constraints

## Requirement: SHALL 约束机器可验证性

- SHALL NOT: 禁止为 SHALL 引入新检查引擎（仅复用既有 annotation 类型与 AST provider）。
- SHALL NOT: 禁止改变无通道 SHALL（E-SPEC-004）与无通道 SHALL NOT（E-SPEC-015）的既有判定路径。

Enforcement:

- ENF-1: manual(回归测试：无通道回落与 E-SPEC-004/015 行为不变)