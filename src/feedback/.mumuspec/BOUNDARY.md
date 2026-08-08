---
scope: src/feedback
layer: 2
---

# Boundary Document: feedback

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `submitFeedback` | `(root, feedback, options?) => string` | manager.ts | 提交用户反馈 |
| `linkFeedbackToSession` | `(root, sessionId, feedbackId) => void` | manager.ts | 关联反馈到会话 |
| `linkFeedbackToChange` | `(root, changeName, feedbackId) => void` | manager.ts | 关联反馈到变更 |
| `createSessionSummary` | `(root, options) => string` | manager.ts | 创建会话摘要 |
| `listChangeFeedbacks` | `(root, changeName) => FeedbackEntry[]` | manager.ts | 列出变更反馈 |
| `listAllFeedbacks` | `(root, options?) => FeedbackEntry[]` | manager.ts | 列出所有反馈 |
| `getFeedbackContent` | `(root, feedbackId) => UserFeedback \| undefined` | manager.ts | 获取反馈内容 |
| `updateFeedbackStatus` | `(root, feedbackId, status) => void` | manager.ts | 更新反馈状态 |
| `getChangeFeedbackLog` | `(root, changeName) => FeedbackLog` | manager.ts | 获取变更反馈日志 |
| `ensureFeedbackStructure` | `(root) => void` | manager.ts | 确保反馈目录结构 |

### 导出类型

| 类型 | 用途 |
|------|------|
| `UserFeedback` | 用户反馈实体 |
| `FeedbackEntry` | 反馈索引条目 |
| `FeedbackLog` | 变更反馈日志 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统读写 |
| `node:path` | 路径处理 |
| `../core/utils.js` | 工具函数 |

### 外部依赖

无（仅 Node.js 标准库）

## 数据契约

### 输入

- 项目根路径
- 反馈内容（type, severity, title, description）
- 变更名称或会话 ID

### 输出

- 反馈文件树：`.mumuspec/feedback/user/`, `sessions/`, `change/{name}/`
- 索引文件：`index.yaml`

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-04 | 初始创建边界文档 | 新目录边界定义 |
