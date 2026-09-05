# MumuSpec 全流程与标准分析评价：确定性谱系与 CLI-first 落地

> 日期：2026-08-29　性质：分析 + 评价 + 落地依据（本文件是同日 .mumuspec 更新与 CLI 改动的评审基础）
> 评价准则（用户裁决）：**所有固定流程应通过 CLI 工具确定性执行；大模型只承担复杂规则的决策。**
> 数据来源：五阶段 SKILL.md 全量步骤盘点、workflow.yaml BP 定义、40+ CLI 命令面、状态机与 guard 实现走查（行号证据见文末索引）。

---

## 0. 结论先行

1. **工作流骨架的 CLI 化率已经很高**：阶段转换（state machine）、BP 阻塞确认（--confirm + 审计）、guard 校验、test-cases 锁定、归档合并/知识提取、worktree 清理——全部有确定性载体。**问题不在"缺命令"，而在三件事**：① 少数真缺口无命令（本日已补 3 个）；② 大量已有命令未被 skill 引用（LLM 每次重新手工执行等价操作）；③ skill 文档与 CLI 实现存在 6 处不一致（含 2 个无效状态机目标、1 个缺失 `--confirm` 的必拒调用、1 个 spec 要求但从未实现的命令）。
2. **"下一步"编排是 CLI 层的最大空洞**：`getNextPhaseHint` 仅覆盖 5 种纯 phase 驱动情形，不感知 verify_result==fail、build_pause、工件缺失、BP 等待状态——skill 的"结构化菜单"没有对应实现，导致编排知识只能活在 skill 文本里。
3. **LLM 决策域与确定性域的边界目前是隐式的**——本日将其显式化为规范约束（spec.md 新增「流程执行载体」块 + 根 constraints.yaml），这是"为目标增加限制、不限制过程"的流程面表达：**约束"什么必须由 CLI 做"，不约束 agent 怎么思考。**

---

## 一、确定性谱系：五阶段步骤分类

分类标准：**D0 纯确定性**（可完全 CLI 化，LLM 只需调用）→ **D1 薄封装**（git/shell 单命令包装）→ **H 混合**（CLI 执行 + LLM 组织内容/决策）→ **J LLM 决策**（创作/批判/澄清——保留给模型）→ **U 用户决策**（LLM 只传达，不得代答）。

### 1.1 各阶段分类汇总

| 阶段 | D0（应 CLI） | D1（薄封装） | H（混合） | J（LLM 决策域） | U（用户域） |
|---|---|---|---|---|---|
| Open | 变更骨架创建✅、decisions 追加✅（本日接线）、知识加载✅、契约加载✅ | worktree/分支创建⚠️ | 内容完整性检查（guard 可查，LLM 组织 proposal 内容） | brainstorming 需求澄清、BP-2 拆分判断 | BP-1/BP-3 确认 |
| Design | cognitive-map init/sync✅（本日接线）、test-cases init✅（本日接线）、test-cases lock✅、build_layers 写入（state set --json） | — | cognitive-map 条目撰写、design.md 撰写 | Q1-Q4 推理、Hyperplan 批判、grill-me 追问（CLI 可承载交互） | BP-4/BP-4.5/BP-5/6/7/8 确认 |
| Build | tasks 定位✅（本日新增 `tasks next`）、suite hash 锁定✅（本日新增 `lock-suite`）、layer 状态✅（本日新增 `state layer`）、Ponytail lint✅ | — | RED/GREEN 编码（测试/实现是创作，登记是 CLI） | 调试策略、BP-12/13 规范增量判断 | BP-9/10/11 选择与确认 |
| Verify | validate/check/drift/graph verify/test-cases verify/contract verify/knowledge verify ✅（全有）、verify.md 登记（state set）✅ | 轻/全量检查中的构建与测试执行⚠️ | 检查结果解读、偏差分类 | BP-15 漂移矛盾语义分析 | BP-14 失败决策、BP-16 分支处理 |
| Archive | 归档执行✅（archive --confirm：合并+知识提取+清理原子完成）、finalize-archive/merge✅ | push/建 MR/CI 触发⚠️ | 归档选项组织 | — | BP-17 最终确认 |

✅=已有 CLI 载体；⚠️=缺口（见 §二）。**结论：J/U 域占决策总量的绝大部分，D0 域 90% 已有载体**——"固定流程靠 LLM 自觉"的真实范围比直觉小得多，剩余工作是接线与补缺，不是重写流程。

### 1.2 BP 强制力矩阵（汇总 8/28 评审 + 本次盘点）

