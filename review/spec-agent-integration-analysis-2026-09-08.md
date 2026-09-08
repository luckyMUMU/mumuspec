# MumuSpec 规范体系与 Agent 结合分析（2026-09-08）

基线：包版本 0.19.2-alpha.10，根 `.mumuspec/prd.md`（last_updated 2026-09-05）+ `spec.md`（14 个 Requirement 块）+ 17 个分布式 `prd.md/tech.md` 叶子层。证据来源：`mumuspec validate / check / drift / context` 实跑输出 + 源码核对。

---

## 0. 自动校验证据

| 命令 | 修复前 | 修复后 |
|---|---|---|
| `mumuspec validate` | ✗ 2 error（E-SPEC-010）+ 2 warning | ✓ All specs are valid |
| `mumuspec check` | ✓ 通过（与 validate 结论相反） | ✓ All checks passed |
| `mumuspec drift` | ✓ No drift detected | ✓ No drift detected |
| `mumuspec context .` | 7 行，规范内容为空 | 257 行，含完整规范链 |
| AGENTS.md | 规范链摘要为空、CLI 速查 8 条 | 56 条红线 + 56 条命令速查，13.9 KiB |

修复后 Enforcement Coverage（230 条约束）：enforced-strong 2（0.9%）/ enforced-weak 16（7.0%）/ manual 212（92.2%）/ **unverifiable 0**，declared_ratio 100%。

> 修复前存在**门禁不一致**：`check` 判定通过而 `validate` 报 2 个 ERROR，二者共用同一套 E-SPEC-* 诊断却结论相反，导致真实规范缺陷在主力门禁下静默通过。

---

## 1. 规范体系现状

### 1.1 分层结构

| 层 | 内容 | 状态 |
|---|---|---|
| 根 layer 0 | prd.md（产品定位 + 15 项核心能力）/ spec.md（14 块全局约束）/ tech.md / goal.md / prohibitions.md / glossary.md / index.yaml / config.yaml / constraints.yaml / workflow.yaml | ✅ 齐备 |
| 分布式 layer 1+ | 17 个模块目录各含 prd.md + tech.md | ⚠️ 覆盖率约 68%（见 §4-G7） |
| 变更层 | `.mumuspec/changes/<name>/`，五阶段状态机 | ✅ |

### 1.2 根 spec.md 14 块

Ponytail 基础编码约束 / 临时目录管理 / 项目结构规范 / 变更管理 / 文档产出规范 / 术语表管理 / 命令能力分层（Capability Tier）/ Verifier 语义与可验证性 / 流程执行载体（CLI-first）/ 完备性门禁-结构化工件 / 完备性门禁-双签放行 / 分发层-AGENTS.md canonical / 分发层-phase skill 平权 / 规则-实现分离（KP-0060）。

其中 4 块（两个完备性门禁、两个分发层）由 `goal-p0-dispatch-gate` 归档时 delta 合并而来，1 块（规则-实现分离）为 KP-0060 一般化上位原则。

### 1.3 相较 09-06 评审的进展

`feat(p0)` 提交（6b8a1dd）已落地 4 项 P0，09-06 评审报告 §2 的缺口判定**已失效**：

| 项 | 09-06 判定 | 当前事实 |
|---|---|---|
| P0-A Capability Tier | ❌ 未实现 | ✅ `src/cli/capability.ts` CommandMetadata 注册表 + `mumuspec capability [command] [--json]` |
| P0-B loader 层数 | ❌ 硬编码 | ✅ `selectLayersToLoad(pathChain, config.specs.max_layer_depth)`，深度来自配置（默认 5） |
| P0-C 32KiB 容量断言 | ❌ 未实现 | ✅ `MAX_RULES_BYTES` + `assertRulesWithinBudget()` fail-closed + E-RULES-001 |
| P0-D finalize-archive | ❌ Placeholder | ✅ 真实 code-graph snapshot、cache 陈旧项硬删除、`.finalized` 幂等标记 |

**新引入缺陷**：P0 落地与归档动作产生了新的规范漂移（§4-G4）。

---

## 2. 与 Agent 结合的架构

```
                  ┌──────────────────────────────┐
   LLM Agent ───► │  AGENTS.md（canonical）       │ ◄── rules-generator 生成
                  │  规范链摘要/Ponytail/CLI/MCP  │
                  └──────────┬───────────────────┘
                             │ 薄壳桥接
              ┌──────────────┼──────────────┐
          CLAUDE.md      GEMINI.md      （其余 agent 原生读 AGENTS.md）
                             │
   LLM Agent ───► MCP Server（35 工具，只读查询）
   LLM Agent ───► CLI（56 命令，确定性写操作）
```

支持的 10 个 AgentType：catpaw / claude / cursor / trae / workbuddy / opencode / codex / windsurf / gemini / copilot。

---

## 3. 优势（设计层面）

