---
scope: feedback
layer: 1
---
# Technical Design: feedback

## SHALL
- 用户反馈文件使用 YYYY-MM-DD-<short-title>.md 命名格式
- 会话摘要文件使用 YYYY-MM-DD-<short-title>.md 命名格式
- 用户反馈 frontmatter 必须包含 feedback_id、date、type、severity、status、version
- 会话摘要 frontmatter 必须包含 date、session_id、agent、mumuspec_version、outcome
- 提交前必须删除密钥、内部 URL、客户数据等敏感信息
- 月度聚合报告同步更新到 docs/STATUS.md 的反馈汇总表

## SHALL NOT
- 禁止在反馈文件中包含密钥、密码、token 等敏感凭证
- 禁止在会话摘要中收集用户代码内容（只记录 Agent 行为模式）
- 禁止反馈文件脱离模板自定义 frontmatter 字段

## 架构决策
- **双类型反馈**：用户反馈（人提交）与 会话摘要（AI 自动生成），分别有独立模板
- **月度聚合闭环**：monthly/ 报告 → STATUS.md Top 改进项 → 下一轮 prerelease 修复
- **隐私优先**：默认公开但提交前必须脱敏，支持匿名提交
- **关联追踪**：反馈可通过 change_name、session_id、design_ref 字段关联到变更与设计文档

## 依赖关系
- _template/ 提供两种模板文件
- 月度聚合引用 docs/STATUS.md 的反馈汇总表
- 反馈流程详细说明引用 docs/reference/feedback-process.md
- 会话摘要可关联到 .mumuspec/changes/<name>/ 下的变更工件
