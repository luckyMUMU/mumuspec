# Verify Report: shall-annotation-channel

## 验证结果：pass（全量验证）

| 检查 | 结果 |
|---|---|
| check（合规+漂移+术语，exit code） | 0 error；[drift] OK |
| validate（格式+Enforcement 覆盖） | 通过；371 约束 declared_ratio 100.0%，unverifiable=0 |
| test-cases verify（hash + 套件） | 通过（lock-suite，suites_locked=true，hash a9fcc805208a7877） |
| guard verify | 通过（0 errors / advisory warnings） |
| lint / build | tsc --noEmit 0 error；error-codes 文档重建 115 码 / 21 域 |
| 新增测试 | verifier-classify-shall.test.ts(7) + shall-annotation-channel.test.ts(6) = 13 例全绿 |
| 全量回归 | 285 files / 5263 tests 通过；6 失败文件（git.test.ts 13 / hooks guard-branches 6 / hooks guard-deep 13 / metadata-alignment 1，均环境性或既有漂移）与本变更无关 |

## Enforcement 覆盖（通道验证记录）

- SHALL_MACHINE_CHANNEL（ENF-1）：TC-L0-01（分类对称）、TC-L0-02（ast: 通道执行 E-GUARD-012 + 反例）、TC-L0-05（测试文件豁免）、TC-L0-06（子范围过滤）→ tests/spec/verifier-classify-shall.test.ts + tests/guard/shall-annotation-channel.test.ts
- NO_NEW_ENGINE / E-SPEC-004/015 保序（ENF-1 回归面）：TC-L0-03（无注解 SHALL → 仅告警）、TC-L0-04（无通道 SHALL NOT → E-SPEC-015 阻断）→ tests/guard/shall-annotation-channel.test.ts

## 过程裁决记录

- E-GUARD-011 已被 FREEZE_GATE_UNSIGNED_DECISION 占用 → 新码 E-GUARD-012（SHALL_UNSATISFIED），error-codes.md 重生成（115 码 / 21 域）。
- 分类对称实现裁决：SHALL 机器通道仅 R1（注解/`ast:` → enforced-strong），与 SHALL NOT 的 `ast:` 语义一致（原 enforce-weak 概念不适用 SHALL——weak=词法兜底保留给 SHALL NOT）；`lex:` 语法面留给下一变更（annotation-primary-r2），本变更不引入。
- `typeToConstraint` 映射提取为模块级共享常量 ANNOTATION_TYPE_TO_CONSTRAINT（checker 内单一权威源），checkAstViolation 消费同源。
- 测试严格执行语义沿用 checkShallNot：isTestFile 豁免、isAgentBehaviorConstraint 豁免（dogfooding）、isFileInScope 范围过滤。

## 分支处理

- 待归档：本机无 git（`git init` 无法执行），归档的分支提交/合并步骤需在 git 可用环境完成；按状态机 isolation=branch（mumuspec/shall-annotation-channel），归档时 git 步骤失败则按手动处理留痕。