---
id: "KE-add-env-spec-decisions"
title: "Knowledge extracted from add-env-spec"
type: decision
status: confirmed
scope: "add-env-spec"
merged_from:
  - KE-add-env-spec-d-arch
  - KE-add-env-spec-d-modules
  - KE-add-env-spec-d-security
  - KE-add-env-spec-d-init
---

# Knowledge Extracted: add-env-spec

## Context

MumuSpec 0.13.0 引入 Environment Spec 能力：自动检测和记录项目环境及核心组件位置。新增 src/core/env-detector.ts、env-spec.md 格式、mumuspec env detect/validate/diff CLI 命令、以及 init 集成。

## Decisions

### DEC-001: 环境检测器作为独立 Core 模块
- **决策**: 提取 env-detector.ts，与 project-analyzer.ts 分离
- **理由**: 单一职责 + 可测试性，各自独立演进

### DEC-002: env-spec.md 作为 Requirement 扩展
- **决策**: 沿用 spec.md 格式（frontmatter + SHALL/SHOULD + Enforcement），type: environment 区分
- **理由**: Spec parser 无需修改，Validator 可复用

### DEC-003: CLI 命令采用现有 Commander 模式
- **决策**: mumuspec env 子命令复用现有 Commander.js 注册模式
- **理由**: boring over clever，风格一致性

### DEC-004: 检测逻辑 MUST 安全且只读
- **决策**: 仅执行 --version / which / echo $VAR；敏感变量（含 password/secret/token/key）自动过滤
- **理由**: 工具不会破坏用户环境，env-spec.md 不会泄露敏感信息

### DEC-005: init 集成检测范围由项目配置推断
- **决策**: 通过扫描项目根文件（pom.xml、package.json 等）自动推断检测工具链
- **理由**: 零配置体验

### DEC-006: 仅使用 Node.js 内置模块
- **决策**: 不使用外部依赖
- **理由**: 零 runtime 依赖，减少 breaking changes

### DEC-D-001: Detected 部分自动覆盖
- **决策**: 每次 --save 时完全重写 Detected 部分
- **理由**: 自动覆盖保证数据新鲜度

### DEC-B-001: validateEnv 返回结构化结果
- **决策**: 返回 { exitCode, messages, suggestions } 而非直接 process.exit
- **理由**: 分离关注点

## Patterns

### 环境检测器架构 (env-detector.ts)

核心函数: detectEnvironment(options?) → EnvironmentDetection
         detectTool(name, config) → DetectedTool | null
         detectRequiredEcosystems(projectRoot) → ToolEcosystem[]

预定义配置: JDK / Maven / Node / npm / Python 的 versionRegex 和 locationCmd

### 项目感知检测映射

配置文件 → 检测生态:
  pom.xml / build.gradle → java
  package.json → node
  go.mod → go
  Cargo.toml → rust
  pyproject.toml / requirements.txt → python
  Dockerfile → container

### CLI 三层命令

1. env detect [--save] [--ecosystem] [--json] — 检测并可选保存
2. env validate [--fix] [--strict] — 验证，返回 exit code 0/1/2/3
3. env diff [--against file] — 对比两个环境

### 敏感变量过滤

正则: /password/i /secret/i /token/i /key/i /credential/i /auth/i /private/i

## Lessons

- 仅用 Node.js 内置模块实现完整环境检测，零 runtime 依赖可行
- 项目配置推断（pom.xml → java）实现零配置体验
- 500ms 超时 + 异步模式是 hook 场景的标准做法
- Detected 部分自动重写保证新鲜度，手动修改注定过时

## Risks

- 跨平台 which/where 命令差异需平台适配
- 第三方工具更新 versionRegex 可能失效需可配置
- env-spec.md 的 Detected 自动覆盖可能丢失手动补充 notes
