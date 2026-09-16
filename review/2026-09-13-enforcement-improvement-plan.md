# MumuSpec Enforcement 强化改进计划

> 依据：`review/2026-09-13-sdd-ecosystem-comparison.md` ｜ 日期：2026-09-13 ｜ 基线：v0.24.0-alpha.0
> 主旨：把 MumuSpec 的差异化护城河（机械校验）从"阶段门禁"升级为"全生命周期持续 enforcement + verification 闭环"。

## ⚡ 执行状态（2026-09-13 收束，基线 0.24.0 → 0.30.0）

| 计划项 | 状态 | 落点 |
|---|---|---|
| A1 覆盖率指标 | ✅ 主体已于 0.24 交付，补齐 R4 修复路径提示 | CHG enforcement-coverage（v0.25） |
| A2 convergence 闭环 | ✅ 归档 delta fail-closed `E-CHANGE-022` + ci:check 集成 check/validate 双门 | CHG enforcement-coverage + ci-drift-gate（v0.25/v0.26） |
| A3 结构可判定性校验 | ✅ 无界词 `W-SPEC-016` advisory（语料 0 噪音）+ verify 门禁 delta 通道核验 `E-GUARD-010` | CHG shall-structure-lint + delta-channel-gate（v0.27/v0.30） |
| A4 词法通道 fence-aware | ✅ parser 剥离围栏，示例约束不进语料 | CHG spec-fence-guard（v0.28） |
| A5 技能副本到期校验 | ✅ 裁决：skill-drift 已于 0.24 交付并接入 check drift + CI 门禁；pinning/required 校验按 YAGNI 跳过 | — |
| A6 fail-open 审计清零 | ✅ 归档关键路径 13 处空 catch 清零，4 类点位裁决保持静默（理由固化 design.md） | CHG fail-open-audit（v0.29） |
| B1 就绪动作引导 | ✅ status 就绪动作块（下一转换 + runPhaseGuard 实时三态判定） | CHG ready-action-guidance（v0.31） |
| B2 完备性交互化 | ✅ 裁决：受阻发现（含 fix 路径）已由 B1 就绪块 + E-GUARD-008 承载；"二选一问题"呈现属 skill 层 LLM 追问行为（KP-0060：规则归 LLM），引擎侧无新增职责 | — |
| B3 规模分档推荐 | ✅ 档位失配显式提示（⚠ 规模建议 + 调整指引 / ✓ 档位匹配）；recommendPath 分档引擎 0.24 已有，零改动 | CHG workflow-tier-hint（v0.33） |
| B4 drift diff | ✅ `drift --change` Delta 预览块（归档将并入主规范的约束 + 行） | CHG drift-delta-preview（v0.32） |
| B5 波次执行 / dev-auto | ⏸ 观察项（依赖 C 元层死端裁决） | — |

**遗留裁决**：implicit-manual 是否参与一票否决（涉及存量约束迁移与 `### Enforcement` 自由文本语义，需单独评审）。

## 0. 设计原则（全计划硬约束）

- **fail-open 优先于任何新增能力**：先堵既有静默失败（commitAll allowFail、C 元层死端），再扩功能。
- **KP-0060 规则-实现分离**：引擎归代码、规则归 LLM、校验归代码；指标/hash 类字段一律代码推导，禁 LLM 手写。
- **先校验器后消费者**：任何新结构化产物必须同批交付校验器，禁止死端。
- **可判定事实必须留在不会被丢弃的位置**（元结论），所有 enforcement 动作产出可审计工件。
- 每项独立立项（`mumuspec new`），按变更状态机走 open→design→build→verify→archive，不绕过门禁。

---

## 一、主线 A：Enforcement / Verification 强化（最高优先级）

### A1. Enforcement 覆盖率指标（enforcement-coverage）— CHG-8a

**问题**：四通道分类（R1 注解 > R2 词法 > R3 manual > R4 unverifiable）已存在，但通道分布只是一次性校验的中间量，没有成为**持续可观测的强制力度量**——"有多少 SHALL 真正被机械强制"无报表、无趋势、无门禁。

