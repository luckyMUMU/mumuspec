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
| `../core/types.js` | 核心类型定义 |
| `../core/config.js` | 配置 |
| `../core/constraint-evaluator.js` | 约束强度评估 |
| `../spec/parser.js` | 规范解析 |
| `../spec/ponytail.js` | Ponytail 解析 |
| `../spec/loader.js` | 规范加载 |
| `../contract/validator.js` | 契约验证 |

### 外部依赖

无（仅 Node.js 标准库）

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
