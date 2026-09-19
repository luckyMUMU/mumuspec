# New SHALL NOT Constraints

## Requirement: manual 显式化

- SHALL NOT: 禁止改变既有 manual 分类结果与 E-SPEC-004/015 阻断语义。
- SHALL NOT: 禁止改变 check/validate 既有 JSON schema（新字段仅追加）。

Enforcement:

- ENF-1: manual(回归测试：旧行为不变)