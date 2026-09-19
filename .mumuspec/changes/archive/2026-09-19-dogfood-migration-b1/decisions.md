# Decision Log: dogfood-migration-b1


## [open] 2026-09-19T15:40:32.468Z

用户签收决策一：仅语义与通道真实对应才升 strong/weak，映射不了的显式 manual(reason)，不作错配注解（F8 教训）

## [open] 2026-09-19T15:40:33.360Z

用户签收决策二：按文件分批回写（根 spec.md → roadmap → constraints.yaml），每批附逐条映射清单供签收

## [design] 2026-09-19T15:41:23.730Z

设计三分法与逐批签收流程落档；完成判据=legacy_weak 0 + implicit-manual 0 + legacy=false 演练绿

## [build] 2026-09-19T15:42:59.633Z

用户以目标续跑指示签收批1清单（A 95 条 manual 显式化 + B 20 条 lex 前缀 + C 0 注解）并要求继续

## [build] 2026-09-19T15:48:25.138Z

偏差登记：21 条 legacy weak 不可转显式 lex: 前缀——lex: 前缀破坏 checker 对 The system SHALL NOT 类系统行为约束的豁免路径（实测 15 条误报），且其引号项为对象标识符（红线：行内码承载标识符）。该类保留 legacy 兜底，显式化留待后续'系统行为类红线通道'变更；批1 A类(50 manual 显式化)与 demo 批维持
