---
id: "UA-003"
title: "Git 提交增量知识更新"
scope: "src/hooks/guard.ts"
type: "shall"
layer: 0
---

## SHALL

post-commit hook 提交时自动执行知识增量更新。

### 流程

1. 获取 `HEAD~1..HEAD` 变更文件
2. 从 Reverse Index 查找受影响 Knowledge Page
3. 对每个页面执行增量验证：
   - 若变更在决策范围内：刷新 `verified_at`
   - 若变更偏离决策：标记 stale + 生成警告

### 提交消息格式

支持可选的 `Knowledge-Impact` 块：

```
feat(payment): add refund

Knowledge-Impact:
  IMPLEMENTS:
    - KP-0012
  AFFECTS:
    - KP-0020
```

## Reason

手动维护 Knowledge Page 新鲜度成本高，提交时增量更新可自动化知识维护。
