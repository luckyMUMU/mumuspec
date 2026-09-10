# Changelog

All notable changes to MumuSpec are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.22.0-alpha.0] — archive auto-bump (2026-09-10)

### Changed
- 归档自动升版：变更 freedom-metrics-loop-closure（full workflow）归档触发

## [0.21.0-alpha.0] — archive auto-bump (2026-09-09)

### Changed
- 归档自动升版：变更 2026-09-09-review-followup-hardening（full workflow）归档触发

## [0.20.0-alpha.0] — archive auto-bump (2026-09-09)

### Changed
- 归档自动升版：变更 2026-09-09-completeness-artifacts-freedom-metrics（full workflow）归档触发

## [Unreleased] — PRD ↔ 实现对齐（Agent 上下文链路）

分析依据：`review/spec-agent-integration-analysis-2026-09-08.md`；变更：`prd-alignment-agent-integration`。

### Fixed
- **渐进式披露通道修复**：`mumuspec context <path>` 文本渲染此前只输出遗留字段 `layer.spec` / `layer.design`，对 0.19 起的 prd.md/tech.md 新格式输出零条约束（7 行空输出）。现补齐 `layer.prd` / `layer.tech` 渲染，与 `--json` 通道同构（根路径输出 7 → 257 行）
- **根全局 charter 回归规范链**：根层 `spec.md` 此前被 loader 当作 `tech.md` 的回退文件跳过（根层同时存在 prd/tech 时永不加载）。现根层（level 0）额外加载 spec.md——Root spec.md 是全局 charter，与 prd/tech 共存为规范要求；模块层保持「spec.md 仅作 tech.md 回退」语义
- **AGENTS.md 规范链摘要为空**：`buildRuleGenContext` 改为结构摘要（层级 / scope / 文档类型 / SHALL·SHALL NOT 条数）+ 当前路径红线全文，不内联 SHALL 正文（遵守分发层「禁止内联全量规范」SHALL NOT）；init 与 install 两条链路均传入 specContext。摘要由空 → 56 条红线
- **CLI 速查与注册表脱钩**：AGENTS.md 速查此前硬编码 8 条，实际注册 56 条，CLI-first 关键命令（`state transition` / `decisions append` / `test-cases lock` / `state layer` / `capability`）agent 无从得知。新增 `renderCliCheatSheet(program)` 从命令注册表现场生成（CLI-first 命令置顶 + 子命令展开）；`setCliCheatSheet()` 依赖倒置注入，使 install 路径与 init 同源
- **归档 delta 合并污染根规范**：`prepareChangeSpecContent()` 剥离变更层 frontmatter（消除 `parent_prd` / `parent_tech` 未重定位导致的 E-SPEC-010 ×2）并拒绝合并未填写的 init 模板占位符；同步清理根 prd.md / tech.md 已入库的占位符块。`validate` 由 2 error → 0，unverifiable 2 → 0，declared_ratio 100%

### Added
- `tests/spec/agent-context-alignment.test.ts` — G1/G2/G3/G4 回归锁定（14 例）
- `tests/guard/check-validate-parity.test.ts` — G5 门禁结论一致性回归（3 例）
- `tests/guard/index-drift.test.ts` — G7b index 全树漂移检测回归（5 例）