**做法**：
1. 新增 `enforcement-coverage` 指标：由代码从通道派生结果聚合（R1/R2 = mechanically-enforced，R3 = manual，R4 = unverifiable），输出 per-change 与全库两级报表。
2. 指标值代码推导，weight 与现有 composite 收敛语义隔离（不进 loop 权重，避免改变收敛语义——已声明 SHALL NOT）。
3. `mumuspec validate` 输出 unverifiable 清单；全库 R4 > 0 时给出逐条"补 annotation / 改可提取文本 / 声明 manual"的修复路径（E-SPEC-015 的出口三分法）。

**验收（可判定）**：`mumuspec validate` 输出通道分布统计；R4 清单与修复建议逐条可执行；新增校验器先行落地。

### A2. Convergence 闭环：spec 与实现的强制定期对账 — CHG-8b

**问题**：`drift` 命令存在但游离在 CI 与归档流程之外——漂移检测是可选动作而非强制关卡，正是 spec-kit 用 `/speckit.converge` 补的缺口。

**做法**：
1. **ci:check 集成 drift 门禁**：`npm run ci:check` 增加 drift 检测步，漂移超阈值（阈值入 `.mumuspec/config.yaml`，人工签收后修改）时 CI fail。
2. **archive fail-closed**：归档时若 delta-spec 未对主 spec 产生任何可判定变更且未声明 skip（借鉴 OpenSpec v1.13 "apply 无 delta 即告警"，但 MumuSpec 升级为硬错误），报 `E-ARCH-*` 新码并注册 ERROR_CODES。
3. **变更分支 verify 阶段强制 convergence 步**：`guard <change> verify` 检查项新增"drift 报告存在且未超阈值"（清单权威源 phase-guards.md 同步更新）。

**验收**：人为制造 spec-代码漂移 → CI 红；空 delta-spec 归档 → 硬错误留 audit。

### A3. SHALL 约束可验证性结构校验（借鉴 Kiro/EARS、MUSUBI 100% 映射）— CHG-9a

**问题**：四分类判定"是否可校验"，但不校验 SHALL 文本本身的**结构可判定性**——大量 R3/R4 约束是模糊措辞（无主体、无条件、无具体动词）造成的。

**做法**：
1. 机械结构检查器：SHALL/SHALL NOT 语句须含可判定主体（行内标记对象或明确名词短语）+ 可验证动作；纯形容词/无界词（"合理""适当""必要时应"）标记为 `W-SPEC-*` 结构告警（新告警一律 `W-` 前缀，注册 ERROR_CODES）。
2. verify 门禁新增检查项：进入 verify 的变更，其 delta 约束须全部落到 R1/R2 或已声明 manual——**没有验证通道的约束不允许默默通过验证阶段**。
3. 不做自然语言语义判定（归 LLM advisory 双轨），只做可机械判定的结构特征，维持红线"完备 ≠ 正确"。

**验收**：对存量规范跑只读报告（先 advisory 后接入门禁，分期落地）；测试用例覆盖正反例。

### A4. 词法通道 R2 加固：fence-aware（借鉴 OpenSpec v1.13）— CHG-9b

**问题**：`extractQuotedTerms` + checker 字面量检索不感知代码围栏——spec 中文档化的代码示例/配置样例会被词法通道误处理（OpenSpec 曾因同类问题静默改写/漏匹配，MumuSpec 有 60 条假阳性前科）。

