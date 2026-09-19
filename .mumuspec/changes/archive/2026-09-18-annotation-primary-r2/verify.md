# Verify Report: annotation-primary-r2

## 验证结果：pass（全量验证）

| 检查 | 结果 |
|---|---|
| check（合规+漂移+术语，exit code） | 0 error；[drift] OK（E-AGENTS-001 由 regen-rules.mjs 重建后消除） |
| validate（格式+Enforcement 覆盖） | 通过；371 约束 declared_ratio 100.0%，unverifiable=0 |
| test-cases verify（hash + 套件） | 通过（lock-suite，suites_locked=true，hash 500009bad26b52bf） |
| guard verify | 通过（0 errors / advisory warnings） |
| lint / build | tsc --noEmit 0 error；error-codes 文档重建 115 码 / 21 域 |
| 新增测试 | verifier-classify-policy.test.ts(5) + annotation-primary-r2.test.ts(4) = 9 例全绿 |
| 全量回归 | spec+guard（38 文件 506 例）全绿；cli/core/mcp 目录 2285 例通过；残余失败（git.test / cli.test git init / hooks / metadata-alignment STATUS.md 版本漂移）均环境性或既有漂移，与本变更无关 |

## Enforcement 覆盖（通道验证记录）

- LEXICIAL_EXPLICIT（ENF-1）：TC-L0-01（legacy 缺省兼容执行）、TC-L0-02/04（legacy=false 去沉默词法 + E-SPEC-015 出口）、TC-L0-03/06（lex: 前缀显式入口）、TC-L0-05（覆盖报告 legacy_weak/actionable_weak 追加字段，unverifiable_items 语义不变）、TC-L0-01b（legacy=false 注解 AST 通道仍执行）→ tests/spec/verifier-classify-policy.test.ts + tests/guard/annotation-primary-r2.test.ts

## 过程裁决记录

- R2 门控实现裁决：`classifyConstraint` 增可选 `opts.legacyLexical`（缺省 true，兼容面零变化）；`lex:` 前缀无条件 enforced-weak（weakSource='lex'），legacy 兜底标 weakSource='legacy' 供报告区分。
- `checkShallNot` 去沉默词法：legacy=false 时无注解无 `ast:`/`lex:` 前缀的 SHALL NOT 跳过检查（回落 unverifiable → E-SPEC-015 出口），不再静默执行正则兜底。
- E-SPEC-015 文案在 checker 与 validator 双处同步扩展（"出路：补 annotation / ast: / lex: / manual(reason)"），errors.ts fixSteps 同步；code 语义不变量（strict 阻断）不变。
- 配置键 `specs.legacy_lexical_channel` 默认 true（config-io），类型为可选（migrations/旧配置缺省容错，消费处 `?? true`）。
- 结果收口副作用：A1 归档合并 spec 后 AGENTS.md 漂移（E-AGENTS-001）由 regen-rules.mjs 重建消除。

## 分支处理

- 待归档：本机无 git（`git init` 无法执行），归档的分支提交/合并步骤需在 git 可用环境完成；按状态机 isolation=branch（mumuspec/annotation-primary-r2），归档时 git 步骤失败则按手动处理留痕。