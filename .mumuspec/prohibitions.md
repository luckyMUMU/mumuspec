# Global Prohibitions

> Last updated: 2026-08-04

## All Modules

### 运行时依赖

- 禁止在 install/、bundle/、i18n/、skill-authoring/ 模块中引入任何外部 npm 包（ponytail: 零运行时依赖偏好决策 D-004）
- 禁止使用 `require()`（仅允许 `import` ESM 语法）
- 禁止引入未被请求的第三方库替代 Node.js 内置功能（ponytail: YAGNI）

### 规范完整性

- 禁止 SHALL 约束缺少对应的 Enforcement 机制
- 禁止 design.md 为空模板（必须填写架构概览）
- 禁止 spec.md 包含无具体内容的占位符（如 "定义本层的正向要求"）

### 代码质量

- 禁止使用 `any` 类型绕过类型检查（必须显式声明或推断）
- 禁止在 error 消息中泄露敏感信息（密钥、token、文件路径）
- 禁止不安全的反序列化（yaml.load 必须指定 schema 或类型断言）

### 变更管理

- 禁止在 single_active_change 模式下同时存在多个活跃变更
- 禁止跳过设计阶段执行 full workflow 的 build（hotfix/tweak 除外）
- 禁止归档未通过 verify 的变更

### 安全

- 禁止直接使用用户输入拼接文件路径（必须通过 isPathSafe 检查）
- 禁止在 CI 环境中执行 force_skipped 的 SHALL NOT 检查
- 禁止跳过敏感信息扫描（sensitive_info_scan 为 always_enforce 异常）
