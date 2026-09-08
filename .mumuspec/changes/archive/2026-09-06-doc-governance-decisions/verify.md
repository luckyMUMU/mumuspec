# Verify: doc-governance-decisions

## 验证结果

| 用例 | 结果 | 证据 |
|------|------|------|
| TC-1 structure-validator 接受 temp/ | PASS | `.mumuspec/temp/` 含文件时 `mumuspec validate` 通过，无 E-SPEC-013（230 constraints） |
| TC-2 glossary 以 canonical 为基准 | PASS | `check --glossary` 无 glossary-missing finding（.mumuspec/glossary.md 存在、docs 薄入口不参与判定） |
| TC-3 canonical 缺失软告警 | PASS（回归） | tests/glossary-checker.test.ts TC-4-4 通过（断言 missing.file 含 glossary.md，不崩溃） |
| TC-4 回归测试 | PASS | vitest: tests/glossary-checker.test.ts (6) + tests/structure-validator.test.ts (2)，8/8 passed |

## 合规校验

- `mumuspec validate`：PASS（230 constraints，declared_ratio 100%）
- 变更范围：5 文件（structure-validator.ts / glossary-checker.ts / glossary-checker.test.ts / spec.md / package.json），未超出 proposal Impact Scope
- 版本一致性：package.json 0.19.2-alpha.8 ↔ CLI 运行时同值（CHANGE-3 不变式）

## Enforcement 证据锚点

- TEMP-1 → TC-1
- GLOSSARY-1 → TC-2/TC-3
