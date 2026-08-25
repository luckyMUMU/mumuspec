---
scope: .
layer: 0
type: environment
last_updated: "2026-08-04"
---

# 环境规范: MumuSpec

## 环境检测

### SHALL
- 环境检测必须通过系统命令支持 Java（JDK/Maven/Gradle）、Node（Node.js/npm/pnpm/yarn）、Python 三大生态的识别（通过执行 `xxx --version` 等只读命令实现检测，无需引入额外依赖）
- 检测命令必须仅执行只读操作（`--version`、`which`、`echo`），禁止修改系统配置
- 全量环境检测必须在 2 秒内完成，单项检测必须有 1 秒超时保护
- env-spec.md 必须使用 `type: environment` frontmatter 标识
- Detected 部分必须由 `mumuspec env detect --save` 自动生成

### SHALL NOT
- 环境检测器不得执行网络请求
- 环境检测器不得修改任何系统文件
- 单工具检测失败不得阻断整体检测流程

### Enforcement
- ENV-1: env-detector.ts 实现并行检测且总耗时 < 2s
- ENV-2: 敏感变量过滤 MUST 覆盖 password/secret/token/key/credential/auth/private
- ENV-3: env-spec.md 格式校验（frontmatter + SHALL/SHALL NOT + Detected）

## 敏感信息过滤

### SHALL
- 检测结果必须过滤敏感环境变量（含 password/secret/token/key 的变量名）
- 过滤规则必须覆盖以下关键词：`password`、`secret`、`token`、`key`、`credential`、`auth`、`private`
- 在 error 消息和日志输出中必须脱敏处理（仅显示变量名前缀 + `***`）

### SHALL NOT
- env-spec.md 不得记录敏感信息的值（仅记录变量是否存在）
- 禁止在 error 消息中泄露敏感信息（密钥、token、文件路径）

### Enforcement
- SEC-1: 敏感变量过滤正则覆盖 7 个关键词
- SEC-2: 日志输出脱敏校验

## 工具检测

### SHALL
- 工具检测必须独立于环境检测，可单独执行 `mumuspec doctor`
- 检测结果必须区分 available / missing / unknown 三种状态
- 必须检测的核心工具：Node.js >= 20.0.0、Git、项目语言运行时

### SHALL NOT
- 工具检测不得引入新的外部依赖
- 不得因单个工具缺失而整体失败（必须给出降级方案建议）

### Enforcement
- TOOL-1: `mumuspec doctor` 输出格式校验（工具名 + 版本 + 状态）
- TOOL-2: Node.js 版本低于 20.0.0 时返回 WARN

## Detected

> 此部分由 `mumuspec env detect --save` 自动生成，记录当前环境实际检测到的工具与版本。运行该命令后此处会被真实检测结果填充。

（待运行 `mumuspec env detect --save` 填充当前环境数据）