| # | 优势 | 依据 |
|---|---|---|
| **S1** | **一次生成覆盖 10 agent**：AGENTS.md 为唯一 canonical，CLAUDE.md / GEMINI.md 为 `@AGENTS.md` 首行薄壳，符合 AAIF 托管事实标准 | `AGENT_RULE_TARGETS`；claude 为唯一不原生读 AGENTS.md 的 agent，已桥接 |
| **S2** | **声明式扩展**：加一个 agent = 加一条 `AGENT_RULE_TARGETS` / `AGENT_INSTALL_POLICIES` 表项，渲染与安装逻辑不动 | installer-registry.ts:199-265；符合 KP-0060 规则-实现分离 |
| **S3** | **三态冲突策略**：absent→create / managed→update（识别托管标记）/ user→skip+warn，`--force-rules` 显式接管。不静默覆盖用户手写文件 | `decideAction()` rules-generator.ts:113 |
| **S4** | **容量预算 fail-closed**：E-RULES-001 超 32KiB 直接拒绝写入，杜绝规范撑爆 agent 上下文 | `assertRulesWithinBudget()` |
| **S5** | **CLI-first 分工清晰**：MCP 35 工具全为只读查询，确定性写操作（阶段转换、hash 锁定、决策登记）经 CLI，LLM 无法绕过状态机 | tools.ts 工具清单无写操作；spec「流程执行载体」块 |
| **S6** | **phase skill 平权分发**：codex / windsurf / gemini / workbuddy 均获得完整五阶段 SKILL.md + workflow-presets；copilot 因无自定义 skill 机制 + TC-A1x 限制，为文档化的有意 rules-only 豁免 | `CODEX_PACKAGES` 及 map 派生 |
| **S7** | **遗留格式硬过滤**：`.cursorrules` / `.windsurfrules` 永不生成（`LEGACY_RULE_FILES`） | rules/generator.ts |
| **S8** | **双签放行完备性门禁**：LLM 判定仅 advisory，机械四分类一票否决，人工签收才放行 | spec「完备性门禁-双签放行」ENF-3/ENF-4 |

---

## 4. 劣势（实现与 PRD 的断裂点）

### G1 — 渐进式披露对 Agent 空转（致命）

`mumuspec context <path>` 的文本渲染（src/cli/commands/spec.ts:64-90）只输出 `layer.spec` 与 `layer.design`，**不输出 `layer.tech` 与 `layer.prd`**。而项目自 0.19 起已整体迁移到 prd.md + tech.md 新格式（spec「变更管理」SHALL 明文规定）。

结果：`mumuspec context .` 输出 7 行、零条约束；`--json` 却有完整 layers 数据。PRD 三大差异化优势之一「唯一实现树状分层 + 渐进式披露的规范加载」在文本通道上完全失效。

### G2 — AGENTS.md 规范链摘要为空（严重）

根 AGENTS.md 首节为「（规范链尚未生成——运行 mumuspec init / mumuspec context 加载）」。分发层 SHALL 要求产出四要素（规范链摘要 / Ponytail / CLI 速查 / MCP 入口），第一要素缺失。

**次生矛盾**：`buildRuleGenContext()` 的 specSummary 一旦拿到真实 context，会把每层全部 requirement 的 SHALL/SHALL NOT 全文内联进 AGENTS.md（rules-generator.ts:209-214）——这直接违反分发层 SHALL NOT「禁止在 Rules 文件中内联全量规范上下文，渐进式披露职责归 MCP」。当前靠「传入空 context」侥幸不触发 32KiB 断言。修复 G2 必须先确定「摘要」的正确粒度，否则会踩 G2′。

### G3 — CLI 速查与注册表脱钩（严重）

AGENTS.md 的 CLI 速查为硬编码 8 条（`DEFAULT_CLI_COMMANDS`），实际注册命令 56 条。CLI-first 必需的确定性命令 agent 完全无从得知：

| 缺失的关键命令 | CLI-first 用途 |
|---|---|
| `decisions append` | 决策登记（F-1：手工编辑破坏 content_hash） |
| `test-cases lock-suite` | 测试套件 hash 锁定（F-3） |
| `state layer` / `state set` | 受保护状态字段（E-STATE-001） |
| `tasks next` | 定位未完成任务（F-3） |
| `capability` | 查询命令能力分层（CAP-1） |
| `finalize-archive` | 归档收尾 |

违反 spec F-5「skill 指令中引用的 CLI 命令必须与命令注册表一致」。

### G4 — 归档 delta 合并污染根规范（中）

最终归档把变更目录的 `.mumuspec/prd.md` / `tech.md` 原样 delta 合并进根文档，带来三类问题：

1. **占位符模板入库**：根 prd.md 含两块「SHALL: \<Describe what this feature/change must accomplish\>」、tech.md 含「Module: xxx is maintained at current level」——违反 STRUCT SHALL NOT「禁止约束内容使用无具体含义的占位符文本」
2. **相对路径未重定位**：frontmatter `parent_prd: ..\..\..\prd.md` 从变更目录复制后未改写，解析为 `d:\Code\prd.md` → **E-SPEC-010 ×2 ERROR**
3. **产生 unverifiable 约束**：2 条占位符 SHALL 无 enforcement，落入 unverifiable 桶

