# Verify: eval-corpus

## verify_result

pass

## 测试证据

- 全量回归：`vitest run` → **285 files / 5267 tests passed**（含新增 corpus.test.ts 18 用例、runner L0-C15~C32、verifiable-ratio L1-C01~C08、fail-open-count L1-C09~C16、eval-handler L2-C01~C13、corpus-fixtures、fixture-location L2-C09/C16）。
- 环境注记：git 不在子进程 PATH 时 36 项 spawn 类用例环境性失败（git init ENOENT），前置注入 PortableGit cmd 后全部转绿——非代码缺陷。
- 结构白名单修复（E-SPEC-013 drive-by）：TC-4 RED（evals/ 报 E-SPEC-013 复现回滚根因）→ 补登 `evals` → GREEN；`mumuspec validate` exit 0。
- 自检三件套：`mumuspec check` exit 0（drift OK）；`mumuspec validate` exit 0（337 constraints：strong 2 / weak 21 / manual 314 / unverifiable 0）；`eval run --report` 全场景 passed。

## 参考场景实跑（eval-corpus）

`mumuspec eval run --report`（dist 构建后）：

- eval-corpus: recall=1.000 (n=15, Wilson CI=[0.796, 1.000]) / noise=0.000 / precision=1.000
- 15 码 bad-case 全检出（含 E-SPEC-013 自身——白名单修复被语料闭环验证）；3 例 clean 零误报
- report-only warning 符合 M1 口径裁决（不声明 corpusExpect，避免 n<3 假红）
- verifiable-ratio / fail-open-count 两评估器进程内调用出值（weight=0，composite 收敛语义不变）

## SHALL / SHALL NOT 校验记录（对照 DS-EVAL-001~004）

| 约束组 | 验证通道 | 结果 |
|---|---|---|
| DS-EVAL-001 corpus 场景与多信号 kill | 词法锚点（corpus/recall/noise/coverage 字段名）+ 三态/空分母/三告警单测 | ✓ L0-C15~C32 + corpus-fixtures |
| DS-EVAL-002 custom 死端消除 | custom 分支单测（两态 + 零警告） | ✓ runner.test.ts 回归绿 |
| DS-EVAL-003 weight=0 评估器注册 | 注册三重断言（名称 / weight=0 / 权重和不变） | ✓ auto-evaluate.test.ts 19 tests |
| DS-EVAL-004 语料位置隔离与 --report | fixture-location 断言 + report 渲染单测 + 实跑 | ✓ L2-C09/C16 + Eval Report v1 |

- SHALL NOT 面：LLM 判定/手写指标（无——两评估器均确定性取数）、composite 权重不变（注册断言锁定）、语料不入 walker 扫描路径（fixture-location）、report 不改 check/validate JSON schema（L2-C09 顶层键集断言）——全部有对应负向或正向用例。
- manual 约束：本变更 delta-specs 全部为词法/单测锚点，无 manual 类约束，E-VERIFY-003 无强制对象。

## 验收标准对照

1. corpus 场景类型 + 多信号 kill + Wilson CI ✓（实跑 recall=1.000）
2. 三态聚合 + 空分母 fail-closed + report-only warning ✓（单测 + 实跑 warning 可见）
3. 两 weight=0 评估器注册且不变更 loop 收敛语义 ✓（三重断言 + metrics 输出）
4. .eval-corpus/ 位置隔离 + 15 码覆盖 + 3 registered-but-not-emitted ✓（fixture-location + 语料 19 fixtures）
5. --report 文本/JSON 双形态 + precision 展示 ✓（L2-C01~C13 + 实跑）
6. E-SPEC-013 白名单补登（verify 回滚根因）✓（TC-4 RED→GREEN + validate exit 0）
