# Proposal: legacy-cleanup-fix

## Why

CHG-8 归档过程暴露两个遗留缺陷：
1. guard 侧消费 affected_scopes 时对字符串值逐字符迭代（for..of），含 / 的字符触发 E-SECURITY-001、. 圈定全量根规范 manual 面（E-VERIFY-003 记录面失真）。
2. findSpecDirs 未复用 SKIP_DIRS（temp 在集合中但未被使用），temp/ 下测试探针夹具（temp/probe/*/.mumuspec/spec.md）被计入规范扫描面，污染 spec_drift 警告、validate 覆盖率与 agents-hash。

## What

1. phase-guard 新增导出 normalizeAffectedScopes(v): string[]——数组原样、字符串按逗号切分并过滤空项；collectManualItems 调用处改为消费归一化结果。
2. findSpecDirs 改用共享 SKIP_DIRS 集合（消灭与 code-scanner/ponytail-linter 的独立排除实现）。

## Impact Scope
- src/guard/phase-guard.ts
- src/core/utils.ts
- tests/guard/affected-scopes-normalize.test.ts
- tests/core/utils-find-spec-dirs.test.ts

## Workflow
hotfix
