# Proposal: annotation-primary-r2

## Why

SHALL NOT 机器通道目前是"注解可用则 R1、否则词法兜底自动生效"（src/spec/verifier-classify.ts L127-130：无注解 + `isRegexCheckable` → enforced-weak）。词法兜底（引号术语字面量匹配）已知产生误报（"不得以行内代码标记承载对象标识符——词法兜底会把字面量出现误判为行为发生"），且无注解的约束静默走 R2、无任何提示。注解（annotation/AST）应是约束进入机器通道的唯一主入口；词法通道降级为显式 opt-in。

## What

1. 分判据反转：SHALL NOT 无注解且非 `ast:`/`lex:` 前缀时不再默认走 R2，回落 unverifiable 并报可操作项——E-SPEC-015 出口三分法：补 annotation / 改写为 `ast:`（或 `lex:` 前缀）/ 声明 `manual(reason)`。
2. `isRegexCheckable` 延后为显式 `lex:` 前缀的触发条件；新配置键 `specs.legacy_lexical_channel`（默认 `true`，首版行为与现状完全一致——兼容期）控制是否对无前缀文本沿用旧 R2 兜底；`false` 时仅 `lex:` 前缀进入 enforced-weak。新配置键同步 config.ts / config-io 默认值 / migrations / docs/reference/configuration.md / docs:audit。
3. `computeEnforcementCoverage` 以新增追加字段承载"legacy 词法兜底生效数"（needs_annotation 行动项），不改写 `unverifiable_items` 既有语义（不改变 check/validate 既有 JSON schema）。
4. 迁移策略：只读清单（列出将翻转的存量条目）→ 分批补注解 → 配置开关分阶段翻转（默认保留 legacy 兼容）→ 视存量收敛后强制 `legacy_lexical_channel: false`。

## Impact Scope

- .

## User Decisions

- [blocking] 新配置键 `specs.legacy_lexical_channel` 默认 `true`（存量无注解约束的词法兜底行为首版不变）；翻转时机由项目配置决定，本变更不自动翻转

## Workflow

full