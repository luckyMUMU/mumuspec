---
scope: src/eval
layer: 2
---

# Boundary Document: eval

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `loadScenario` | `(filePath) => EvalScenario` | runner.ts | 加载评估场景 |
| `discoverScenarios` | `(root) => string[]` | runner.ts | 发现评估场景文件 |
| `runScenario` | `(scenario) => EvalResult` | runner.ts | 运行单个评估 |
| `runAllEvals` | `(root?) => EvalReport` | runner.ts | 运行全部评估 |
| `initEvalsDir` | `(root) => { created, errors }` | runner.ts | 初始化评估目录 |

### 导出类型

| 类型 | 用途 |
|------|------|
| `EvalScenario` | 评估场景定义 |
| `EvalResult` | 单个评估结果 |
| `EvalReport` | 完整评估报告 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统读写 |
| `node:path` | 路径处理 |
| `yaml` | YAML 解析 |
| `../core/utils.js` | 工具函数 |

### 外部依赖

- `yaml`（npm 包）

## 数据契约

### 输入

- 评估场景文件路径（YAML 格式）
- 项目根路径

### 输出

- 评估结果（pass/fail, score, details）
- 报告文件：`.mumuspec/evals/*`

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 初始创建边界文档 | 新目录边界定义 |
