# Decision Log: legacy-cleanup-fix


## [open] 2026-09-13T13:54:55.257Z

授权边界裁决：用户指令处理遗留=遗留清单本身（affected_scopes 字符串防御 + findSpecDirs/SKIP_DIRS 对齐 + 扫描面去 temp 污染）；BP-18 升级条件以实质判断（无架构/接口变更、无 SHALL NOT 新增、均为一行的机械修复）视为未触发，裁决留痕；dashboard/state check 消费 phase_bps 维持延后

## [build] 2026-09-13T13:57:45.438Z

TDD：normalizeAffectedScopes（数组原样/字符串按逗号切分/空值空表）+ findSpecDirs 改用 SKIP_DIRS。修后 check drift 全绿（temp/probe spec_drift 警告清零）、validate unverifiable=0 覆盖率 100%。新增测试 tests/guard/affected-scopes-normalize.test.ts(4) + tests/core/utils-find-spec-dirs.test.ts(1)，全部先红后绿
