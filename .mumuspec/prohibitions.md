# Global Prohibitions

> Last updated: 2026-08-29
> CHG-5 (0.20): 过程约束降为 advisory，仅保留结果约束为 block

## All Modules

### 流程执行载体（0.20 CLI-first）

- 禁止手工编辑 decisions.md 追加决策（必须 `mumuspec decisions append --text`，手工编辑破坏 content_hash 审计链）
- 禁止手工编辑 `.mumuspec.yaml` 的状态字段（必须 `state set` / `state layer`；受保护字段绕过须审计）
- 禁止 LLM 自行计算或手写 hash 类字段（design_content_hash / suites_hash 须 CLI 命令写入）
- 禁止 skill 指示使用状态机不存在的目标阶段（历史误写：verify-fail、archive-reopen）

### 运行时依赖

- 禁止在 install/、bundle/、i18n/、skill-authoring/ 模块中引入任何外部 npm 包（ponytail: 零运行时依赖偏好决策 D-004）
- 禁止使用 `require()`（仅允许 `import` ESM 语法）
- 禁止引入未被请求的第三方库替代 Node.js 内置功能（ponytail: YAGNI）

### 规范完整性（结果约束 — 恒 block）

- 禁止 SHALL 约束缺少对应的 Enforcement 机制
- 禁止 SHALL NOT 红线无可验证通道（E-SPEC-015 恒 block）
- 禁止 spec.md 包含无具体内容的占位符（如 "定义本层的正向要求"）

### 代码质量

- 禁止使用 `any` 类型绕过类型检查（必须显式声明或推断）
- 禁止在 error 消息中泄露敏感信息（密钥、token、文件路径）
- 禁止不安全的反序列化（yaml.load 必须指定 schema 或类型断言）

### 变更管理（结果约束 — block；过程约束已降级 advisory）

- 禁止归档未通过 verify 的变更（结果约束：verify_result 必须 pass）
- 禁止在 CI 环境中执行 force_skipped 的 SHALL NOT 检查
- 禁止跳过敏感信息扫描（sensitive_info_scan 为 always_enforce 异常）

### 安全

- 禁止直接使用用户输入拼接文件路径（必须通过 isPathSafe 检查）
- 禁止跳过敏感信息扫描（sensitive_info_scan 为 always_enforce 异常）

### 已降级为 advisory 的约束（0.20 CHG-5）

> 以下约束从 SHALL NOT 降级为 SHOULD NOT，不再 block，仅产生 warning。
> LLM 在这些方面拥有自主决策权，结果约束（verify pass）兜底。

- ~~禁止在 single_active_change 模式下同时存在多个活跃变更~~ → advisory（medium 强度自动关闭）
- ~~禁止跳过设计阶段执行 full workflow 的 build~~ → advisory（LLM 可自主选择设计深度）
- ~~禁止 design.md 为空模板~~ → advisory（结果约束为 verify 通过）