### Fixed（P1 批次）
- **门禁结论不一致（G5）**：`checkCompliance` 全量模式并入 `validateAllSpecs` 的 error 级诊断（E-SPEC-* 全族，按 code+message 去重，warning 不升格）。此前 `check` 仅覆盖 E-SPEC-004/015，规范结构缺陷（如 E-SPEC-010 父引用断链）在 `check` 下静默通过而 `validate` 报 ERROR——违反「归档前必须通过 check 全量校验」；并入后 check 实测抓到 AGENTS.md↔spec 漂移（E-AGENTS-001）
- **规范-实现 API 名漂移（G6）**：`src/feedback/.mumuspec/prd.md` / `tech.md` 与 `manager.ts` 头部注释引用 3 个不存在的 API（`linkSession` / `listFeedbacks` / `getFeedbackContext`），`submitFeedback` 返回类型漂移。按 YAGNI 修文档对齐实际导出（9 个函数），不新增无调用方函数
- **index 漂移检测只扫一层（G7b）**：`checkIndexDrift` 此前仅枚举 projectRoot 一级子目录，深层模块「有 .mumuspec 却未注册」永远漏检。改为全树递归收集（排除 node_modules / dot 目录），上线即抓到 2 个漏检目录（src/contract/formatter、src/knowledge/scanners）
- **drift --fix 生成质量**：`autoFixDrift` 生成的 index 条目使用绝对路径且缩进错乱，已手工修正为相对路径统一格式（条目生成逻辑待后续修复）

### Added（P1 批次）
- **G7a 三模块规范层**：`src/mcp`（35 工具 / 4 写工具显式声明 / 传输-工具分离边界）、`src/meta-evolution`（评分 / 知识进化 / 技能推荐 / 影响分析 / stats 五子系统）、`src/team`（状态机 / 适配器分离 / 配置校验门）补齐 V2 格式 prd/tech 并注册 index——严格校验生效，约束总数 230 → 258，unverifiable 保持 0，declared_ratio 100%

## [Unreleased] — 自洽性修复批次（2026-09-05 全流程评审落地）+ Verifier 语义收紧（P0）+ Spec 即 DSL 定位修正 + CHG-5 LLM 自主性增强

设计提案：`review/proposal-verifier-semantics-2026-08-29.md`（含影响分析 C1-C7 与开放问题裁决 Q1-Q6）。
定位修正：`review/nl-bytecode-gap-analysis-2026-08-29.md` §定位修正，决策页 KP-0059。
本轮依据：`review/full-flow-consistency-ecosystem-2026-09-05.md`（全流程自洽性评审 × 生态对标）。

### Changed
- **归档自动升版口径定稿（保留 + 补 CHANGELOG）**：`bumpVersionForArchive` 保留既有规则（full: minor+1/prerelease 重置；tweak/hotfix: prerelease 计数 +1；无 prerelease: patch+1 转 alpha 基线），新增可选 `changeName` 参数——bump 成功时自动在 `CHANGELOG.md` 顶部插入 `## [<newVersion>] — archive auto-bump (<date>)` 条目（幂等，该版本标题已存在则跳过；无 CHANGELOG.md 或写失败均非致命）；`archiveChange` 传入 changeName 接通口径。文档口径见 `docs/reference/packaging-deployment.md` §3.4。经用户 2026-09-07 裁决保留该行为，人工不回滚版本
- **Dogfood 迁移（P0）**：根部 AGENTS.md/CLAUDE.md 从旧式全量生成迁移到 canonical-first 产物——AGENTS.md 为 canonical（规范链摘要 + Ponytail + CLI + MCP 四节），CLAUDE.md 为 `@AGENTS.md` 薄壳桥接；`buildRuleGenContext` 补齐对新格式 tech.md 层的读取（此前仅读 `layer.spec`，新格式项目生成空摘要）；demo/ 示例产物同步更新
- **CHG-7 dogfood**：本仓库创建 `.mumuspec/workflow.yaml`（当前与内置默认一致，启用项目级加载路径；差异化调整时在此修改）
- **CLI 去重（非破坏）**：`--change` 选项提升至 `mumuspec drift` 主命令；`drift detect` 降级为隐藏弃用别名（stderr 提示，下一 minor 移除）；`knowledge search` 升级为原 search2 的相关性评分增强引擎（兼容旧 `--tag`/`--type` 单值选项）；`search2` 降级为隐藏弃用别名
- **SKILL.md 开放标准对齐**：新增 `skills/mumuspec-workflow/SKILL.md`（agentskills.io 标准 frontmatter：name/license/metadata，installer `findMumuspecWorkflowSource` 首选路径）；`skills/mumuspec/en/SKILL.md`（无 frontmatter，不合规范）降级为资源文件 `en/orchestrator-en.md`
- 失效修复提示更正：`mumuspec rules generate` 命令已不存在，E-AGENTS-001 fixSteps 及 agents_drift fixHint 改为指向 `mumuspec init`