**做法**：R2 提取与字面量检索在 fenced code block（``` 围栏）内停用；删除线/嵌套围栏场景补测试。

**验收**：含围栏示例的 spec 校验结果与剥离围栏后一致；新增回归测试 ≥3 例。

### A5. 技能副本到期校验 + 版本 pinning — CHG-10a

**问题**：B 面副本是单向快照、"无过期状态"——源改副本旧无任何告警（已声明 SHALL NOT 但引擎未实现，属"声明了却没留下可判定事实"的同构缺陷）。

**做法**：
1. 安装时记录源内容 hash（复用 `test-cases lock-suite` 的 hash 纪律，代码计算禁手写）；`mumuspec install`（无参列出模式）或 `doctor` 比对副本与源，过期即报 `W-INSTALL-*`。
2. 版本 pinning：B 面记录安装时运行时包版本，跨版本升级时提示重新安装（借鉴 spec-kit upgrade detection）。
3. 修复 `guard`/skill 声明 `required: true` 但实体不存在的空转：加载前实体存在性校验（判定看实体，不看断言强度——已有纪律，落地为代码）。

**验收**：篡改 B 面任一副本 → doctor 报告定位到文件；required 不可达 skill 被 guard 显式降级留痕（不静默）。

### A6. fail-open 审计强制化 — CHG-10b（小）

**做法**：清查 `allowFail:true` 类静默失败点（已知 `guard archive-in-progress` 的 commitAll），失败必须留 audit 记录 + 非零信号；C 元层四条数据面死端逐条裁决"实现或删除"。

**验收**：全库 grep 审计，静默吞错点清单归零或逐条有 audit。

---

## 二、主线 B：UX / 流程增强（次优先级，均可独立立项）

| # | 项目 | 借鉴来源 | 要点 | 建议批次 |
|---|---|---|---|---|
| B1 | 下一步就绪动作引导 | OpenSpec DAG + continue | 基于 state machine 在 `status`/MCP 暴露"当前阶段就绪动作"拓扑提示；不改状态机语义 | CHG-11 |
| B2 | 完备性检查交互化 | Kiro Analyze Requirements | LLM advisory 工件升级为"每条发现 = 二选一问题 + 建议修复"；产出仍须结构化工件（先校验器后消费者） | CHG-11 |
| B3 | 仪式规模自动分档 | BMAD 三档 / Kiro Quick Plan | 按机械判据（影响层数、约束变更量、命令面增量）**推荐** tweak/hotfix/workflow，只推荐不裁决 | CHG-12 |
| B4 | drift diff 可视化 | openspec show --diff | drift 输出 diff 级差异展示，exit code → 可读结论 | CHG-12 |
| B5 | 任务波次执行 | Kiro 并行任务执行 | 按已验证 parallel_group 分波调度；同文件串行；与 I3 层内可并行不变量闭环 | CHG-13（观察） |

---

## 三、执行顺序与里程碑

```
M1（enforcement 地基）：CHG-8a + 8b（A1 覆盖率指标 / A2 convergence 闭环）
M2（校验加固）      ：CHG-9a + 9b（A3 结构校验 / A4 fence-aware）
M3（分发与审计）    ：CHG-10a + 10b（A5 技能副本 / A6 fail-open 审计）
M4（UX 增强）       ：CHG-11 ~ CHG-12（B1-B4）
后续                ：CHG-13 视 C 元层死端修复进度再评估
```

**每批次统一验收三件套**：`mumuspec check`（exit 0）／`mumuspec validate`（unverifiable=0，M1 后附加 R4 清单收敛）／`npm run ci:check`（含新 drift 门禁）；vitest 基线 271 files / 5134 tests 不回退。改 spec.md 后必跑 `regen-rules.mjs`；新错误码全部注册 ERROR_CODES（守卫测试同步扩展）；新增顶层命令同步 BOUNDARY.md 双向闭包。

## 四、明确不做（边界）

- 不引入 Spec-as-Source 式代码生成（Tessl 非确定性困境，与"测试锁定正确性"路线冲突）。
- 不做多角色 agent 化（BMAD 形态）——专家角色留给宿主（WorkBuddy 专家）承担，MumuSpec 保持引擎中立。
- 不自动修改 constraint_strength / 不以 LLM 手写指标值（既有红线不动）。
- 不改变 composite 收敛权重与阈值（已声明 SHALL NOT）。
