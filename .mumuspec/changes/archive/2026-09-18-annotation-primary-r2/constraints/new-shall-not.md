# New SHALL NOT Constraints

## Requirement: 词法通道显式化

- SHALL NOT: 禁止改变 `legacy_lexical_channel=true` 时无前缀文本的既有 R2 行为（兼容面与现状一致）。
- SHALL NOT: 禁止为 annotation 主入口引入新检查引擎（仅复用既有类型与 AST 通道）。

Enforcement:

- ENF-1: manual(回归测试：legacy 默认兼容 + 无新引擎)