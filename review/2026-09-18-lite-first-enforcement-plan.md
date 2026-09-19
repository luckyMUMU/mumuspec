# MumuSpec 轻量路径为主路径 改动计划

> 日期：2026-09-18 ｜ 基线：v0.37.0-alpha.0
> 主旨：把约束的"默认命运"从正文散文决定（掉进 manual/unverifiable）改为由机读注解决定（可机器执行）；重型路径（manual 人工复核 / 子进程编排 / 整文件上下文）降级为显式 opt-in 的异常路径。

## 现状依据（代码锚点）

| 缺口 | 代码现状 | 影响 |
|---|---|---|
| G1 SHALL 零机器通道 | [verifier-classify.ts](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L120-L127) 的 R1/R2 判定只在 `shall-not` 分支执行 | 154 SHALL（≈58% 约束）恒落 manual/unverifiable |
| G2 词法兜底为静默默认 | [extractQuotedTerms](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L89-L92) 引号术语 + 无注解即走 R2 | 已知误报（行内标识符被当行为发生），且无提示 |
| G3 manual 是懒惰默认 | [classifyConstraint](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L129) 有 Enforcement 即 manual；[classifyConstraintEntry](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L241-L245) 恒 manual/unverifiable | 判断面整体推给人工 |
| G4 评估器全子进程编排 | [spec-compliance.ts](file:///d:/Code/AI-coding/mumuspec/src/core/metrics/spec-compliance.ts#L35-L39) / [drift-score.ts](file:///d:/Code/AI-coding/mumuspec/src/core/metrics/drift-score.ts#L31-L35) 各自 `spawnSync npx` | 每指标一次完整 CLI 启动 + 30s timeout |
| G5 整文件上下文 | [loader.ts](file:///d:/Code/AI-coding/mumuspec/src/spec/loader.ts#L361-L369) 按层整文件加载 | 无关 prose 稀释判断、token 浪费 |
| G6 strength 纯手动杠杆 | [constraint-evaluator.ts](file:///d:/Code/AI-coding/mumuspec/src/core/constraint-evaluator.ts#L146-L147) 完全由 `config[dimension]` 驱动 | 默认值无推导来源，调配置成常态 |

## 设计原则（全计划硬约束）

- **机器通道优先**：约束默认走 R1（注解/AST）机器执行；词法 R2 降级为显式 fallback；manual 必须显式 `manual(reason)` 声明。
- **判定一律确定性**：分类、强度建议值、指标值全部代码推导，不引入 LLM 判定（与"评估器数值由 LLM 计算或手写"红线同一纪律）。
- **先校验器后消费者**：任何新结构化产出（如结构化证据记录）必须同批交付校验器。
- **向后兼容**：不改 check/validate 既有 JSON schema（新字段只追加）；R2 通道不删除，只降级状态。
- **不动既有收敛语义**：loop composite 权重与阈值、既有权重权威源（defaultWeight）不动。
- **constraint_strength 不自动修改**：B3 只新增"建议默认值"来源，签收机制保留。
- 每项独立立项（`mumuspec new`），按 open→design→build→verify→archive 状态机执行，不绕过门禁。

---

## 主线 A：机器通道为主路径（P0/P1）

### A1. SHALL 机读注解通道 — CHG-lite-1（P0）

**问题（G1）**：[classifyConstraint](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L120-L127) 的 `enforced-strong`/`enforced-weak` 分支仅对 `shall-not` 生效；SHALL 全部落入 manual/unverifiable。

**做法**：
1. [classifyConstraint](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L119-L132) 对 `shall` 极性开放 R1/R2 判定。首阶段仅**复用**既有 `MachineReadableAnnotation.type`（no-new-dependency / no-side-effect / pure-function / no-global-state / no-mutable-state / custom），不放宽"no new engines"契约；新类型需走契约变更流程，不另立检查逻辑。
2. SHALL 的 `enforced-weak` 仅限显式 `ast:`/`lex:` 前缀触达；无通道 SHALL 仍回落 unverifiable——[checkShall](file:///d:/Code/AI-coding/mumuspec/src/guard/checker.ts#L412-L446) 的 E-SPEC-004（恒可见警告）/ E-SPEC-015 判定原样保留，A1 不修改该分支。
3. guard/checker.ts 的 SHALL 分支驱动化：命中注解的 SHALL 从"仅 E-SPEC-004 警告"升级为执行注解对应检查（复用既有 AST 通道）。

**验收（可判定）**：分类器对同一文件内 SHALL/SHALL NOT 同规则；带注解的 SHALL 落在 R1，`computeEnforcementCoverage.strong_ratio` 反映增量；回归测试覆盖 SHALL 复用既有类型与无通道回落的正反例。

### A2. 注解前置为唯一入口，R2 显式降级 — CHG-lite-2（P0）

**问题（G2）**：无注解时静默走词法通道（[L126](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L126)），误报无提示。

**做法**：
1. 分判据反转：SHALL NOT 无注解且非 `ast:` 前缀时，不再默认 R2，而是报可操作项——`E-SPEC-015` 出口三分法：补 annotation / 改成显式可提取文本（`ast:` 前缀）/ 声明 `manual(reason)`。
2. `isRegexCheckable` / R2 仅在约束显式带 `lex:` 前缀或配置开启 legacy 词法通道时生效（配置手动签收；新配置键须同步 config.ts / config 迁移 / docs/reference/configuration.md / docs:audit）。
3. `computeEnforcementCoverage` 的 `enforced-weak` 项列为"需补注解"行动项：validate 输出以**新增追加字段**承载，不改写 `unverifiable_items` 既有语义（红线：不改变既有 JSON schema）。
4. 迁移策略：先出只读清单（列出新判据下将翻转的存量条目）→ 分批补注解 → 新判据经配置开关分阶段启用（默认 legacy 兼容）→ 最后强制。纯词法可提取的存量条目暂时转入 R4 属预期迁移成本，验收中显式声明。

**验收（可判定）**：存量无注解 SHALL NOT 的 validate 输出逐条给修复路径；配置关闭 legacy 后 R2 不执行；R4 清单收敛至 0 或逐条有行动项。

### A3. manual 显式化 + 结构化证据 — CHG-lite-3（P1）

**问题（G3）**：`enforcement` 有声明即 manual（[L129](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L129)），文本证据用"包含 enforcementId / 前 24 字符"（[L261-L273](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L261-L273)）可被误匹配。

**做法**：
1. `implicit-manual`（legacy 自由文本）走迁移提示：validate 报 `W-*`，指引改写为显式 `manual(reason)`；新规范仅接受显式声明（`isExplicitManual` 已是标准）。
2. 证据匹配升级为结构化记录：`{constraintId, user, verdict, timestamp, evidence_hash}`，verify.md 解析器先验证记录结构再匹配（先校验器后消费者）；`evidence_hash` 由 CLI 经 computeHash 计算（hash 类字段纪律：禁 LLM/手写）。
3. [classifyConstraintEntry](file:///d:/Code/AI-coding/mumuspec/src/spec/verifier-classify.ts#L241-L245) 接入同一通道：有注解/可提取文本按 A1 判 R1/R2；仅保留 `manual(...)` 声明才为 manual。

**验收（可判定）**：verify 证据非结构化记录的约束判为未满足；constraints.yaml 条目分类分布与 spec 条目同标准；输出合法记录样例的校验器测试先行。

---

## 主线 B：编排与上下文轻量化（P1/P2）

### B1. 评估器 in-process 同批 — CHG-lite-4（P1）

**问题（G4）**：spawnSync 子进程（[spec-compliance.ts L35](file:///d:/Code/AI-coding/mumuspec/src/core/metrics/spec-compliance.ts#L35-L39)、[drift-score.ts L31](file:///d:/Code/AI-coding/mumuspec/src/core/metrics/drift-score.ts#L31-L35)）。

**做法**：
1. 把 `check --json` / `drift --json` 的解析与计算逻辑上移为共享纯函数（复用既有 `utils.parseJsonFrom`，延续 DS-EVAL-003 单一权威源纪律，禁止本地复刻解析副本）。
2. 新增 in-process evaluate 批入口：一次变更、一次源码快照，同批跑合规/漂移/密度；指标 output schema 不变。
3. 子进程通道保留给独立 CLI 调用；两通道一致性用同一批测试锁定（JSON payload 契约测试）。

**验收（可判定）**：in-process 与 CLI 通道对同一仓库输出逐字段一致；`npm run ci:check` 走 in-process；无新增 JSON schema 字段。

### B2. Context 声明式投影加载 — CHG-lite-5（P2）

**问题（G5）**：[selectLayersToLoad](file:///d:/Code/AI-coding/mumuspec/src/spec/loader.ts#L361-L369) 整文件进 context。

**做法**：
1. 每层声明"披露清单"（frontmatter 或环境变量投影键：需进场的 requirement id / section / 术语 / 风险），`loadSpecContext` 按清单过滤 raw 内容。
2. MCP `get_spec_context` 返回投影后的 `SpecLayerContext`；未声明清单时回退现状（向后兼容）。
3. 投影过滤必须机械实现（头部/区块边界，不语义判断）。

**验收（可判定）**：声明清单后 context 输出不含清单外区块；未声明时输出与现状逐字节一致；MCP 单测覆盖投影与回退两态。

### B3. Strength 建议默认值确定性推导 — CHG-lite-6（P2）

**问题（G6）**：无默认值来源，配置改动需人工且常态。

**做法**：
1. 新增纯函数：由 `enforcement.kind` / `severity` / R1-R4 类别推导约束强度**建议值**（如 R1+severity=error → high）。
2. `mumuspec doctor` / `check` 输出"建议 vs 实际"对照；仅当偏差存在时提示人工签收。
3. 不写入 config、不自动修改 —— `evaluateConstraint` 求值路径不变（[L146-L147](file:///d:/Code/AI-coding/mumuspec/src/core/constraint-evaluator.ts#L146-L147)），红线"不自动修改 constraint_strength"保持。

**验收（可判定）**：同一约束的建议值稳定（幂等纯函数）；签收机制不变；回归测试覆盖各类别的映射。

---

## 执行顺序与里程碑

```
M1（机器通道地基）：A1 + A2  —— 改 parse/classify/checker/validate，SHALL 通道 + R1 前置
M2（重型路径收口） ：A3       —— manual 显式化 + constraints.yaml 通道统一
M3（编排轻量化）  ：B1       —— 评估器 in-process 同批
M4（上下文轻量化） ：B2 + B3  —— 投影加载 + strength 建议值
```

依赖：M1 为 A3（依赖分类结果）、B3（依赖分类结果）前置；B1/B2 相互独立。

**统一验收三件套**（每批次）：`mumuspec check`（exit 0）／`mumuspec validate`（R4 清单收敛且逐条可行动）／`npm run ci:check`（in-process 后走 B1 通道）；vitest 全量不回退（基线以执行时 master 为准）。新错误码全部注册 ERROR_CODES；新顶层命令同步 BOUNDARY.md 双向闭包；改 spec.md 后必跑 `regen-rules.mjs`；版本号随 release 流程更新（package.json 与 src/cli.ts 一致）。

## 明确不做（边界）

- 不引入 LLM 评估/打分：机器通道保持纯确定性代码，无新增 LLM 判定点。
- 不自动修改 constraint_strength：B3 只产出建议值，签收机制保留。
- 不改变 check/validate 既有 JSON schema（新字段仅追加）。
- 不删除词法 R2 通道（向后兼容，仅降级为显式启用）。
- 不动 loop composite 权重之和、收敛阈值与稳定窗口。
- 不新增运行时依赖（JEV 仅为设计参考，非运行时组件）。