| 强制层级 | BP | 备注 |
|---|---|---|
| 状态机硬强制 | BP-3/4/17 | `--confirm` + 绕过审计（E-STATE-001）；BP-17 另有 archive --confirm 双保险 |
| CLI 工件强制 | BP-8 | test-cases lock + guard hash 校验 |
| 状态字段承载（事后校验） | BP-9/10/11 | build_pause/isolation/build_mode；guard 查事后字段 |
| CLI 可承载未接线 | BP-4.5 | grill-me run 已实现，本日接线 |
| 纯 skill 文本 | BP-1/2/5/6/7/12/13/14/15/16 | 交互性质居多，属 U/J 域，无需强改 |
| 纯 skill 文本（应检测化） | **BP-18** | 升级条件（文件数/schema 变更）有可检测信号；`recommend` 命令已实现同源逻辑但未接入预设路径判断——列为 P1 候选 |

---

## 二、缺口清单与处置

### A. 本日已补的确定性缺口（新增 CLI 命令）

| 命令 | 替代的手工步骤 | 位置 |
|---|---|---|
| `mumuspec tasks next <name>` | build Step 1 的 `grep -n '\- \[ \]' tasks.md \| head -1` | src/change/lifecycle.ts `getNextTask` |
| `mumuspec test-cases lock-suite <name> --layer N` | build Step 5c "计算 hash 写入 suite-map.yaml"（此前 suites_hash 字段**无任何写入命令也无消费者**） | `lockTestSuite` |
| `mumuspec state layer <name> <N> <status>` | build 中手工编辑 `.mumuspec.yaml` 的 build_layers[].status（`updateBuildLayerStatus` 函数早已存在，仅缺入口） | `updateBuildLayerStatus` 接线 |

### B. 已有载体、本日接线（skill 修正）

| skill 步骤 | 接线的既有命令 |
|---|---|
| 编排器快速修复（grep -c 四象限计数 + 两次 state set） | `mumuspec cognitive-map sync <name>`（一步等价） |
| design Stage 2 cognitive-map 初始化 | `mumuspec cognitive-map init <name>` |
| design Step 2.5 grill-me（BP-4.5） | `mumuspec grill-me run --phase design --change <name>`（含 --interactive 与 Fallback E 降级保留） |
| design Step 5 测试用例骨架 | `mumuspec test-cases init <name> --layers ...` |
| design Step 6 build_layers 写入 | `mumuspec state set <name> build_layers --json '<JSON>'` |
| open Step 7 decisions 追加 | `mumuspec decisions append --phase open --change <name> --text ...`（手工编辑会破坏 content_hash 审计链 → E-CHANGE-007） |

### C. skill 文档与实现不一致（本日已修 5 处 + 新发现 1 处）

| # | 位置 | 问题 | 修正 |
|---|---|---|---|
| 1 | phase-verify SKILL.md:173 | `state transition <name> verify-fail` **无效目标** | `state transition <name> build --reason`（verify→build rebuild 回退） |
| 2 | phase-archive SKILL.md:61 | `state transition <name> archive-reopen` **无效目标**（图无该边） | `state transition <name> build --reason`（archive-in-progress→build） |
| 3 | phase-archive SKILL.md:71/155 | `mumuspec archive <change-name>` 缺 `--confirm`，实际必拒（change.ts:258） | 补 `--confirm` |
| 4 | phase-design SKILL.md:362 | `decisions append` 缺 `--text`，实际必拒（decisions.ts:92） | 补 `--text` |
| 5 | 编排器 SKILL.md Guard/State 说明 | "transition --confirm 宽松/无法修复只能跳过"已过时——0.20 起它会校验目标合法性、强制 BP 确认并**审计绕过**（guard.bypass_audit=false 时拒绝，E-STATE-001） | 重写为当前真实语义（guard 为标准路径，transition --confirm 为被审计的例外路径） |
| 6 | **spec.md CAP 块** | 根 spec.md 要求 `mumuspec capability <command>` 命令（CAP-DESC-1，"CI 校验"），**命令从未实现** | 未改 spec（保留为 roadmap 需求，新 verifier 语义下其 Enforcement 归 manual 类）；列入 P1 待实现清单 |

### D. 未处置的候选（按 ROI 排序，供后续立项）

