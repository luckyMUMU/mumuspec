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
| `checkAstConstraints` | `(content, filePath, constraintIds) => CodeViolation[]` | 纯 AST 约束检查（无正则回退） |
| `JsxDetectionResult` | 接口类型 | `{ hasJsx, reason, details?, line? }` |
| `CodeViolation` | 接口类型 | `{ line, column, matched, source }` |

> **设计原则**：ast-checker.ts 不使用任何正则匹配，所有检测基于 TypeScript Compiler API 的 AST 节点。

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
| 2026-08-03 | 修复文件共存约束检测（避免代码模式匹配误报） | 减少误报 128+ 个错误 |
| 2026-08-03 | 排除系统行为约束的模式匹配 | 减少误报 |
| 2026-08-09 | 新增 ast-checker.ts（纯 AST 检测器） | 为 guard 层提供无正则回退的检测能力 |
| 2026-08-09 | 删除 findJsxLine（正则行号定位） | 改用 detectJsxUsage 的 AST 行号 |
| 2026-08-09 | 引入 typescript 外部依赖 | AST 解析引擎 |
