---
scope: src/feedback
layer: 2
last_updated: '2026-08-04'
---

# Technical Design: feedback

## SHALL constraints (migrated from spec.md)

- 反馈 ID 必须遵循 FB-YYYYMMDD-<8位hash> 格式
- 反馈必须支持 5 种类型：bug, feature-request, improvement, question, design-review
- Session 摘要必须与反馈支持双向链接
- 反馈状态必须支持 5 种：open, acknowledged, in-progress, resolved, declined

## SHALL NOT constraints (migrated from spec.md)

- 禁止反馈文件缺少 type 或 severity 字段
- 禁止绕过变更关联直接归档反馈

## Enforcement (migrated from spec.md)

- FB-1: 检查反馈 ID 格式正确
- FB-2: 检查反馈文件包含必需字段
- FB-3: 检查状态转换合法

## 架构决策 (Architecture decisions)

- **目录结构**：`.mumuspec/feedback/user/` 存用户反馈，`.mumuspec/feedback/sessions/` 存 session 摘要
- **变更级反馈**：每个变更目录下有 `feedback/` 子目录，存放变更专属反馈
- **双向链接**：反馈 entry 中记录 session_id，session 摘要中也记录 feedback_id
- **索引文件**：`feedback/index.yaml` 和 `sessions/.index.yaml` 维护快速查找索引
- **审计日志**：反馈操作通过 appendAuditLog 记录到审计日志

## 接口契约 (Interface contracts)

```typescript
interface SubmitFeedbackOptions {
  type: 'bug' | 'feature-request' | 'improvement' | 'question' | 'design-review';
  severity?: 'critical' | 'major' | 'minor' | 'info';
  changeName?: string;
  sessionId?: string;
  title: string;
  expected?: string;
  actual?: string;
}

function submitFeedback(projectRoot: string, options: SubmitFeedbackOptions): { feedbackId: string; filePath: string };
function linkFeedbackToSession(projectRoot: string, sessionId: string, feedbackId: string, feedbackFile: string): void;
function linkFeedbackToChange(projectRoot: string, changeName: string, feedbackId: string, feedbackFile: string): void;
function createSessionSummary(projectRoot: string, options: CreateSessionSummaryOptions): { sessionId: string; filePath: string };
function listChangeFeedbacks(projectRoot: string, changeName: string): FeedbackEntry[];
function listAllFeedbacks(projectRoot: string, options?: {...}): UserFeedback[];
function getFeedbackContent(projectRoot: string, feedbackId: string): UserFeedback | undefined;
function getChangeFeedbackLog(projectRoot: string, changeName: string): FeedbackLog;
function updateFeedbackStatus(projectRoot: string, feedbackId: string, status: FeedbackStatus, reason?: string): void;
```

## 依赖关系 (Dependencies)

- **上游**：`src/core/types.js`、`src/core/config.js`、`src/core/utils.js`、`src/core/errors.js`
- **跨模块**：`src/change/manager.ts`（getChangeDir、getChangesDir 路径函数）
- **下游**：被 `src/cli/commands/feedback.ts` 和 `src/change/manager.ts`（ensureFeedbackStructure）调用
