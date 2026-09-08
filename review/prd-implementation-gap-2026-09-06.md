# PRD ↔ 实现一致性走查（根 → 叶子，2026-09-06）

基线：仓库按 MumuSpec 自管——根 `.mumuspec/prd.md`（产品定位/能力）→ 根 `.mumuspec/spec.md`（14 个全局约束块）→ 25 个分布式 `.mumuspec/prd.md + tech.md` 叶子层。代码在 `src/`。
本报告自上而下比对"PRD/规范声明 → 实际实现"，以 `mumuspec validate/drift/check` 自动证据 + 逐叶子源码核对为双重来源。未改动任何文件。

---

## 0. 自动校验证据（官方通道）

| 命令 | 结果 | 含义 |
|---|---|---|
| `mumuspec check` | ✓ All checks passed · [drift] OK | 结构/状态机自洽 |
| `mumuspec drift` | ✓ No drift detected | index 注册项均存在且路径匹配 |
| `mumuspec validate` | ✓ valid · **230 constraints** | 语义/可验证性 |

**enforcement_coverage（230 条约束五桶计量）**：

| 桶 | 数量 | 占比 |
|---|---|---|
| enforced-strong | 2 | 0.9% |
| enforced-weak | 16 | 7.0% |
| **manual** | **212** | **92.2%** |
| unverifiable | 0 | 0% |

> ⚠️ **系统级漂移信号**：强验证仅 0.9%，92% 约束依赖 manual（人工走查 + verify.md evidence）。这使 PRD「可验证性四分类 / 不可验证的约束等于不存在」的强承诺，在落地层面主要由人工背书而非代码自动证明。

---

## 1. 根 PRD 20 项能力 → 实现核对

PRD `## 核心能力` 表 20 项（读作 `| **能力** |` 行）逐项核对：

| # | PRD 能力声明 | 结论 | 关键证据 |
|---|---|---|---|
| 1 | Spec 语法语义（SHALL/SHALL NOT × Enforcement） | ✅ | `spec/parser.ts`、`spec/verifier-classify.ts` |
| 2 | 可验证性四分类 | ⚠️ 部分 | 分类器 ✓；但 92% 落 manual（见 §0） |
| 3 | Spec 树分层继承 | ✅ | `spec/inheritance.ts` |
| 4 | 渐进式披露 | ✅ | `spec/loader.ts`（但见 P0-B 3 层硬编码） |
| 5 | 变更生命周期五阶段 | ✅ | `change/state-machine.ts`、`workflow.default.yaml` |
| 6 | Phase Guard | ✅ | `guard/phase-guard.ts`、`guard.ts` |
| 7 | 红绿 TDD + 核心规则 | ✅ | `state.ts` test-cases lock、guard |
| 8 | 动态约束强度 | ✅ | `core/config.ts`、`constraint-evaluator.ts` |
| 9 | Ponytail 编码约束 | ✅ | `spec/ponytail.ts` |
| 10 | Skills 编排 | ⚠️ | 安装器平权已落地 codex/windsurf/gemini，copilot 仅 rules-only（有意，TC-A1x）；见 §4 |
| 11 | Workflow 外化 + 项目级 override（CHG-7） | ✅ | `phase-graph-loader.ts:85` loadProjectWorkflowConfig、`state-machine.ts:87` |
| 12 | CLI-first | ✅ | cli/commands 全量注册，E-CHANGE-007/STATE-001 审计 |
| 13 | MCP Server 30+ 工具 | ✅ | `mcp/tools.ts` 实际 **35** 工具 |
| 14 | Rules 生成（AGENTS.md canonical + 10 agent） | ✅ | `install/rules-generator.ts`、`installer-registry.ts` 10 AgentType；`.cursorrules` 硬过滤 |
| 15 | 知识层 | ⚠️ 部分 | CRUD/渐进式/搜索/新鲜度在；API 命名漂移 + KP-ID 未强制（§4） |
| 16 | **完备性门禁（人机合著）** | ✅ | `change/artifact-validator.ts`、guard open+无签收→block |
| 17 | **Spec 即 DSL / 一等源文件** | ✅ | spec.md/prd.md/tech.md 分布式 + error-codes 诊断器 |
| 18 | **双向约束 + 不可验证=不存在** | ⚠️ 部分 | 语义在；覆盖实证偏 manual（§0） |
| 19 | **为目标加限制不限制过程（CHG-5）** | ✅ | 过程约束默认 medium，top_down/tdd 默认关 |
| 20 | **规则-实现分离（KP-0060）** | ✅ | 校验器先于消费者（verifier-classify、E-CHANGE-006、schema） |

