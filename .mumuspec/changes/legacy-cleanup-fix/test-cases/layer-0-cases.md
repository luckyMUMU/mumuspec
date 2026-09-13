# Test Cases — Layer 0

## TC-01：normalizeAffectedScopes 数组原样
- 输入 [a, b] → 输出 [a, b]

## TC-02：normalizeAffectedScopes 字符串按逗号切分
- 输入 src/change, src/core → 输出 [src/change, src/core]（不再逐字符迭代）

## TC-03：normalizeAffectedScopes 空值
- 输入 undefined / 空 → 输出 []

## TC-04：findSpecDirs 排除 SKIP_DIRS
- 构造 temp/case-a/.mumuspec 与 mods/case-b/.mumuspec
- 预期：返回含 mods/case-b、不含 temp/case-a

## TC-05：collectManualItems 对字符串 affected_scopes 不抛 E-SECURITY-001
- 构造 affected_scopes 为含 / 的字符串，走 verify_to_archive 归一化路径
- 预期：按逗号切分为 scope 列表，不抛路径防护错误
