# Verify: enforcement-gap

## 结果
- `npx vitest run`：299 files / 5353 tests 全绿（另修复合批：doctor advisory 通道 undefined-config 崩溃防护、W-SPEC-017 对 `ast:`/`lex:` 机器文本不误报、corpus-fixtures L2-C13 同批更新至 16 码）。
- `node dist/cli.js check`：exit 0；`status_assertion` 无矛盾项（上线当轮即拦下 Contract 0% vs 2552 行漂移，已按事实修正 STATUS）。
- `node dist/cli.js test-cases verify enforcement-gap`：✓ hash 一致。
- `mumuspec eval run eval-corpus --report`：recall=1.000 (n=16) / noise=0 / precision=1.000。
- `node scripts/ci-check.mjs`：STATUS 对账步骤 ✓。
- 执行面 e2e（tests/guard/constraints-entry-channel.test.ts）：constraints.yaml 带注解条目 forward 触发 E-GUARD-012、reverse 触发 E-GUARD-003，coverage 计入 enforced_strong≥2。

## TC 映射
- TC-L1-001/002/003 → tests/spec/verifier-entry-annotation.test.ts
- TC-L1-004/005 → tests/guard/constraints-entry-channel.test.ts
- TC-L1-006 → annotate 只读建议清单（constraintsSuggestions，JSON 追加字段）
- TC-L2-001..005 → tests/guard/status-assertion.test.ts
- TC-L2-006 → .eval-corpus/bad-drift-001 + clean-04（聚合绿）
- TC-L2-007 → ci-check.mjs Check 1.5（矛盾 fail；现状 0 矛盾）

## manual 核验记录
- ENF-1: 散文约束无注解保持 manual——由分类器单测与 e2e 第 3 例机器佐证（禁止为 constraints.yaml 条目另立第二套分类判定逻辑：实现复用 `classifyConstraintEntry` 单一判定序，`constraintEntryToItem` 仅做投影）。
- 禁止对账通道以语义判断决定进度好坏：核对 `checkStatusAssertions` 仅输出"断言 vs 事实"矛盾条目，无评分/好坏判断分支。
- 禁止改变 check/validate 既有 JSON schema：drift 项仅新增 `status_assertion` type 取值；CheckJsonPayload 字段未变（ci-check 与 corpus 消费面回归全绿佐证）。
- 禁止 LLM 计算或手写对账结果与 coverage 数值：全部数值出自确定性代码（单测 + Wilson CI 聚合输出复核）。

设计决策签收：用户在方案比选（AskUserQuestion）中选"方案一：引擎补角→语料迁移"并指示"执行直到达到预期"。