### Removed
- DS-005 任务粒度检查空壳占位（`phase-guard.ts` checkBuildToVerify 内 `void GranularityLimit` 死代码）：从未产出任何 warning 且无文档声明，按 YAGNI 移除；未来需要时基于 tasks 数据结构重新设计

### Added
- **CLI-first 三命令（0.20）**：`tasks next <name>`（tasks.md 首个未完成任务定位，替代 grep 手工步骤）、`test-cases lock-suite <name> --layer N`（逐层套件 hash 确定性写入 state.suites_hash，替代手写 suite-map.yaml）、`state layer <name> <N> <status>`（build_layers 状态确定性更新，替代手编 .mumuspec.yaml）
- 约束可验证性四分类（`enforced-strong` / `enforced-weak` / `manual` / `unverifiable`）：新增 `src/spec/verifier-classify.ts` 纯函数分类器，正则兜底提取逻辑与 guard 共享（消除双份正则漂移）
- `E-SPEC-015 SPEC_SHALL_NOT_UNVERIFIABLE`（ERROR，forceable: false）：SHALL NOT 红线无可验证通道时发射
- `E-VERIFY-003 MANUAL_EVIDENCE_MISSING`（ERROR，forceable: true）：verify_to_archive 逐条检查 manual 约束的验证记录（按 Enforcement ID 或约束原文锚定）
- `mumuspec validate` / MCP `validate_specs` 返回 `enforcement_coverage`（五桶计数 + `declared_ratio` / `strong_ratio` + unverifiable 迁移清单）；CLI 人类可读输出新增 Coverage 报告
- Enforcement 节新增 `manual(原因)` 保留字（parser 解析 + 序列化回写 round-trip）；`EnforcementRule.kind` 字段（`manual` / `implicit-manual`）

### Changed
- **CHG-5: LLM 自主性增强（过程约束全面降级）**：
  - 默认约束强度 `technical_design` 从 `high` 降为 `medium`（过程约束 advisory，结果约束仍 block）
  - 默认工作流规则 `top_down_design` / `tdd_enforced` 改为 `false`（LLM 可自主选择实现路径）
  - 默认 `require_brainstorming` 改为 `false`，`default_tdd_mode` 改为 `non-tdd`
  - `E-GUARD-001`（proposal.md 缺失等）从 RG high 降为 TD medium
  - `E-DESIGN-009`（设计模板缺失）从 ERROR 降为 WARNING（W-DESIGN-009）
  - hotfix 路径的 proposal.md/build_layers/test-cases 检查从 ERROR 降为 WARNING
  - full workflow 的 build_layers 检查从 ERROR 降为 WARNING
  - 核心原则：**Spec 只约束 WHAT（验收标准、红线），不约束 HOW（执行路径）**
- **M2 红线门禁默认启用（行为变更）**：`constraint_strength.enforcement_strict` 默认 `true`——SHALL NOT 无可验证通道即 ERROR（阻断 validate/check），manual 约束归档前必须有 verify evidence。**opt-out**：设 `enforcement_strict: false` 退回观察态（仅 warning）。经用户 2026-08-29 明确接受，随本次一并发布
- **E-SPEC-004 语义收窄与恒可见**：仅指 SHALL 无验证声明；`always_enforce` 注解使其不再被 TD=low 强度折叠丢弃（可验证性 ⊥ 强度，constraint-strength.md 新增 §9.0）；forceable 改为 false
- F8 修复：自动注解移除「样板/DRY → no-side-effect」语义错配（此前制造虚假的 enforced-strong 覆盖）

