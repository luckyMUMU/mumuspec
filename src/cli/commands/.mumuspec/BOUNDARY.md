---
scope: src/cli/commands
layer: 3
---

# src/cli/commands/ 目录边界文档

## 对外接口

### 命令注册函数命名约定

- **复数命令**（包含多个子命令）：`register<Name>Commands(program)` — `program: Command`（commander 实例）
- **单数命令**（单一功能）：`register<Name>Command(program)` — `program: Command`

### 完整命令注册函数列表（24 个）

| 注册函数 | 来源文件 | 命令名 |
|----------|----------|--------|
| `registerSpecCommands` | `spec.ts` | spec |
| `registerChangeCommands` | `change.ts` | change |
| `registerGuardCommand` | `guard.ts` | guard |
| `registerStateCommands` | `state.ts` | state |
| `registerKnowledgeCommands` | `knowledge.ts` | knowledge |
| `registerConstraintsCommands` | `constraints.ts` | constraints |
| `registerFeedbackCommands` | `feedback.ts` | feedback |
| `registerInstallCommands` | `install.ts` | install |
| `registerFinalizeArchiveCommand` | `finalize-archive.ts` | finalize / archive |
| `registerHooksCommands` | `hooks.ts` | hooks |
| `registerDashboardCommands` | `dashboard.ts` | dashboard |
| `registerEvalCommands` | `eval.ts` | eval |
| `registerI18nCommands` | `i18n.ts` | i18n |
| `registerSkillCommands` | `skill.ts` | skill |
| `registerBundleCommands` | `bundle.ts` | bundle |
| `registerEnvCommands` | `env.ts` | env |
| `registerDoctorCommand` | `doctor.ts` | doctor |
| `registerRecommendCommand` | `recommend.ts` | recommend |
| `registerDecisionsCommand` | `decisions.ts` | decisions |
| `registerAdviseCommand` | `advise.ts` | advise |
| `registerContractCommands` | `contract.ts` | contract |
| `registerLoopCommands` | `loop.ts` | loop |
| `registerSyncCommand` | `sync.ts` | sync |
| `registerReviewCommand` | `review.ts` | review |
| `registerMergeCommand` | `merge.ts` | merge（2026-08-08 新增） |

### 命令文件清单（33 个 .ts 文件）

advise.ts, bundle.ts, change.ts, constraints.ts, contract.ts, dashboard.ts, decisions.ts, doctor.ts, env.ts, eval.ts, feedback.ts, finalize-archive.ts, guard.ts, hooks.ts, i18n.ts, install.ts, knowledge.ts, knowledge-analysis.ts, knowledge-chat.ts, knowledge-crud.ts, knowledge-doctor.ts, knowledge-git.ts, knowledge-onboard.ts, knowledge-scan.ts, loop.ts, merge.ts, recommend.ts, review.ts, skill.ts, spec.ts, state.ts, sync.ts

## 依赖声明

### 内部依赖

| 依赖来源 | 提供能力 |
|----------|----------|
| `../helpers.ts` | `getCssSummary`、`getDirectorySummary` 等 CLI 共有辅助函数 |
| `../ui-helpers.ts` | `step()`、`success()`、`warn()`、`error()` 等终端 UI 辅助函数 |

### 核心模块依赖

各命令文件根据职责选择性导入以下核心模块：

- `core/config.ts` — `loadConfig`、`saveConfig`、`getDefaultConfig`、`isInitialized`
- `core/utils.ts` — `getMumuSpecDir`、`ensureDir`、`writeText`、`writeYaml`、`appendAuditLog`、`now`、`findProjectRoot`
- `core/errors.ts` — `formatError`
- `core/project-analyzer.ts` — `analyzeProject`
- `core/init-generator.ts` — `generateInitialSpec`、`generateInitialDesign`、`scaffoldKnowledgeBase`
- `core/constraint-evaluator.ts` — 约束评估
- `spec/parser.ts`、`spec/loader.ts`、`spec/validator.ts`、`spec/ponytail.ts`
- `change/manager.ts`、`change/state-machine.ts`
- `guard/checker.ts`、`guard/phase-guard.ts`
- `knowledge/manager.ts`
- `contract/`（loader、validator、impact-analyzer、manager）
- `rules/generator.ts`
- `install/installer.ts`
- `eval/runner.ts`
- `i18n/locales.ts`
- `hooks/guard.ts`

## 数据契约

### 命令注册规范

- 每个命令文件导出一个 `registerXxxCommand(s)(program: Command): void` 函数
- 函数内使用 `program.command('name').description('...').argument(...)...action(callback)` commander API
- 异步 action 使用 `async` 回调
- 错误统一通过 `catch` 捕获并使用 `console.error` + `process.exit(1)` 退出

### 安全确认规范

- **危险操作**（删除/归档/清理 worktree）必须提供 `--confirm` / `-y` 选项
- 危险操作 action 执行前检查 confirm 标志：无则输出警告 + `process.exit(130)`（用户取消）
- 规范：archive.ts、change.ts（discard）、hooks.ts（uninstall）均需实现

### 文件命名约定

- 采用 **kebab-case**（全小写，连字符分隔）
- 对应命令名与文件basename一致
- 子命令文件沿用父命令前缀（如 `knowledge-scan.ts`、`knowledge-git.ts`、`knowledge-analysis.ts` 等）

## 变更日志

| 日期 | 变更说明 |
|------|----------|
| 2026-08-08 | 新增 `merge.ts`（`mumuspec merge <change>` 命令：归档后合并变更分支到主分支，--no-ff + 冲突暂停） |
| 2025-07-09 | 首次创建，记录 src/cli/commands/ 对外接口、依赖与数据契约 |
