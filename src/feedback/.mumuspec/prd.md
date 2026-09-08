---
scope: src/feedback
layer: 2
last_updated: '2026-08-04'
---

# Product Requirements: feedback

## 模块职责 (What this module does)

用户反馈与 Session 摘要的收集、关联和查询模块。

- `submitFeedback()` — 用户提交反馈，格式化记录并自动关联 session
- `linkFeedbackToSession()` / `linkFeedbackToChange()` — 建立反馈与 session 摘要 / 变更的双向关联
- `listChangeFeedbacks()` / `listAllFeedbacks()` — 按变更 / 时间 / 类型查询反馈列表
- `getFeedbackContent()` / `getChangeFeedbackLog()` — 读取反馈正文与变更反馈日志
- `updateFeedbackStatus()` — 流转反馈处理状态
- 支持 5 种反馈类型：bug、feature-request、improvement、question、design-review
- 支持 5 种状态：open、acknowledged、in-progress、resolved、declined

## 存在理由 (Why it exists)

规范驱动开发需要收集用户对设计和实现质量的反馈。feedback 模块将反馈与变更生命周期
绑定，确保反馈不会丢失，并能在后续变更中追溯历史反馈。Session 摘要与反馈的双向链接
让 AI 编程助手能理解对话上下文与变更的关联。

## 用户场景 (User scenarios)

1. **提交 Bug**：用户在变更过程中发现缺陷，`mumuspec feedback submit` 记录反馈
2. **设计评审**：变更 design-review 阶段，收集对设计方案的评审意见
3. **反馈查询**：查看某变更关联的所有反馈，辅助决策
4. **Session 关联**：AI 助手将对话摘要自动关联到反馈

## 验收标准 (Acceptance criteria)

- 反馈 ID 遵循 `FB-YYYYMMDD-<8位hash>` 格式
- 反馈文件包含 type 和 severity 必需字段
- 反馈状态转换合法（open → acknowledged → in-progress → resolved/declined）
- Session 摘要与反馈支持双向链接
- 反馈不绕过变更关联直接归档