### Fixed
- **CLI 版本动态化（CHANGE-3 由构造保证）**：`src/cli/index.ts` 硬编码 `.version('0.19.1')` 与 package.json（0.19.2-alpha.0）漂移——`--version` 输出错误且 prebuild 阻断；现改为运行时读取 package.json，`prebuild-check` 识别动态读取模式
- **C3 遗留格式禁令 dogfooding 误报**：`禁止生成 .cursorrules/.windsurfrules` 的字面扫描命中 generator 硬过滤与 doctor 指引（约束自身的合法实现者）；扩展 `isAgentBehaviorConstraint` dogfooding carve-out 覆盖该约束（checker.ts）
- **skill 指令与 CLI 实现一致性修复（6 处）**：verify-fail/archive-reopen 两个无效状态机目标改为 `transition <name> build --reason`；`mumuspec archive` 补 `--confirm`；`decisions append` 补 `--text`；编排器 Guard/State 说明重写为当前审计语义；skill 接线既有命令（cognitive-map init/sync、grill-me run、test-cases init、decisions append）。分析见 `review/pipeline-cli-first-analysis-2026-08-29.md`
- `checkIndexDrift` 对比逻辑修复：此前将 index 子项 path（`src\core`）与目录名（`core`）互比，永不相交导致每个索引条目都产生假漂移警告；现按 path 探测 `.mumuspec` 存在性，仅报告真实陈旧项
- `serializeSpecFile` frontmatter 保真修复：此前 round-trip 会静默丢弃未知 frontmatter 字段（如 doc_type、parent_prd）；现按序保留（`mumuspec annotate` 等回写命令不再有数据丢失风险）
- 错误码注册表补全：登记 5 个有发射点但未注册的码（E-VERIFY-001/002、E-DESIGN-009/010、E-FINAL-001，新增 FINAL 域，共 78 码/16 域）
- 结构白名单补 `templates`（cognitive-map 查找路径、config `custom_dir`）与 `discarded`（discard 终态目的地）
- `mumuspec init` 创建的 `knowledge/rationale` 目录更正为 `rationales`（并补 `imports`）——修复新初始化项目立即报 E-SPEC-013 的自相矛盾（预存在缺陷）

### Documentation
- `docs/design/constraint-strength.md` 新增 §9.0 可验证性前置判定
- `docs/reference/error-codes.md` 自动再生（71 → 73 码，新增 VERIFY 域）
- README.md、overview.md、design.md、STATUS.md 全面更新：对齐 "Spec 即 DSL" 核心定位（KP-0059），"人工编写 spec 而不编写代码"

## [0.19.2-alpha.10] - 2026-09-07

### Added
- **P0-C 容量断言**：Rules 产物 32KiB 预算（`MAX_RULES_BYTES` + `assertRulesWithinBudget`），fail-closed；新增错误码 E-RULES-001
- **P0-A 命令能力分层（最小版）**：`CommandMetadata` + `mumuspec capability [command] [--json]`

### Changed
- **P0-B**：loader 渐进式披露层数改用 `config.specs.max_layer_depth`（默认 5），不再硬编码 3 层
- **P0-D**：finalize-archive code-graph snapshot 由占位改为真实快照（落 temp/codegraph.snapshot.json）

### Fixed
- **P0-D**：cleanStaleCache 陈旧归档项由「仅计数」改为实际删除；新增 `.finalized` 防重跑标记（幂等，--force 覆盖）

## [0.19.1] - 2026-08-22

### Security
- MCP HTTP 模式新增 Token 认证（`MUMUSPEC_MCP_TOKEN`）和 CORS 白名单（`MUMUSPEC_MCP_CORS_ORIGIN`）
- YAML 解析启用安全配置（maxAliasCount: 100）防止 YAML 炸弹攻击
- 归档操作的 appendFileSync 改为原子替换模式，防止重复追加

