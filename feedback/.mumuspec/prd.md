---
scope: feedback
layer: 1
---
# Product Requirements: feedback

## 模块职责
feedback 目录是 MumuSpec 的用户反馈与 AI Agent session 摘要收集系统。
它通过结构化的模板收集用户反馈（bug/feature-request/improvement）与
AI Agent 会话摘要（流程走完/阻断/回退），驱动 MumuSpec 的迭代改进闭环。

## 存在理由
规范驱动的开发系统需要真实使用反馈来验证设计假设、发现盲区、指导迭代优先级。
散落在 Issue/聊天记录中的反馈难以系统化分析。feedback 目录通过统一模板、
月度聚合与 STATUS.md 联动，形成"反馈 → 聚合 → 迭代 → 状态同步"的闭环。

## 用户场景
1. **用户提交反馈**：复制 user-feedback-template.md，填写期望/实际行为、复现步骤、影响范围
2. **AI Agent 生成会话摘要**：完成变更流程或遇到阻断后，使用 session-summary-template.md
   记录走完的流程阶段、触发的约束、阻断点与回退、走捷径点、沉淀模式、设计盲区
3. **维护者月度聚合**：每月 1 号扫描 feedback/ 目录，提取共性模式到 monthly/YYYY-MM.md，
   并同步到 docs/STATUS.md 的反馈汇总表
4. **隐私保护**：提交前删除密钥、内部 URL、客户数据；用户反馈可匿名

## 验收标准
- _template/ 包含 user-feedback-template.md 与 session-summary-template.md
- user/ 目录存放用户提交的反馈文件（YYYY-MM-DD-short-title.md 格式）
- sessions/ 目录存放 AI Agent 会话摘要（YYYY-MM-DD-short-title.md 格式）
- monthly/ 目录存放月度聚合报告（YYYY-MM.md 格式）
- 反馈文件 frontmatter 包含 feedback_id、date、type、severity、status 字段
- 会话摘要 frontmatter 包含 date、session_id、agent、outcome、change_name 字段
