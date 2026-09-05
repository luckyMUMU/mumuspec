# Changelog

All notable changes to MumuSpec are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — Verifier 语义收紧（P0）+ Spec 即 DSL 定位修正 + CHG-5 LLM 自主性增强

设计提案：`review/proposal-verifier-semantics-2026-08-29.md`（含影响分析 C1-C7 与开放问题裁决 Q1-Q6）。
定位修正：`review/nl-bytecode-gap-analysis-2026-08-29.md` §定位修正，决策页 KP-0059。

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
