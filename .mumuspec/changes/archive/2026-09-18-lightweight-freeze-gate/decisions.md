# Decision Log: lightweight-freeze-gate


## [design] 2026-09-18T12:53:53.078Z

lightweight-freeze-gate 设计裁决 D-E1：freeze gate 仅以『proposal 显式声明 blocking 决策』为触发，默认零新增硬门（CHG-5 兼容）；D-E2：最小可解析单元与 skip_specs 均限定轻量档，full 零变化由 TC-L0-06 回归锁定；D-E3：签收复用 decisions.md 机制，不引入交互式向导

## [design] 2026-09-18T13:04:57.537Z

lightweight-freeze-gate TDD 实现：new src/change/proposal.ts（parseUserDecisions/unsignedBlockingDecisions 纯函数）+ ChangeState.skip_specs + CLI --no-spec-delta（commander 负向选项属性为 specDelta）+ phase-guard freeze-gate（E-GUARD-011，E-GUARD-010 已被 DELTA_CONSTRAINT_UNCHANNELABLE 占用）+ validator isMinParseableUnit 最小单元谓词 + proposal 模板 User Decisions 段；增量测试 17 例全绿。同步修正设计产物：Scenario 语义按解析器实际能力收敛为 SHALL 项（WHEN/THEN 以 SHALL 措辞承载），错误码引用 E-GUARD-010→E-GUARD-011

## [build] 2026-09-18T13:05:30.702Z

lightweight-freeze-gate TDD Build 完成：proposal.ts 纯函数 + skip_specs + --no-spec-delta + E-GUARD-011 freeze-gate + isMinParseableUnit 最小单元；17 增量测试绿，error-codes.md 重生成（114 码/21 域），测试套件重锁（lock 后内容有事实性修正：E-GUARD-011 与 SHALL 项语义）
