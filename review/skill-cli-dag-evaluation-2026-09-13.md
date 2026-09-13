# Skill 组合 × CLI 命令面 × DAG 编排设计 — 系统评估（2026-09-13）

> 范围：A/B 两面 skill、CLI 命令面（36 注册函数 / 58 顶层命令）、三层图定义（引擎 YAML / 项目 override / skill 分发表）
> 前序：本报告在 `skill-composition-audit-2026-09-12.md` 基础上（1）核实昨日 P0/P1/P2 修复状态；（2）把 **CLI 命令面**与 **DAG 编排设计**纳入评估范围。
> 证据强度：本轮全部正面断言均经文件/哈希/代码复验。

---

## 0. 昨日审计（2026-09-12）修复状态核验

| 昨日项 | 状态 | 证据 |
|---|---|---|
| P0-1 重装 + 漂移检测 | ✅ 已闭环 | A/B 7 包 SHA256 **7/7 SAME**（本轮哈希复验）；`src/guard/skill-drift.ts` 实现 `W-SKILL-001` 并接入 `check`（`spec.ts` 收集 `['skill-drift', collectSkillDrift]`），错误码已注册 `errors.ts` |
| P0-2 幽灵字段三态 | ✅ 已闭环 | 5 份 SKILL.md Red Flags 表已无 `design_layers_covered` 等 6 个幽灵字段；`workflow.yaml` guards 段现无幽灵项 |
| P0-3 编排器四写 | ❌ **仍开放**（属"需裁决"项） | A 面仍有 4 份编排文本：`mumuspec/SKILL.md`（中文 366 行）、`mumuspec-workflow/SKILL.md`（英文）、`en/orchestrator-en.md`（v0.12.2）、`workflow.yaml`；B 面仍无中文编排器 |
| P1-1 required 诚实化 | ✅ 已闭环 | 全部 phase skill 改为"伴随能力（companion）"框架 + `mumuspec skill companions` 代码侧探测（`src/install/skill-companions.ts`） |
| P1-2 审查门禁强度 | ✅ 已闭环 | `phase-build` Step 7 现为"不允许无条件跳过，必须四角度自审并写 tasks.md" |
| P1-3 tweak 陷阱回填 | ✅ 已闭环 | A 面 `workflow-presets` 已含静默失败陷阱 + `finalize-archive --keep-old` 补救段 |
| P2-2 守卫测试 | ✅ 已闭环 | `tests/guard/skill-registry.test.ts` 存在（含参数签名断言） |
| P2-1 BP-9/10 合并 | ❌ 未执行 | `phase-build` Step 3 / Step 4 仍为两次独立暂停 |

**新增发现（本轮，昨日未覆盖）**：
- **N1｜phase-archive 同文件自相矛盾**："Phase Guard 调用"段（`:163-178`）的 `archive_complete` 清单仍列 `active_change_slot_released: true` 与 `spec changes committed to main branch`，而同文件"退出条件"段（`:147-152`）明确"不存在活跃变更槽位结构""规范变更未自动提交（D6 需手工 git merge）"。同文件两段互斥 = 第三态残留，违反项目自身"同一事实唯一权威源"红线。
- **N2｜三层图定义并存**（详见 §2）：引擎层两份 schema 统一且受测；skill 侧第三份 schema 漂移、无引擎消费者。
- **N3｜BOUNDARY.md 计数注记过期**：`BOUNDARY.md:17` 写"35 次 register 调用（2026-09-10）"，实测 `index.ts` 为 **36**（cognitive-map 接线后未回改该行；注册表本身已含 cognitive-map，仅注记漂移）。

---

## 1. 评估对象与边界

