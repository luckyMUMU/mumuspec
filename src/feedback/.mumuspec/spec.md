---
layer: 1
scope: "src/feedback"
last_updated: "2026-07-30"
---

## Requirement: 用户反馈管理

### SHALL
- 反馈 ID 必须遵循 FB-YYYYMMDD-<8位hash> 格式
- 反馈必须支持 5 种类型：bug, feature-request, improvement, question, design-review
- Session 摘要必须与反馈支持双向链接
- 反馈状态必须支持 5 种：open, acknowledged, in-progress, resolved, declined

### SHALL NOT
- 禁止反馈文件缺少 type 或 severity 字段
- 禁止绕过变更关联直接归档反馈

### Enforcement
- FB-1: 检查反馈 ID 格式正确
- FB-2: 检查反馈文件包含必需字段
- FB-3: 检查状态转换合法