| 优先级 | 候选 | 理由与现状 |
|---|---|---|
| P1 | **`next` 结构化编排命令**（合并 getNextPhaseHint + guard 结果 + BP 等待 + 工件缺失 + tasks 剩余 → "已完成/待完成/可执行操作"菜单） | 现有 getNextPhaseHint 仅 5 种情形；这是"编排知识从 skill 移入 CLI"的核心件，但需要设计输出 schema，独立立项 |
| P1 | BP-18 升级条件检测化（接入 recommend/workflow-recommender） | 升级条件（文件数/schema 变更）有可检测信号，当前纯靠 LLM 自觉 |
| P1 | `mumuspec capability` 实现（或从 spec 降级删除） | spec 已承诺但从未实现；CAP-DESC-2 声称"CI 校验"不可兑现 |
| P2 | `isolation create <name> --mode worktree\|branch` | 薄封装 git worktree/branch；但 BP-11 分支命名含用户交互，需设计 |
| P2 | 归档子流程 A 的 push/MR/CI 触发 | 依赖宿主 git/gh 环境与远端策略，属用户域边缘 |
| P2 | verify 轻量/全量检查的构建+测试统一执行器 | 构建/测试命令高度项目特定（build_command 配置已有），收益存疑 |
| 不做 | state check --recover 的"恢复上下文"输出承诺 | 属 `next` 命令范围的一部分，合并处理 |

---

## 三、标准体系评价（对照 CLI-first 准则）

**做得对的**：

1. **CHG-5（行为/结果约束分离）** 是整个体系的正确底座——它就是"限制目标、不限制过程"在约束层的表达，0.20 的 P0/M2（可验证性四分类 + 红线恒 block）把这条原则推进到了 verifier 层。
2. **审计链设计**（decisions content_hash、state.confirm_bypass 审计、E-STATE-001）天然反对手工编辑审计工件——CLI-first 不是新原则，而是既有设计的自然延伸，本日只是把它显式化。
3. **预设路径（hotfix/tweak）** 证明了"流程可以薄"：skip 边 + 轻量守卫是确定性流程的示范。

**主要缺陷**：

1. **编排知识沉积在 skill 文本中**，与 CLI 实现无同步机制——本次发现 6 处不一致正是这个结构性问题的体现。skill 文本没有"与实现一致性校验"，而 spec 有 drift 检测。**建议（P1）：为 skill 中的 CLI 调用建立与 error-codes 同类的清单化生成/校验**（从命令注册表生成"允许的命令面"，skill 引用不在面上的命令即告警）。
2. **"下一步"能力碎片化**（status/next/recommend/advise/grill-me 各覆盖一角），没有一个命令能回答"我现在该做什么"——这是 LLM 被迫承担编排的根因。
3. **18 个 BP 的执行载体三层不对称**（8/28 评审已指出），本日将其中 2 个（BP-4.5 接线、BP-18 列为 P1 检测化）推进了一步，其余交互性 BP 属 U/J 域，维持 skill 承载是合理的。
4. **spec.md 曾写出从未实现的需求**（capability 命令、check --recover 的恢复上下文承诺）而无发现机制——在新的 verifier 语义下，SHALL 的 Enforcement 缺失会被 coverage 计量暴露，这类漂移未来会被 declared_ratio 抓住。

---

## 四、同日落地清单

| 类别 | 内容 |
|---|---|
| 新命令 | `tasks next`、`test-cases lock-suite --layer`、`state layer`（8 个新测试） |
| skill 修正 | 5 处不一致修复 + 6 处既有 CLI 接线 + Guard/State 说明重写（14 处编辑） |
| spec 更新 | 根 spec.md 新增「Verifier 语义与可验证性」「流程执行载体（CLI-first）」两个 Requirement 块；创建根 constraints.yaml（5 条目，含 always_enforce 红线）；prohibitions.md 追加审计工件禁改条目 |
| 未动 | demo 共存冲突（用户指示暂不关注）；P1/P2 候选见 §二 D |

---

## 附：证据索引

| 主题 | 位置 |
|---|---|
| 五阶段步骤原文 | `skills/mumuspec/{SKILL.md, phase-*/SKILL.md, workflow-presets/SKILL.md}` |
| BP 定义 | `skills/mumuspec/workflow.yaml:150-351`；图边 BP `src/change/workflow.default.yaml` |
| 状态机/守卫 | `src/change/state-machine.ts:87-160,402-437`、`src/cli/commands/guard.ts:15-110`、`src/cli/commands/state.ts:282-505` |
| 下一步逻辑 | `src/change/decisions.ts:37-105` |
| 本日新命令 | `src/change/lifecycle.ts`（lockTestSuite/getNextTask）、`src/cli/commands/state.ts`（lock-suite/tasks/layer） |
| 审计机制 | `src/core/utils.ts appendAuditLog`、`state.ts:133-160`（E-STATE-001） |
| capability 缺失 | 根 `.mumuspec/spec.md:161,190-196` vs CLI 注册表（无该命令） |
