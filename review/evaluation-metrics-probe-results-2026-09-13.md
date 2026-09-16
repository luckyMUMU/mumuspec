# QA 探测实验结果报告（评测指标体系 4 假设验证）

日期：2026-09-13
性质：探测实验结果（零引擎代码改动；探测脚本与原始数据在 temp/probe/，本文为固化结论）
前置：evaluation-metrics-deep-analysis-2026-09-13.md 第五节"QA 验证假设清单"
执行：software-eval-probe 团队——寇豆码（探测脚本）、严过关（运行判读）、主理人齐活林（汇编）

## 总览

| 探测 | 假设 | 结果 | 对计划的影响 |
|---|---|---|---|
| 1 变异算子杀伤分布 | 存活集 = checker 盲区清单 | ✅ 完成：50/60（0.83），**2 处实锤盲区 B-1/B-2** | M1 kill 判定改多信号 diff；checker 改进 backlog +2 |
| 2 Stryker 基线 | 95% 覆盖下验证强度可测 | ⛔ defer 至 M4（4 次尝试均阻塞于环境层，配置层已验证可行） | M4 走 devDependency 路线；structure-lint.ts 待杀集 = 14 mutants |
| 3 W 告警处置率回溯 | audit + decisions 可推导 B2b | ❌ **证伪**：318 行 audit 零告警事件 | M2 必须先加告警入账事件，B2b 基线从上线后累积 |
| 4 语料位置假阳性 | tests/fixtures/ 会污染主 validate | ✅ **实锤**：clean 语料仅因位置即 327→331 | **推翻 D2 默认值**：语料不得放被扫描路径 |

## 探测 1：变异算子杀伤分布

方法：`temp/probe/mutation-probe.mjs`，合成基线 spec（5 Requirement × 20 约束，clean 零错误零警告），O1-O6 各 10 个确定性变体，逐变体跑 `dist/cli.js validate --json`（O6 另跑 check），与基线做码 ∪ coverage 五字段 diff。

| 算子 | kill | 信号形态 |
|---|---|---|
| O1 通道剥夺 | 5/10 | 删整段→E-SPEC-004（落在 warnings[]，E- 码非阻断）+ manual 计数变化；**删单条 bullet→零信号** |
| O2 强度降级 | 10/10 | 纯 coverage 变化（total -1、enforced_weak -1），无任何码 |
| O3 语义模糊 | 10/10 | W-SPEC-016 每变体恰好 1 条 |
| O4 围栏走私 | 10/10 | 纯 coverage 变化——约束被 stripFencedBlocks **静默吞掉，零诊断码** |
| O5 结构破坏 | 5/10 | SHALL NOT 占位→重分类捕获；**SHALL 占位（'- XXX'）→零信号** |
| O6 路径破坏 | 10/10 | 间接信号（E-SPEC-004 + unverifiable + spec_drift）；带 Enforcement 的 `../` 条目不会被检出 |

**checker 盲区清单（核心产出）**：
- **B-1**：Enforcement 通道只查存在性不查数量映射——每 Requirement 2 条 Enforcement 删 1 条完全不可见（半数验证通道被砍零信号）。
- **B-2**：SHALL bullet 无内容合理性检查，占位符替换零信号——与 SHALL NOT 侧被四分类捕获形成不对称。

**方法论结论**：① M1 语料 kill 判定必须多信号 diff（码 ∪ coverage 五字段），否则 O2/O4 型全部误判存活；② 分档目标（R2）可行，但 B-1/B-2 型盲区须先补 checker 才能把对应语料计入 B1 分数——是 checker 改进项而非语料问题；③ 每格 n=10 下 0.5 kill 率的 Wilson 95% CI ≈ [0.19, 0.81]，正式评测必须扩样并报 CI；④ 六算子全部适用，O1 无需跳过逻辑；O1"不适用"预期被证伪（E-SPEC-004 能杀整段删除，好消息）。

## 探测 4：语料位置假阳性

方法：`temp/probe/fixture-location-probe.mjs`，基线 validate → 创建 clean 语料 fixture（内容零违规）→ 复测 diff → 自删恢复。

数据：clean 语料仅因**位置**（tests/fixtures/eval-corpus/）即使 coverage total 327→331、enforced_weak 21→23、manual 304→306；`false_positive_found: true`。findSpecDirs 只排除隐藏目录与 node_modules。

