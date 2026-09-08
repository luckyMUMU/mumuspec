# Test Cases - Layer 0

## Cases

### TC-1: structure-validator 接受 .mumuspec/temp/ 目录
- Given: 项目 .mumuspec/ 下存在 temp/ 子目录（含任意文件）
- When: 运行结构校验（validate / check）
- Then: 不产生 E-SPEC-013（未定义目录），temp/ 内文件不触发白名单告警

### TC-2: glossary-checker 以 .mumuspec/glossary.md 为存在性基准
- Given: 项目存在 .mumuspec/glossary.md、不存在 docs/reference/glossary.md
- When: 运行 glossary 漂移检查
- Then: 不产生 glossary-missing finding

### TC-3: glossary-checker 缺失 canonical 时软告警不崩溃
- Given: 项目既无 .mumuspec/glossary.md 也无 docs/reference/glossary.md
- When: 运行 glossary 漂移检查
- Then: 产生 glossary-missing finding（指向 .mumuspec/glossary.md），不崩溃

### TC-4: 现有测试套件回归
- When: npx vitest run tests/glossary-checker.test.ts tests/structure-validator.test.ts
- Then: 全部通过
