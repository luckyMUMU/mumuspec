# Decision Log: dogfood-migration-b1


## [open] 2026-09-19T15:40:32.468Z

用户签收决策一：仅语义与通道真实对应才升 strong/weak，映射不了的显式 manual(reason)，不作错配注解（F8 教训）

## [open] 2026-09-19T15:40:33.360Z

用户签收决策二：按文件分批回写（根 spec.md → roadmap → constraints.yaml），每批附逐条映射清单供签收

## [design] 2026-09-19T15:41:23.730Z

设计三分法与逐批签收流程落档；完成判据=legacy_weak 0 + implicit-manual 0 + legacy=false 演练绿