### Fixed
- 修复 discardChange/archiveChange 在 renameSync 失败后状态与文件不一致的数据完整性问题
- 修复 acquireLock 锁超时后静默放行改为抛出错误
- 修复 mergeDeltaSpecsToMain 幂等性问题（防止重复归档导致内容重复）
- 修复 readFileSync 读取超大 YAML 文件导致 OOM 的问题（限制 10MB）

### Added
- `mumuspec spec annotate` 命令：自动为 SHALL NOT 约束生成 machine-readable 注解
- `mumuspec gen:error-codes` 命令：自动生成错误码文档
- `mumuspec ci:check` 命令：版本一致性 + 文档漂移检测
- CI 管道新增版本一致性和错误码文档漂移检查步骤

### Documentation
- 错误码文档（docs/reference/error-codes.md）改为自动生成
- 统一版本号四处（package.json / README / STATUS.md / npm）为 0.19.1
- 修正 README 中未经实证的量化声称

## [0.16.0-beta.0] - Unreleased

### Added
- 测试覆盖为 guard/checker.ts、spec/validator.ts 新增单元测试（checker.test.ts、validator.test.ts），覆盖 applyStrengthToGuardResult、checkCompliance、detectDrift、validateAllSpecs 等核心守卫逻辑。

### Changed
- 规范层一致性修复：34 个分布式 prd.md/tech.md 补充 last_updated 字段。
- 契约层完整性修正：hooks/BOUNDARY.md、i18n/BOUNDARY.md 接口名与代码完全对齐；移除 core/BOUNDARY.md 中不存在的 migrateConfig 声明及虚假 contract/constants 依赖。
- 架构层补全：新增 src/change/index.ts barrel re-export，符合 spec.md 结构规范。

### Documentation
- CHANGELOG 补录 DCG 状态机重构、Dashboard 子项目、monolithic 拆分归档三项遗漏变更。

## [0.15.0-beta.0] - 2026-08-01

### Added
- Mode-aware Guard 层:检测到不同运行环境(Claude Code / Cursor / CatPaw)时,自动调整 MCP 工具与 Rules 文件输出。
- Spec Scaffolder:初始化时基于项目分析结果,按目录结构自动生成分布式 prd.md / tech.md 文档。
- Git 命令封装 (`mumuspec git commit/flow/push/tag`):git-master 风格的一站式 git 操作,内置状态校验。
- Dashboard 命令 (`mumuspec dashboard`):实时查看活跃变更、状态机位置与历史指标。
- Spec Incremental Diff (`mumuspec search`):正则表达式搜索代码/规范节点。

### Changed
- 初始化流程重构 (`2026-08-01-refactor-init-and-archive`):整合项目分析、自动导入现有文档/第三方规范、环境检测知识页面生成等步骤。
- 归档流程重构 (`2026-08-01-refactor-init-and-archive`):新增 `finalize-archive` 命令用于归档后清理(合并规范、更新索引、清理缓存)。
- 知识层持久化重构 (`2026-08-01-refactor-persistent-spec`):`loadSpecContext` 增加缓存与增量更新;变更归档后知识可持久化落盘。
- 移除 package.json 中的 `bundledDependencies`,`workspaces` 字段,与 monorepo 的 npm 全局安装无关配置。
- Design 阶段增强 (`2026-08-01-enhance-design-phase`):引入 Hyperplan 对抗式设计评审流程;Design Skill 增加 cognitive-map.yaml 产出要求。

### Fixed
- Spec 继承加载器修复重复解析同一文件问题。
- 零依赖模块 `src/i18n/locales.ts` 误用 `import type` 跨包引用错误。
- `mumuspec context` 在 Windows 路径分隔符场景下上下文层级判定错误。

## [0.15.0-alpha.2] - 2026-08-01

### Added
- TypeScript 严格性补全启用 `noImplicitReturns` 与 `noFallthroughCasesInSwitch`,与原有
  `noUnusedLocals`/`noUnusedParameters` 组成完整严格性家族。
- CLI 子命令参数校验 (`feedback submit/update`、`guard`、`state transition`)
  在调用核心函数前显式验证,替换原有的 `as any` 断言。

