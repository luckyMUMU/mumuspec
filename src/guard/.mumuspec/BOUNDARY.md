---
scope: src/guard
layer: 2
---

# Boundary Document: guard

## 对外接口

### Checker（checker.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `checkCompliance` | `(projectRoot, options) => GuardResult` | 合规检查 |
| `applyStrengthToGuardResult` | `(result, strength) => GuardResult` | 应用强度感知 |
| `detectDrift` | `(projectRoot) => DriftResult[]` | 规范漂移检测 |
| `detectDriftWithContracts` | `(projectRoot) => DriftResult[]` | 含契约的漂移检测 |
| `detectContractGuardDrift` | `(projectRoot) => DriftResult[]` | 契约守护漂移检测 |
| `autoFixDrift` | `(projectRoot, drifts, dryRun?) => AutoFixResult` | 安全漂移自动修复 |

### AST Checker（ast-checker.ts）— 纯 AST 代码检测器

| 函数/类型 | 签名 | 用途 |
|-----------|------|------|
| `detectJsxUsage` | `(content, filename) => JsxDetectionResult` | AST 检测 JSX/TSX 语法（正确区分泛型） |
| `usesHtmLibrary` | `(content) => boolean` | 检测 htm 模板库（JSX 替代方案） |
| `reportSensitiveInfo` | `(projectRoot, warnings) => number` | 规范工件敏感信息扫描（W-SECURITY-001 + audit 留痕），供 `mumuspec check` 全量模式调用 |
| `JsxDetectionResult` | 接口类型 | `{ hasJsx, reason, details?, line? }` |
| `SensitiveFinding` | 接口类型 | `{ file, line, pattern, excerpt }`（excerpt 为掩码片段） |

> **设计原则**：ast-checker.ts 不使用任何正则匹配，所有检测基于 TypeScript Compiler API 的 AST 节点。

### Ponytail Linter（ponytail-linter.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `lintPonytail` | `(projectRoot) => PonytailLintResult[]` | Ponytail 7 级阶梯 lint 检查 |

### Phase Guard（phase-guard.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `runPhaseGuard` | `(change: string, phase: string) => PhaseGuardResult` | 阶段守护检查 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统 |
| `node:path` | 路径处理 |
| `typescript` | TypeScript Compiler API（AST 解析、JSX 检测、约束检查） |
| `../core/types.js` | 核心类型定义 |
| `../core/config.js` | 配置 |
| `../core/constraint-evaluator.js` | 约束强度评估 |
| `../spec/parser.js` | 规范解析 |
| `../spec/ponytail.js` | Ponytail 解析 |
| `../spec/loader.js` | 规范加载 |
| `../contract/validator.js` | 契约验证 |

### 外部依赖

- `typescript`（npm 包，AST 解析引擎）

## 数据契约

### 输入

- 项目根路径
- 检查选项（shall、shallNot、ponytail、testImmutability、strength）

### 输出

- `GuardResult` — passed、errors、warnings
- `DriftResult` — type、severity、message、file、line
- `PhaseGuardResult` — canTransition、blockers

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-29 | **CHG-5: LLM 自主性增强**：`E-GUARD-001` 从 RG high 降为 TD medium（过程约束）；`E-DESIGN-009` 从 ERROR 降为 W-DESIGN-009（设计模板检查）；hotfix 路径 proposal.md/build_layers/test-cases 从 ERROR 降为 WARNING；full workflow build_layers 从 ERROR 降为 WARNING；新增 `E-DESIGN-010`（TD medium）；默认 TD 强度从 high 降为 medium | 过程约束全面降级为 advisory，LLM 可自主选择实现路径；结果约束（SHALL NOT / verify pass / all layers done）仍 block |
| 2026-08-29 | `checkIndexDrift` 修复：此前将 index 子项 path（如 `src\core`）与目录名（`core`）互比——永不相交导致每个条目都产生假漂移警告；改为按 path 探测 `.mumuspec` 存在性 + name/path 双向覆盖比较 | index_drift 警告从全员误报变为真实陈旧项 |
| 2026-08-29 | **M2 门控默认翻转**：E-SPEC-015 / E-VERIFY-003 门控默认 ON（`enforcement_strict !== false`），显式 `false` 才退回观察态 | `mumuspec check` 与 archive 守卫默认执行红线门禁 |
| 2026-08-29 | **Verifier 语义收紧（P0）**：`GUARD_CHECK_METADATA` 中 `E-SPEC-004` 加 `always_enforce: true`（任何强度保留为 warning，不再被 TD=low 折叠丢弃）；新增 `E-SPEC-015`（requirement_goals/high/always_enforce）与 `E-VERIFY-003`（同）注解；`checkShall` 改用共享分类器（`spec/verifier-classify.ts`）判定，正则提取与 `checkProhibitionViolation` 共享 `extractRegexPatterns`；`checkVerifyToArchive` 新增 manual 约束 evidence 逐条检查（E-VERIFY-003，门控 `enforcement_strict`） | `mumuspec check` 行为变化：E-SPEC-004 恒可见；门控开启时新增红线门禁 |
| 2026-08-28 | 新增 `ponytail-linter.ts` — Ponytail lint 规则检查器 | 集成到 `checkCompliance` 中，输出 E/W-PONYTAIL-001 |
| 2026-08-28 | `E-DESIGN-*` 和 `E-GUARD-004` 约束强度从 high 降级为 medium | 行为约束降级为 advisory，增强 LLM 自由度 |
| 2026-08-28 | `ILanguageProvider` 新增 `extractSymbols?()` 方法 | TypeScript Provider 实现 AST 符号提取 |
| 2026-08-03 | 修复文件共存约束检测（避免代码模式匹配误报） | 减少误报 128+ 个错误 |
| 2026-08-03 | 排除系统行为约束的模式匹配 | 减少误报 |
| 2026-08-09 | 新增 ast-checker.ts（纯 AST 检测器） | 为 guard 层提供无正则回退的检测能力 |
| 2026-08-09 | 删除 findJsxLine（正则行号定位） | 改用 detectJsxUsage 的 AST 行号 |
| 2026-08-09 | 引入 typescript 外部依赖 | AST 解析引擎 |
