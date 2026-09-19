# 批1映射清单：根 spec.md（签收后回写）

## A. implicit-manual → 显式 manual(reason)：95 条

| 行号 | ID | 原文（核验方式描述） | 处置 |
|---|---|---|---|
| 37 | PONYTAIL-1 | lint rule: detect unnecessary abstraction patterns (YAGNI ch | 改 manual(...) 包原句 |
| 38 | PONYTAIL-2 | lint rule: check for unnecessary new dependencies | 改 manual(...) 包原句 |
| 39 | PONYTAIL-3 | lint rule: detect boilerplate code patterns | 改 manual(...) 包原句 |
| 40 | PONYTAIL-4 | lint rule: detect overly clever solutions | 改 manual(...) 包原句 |
| 59 | TEMP-1 | `.mumuspec/temp/` 使用时创建，结构校验器不得因 temp/ 存在报 E-SPEC-013 | 改 manual(...) 包原句 |
| 60 | TEMP-2 | `.mumuspec/temp/` 必须在根 `.gitignore` 中被排除 | 改 manual(...) 包原句 |
| 61 | TEMP-3 | finalize-archive 阶段必须提示用户清理 temp/ | 改 manual(...) 包原句 |
| 62 | TEMP-4 | 禁止在 .mumuspec/ 根目录存放非规范文件（白名单：spec.md/prd.md/tech.md/design. | 改 manual(...) 包原句 |
| 78 | STRUCT-1 | frontmatter 校验（layer 为数字，scope 为有效路径） | 改 manual(...) 包原句 |
| 79 | STRUCT-2 | SHALL 必须有对应 Enforcement 条目 | 改 manual(...) 包原句 |
| 80 | STRUCT-3 | 新增模块必须在 index.yaml children 中注册 | 改 manual(...) 包原句 |
| 146 | CHANGE-1 | 检查 .mumuspec/changes/ 目录存在 active 变更 | 改 manual(...) 包原句 |
| 147 | CHANGE-2 | 检查 phase 转换符合状态机规则 | 改 manual(...) 包原句 |
| 148 | CHANGE-3 | prebuild-check.mjs 校验 package.json 与 src/cli.ts 版本一致性 | 改 manual(...) 包原句 |
| 149 | CHANGE-4 | 变更内容涉及代码或规范时，version 字段必须有语义化版本增量 | 改 manual(...) 包原句 |
| 150 | FA-1 | finalize-archive completes all sub-processes atomically (or  | 改 manual(...) 包原句 |
| 151 | FA-2 | finalize-archive verifies all delta-specs were merged before | 改 manual(...) 包原句 |
| 152 | FA-3 | finalize-archive respects backward compat — old spec.md/desi | 改 manual(...) 包原句 |
| 169 | DOC-2 | enforced-weak(正则兜底可提取：扫描"（与 …对齐）"类括号元注释与"本次/此次更新"类过程回顾句式) | 改 manual(...) 包原句 |
| 184 | GLOSSARY-1 | glossary.md 必须存在于项目根 `.mumuspec/` 目录 | 改 manual(...) 包原句 |
| 185 | GLOSSARY-2 | glossary.md 每条目必须包含"术语 / 英文 / 定义"三要素 | 改 manual(...) 包原句 |
| 186 | GLOSSARY-3 | 新增命令/模块时检查 glossary.md 是否同步更新 | 改 manual(...) 包原句 |
| 221 | CAP-1 | 每个命令必须在代码中声明 `CommandMetadata`，包含 `tier` / `risk` / `confirm | 改 manual(...) 包原句 |
| 222 | CAP-2 | 专用工具必须经过完整守门流程才能执行（可通过 `mumuspec capability <cmd>` 验证） | 改 manual(...) 包原句 |
| 223 | CAP-3 | 通用能力组合不得产生文件系统副作用（测试覆盖） | 改 manual(...) 包原句 |
| 224 | CAP-4 | 不可逆操作必须等待二次确认，确认输入必须匹配变更名称 | 改 manual(...) 包原句 |
| 225 | CAP-5 | dry-run 输出与实际执行输出格式必须一致（schema 校验） | 改 manual(...) 包原句 |
| 226 | CAP-DESC-1 | `mumuspec capability` 必须能返回所有已注册命令的元数据 | 改 manual(...) 包原句 |
| 227 | CAP-DESC-2 | 能力元数据必须与代码实现一致（CI 校验） | 改 manual(...) 包原句 |
| 228 | CAP-DESC-3 | 能力层级变更必须在 `.mumuspec/contracts/` 中有对应记录 | 改 manual(...) 包原句 |
| 245 | V-1 | E-SPEC-015 SPEC_SHALL_NOT_UNVERIFIABLE（ERROR, forceable: fal | 改 manual(...) 包原句 |
| 246 | V-2 | E-VERIFY-003 MANUAL_EVIDENCE_MISSING（ERROR, forceable: true， | 改 manual(...) 包原句 |
| 247 | V-3 | enforcement_coverage 计量（src/spec/verifier-classify.ts 纯函数分类器 | 改 manual(...) 包原句 |
| 248 | V-4 | docs/design/constraint-strength.md §9.0 可验证性前置判定（求值序 0） | 改 manual(...) 包原句 |
| 265 | F-1 | E-CHANGE-007 decisions content_hash 篡改检测 | 改 manual(...) 包原句 |
| 266 | F-2 | E-STATE-001 受保护字段审计 / guard.bypass_audit 拒绝 | 改 manual(...) 包原句 |
| 267 | F-3 | `mumuspec tasks next` / `test-cases lock-suite --layer` / `s | 改 manual(...) 包原句 |
| 268 | F-4 | 状态机边校验（无效目标阶段即拒绝，含 verify-fail/archive-reopen 类历史误写） | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(schema 校验：字段、状态枚举、version 存在) | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(工件状态与 decisions 日志交叉断言：resolved 条目必有决策去向) | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(guard 单元测试：无签收 + LLM 判完备 → 断言 block) | 改 manual(...) 包原句 |
| 312 | ENF-4 | enforced-strong(guard 单元测试：机械校验失败 → 断言 block 优先于任何 advisory  | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(install/init 落盘断言：AGENTS.md 存在且含四要素；CLAUDE.m | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(源码级断言：生成路径中不出现 .cursorrules / .windsurfrules | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(容量断言：生成产物 ≤ 32KiB) | 改 manual(...) 包原句 |
| 313 | ENF-5 | enforced-strong(对每个 AgentType 执行 install 后断言五个 phase skill 文 | 改 manual(...) 包原句 |
| 265 | F-1 | 既有实例——可验证性四分类校验器（verifier-classify）+ E-SPEC-015 红线未声明验证方式恒 b | 改 manual(...) 包原句 |
| 266 | F-2 | 既有实例——状态机边校验拒绝无效目标阶段（E-CHANGE-006）与受保护字段审计（E-STATE-001） | 改 manual(...) 包原句 |
| 267 | F-3 | 本变更新增实例——分发层生成器以声明式配置为输入、生成物经代码校验；完备性门禁 schema 校验器拒绝非法 open- | 改 manual(...) 包原句 |
| 268 | F-4 | drift / CI 校验覆盖新增规则 schema，防止规则与校验器漂移 | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(单元测试：给定固定规范链输入，断言归一化值与 rawData 明细) | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(单元测试：构造含/不含 rollback 记录的变更目录夹具，断言占比与样本量) | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(单元测试：低通过率+高密度夹具 → 断言建议文本含"放宽"；配置文件字节不变断言) | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(单元测试：遍历 registerBuiltInEvaluators 后的注册表，断言权重 | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(单元测试：构造 rename 失败夹具（占用目标路径），断言版本号未被 bump 且 a | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(单元测试：BOUNDARY-only 夹具目录 → checker 不再报 index_ | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(单元测试：构造含建议的评估结果，断言 LoopEvaluation.suggestion | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(单元测试：断言 metrics snapshot 保留 suggestions；配置文件 | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(单元测试：非 loop 变更下 `metrics` 返回约束密度与一次通过率两项) | 改 manual(...) 包原句 |
| 312 | ENF-4 | enforced-strong(单元测试：执行 `metrics` 后变更 state 文件字节不变) | 改 manual(...) 包原句 |
| 313 | ENF-5 | enforced-strong(单元测试：`--json` 输出可解析且字段完整) | 改 manual(...) 包原句 |
| 569 | ENF-6 | enforced-weak(实跑断言：AGENTS.md 速查含 metrics 条目，全文 ≤ 32KiB) | 改 manual(...) 包原句 |
| 586 | ENF-7 | enforced-strong(单元测试：断言 STATUS.md 当前包版本字符串等于 package.json ve | 改 manual(...) 包原句 |
| 587 | ENF-8 | enforced-strong(单元测试：断言 config.yaml ai.rules_files 不含遗留目标) | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(phase-guard design_to_build：I1 覆盖断链检测 E-GUAR | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(phase-guard build_to_verify 与 mumuspec state | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(单元测试：state layer 对同层多 scope 的歧义目标必须报错；低层未完成时 | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(constraint-provenance 检查：E-CONSTRAINT-001/00 | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(既有边界通道：I1 E-GUARD-009/W-GUARD-009；I2 W-BUILD | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(单元测试：生成的插件清单逐字段比对官方规则——name 正则、version 语义化、d | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(单元测试：路径正负样例——以点斜杠开头的相对路径通过；绝对路径、上溯段、反斜杠、缺前缀被 | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(单元测试：source 指向不存在目录时校验失败) | 改 manual(...) 包原句 |
| 312 | ENF-4 | enforced-strong(单元测试：包版本等于运行时包版本，不出现硬编码回退值) | 改 manual(...) 包原句 |
| 569 | ENF-6 | enforced-strong(单元测试：两次安装后登记条目数为 1；版本段等于包版本；installedAt 不变而  | 改 manual(...) 包原句 |
| 586 | ENF-7 | enforced-strong(单元测试：登记文件为非法 JSON 时返回失败而非成功) | 改 manual(...) 包原句 |
| 587 | ENF-8 | enforced-weak(实跑：安装后目标路径存在清单与技能文件) | 改 manual(...) 包原句 |
| 762 | ENF-9 | enforced-strong(单元测试：改动源正文产生诊断；仅改动版本行不产生诊断) | 改 manual(...) 包原句 |
| 763 | ENF-10 | enforced-strong(单元测试：漂移诊断出现在 check 的 drift 数组，且 CI 检查消费同一函数) | 改 manual(...) 包原句 |
| 764 | ENF-11 | enforced-weak(实跑：修复后 `mumuspec check` 无该诊断) | 改 manual(...) 包原句 |
| 783 | ENF-12 | enforced-strong(单元测试：伴随能力枚举覆盖技能文本中声明的全部外部名称，且解析结果与实际搜索面一致) | 改 manual(...) 包原句 |
| 784 | ENF-13 | enforced-weak(实跑：伴随能力全缺失时阶段流程仍可完成并留痕) | 改 manual(...) 包原句 |
| 805 | ENF-14 | enforced-strong(单元测试：技能文本中不出现已知幽灵字段名；分发表定义处唯一) | 改 manual(...) 包原句 |
| 806 | ENF-15 | enforced-strong(单元测试：阶段技能的守卫目标阶段合法，取值域为状态机实际边) | 改 manual(...) 包原句 |
| 807 | ENF-16 | enforced-strong(单元测试：技能文本引用的命令及其参数签名逐条命中命令注册表——含正向样例与四类已知漂移的 | 改 manual(...) 包原句 |
| 808 | ENF-17 | enforced-strong(单元测试：命令模块集合与注册表条目集合双向闭包——有模块无注册即失败) | 改 manual(...) 包原句 |
| 826 | ENF-19 | enforced-strong(单元测试：高风险门禁段落不含无条件跳过表述) | 改 manual(...) 包原句 |
| 851 | PHASE_BPS_LOADER | tests/change/phase-graph-loader-bps.test.ts TC-L0-01..06（合法解 | 改 manual(...) 包原句 |
| 865 | PHASE_BPS_VERIFY | tests/change/phase-bps.test.ts TC-L1-01..06（报告清单/18 BP 并集/一致 | 改 manual(...) 包原句 |
| 994 | ITA-2 | unit-tests(rules-generator 对 traecode/traework 渲染非空 AGENTS.m | 改 manual(...) 包原句 |
| 1022 | ITA-3 | unit-tests(helpers 子命令：project-only 缺省 cwd、与 --target user 互 | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(单测断言：条目判定序与 spec 条目同函数出处；tests/spec/verifier | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(端到端断言：带注解条目在违规源上触发 E-GUARD-012/003；tests/gua | 改 manual(...) 包原句 |
| 291 | ENF-1 | enforced-strong(表驱动单测：四类断言矛盾/一致/不可解析三态；tests/guard/status-as | 改 manual(...) 包原句 |
| 292 | ENF-2 | enforced-strong(语料断言：bad-drift-001 必命中、clean-04 零误报；eval-cor | 改 manual(...) 包原句 |
| 311 | ENF-3 | enforced-strong(CI 断言：ci-check 对账步骤矛盾即 exit 1) | 改 manual(...) 包原句 |

## B. legacy weak → 显式 lex: 前缀：20 条

| 约束文本（截断） | 处置 |
|---|---|
| Module-level `spec.md` SHALL NOT coexist with `tech.md` in the same `. | 加 lex: 前缀 |
| Module-level `design.md` SHALL NOT coexist with `prd.md` in the same ` | 加 lex: 前缀 |
| The loader SHALL NOT load both `prd.md` and `tech.md` with the same fi | 加 lex: 前缀 |
| The system SHALL NOT enforce `single_active_change` globally when per- | 加 lex: 前缀 |
| The system SHALL NOT create changes in root `.mumuspec/changes/` when  | 加 lex: 前缀 |
| Init SHALL NOT overwrite existing `prd.md` or `tech.md` files without  | 加 lex: 前缀 |
| 禁止在文档中写对齐来源、修改说明类元注释（如"（与 XX 对齐）"、"本次更新了…"） | 加 lex: 前缀 |
| SHALL NOT 将通用能力标记为专用工具以提高"重要性"（分层基于风险等级） | 加 lex: 前缀 |
| SHALL NOT 跳过专用工具的前置校验（即使"看起来没问题"） | 加 lex: 前缀 |
| SHALL NOT 通过 `mumuspec capability` 查询不到的层级作为执行依据 | 加 lex: 前缀 |
| 禁止以 `--force` 越过 E-SPEC-015（forceable: false；唯一出路是补 annotation、改写为可提取文 | 加 lex: 前缀 |
| 禁止自动注解产出与约束语义无关的通道映射（如"样板代码→no-side-effect"，F8 教训） | 加 lex: 前缀 |
| 禁止手工编辑由 CLI 管理的审计与状态工件：decisions.md 追加（须 `decisions append`，手工编辑破坏 con | 加 lex: 前缀 |
| 禁止以自由文本形式声明"设计完备"（完备性结论必须可由工件状态推导）。 | 加 lex: 前缀 |
| 禁止生成 `.cursorrules` 与 `.windsurfrules`（遗留格式）。 | 加 lex: 前缀 |
| SHALL NOT 将约束密度直接判定为"好/坏"质量分（密度是调节信号，质量判定归 spec-compliance / drift-sco | 加 lex: 前缀 |
| SHALL NOT 以"下游硬过滤兜底"替代事实源自身干净（兜底是防线，不是许可）。 | 加 lex: 前缀 |
| SHALL NOT 保留未被注册的命令模块，也不得以"有测试覆盖"代替"已接线"。 | 加 lex: 前缀 |
| SHALL NOT 以"技能不可用"为由静默跳过高风险门禁。 | 加 lex: 前缀 |
| SHALL NOT 让 `--installed` 列表在 `--project-only` 下扫描错误的目录（应按 workspace+c | 加 lex: 前缀 |

## C. annotation 候选：0 条（autoAnnotate 与人工复核均未发现语义真实对应的可注解项——决策一宁缺勿错配）