| 面 | 位置 | 内容 |
|---|---|---|
| A 面源 | `skills/` | 9 件：中文编排器 + 英文 lifecycle + 5 phase + presets + sync + workflow.yaml + en/orchestrator-en.md |
| B 面装载 | `%USERPROFILE%\.workbuddy\skills\` | 8 件：mumuspec-workflow + 5 phase + presets + mechanism-circuit-audit（**编排器中文版与 sync 仍不装载**，由 `WORKBUDDY_PACKAGES` 决定） |
| CLI 命令面 | `src/cli/index.ts` + 43 文件 | 36 个 register 调用 → 58 顶层命令；BOUNDARY.md 为边界契约 |
| DAG 引擎 | `src/change/workflow.default.yaml` + `phase-graph-loader.ts` + `phase-graph.ts` | version 1，单一事实源（CHG-6）；项目级 `.mumuspec/workflow.yaml` override（CHG-7） |
| skill 分发表 | `skills/mumuspec/workflow.yaml`（v0.12.2） | orchestrator dispatch + 第二份图 + presets + guards 汇总 |

## 2. DAG 编排设计专项

```
节点: open → design → build → verify → archive-in-progress → archive-completed
                                                  └→ discarded（五处 skip 终态边）
环:   build→design(rollback) · verify→design(rollback) · verify→build(rebuild) · archive→build(rollback)
捷径: open→build（skip, condition workflow_in:[hotfix,tweak]）
```

**优势（有证据）**：
1. **环显式且受计数约束**：4 条 backward 边各自 `count_as: rollback|rebuild`，配 `rollback_limit: 3` / `rebuild_limit: 5`，回退不是自由边而是有预算的资源。
2. **fail-safe 语义完整**：`loadWorkflowConfig` / `loadProjectWorkflowConfig` 在缺失/损坏/非法时 `console.warn + buildFallbackConfig()`，且 fallback 与历史硬编码图同构（AC-01 测试锁定）——配置层 fail-open 与项目"fail-open 优先"元结论一致。
3. **单一事实源 + 项目 override 分层正确**：CHG-6 引擎 YAML 是唯一权威；CHG-7 项目 override 与默认同 schema、同校验、损坏即回退（本仓库 dogfood 当前与默认一致）。override 生效路径有明确 `source: 'project'|'default'` 可判定事实。
4. **BP 挂边**：3 个人工确认点（BP-3/BP-4/BP-17）作为边属性进入图，`state transition --confirm` 绕过时写审计（`guard.bypass_audit`）。

**不足（有证据）**：
1. **编排契约不完整**：18 个 BP 只有 3 个在图上。BP-5~8、9~13、14~16 只活在 phase skill 的 prose 里，`graph verify` / dashboard 无法机器判定"这个阶段的决策点齐了没有"——**图的完备性无法被校验**，恰是本项目对 spec 文本要求而对引擎自身放松的形态（缺陷同构第六例）。
2. **skill 侧第二份图已实质漂移**：`workflow.yaml` 的 graph 用 `blocking_point: {bp: BP-3}`（引擎是 `bp: {id: BP-3}`）、presets 表（引擎是 workflows 表 + `skip_design`）、条件语法 `workflow == 'hotfix' OR 'tweak'`（引擎是 `workflow_in`）。schema 不同 → 不可能用同一校验器 → 漂移不可检测。它同时是 18 个 BP 的唯一结构化定义（4 份 review 引为权威），但**引擎不读它**（死端）。
3. **loop workflow 零覆盖**：引擎 `WORKFLOW_KEYS` 强制含 `loop`（`phases: [build, verify, archive]`），无任何 skill 文档化此路径——引擎能力与 skill 载体脱钩。
4. **限流不属图**：rollback/rebuild 上限在 per-change `.mumuspec.yaml` 而非图配置，图无法表达"哪条边消耗多少预算"的策略差异。

## 3. CLI 命令面专项

**优势**：
1. **文档-代码同构由测试锁定**：`tests/cli/commands/check-json.test.ts` TC-L3-1 断言 `index.ts` 每个 `registerX` 与 BOUNDARY.md 双向闭包（含计数硬断言与参数签名断言）。58 命令 × 漂移前科（20 类已修）证明这个守卫不是仪式。
2. **CLI-first 落地真实**：`state set/layer/tasks next/test-cases lock-suite` 把 hash 计算、grep 定位、手编状态文件从 skill prose 移进引擎（确定性、可测试）。
3. **读写分离**：MCP 面 38 个只读工具，写操作（new/transition/archive）留 CLI——符合"审计面收敛"。
4. **审计脚本已建**：`.workbuddy/cmd-audit.mjs` + `link-check.mjs`（但未进 `ci:check`，见 §6 P1-5）。

**不足**：
1. **检查类入口碎片化**：`check` / `validate` / `guard` / `graph verify` / `contract verify` / `drift` / `sync` 七类校验入口，职责边界只由 BOUNDARY 文本维持；`capability`（P0-A 分层查询）已存在但 skill 文本未引用它做"该跑哪个命令"的路由。
2. **BOUNDARY 注记过期**（N3）：注册函数表 31 项已含 cognitive-map，但"35 次调用"注记未随接线更新到 36。
3. ~~`mumuspec sync` 实为只读快照~~ **更正（2026-09-13 复核 `sync.ts:224`）**：sync 默认模式确实会创建缺失的 BOUNDARY.md 骨架（仅缺失时写，存量不改），skill 文本描述属实、不超承诺。此条撤回。

## 4. 六维度评价（判据 → 现状 → 评分）

| 维度 | 判据 | 现状要点 | 评分 |
|---|---|---|---|
| **功能性覆盖** | 生命周期×预设×横切×引擎能力均有可执行载体；缺口是否落关键路径 | 五阶段+双预设+六横切齐；恢复语义进 skill；CLI-first 替代手工；缺口 = 中文编排器决策核不装载、loop 无 skill、BP 3/18 入图 | **4/5**（昨 3） |
| **协同与冲突** | 上下层交接唯一权威；同一事实出口数；编号唯一 | BP 编号唯一连续；出口 guard 目标阶段语义全修正；companion 框架统一。冲突 = 编排器四写、双图 schema、N1 同文件矛盾、sync skill 超承诺 | **3.5/5**（昨 2） |
| **冗余度** | 同一语义维护处数；副本同步机制；无消费者产出物 | A/B 7/7 SAME + W-SKILL-001 守卫（副本冗余已治理）；剩 3 份图定义、3 份编排文本、每 phase 重复模板段（语言约束/幂等性 ×5） | **3/5**（昨 2） |
| **执行效率** | 上下文成本；自愈路径可达性；阻塞点必要性 | Decision Core 首屏 + hash 按需读取 + `state check --recover` 结构化恢复 + 并行组分发；自愈速查表（guard 错误表）仍在未装载的编排器里；BP-9/10 相邻未合并 | **3.5/5**（昨 3） |
| **场景适配性** | 三档路径可判定；降级路径物理可用 | hotfix/tweak 升级条件可判定（3+/5+ 文件、SHALL NOT 等）；companion 诚实化后 runbook 与实况一致；light/full verify 由 `state scale` 判定可覆盖；大 PRD 仅 BP-2 人工判定 | **4/5**（昨 3） |
| **可维护性** | 单一权威源；漂移可检测；文本自洽 | 守卫三件套（skill-registry 测试 / W-SKILL-001 / cmd-audit）成立；剩 = skill 侧 workflow.yaml 不在任何扫描面、en/orchestrator-en.md 引用旧命令、N1/N3 文本不自洽 | **3.5/5**（昨 1） |

**与昨日对比**：可维护性 1→3.5 是最大改善（P0-1/P0-2 落地 + 守卫测试）；协同/冗余改善来自 companion 框架与幽灵字段清零；剩余短板集中收敛到**"编排器四写 + 三份图"这一个根因**。

## 5. 根因归并（本轮）

昨日三病（单向快照无到期校验 / 强断言与可满足性脱钩 / 事实留在无消费者位置）中，病一病二已修。**当前残余缺陷 100% 收敛于病三的编排器子型**：编排决策核（dispatch 表、8 条阶段判定、guard 速查表）、18 BP 结构化定义、loop workflow、en/orchestrator-en.md——全部"写了但没有装载消费者"或"有消费者但不被守卫扫描"。

## 6. 优化建议（优先级排序，含验收判据）

### P0-1｜编排器单源化裁决（昨日 P0-3，最 senior 的开放项）
二选一，不可都留：
- **方案 A（推荐）**：把中文编排器决策核（Step 0 预设检测 / 8 条阶段判定 / guard 错误速查表 / `.mumuspec.yaml` 字段表）并入已装载的 `mumuspec-workflow`，`mumuspec/SKILL.md` 只留资源（dispatch 表、BP 定义），并将 `mumuspec` 加入或排除出 `WORKBUDDY_PACKAGES` 明示立场。
- 方案 B：`mumuspec` 加入安装清单（代价：常驻 +366 行上下文）。
**验收**：描述"阶段分发规则"的文件数 = 1；B 面任一 skill 内 grep `E-GUARD-009` 修复命令命中 > 0。

### P0-2｜skill 侧 workflow.yaml 处置（N2 落地）
其 graph/presets/guards 段与引擎 schema 漂移且无引擎消费者。三选一：① 删 graph/guards/presets 段留一行指针指向 `src/change/workflow.default.yaml` + `docs/reference/phase-guards.md`；② 下沉为引擎 YAML 的派生产物（生成式，加守卫）；③ 显式标注"历史资源，非权威"并停更。
**验收**：任选其一后，`workflow.yaml` 与引擎图中不再存在同名不同义字段（`blocking_point` vs `bp`）；若选 ①，18 个 BP 需有新家（见 P1-1）。

### P0-3｜N1 修复：phase-archive 同文件矛盾
删"Phase Guard 调用"段中 `active_change_slot_released` 与 `spec changes committed to main branch` 两项（与"退出条件/已知缺口"对齐——D6 未修前它们不可能为 true）。
**验收**：同文件 grep 两字段命中 = 0；`check`/`ci:check` 不回归。

### P1-1｜BP 全量入图
在引擎 YAML 增加可选 `phase_bps` 段（或补全边 bp），把 18 个 BP 变成图数据；`graph verify` 增加"skill 声明 BP ↔ 图 BP"一致性检查。
**验收**：`mumuspec graph verify` 能报告 phase-design 的 BP-4.5/5/6/7/8；skill 文本 BP 表与图输出零差。

### P1-2｜loop workflow 收口
补一份 `phase-loop` skill 或在 `WORKFLOW_KEYS` 校验处将其降级为 experimental 注记。**验收**：`workflows.loop` 要么有 skill 消费者，要么有非权威标注。

### P1-3｜检查类入口路由
skill 文本（编排器决策核）增加"该跑哪个校验"路由表，落点用已有 `mumuspec capability`；或在 doctor 聚合七类检查输出。**验收**：`mumuspec-workflow` 内含 capability 引用。

### P1-4｜en/orchestrator-en.md 删除或再生成
41 行 v0.12.2 残留，含旧命令形态（`state transition` 无 `--confirm` 语境）。**验收**：文件删除，或 mtime/版本与权威源绑定。

### P1-5｜cmd-audit/link-check 进 npm scripts
`.workbuddy/*.mjs` 升级为 `npm run docs:audit`，纳入发版前检查。**验收**：package.json scripts 含之且在 ci:check 或发版清单被引用。

### P2-1｜BP-9/BP-10 合并（昨日遗留）
一次询问（plan-ready + 隔离 + 执行方式），选项集不变。

### P2-2｜phase skill 模板段精简
"输出语言约束 / 幂等性 / 伴随能力声明"三段在 5 份 skill 中近乎逐字重复（≈60 行/份），可抽为共享引用章节或生成式页眉。

## 7. 明确不做（延续昨日裁决）

- 不改 18 BP 的存在性与人工确认机制（"设计决策权在人"不变量的代价）。
- 不重命名遗留 `E-` 前缀告警码；不自动重装 hook；不为 C 面无关插件裁剪。
- 不在本次扩写冻结契约（`sync` 的 missing exports 警告不可信，既有裁决）。

## 8. 待用户裁决

1. P0-1 方案 A/B（token 预算 vs 决策核可达性）。
2. P0-2 三选项（删/生成/标注）。
3. P1-1 BP 入图是否立项（涉及引擎 schema 扩展，需走完整 change 流程）。

## 附：本轮未验证项

- `mechanism-circuit-audit`（B 面自建）与 mumuspec 体系仍无依赖冲突，未复测触发优先级。
- B 面 8 件在宿主中的**加载时序/上下文注入预算**属宿主行为，未实测。
- `mumuspec capability` 输出内容未逐项核对（仅确认命令存在且注册）。