### G5 — 门禁结论不一致（中）

`validate` 报 2 ERROR、`check` 报全部通过。两者共用 E-SPEC-* 诊断码却结论相反，G4 的缺陷因此在主力门禁下长期静默。

### G6 — 公共 API 命名漂移（中）

| 模块 | 规范声明 | 实际实现 | 性质 |
|---|---|---|---|
| knowledge | `searchKnowledge()` | `knowledgeSearch()` | 重命名漂移 |
| eval | `runEvalSuite()` | `runAllEvals()` | 重命名漂移 |
| feedback | `listFeedbacks()` | `listAllFeedbacks()` | 重命名漂移 |
| feedback | `getFeedbackContext()` | **仅注释，无实现** | 能力缺失 |

### G7 — 规范层缺失且 drift 检测不到（中）

`src/mcp`（35 个 MCP 工具）、`src/team`、`src/meta-evolution`、`src/knowledge/scanners`、`src/contract/formatter` 等有源码、无 prd/tech、且未注册 index.yaml。违反 STRUCT-3，而 `mumuspec drift` 报 OK——drift 只正向核对「已注册项路径存在」，不反向检测「无规范层的源码模块」。

### G8 — 可验证性覆盖偏低（长期）

232 条约束仅 0.9% enforced-strong、92.2% manual。PRD「不可验证的约束等于不存在的约束」的强承诺，落地层面主要靠人工背书而非代码自动证明。

---

## 5. 对齐方案与实施结果

| 缺口 | 动作 | 结果 |
|---|---|---|
| **G1** context 空转 | `src/cli/commands/spec.ts` 渲染补齐 `layer.prd` / `layer.tech`，与 JSON 通道同构；新增 `renderRequirements()` 复用渲染 | ✅ 输出 7 → 257 行 |
| **G1b** 根全局 charter 丢失 | `src/spec/loader.ts` 根层（level 0）额外加载 `spec.md`；模块层保持「spec.md 仅作 tech.md 回退」语义 | ✅ 根层 94 SHALL / 56 SHALL NOT 进入规范链 |
| **G2** AGENTS.md 摘要为空 | `buildSpecSummary()` 改为结构摘要（层级 / 文档 / 条数）+ prohibitions 红线全文；init 与 install 两条链路均传入 specContext | ✅ 四要素齐备，13.9 KiB（预算 42%） |
| **G3** CLI 速查脱钩 | 新增 `renderCliCheatSheet(program)` 从注册表生成（CLI_FIRST 置顶 + 子命令展开）；`setCliCheatSheet()` 依赖倒置注入，install 路径与 init 同源 | ✅ 8 条 → 56 条命令，6778 字符 |
| **G4** 归档合并污染 | `prepareChangeSpecContent()` 剥离变更层 frontmatter + 拒绝未填写模板；清理根 prd.md / tech.md 已入库的占位符块 | ✅ E-SPEC-010 ×2 消除，unverifiable 2 → 0，declared_ratio 100% |

回归测试：`tests/spec/agent-context-alignment.test.ts`（14 例，覆盖 G1/G2/G3/G4）。

### 遗留 P1 —— 已全部落地（2026-09-08 第二批）

| 优先级 | 缺口 | 实施结果 |
|---|---|---|
| **P1** | G5 门禁结论不一致 | ✅ `checkCompliance` full check 并入 `validateAllSpecs` 的 E-SPEC-* errors（去重、仅 error 级）。回归：`tests/guard/check-validate-parity.test.ts`（3 例） |
| **P1** | G6 命名漂移 | ✅ 复核定性：规范正文未写 API 名，漂移在 `src/feedback/.mumuspec/prd.md` + `tech.md` + `manager.ts` 注释——`linkSession`/`listFeedbacks`/`getFeedbackContext` 均不存在。按 YAGNI 修文档对齐实际导出（不新增无调用方函数） |
| **P1** | G7 规范层缺失 | ✅ 补 `src/mcp`（35 工具 / 4 写工具显式声明）、`src/meta-evolution`、`src/team` 三模块 V2 格式 prd/tech（doc_type 校验生效，unverifiable 保持 0）；`checkIndexDrift` 改全树递归收集——上线即抓到 2 个漏检目录（src/contract/formatter、src/knowledge/scanners，BOUNDARY-only）并经 `drift --fix` 注册。回归：`tests/guard/index-drift.test.ts`（5 例） |

**G7 附带发现**：`drift --fix` 生成的 index 条目用绝对路径 + 缩进错乱，已手工修正为相对路径统一格式——`autoFixDrift` 的条目生成质量待修（未纳入本次）。

**剩余 P2**：G8 可验证性覆盖——抽查关键约束绑定 verifier，提升 enforced-strong 占比（当前 0.8%）。

---

*生成：2026-09-08 · 依据：mumuspec validate/check/drift/context 实跑 + 源码核对 · 关联变更：prd-alignment-agent-integration*
