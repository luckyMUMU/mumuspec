# New SHALL Constraints

## Requirement: 词法通道显式化

- SHALL: SHALL NOT 的 enforced-weak 仅经显式 `lex:` 前缀或 `specs.legacy_lexical_channel=true` 兜底生效。
- SHALL: legacy 关闭时无注解无前缀的 SHALL NOT 回落 unverifiable，E-SPEC-015 引导补 annotation / `ast:` / `lex:` / manual。
- SHALL: `computeEnforcementCoverage` 以追加字段输出 legacy 兜底 weak 的"需补注解"行动项。

Enforcement:

- ENF-1: manual(legacy 两态 + lex: 前缀 + 覆盖报告追加字段测试锁定)