**小结**：20 项能力 15 项已落地、5 项"部分"（均因覆盖实证或模块层命名/平权差异，非整块缺失）。整块未实现的 PRD 能力见 §2（命令能力分层为根 spec 级，非 PRD 能力表显式行，但 PRD 未显式宣称——实为 spec 承诺缺实现）。

---

## 2. 根 spec.md 14 块 → 实现：仍开放的 P0/P1（锚定活跃变更）

活跃变更 `p0-calibration-hardening`（phase=open，未签收）的 4 项 P0 经本次复核**全部仍为代码事实缺口**：

| 项 | spec 承诺 | 当前代码事实 | 状态 |
|---|---|---|---|
| **P0-A Capability Tier** | CommandMetadata / `mumuspec capability` / 全局 dry-run / 不可逆输入名称二次确认 | 全 `src/` 无 CommandMetadata 类型、无 capability 命令；dry-run 仅 ad-hoc；不可逆用 `--confirm` 非名称确认 | ❌ 未实现 |
| **P0-B loader 层数** | SHALL NOT hardcode 固定层数 | `src/spec/loader.ts:361` 仍 `_maxDepth`，`:41` 传 `config.specs.max_layer_depth` 未用 | ❌ 未实现 |
| **P0-C 32KiB 容量断言** | ENF-3 分发产物 ≤ 32KiB | `install/`、`rules/` 全仓无容量断言 | ❌ 未实现 |
| **P0-D finalize-archive** | FA-1 原子/回滚、code-graph snapshot、cache 陈旧项删除、防重跑 | `finalize-archive.ts:327` 仍 "Placeholder: code-graph snapshot would be updated here" | ❌ 未实现 |

**已消解（自 09-05 校准后）**：TEMP 临时目录管理矛盾、GLOSSARY 路径错位 → 由 doc-governance-decisions 归档修复；分发层 phase-skill 平权 → codex/windsurf/gemini 已补全五阶段 skill（见 §4）。CLI 版本单一事实源已由运行时读 package.json 解决。

---

## 3. 分布式叶子层（25 层 prd+tech）→ 实现

自动 drift 对**已注册**层显示一致；逐叶子源码核对发现漂移集中在"命名漂移 / 规范层缺失 / 规范过期"三类：

### 3.1 规范层缺失（有源码、无 prd/tech、且不在根 index.yaml 注册）

| 目录 | .mumuspec 内容 | 源码 | 判定 |
|---|---|---|---|
| `src/team` | 仅 constraints.yaml+BOUNDARY.md | config/engine/index.ts | **规范层缺失** |
| `src/contract/formatter` | 仅 BOUNDARY.md | problem-matcher/sarif.ts | **规范层缺失** |
| `src/knowledge/scanners` | 仅 BOUNDARY.md | 4 scanner+index | **规范层缺失** |
| `src/mcp` | 无 .mumuspec | tools.ts（35 工具） | **规范层缺失 + 未注册** |
| `src/meta-evolution` | 仅 BOUNDARY.md+constraints.yaml | 6 文件（scoring/knowledge-evolution 等） | **规范层缺失** |
| `src/core/metrics`、`src/core/templates`、`src/guard/providers`、`src/mcp-server.ts` | 无规范层 | 有源码 | **规范层缺失** |

> 违反 spec STRUCT-3「新增模块必须在 index.yaml 注册」与「每个 .mumuspec 应含 prd.md+tech.md」；且 **`mumuspec drift` 报 OK** —— 即自动漂移检查未把"未注册 .mumuspec / 无规范层的源码模块"判为漂移。这是结构级盲区（§5 根因）。
> 注：`src/cli.ts`、`src/cli/commands` 由 `src/cli` 覆盖，正常。

### 3.2 命名漂移（代码已实现，但导出/能力名与规范声明不一致）

| 模块 | 规范声明 | 实际 | 性质 |
|---|---|---|---|
| knowledge | `searchKnowledge()` | `knowledgeSearch()` | 重命名漂移 |
| knowledge | ID 强制 KP-NNNN-`<slug>` | pages.ts:99 仅存传入 id，未强制；实际 KP-时间戳/KP-CHAT- | 语义未强制 |
| eval | `runEvalSuite()` / 断言"安全执行" | `runAllEvals()`；runner.ts:254 `new Function` 直执行无沙箱 | 重命名 + SHALL NOT 落空风险 |
| feedback | `listFeedbacks` / `linkSession` / `getFeedbackContext` | `listAllFeedbacks`/`linkFeedbackToSession`；`getFeedbackContext` 仅注释无实现 | 命名不符 + **getFeedbackContext 缺失** |
| guard | tech 命名 `STRENGTH_ACTION_MAP`/`GUARD_CHECK_METADATA` | 实为 `checkMetadataFor`+`evaluateConstraint` | tech 命名过期 |
| hooks | tech 写"4 种 Hook" | 代码 5 种（含 post-commit） | 规范过期 |
| i18n | locale fallback 到 zh/ | 代码不回退 zh 子目录 | 措辞漂移 |

