---
scope: templates
layer: 1
---
# Product Requirements: templates

## 模块职责
templates 目录是 MumuSpec 的模板文件集合，为 Guard Layer 提供结构化校验规则定义。
当前包含 design-schema.yaml，定义 design.md 文档的必填 section 及其验证规则，
支持按 workflow 类型（full/hotfix/tweak）差异化要求必填章节。

## 存在理由
design.md 的自由格式导致 Phase Guard 仅能检查文件存在性，无法校验内容完整性。
模板系统通过 schema 定义必填 section 的正则匹配模式，让 guard 在 Design→Build
阶段转换时自动检测缺失字段并返回 W-DESIGN-009 错误，保证设计文档质量。

## 用户场景
1. **Guard 校验设计文档**：phase-guard.ts 读取 design-schema.yaml，按 workflow 类型
   匹配 design.md 的 section，缺失必填字段时返回 W-DESIGN-009
2. **开发者编写设计文档**：参照 schema 的 required_for 列表，确保 full workflow
   包含 API Contracts、Data Flow、Error Specification 等必填章节
3. **配置任务粒度**：schema 定义 max_minutes（15 分钟），超过时返回 W-DESIGN-001 警告
4. **跨工件一致性检查**：schema 定义 plan_coverage、fr_satisfaction、risk_coverage 检查规则

## 验收标准
- design-schema.yaml 定义 8 个 section 及其正则匹配模式
- 每个 section 标注 required_for（full/hotfix/tweak）适用的 workflow 类型
- consistency_checks 定义跨工件一致性检查规则（severity: error/major）
- task_granularity 定义最大任务时间（max_minutes: 15）与警告码（W-DESIGN-001）
- schema 版本号（version: "1.0"）与项目版本管理对齐
