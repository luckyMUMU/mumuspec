# Verify: dogfood-migration-b1

## 结果（全部由确定性工件状态推导）
- 迁移量：根 spec.md 50 + roadmap 23 + demo 25 = 98 条 implicit-manual → 显式 `manual(原句)`；约束计数不变（SHALL 183 / SHALL NOT 120，AGENTS 表与 HEAD 一致）。
- `validate` exit 0、W-SPEC-017 触发 0、`check --json`：total 362 / strong 2 / weak 21 / manual 339 / unverifiable 0。
- **TC-L1-003 达成**：`legacy_lexical_channel:false` 演练 exit 0、unverifiable 0、E-SPEC-015 0（证据 /tmp/drill.json，配置已还原）。
- **TC-L1-004 达成**：逐条包原句 + 前缀回滚字节级复原，diff 仅 Enforcement 行。
- **TC-L1-005 达成**：vitest 300/300、ci-check 0 error。
- **TC-L1-001 部分达成 / TC-L1-002 未达成 → 偏差登记**：21 条 legacy weak 未显式化——批1 实测 `lex:` 前缀破坏 checker 对 "The system SHALL NOT…" 系统行为豁免路径（15 条 E-GUARD-003 误报），且引号项承载对象标识符触红线；已全部回滚，处置顺延至后续"系统行为类红线通道"变更（decisions.md build 期偏差记录）。
- 批3 为 no-op：10 条 enforcement 均为 E-码/命令/测试指针（batch3-mapping.md），包 manual() 即错配，按决策一不动。
- 45 条 `enforced-strong(...)` 证据指针：保持原样，分类诚实为 manual（引擎不代为执行指针断言），W-SPEC-017 误报已由 validator 过滤修正。

## 签收链
- 决策一/二：用户 AskUserQuestion 签收（宁缺勿错配；分批逐条清单）。
- 批1 清单：用户目标续跑指示放行；批2/3 沿用同型机械规则，清单在 migration/。