### 3.3 规范过期（声明与根 PRD/代码矛盾）

| 模块 | 过期声明 | 代码事实 |
|---|---|---|
| `src/rules` | prd/tech（2026-08-04）仍写"生成 CLAUDE.md / .cursorrules / AGENTS.md 三文件" | `generator.ts` `LEGACY_RULE_FILES` **永不生成** .cursorrules（符合根 PRD"已停止生成"）——**模块层规范未随 goal-p0-dispatch-gate 更新** |

### 3.4 逆向漂移（代码存在、规范未描述）

| 位置 | 事实 |
|---|---|
| `eval/experiment-engine.ts` | 整模块（meta 进化实验引擎）在 prd/tech 中完全未提及 |

---

## 4. 分发层 / phase-skill 平权现状（09-05 校准后更新）

- **codex / windsurf / gemini**：已由 `installer-registry.ts` 补齐完整五阶段 phase skill + workflow-presets（`CODEX_PACKAGES`，其余 map 派生）✅
- **copilot**：无自定义 skill 机制 + TC-A1x 禁止 .github 额外文件 → **rules-only**（manifest 仅声明位 + AGENTS.md canonical），`AGENT_INSTALL_POLICIES` 标 `workspaceOnly`。此为文档化**有意**设计，非缺口
- 根 PRD「10 agent 安装器」在 AgentType 层面成立（10 种类型），但"每个 agent 获得平权 phase skill"在 copilot 上不成立（有意豁免）

---

## 5. 根因归纳

| 类别 | 说明 |
|---|---|
| **R1 结构校验盲区** | `mumuspec drift` 只核对"已注册项的路径存在"，不反向检查"未注册 .mumuspec / 无规范层源码模块"→ 结构级缺口静默通过（STRUCT-3 缺 enforcement） |
| **R2 覆盖偏 manual** | 230 约束仅 0.9% enforced-strong；PRD「不可验证=不存在」强语义未转为高自动覆盖 |
| **R3 模块规范滞后** | 高层已演进（AGENTS.md canonical、10 agent），低层 rules/ 的 prd-tech 停在 2026-08-04，未随 goal-p0-dispatch-gate 同步 → 层间矛盾 |
| **R4 命名契约漂移** | 公共 API 重命名未回写规范（knowledge/eval/feedback），且 feedback 有一能力纯缺失 |

---

## 6. 建议处置（供签收/立项输入）

| 优先级 | 动作 | 归属 |
|---|---|---|
| **P0** | 完成活跃变更 `p0-calibration-hardening` 4 项（A 裁决实现 or 降级 spec / B loader / C 32KiB / D finalize） | 既有 open 变更 |
| **P0** | 修复 drift 盲区：反向检测未注册 `.mumuspec` 与无规范层源码模块（R1） | 新立项或并入上述 |
| **P1** | 补 `src/mcp`、`src/team`、`src/meta-evolution`、`src/knowledge/scanners`、`src/contract/formatter` 的 prd/tech + index 注册 | 规范补齐 |
| **P1** | `src/rules` prd/tech 更新为"不生成 .cursorrules"；`hooks` tech 4→5；`i18n` fallback 措辞 | 规范同步 |
| **P1** | 统一公共 API 命名与规范：search/knowledgeSearch、runEvalSuite/runAllEvals、listFeedbacks、补 `getFeedbackContext`；`eval` 断言沙箱 | 代码 or 规范对齐 |
| **P2** | feedback `getFeedbackContext` 补实现或从规范删除；`eval/experiment-engine.ts` 补规范描述 | 一致性收口 |
| **P2** | 评估是否提高 enforced-strong 覆盖（抽查绑定关键约束到验证器） | 长期 |

---

*生成：2026-09-06 · 来源：mumuspec validate/drift/check + 25 层 prd/tech 逐源码核对 + 4 组叶子审计并行走查。本文档为 review 产物，未改动任何源码/规范。*
