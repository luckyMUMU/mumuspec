---
scope: templates
layer: 1
---
# Technical Design: templates

## SHALL
- 模板文件使用 YAML 格式，包含 version 与 description 字段
- schema 的 sections 必须定义 name、patterns（正则数组）、required_for（workflow 类型数组）
- 正则模式必须同时支持中英文匹配（如 `^#{1,3}.*API.*` 与 `^#{1,3}.*接口.*`）
- consistency_checks 必须标注 severity（error/major/warning）

## SHALL NOT
- 禁止使用过于宽泛的正则模式（避免误匹配非目标 section）
- 禁止 schema 与 src/guard/phase-guard.ts 的检查逻辑产生矛盾
- 禁止在模板中硬编码具体项目路径

## 架构决策
- **YAML 格式**：模板使用 YAML 而非 JSON，支持注释与多行正则，便于维护
- **中英文双模式**：正则同时匹配中英文 section 标题，适配中英文混用场景
- **按 workflow 差异化**：不同 workflow 类型要求不同的必填 section，避免轻量路径过重

## 依赖关系
- design-schema.yaml 被 src/guard/phase-guard.ts 读取用于 design 完整性检查
- design-schema.yaml 的字段定义与 .mumuspec/spec.md 的 DS-001 delta spec 对应
- consistency_checks 引用 proposal.md 与 cognitive-map.yaml 的内容
- task_granularity 的 max_minutes 被 checkBuildToVerify guard 使用
