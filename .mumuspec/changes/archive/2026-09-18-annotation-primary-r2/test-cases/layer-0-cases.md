# Test Cases: annotation-primary-r2 (Layer 0)

> 对应 delta-spec：`delta-specs/.-tech.md` ｜ 用 `mumuspec test-cases lock-suite` 锁定

## TC-L0-01 legacy 默认兼容（positive / 回归）

- 前置：无 `legacy_lexical_channel` 配置（缺省）；SHALL NOT `禁止使用 \`eval\`` 无注解无前缀。
- 步骤：`classifyConstraint`（opts 缺省）。
- 期望：`enforced-weak`（legacy 兜底生效，与现状一致）；`weakSource==='legacy'`。

## TC-L0-02 legacy=false 时无注解文本回落（positive）

- 前置：`legacyLexical=false`；同上 SHALL NOT。
- 步骤：`classifyConstraint`。
- 期望：`unverifiable`（不再静默走词法兜底）。

## TC-L0-03 lex: 前缀显式入口（positive）

- 前置：SHALL NOT 文本 `lex:禁止使用 \`eval\``。
- 步骤：`classifyConstraint`（legacy=false 与 true 两种）。
- 期望：两态均为 `enforced-weak`（显式 lex: 无条件生效）；`weakSource==='lex'`。

## TC-L0-04 E-SPEC-015 出口三分法（positive）

- 前置：legacy=false；无注解无前缀 SHALL NOT，strict 全量 check。
- 步骤：`checkCompliance`。
- 期望：`E-SPEC-015` error，文案含"补 annotation / ast: / lex: / manual"引导（既可操作）。

## TC-L0-05 覆盖报告追加字段（positive）

- 前置：legacy=true 全量查；含 1 条 legacy 兜底 weak 与 1 条 lex: weak。
- 步骤：`computeEnforcementCoverage`。
- 期望：`legacy_weak===1`；`actionable_weak` 仅含 legacy 条目；`unverifiable_items` 语义不变（legacy_weak 不进入该字段）。

## TC-L0-06 配置接线（positive）

- 前置：仓库 config.yaml 显式 `legacy_lexical_channel: false`；guard fullCheck。
- 步骤：`checkCompliance` 走 loadConfig。
- 期望：与 TC-L0-02/04 行为一致（配置驱动，非默认值）。