结论与影响：
1. **评测语料不能放 tests/fixtures/ 等被扫描路径**——放隐藏目录（如 `.eval-corpus/`）或独立项目根用独立 cwd 运行；**裁决项 D2 的 tests/fixtures 默认值作废**。
2. 备选增强：给 findSpecDirs 增加排除配置（默认跳过 tests/、temp/）——对用户生态同样有价值（用户测试夹具同样污染 coverage），CI drift gate 同受影响。
3. 探测遗留已清理：temp/probe/cases/（62 fixtures）已删除，temp/ 下零 .mumuspec 残留，仓库根 validate 恢复干净态（exit 0 / 0 错 0 警）。

## 探测 3：B2b 可推导性（证伪）

数据：audit.log 全量 318 行（探测时点）仅含状态机动作与系统副作用（change.create/archive 38+38、state 写入 audited 69、archive failed 15 全为 Windows EPERM 重试）；warn/check/lint/violation/exempt/waive 关键词 13 处命中全部是变更名 shall-structure-lint 的子串。40+ 份 decisions.md 仅 2 份叙述性提及 W- 码（bp-into-graph 的 W-GRAPH-001 等），无结构化处置记录。源码佐证：W- 码均在 checker 进程内存中产生、随命令输出丢弃，无入账路径。

结论：**B2b 有效噪声率不可推导**。M2 前置依赖确认：checker 输出聚合处增加 `check.warn` 签发事件（{code,severity,file,line,ts}）+ 处置事件（fixed/waived/not-triaged，与 R5 枚举对齐，挂 decisions 结构化字段或新 waive 命令）。历史无法回溯，基线从入账上线后累积——M2 应尽早排。（注：探测后会话外并发归档 legacy-cleanup-fix 使 audit.log 增至 337 行，新增仍为零告警事件，结论不变。）

## 探测 2：Stryker 基线（defer 至 M4）

4 次尝试均阻塞于环境层，配置层验证通过："Found 1 of 3129 files" + structure-lint.ts 成功插桩 **14 mutants**（40 行纯函数模块的待杀集规模）。

阻塞链根因：Stryker TSConfigPreprocessor 强依赖在其自身安装位置可解析的 typescript——npx ephemeral 安装模型不兼容（-p 注入不可靠、复跑重装清掉手工 junction）；隔离 npm 安装被沙箱拒绝。

M4 正式接入路线：`@stryker-mutator/core` + `@stryker-mutator/vitest-runner` 进 devDependency（与项目同树解析 typescript，问题消失）；dry-run 用限定 include 的 vitest 子配置规避全量 144s（`temp/probe/vitest.probe.config.ts` 已验证此思路，保留复用）。

## 计划修订落点（对 implementation-plan 的最终 delta）

| 编号 | 修订 | 状态 |
|---|---|---|
| R1' | E2 语料位置改为**隐藏目录/独立根**（D2 默认值作废）；可选配 findSpecDirs 排除配置 | 已定稿 |
| R2' | E1 kill 判定明确为**多信号 diff**（码 ∪ coverage 五字段）；正式评测扩样 + Wilson CI | 已定稿 |
| +BL1 | checker backlog：Enforcement 数量映射检查（B-1） | 新增 |
| +BL2 | checker backlog：SHALL 内容合理性检查（B-2，与 B-1 同批评审不对称性） | 新增 |
| +BL3 | checker backlog：stripFencedBlocks 吞约束时给 W 码（O4 静默消失） | 新增 |
| R4 | M2 告警入账事件（check.warn 签发+处置）为 B2b 硬前置，尽早排 | 已确认 |
| R6 | M4 Stryker 走 devDependency 路线，14 mutants 起步 | 已确认 |

## 附：探测产物清单（temp/probe/，均为暂存区合法内容）

mutation-probe.mjs / fixture-location-probe.mjs（可复现脚本）、results.json / fixture-location-result.json（原始数据）、run-smoke.log / run-full.log / run-locprobe.log（运行日志）、vitest.probe.config.ts（M4 复用）、qa-probe-report.md（QA 原始判读）。探测临时目录（cases/ 62 fixtures、stryker-env、stryker-tmp、杂散日志）已全部清理。
