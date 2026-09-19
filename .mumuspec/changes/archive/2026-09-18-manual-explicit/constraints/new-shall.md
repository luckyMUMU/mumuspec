# New SHALL Constraints

## Requirement: manual 显式化

- SHALL: validate 对 implicit-manual enforcement 报 `W-SPEC-017` advisory，指引改写为显式 manual(reason)，分类与阻断语义不变。
- SHALL: missingManualEvidence 识别结构化证据记录并按 constraintId 匹配，无记录时回落既有文本锚点。
- SHALL: classifyConstraintEntry 空 enforcement 按 isRegexCheckable 判 enforced-weak，否则 unverifiable。

Enforcement:

- ENF-1: manual(W-SPEC-017 触发 + 结构化证据解析 + entry 三分测试锁定)