### Changed
- 移除 package.json 中自引用依赖 (`"mumuspec": "file:..."`)。
- 拆分 `src/change/manager.ts` (1212 行) 为 paths / listing / state / lifecycle / archive / decisions 六个子模块 + 转发 hub。
- 拆分 `src/knowledge/manager.ts` (977 行) 为 pages / index / freshness / analysis / organize 五个子模块 + 转发 hub。
- 修复 `src/change` ↔ `src/feedback` 循环依赖:feedback 改为直接从 `change/paths.js` 导入。

### Fixed
- 修复 `.mumuspec/index.yaml` 顶层重复的 `skills` 与 `feedback` 键。
- 修复零依赖模块 `src/core/env-detector.ts` 中误导入 yaml 库的问题。
- TypeScript 严格模式迁移:修复 24 个源文件中 81 处未使用变量/参数警告。

### Removed
- 清理根目录残留的 `mumuspec-0.13.0-alpha.1.tgz` 打包产物。
- 所有 7 处 `as any` 类型断言,改为精确的类型标注 (`as ChangePhase`、`as SubmitFeedbackOptions['type']` 等)。

## [0.13.0-alpha.2] - 2026-07-15

> ⚠ 此版本未发布到 npm,仅作为开发快照存在。

### Added
- 动态约束强度系统: 新增 `constraint_strength` 顶层配置字段,支持
  `technical_design` 与 `requirement_goals` 两个维度,每维 `high`/`medium`/`low` 三档。
- 树状分层约束解析: `resolveConstraintTree` 纯函数,支持 `.mumuspec/constraints.yaml`
  在目录树中分层声明、跳层继承、收紧验证。
- Bundle-based skill 系统: 14 个内置技能 (前端、后端、测试、DevOps) 通过 `mumuspec skills install/load` 分发。
- Env Detector: OS 检测、shell 识别、敏感环境变量过滤。
- Init Generator: 从 ESM/CJS monorepo 模板新建项目。
- Project Analyzer: 技术栈探测、目录结构评估。
- Doc Importer: 从现有 README/design 文档导入生成 spec。
- Knowledge base 扩展: imports/rationales/lessons/risks 四个新类型,imports 子目录 28 条存量导入。
- 14 个 src 模块内嵌 .mumuspec/{prd,spec,tech,design} 文档。
- 打包部署文档、用户反馈与 session 摘要流程、预发布版本管理脚本。
- package.json 新增 `files`/`publishConfig`/`homepage`/`repository`/`bugs` 字段。

### Changed
- 测试套件扩展至 13 文件 / 204 用例,覆盖 env/git/knowledge/parser/constraint 等模块。
- 版本号从 `0.10.0` 提升至 `0.13.0-alpha.2`。

## [0.10.0] - 2026-07-10

### Added
- 初始 MVP 设计: 六层架构 (Spec / Change / Guard / Knowledge / Contract / AI Integration)
- 树状分布双向约束 (SHALL / SHALL NOT)
- Ponytail 编码约束 (7 级优先级阶梯)
- 五阶段变更状态机 (Open → Design → Build → Verify → Archive)
- 知识层 (LLM-Wiki + PageIndex)
- MCP Server 与 CLI 入口
- demo 项目 (task-api) 演示完整流程

[Unreleased]: https://github.com/mumuspec/mumuspec/compare/v0.15.0-beta.0...HEAD
[0.15.0-beta.0]: https://github.com/mumuspec/mumuspec/compare/v0.15.0-alpha.2...v0.15.0-beta.0
[0.15.0-alpha.2]: https://github.com/mumuspec/mumuspec/compare/v0.13.0-alpha.2...v0.15.0-alpha.2
[0.13.0-alpha.2]: https://github.com/mumuspec/mumuspec/compare/v0.10.0...v0.13.0-alpha.2
[0.10.0]: https://github.com/mumuspec/mumuspec/releases/tag/v0.10.0
