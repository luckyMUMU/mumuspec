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

## manual 约束验证记录（E-VERIFY-003）

受影响 scope（`.`）全部 manual 约束按 Enforcement ID 逐组验证如下（词法锚定 + 实证陈述）：

- **PONYTAIL-1**：新增代码限于 tasks.md 声明的必要实现（corpus.ts 纯函数、runner 分支扩展、两评估器、--report 渲染、白名单一行补登）；复用既有 Evaluator 接口 / spawnSync / vitest 断言形态，无 boilerplate、无未被请求抽象，无复杂方案替代简单方案；无有意简化点故无 ponytail: 标记。
- **TEMP-1**：诊断与构建过程零临时文件落仓库根（侦查脚本全部 node -e 内联）；`.mumuspec/temp/` 唯一合法存放处与 gitignore 纪律经 validate exit 0 确认；本变更未产出需归档清理的过渡内容。
- **STRUCT-1**：spec frontmatter 有效、每正向要求含 Enforcement 条目、index 无漂移（validate exit 0 + index_drift OK）；本变更新增文件均落在已定义位置，无占位符文本。
- **CHANGE-1**：本变更全程 `mumuspec new` 跟踪、`state transition` 执行转换、`check` 全量校验通过（本轮实测）；版本号双写对齐（package.json / src/cli.ts）列为归档收尾必做步骤（见 verify.md 收尾记录）；prd/tech 双视角结构未被改动。
- **DOC-1**：verify.md / tasks.md 仅记结果与结论；无思考过程回顾、无生成元信息、无对齐类元注释；过期内容不保留（回滚后失效状态已由 CLI 状态机覆写）。
- **GLOSSARY-1**：本变更未引入需登记的新中文术语；corpus / recall / noise / precision / Wilson CI 沿用评测域既有英文术语，术语表无需扩充，与既有定义无矛盾。
- **CAP-1**：无新命令——`eval` 既有命令的 `--report` / `--json` 旗标扩展，能力层级不变；--report 纯只读不落盘（TEMP-4 红线），未引入不可逆操作，composable 语义未触碰。
- **V-1**：validate 输出四分类计量（337 约束：strong 2 / weak 21 / manual 314 / unverifiable 0，declared_ratio 100%）；本变更 delta 约束全部持词法/单测锚点，无 unverifiable；manual 验证记录即本节。
- **F-1**：确定性步骤全部 CLI 执行（state layer / state set / transition / guard / lock-suite）；hash 类字段（suites_hash / design_content_hash）均由 CLI 计算，LLM 零手写；skill 指引与命令注册表一致性由 phase-graph 测试（32 tests）回归锁定。
- **ENF-1**（完备性工件 / AGENTS.md 生成 / 约束密度 / advisory 抵达 / 权重单源 / 模块注册统一）：open-questions.yaml 与 assumptions.yaml 在变更目录存在且带 version 字段；权重单源不变量测试（weight-single-source.test.ts 6 tests）绿；constraint-density evaluator 既有语义未动；metrics --json 契约面回归绿（collect-metrics 5 tests）。
- **ENF-2**（一次通过率 / archive 幂等）：本变更 rebuild_count=1（verify→build 一次回滚，E-SPEC-013 环境根因修复后重走）；归档将走标准 `mumuspec archive --confirm` 幂等通道，不手工 rename；design-build-first-pass evaluator 既有实现未触碰。
- **ENF-3**（双签放行 / advisory advisory / 模块注册判定）：LLM 完备性判定未参与放行——verify_result=pass 基于本文件实证记录 + 机械门禁；无自动修改 constraint_strength；建议类输出（report-only warning）均 advisory 展示。
- **ENF-5**（phase skill 平权 / 信号进契约面）：本变更未改 skill 分发结构；metrics AGENTS.md 注入机制未动（AGENTS.md 由命令注册表生成，规则文件 32KiB 预算不受影响）。
- **ENF-6**（插件安装幂等登记）：本变更未触碰 install/bundle 面；无占位实现返回成功——corpus 场景 errored 态显式列明不入分母（DS-EVAL-001）。
- **ENF-9**（技能副本漂移可检测）：未触碰 skill 副本内容比对；A/B 面同步机制零改动。
- **ENF-12**（技能依赖可满足性）：未声明任何必须加载项；新增场景 YAML 仅含 name/type/corpusDir 三个既有字段。
- **ENF-14**（技能权威源单一）：未新增守卫检查字段；白名单条目 `evals` 对应实体目录与 init/runner 既有实现。
- **ENF-19**（技能门禁强度）：未改变任何合并/询问路径；report-only 不自动设阈值（M1 口径裁决，用户可选项未收窄）。
- **ENF-7**（元数据事实源对齐）：docs/STATUS.md 与 package.json 版本对齐列为归档收尾必做步骤（regen-rules 后统一执行）。
- **PHASE_BPS_LOADER**：本变更未动 workflow 段与 phase_bps 解析；fail-safe 路径（console.warn + 内置默认）回归绿（phase-bps.test.ts 6 tests）。
- **PHASE_BPS_VERIFY**：W-GRAPH-001 WARN 语义未触碰；config.yaml ai.rules_files 未改动；graph verify 一致性检查不受本变更影响（全量 phase-graph 32 tests 绿）。

## 收尾绑定记录

- 版本号对齐（package.json / src/cli.ts / README / docs/STATUS.md / CHANGELOG）与 regen-rules.mjs 重生成在 archive 收尾执行——归档命令的事务边界，不在 verify 阶段预执行。
