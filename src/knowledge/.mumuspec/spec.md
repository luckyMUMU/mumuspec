---
layer: 1
scope: "src/knowledge"
last_updated: "2026-07-30"
---

## Requirement: 知识库管理

### SHALL
- 知识页必须支持 5 种类型：decision, pattern, risk, rationale, lesson
- PageIndex 必须在知识页创建/更新时自动重建
- 渐进式加载每层最多加载 max_pages_per_layer（默认 5）条
- 新鲜度校验必须检查 warn_after_days（90）和 error_after_days（180）

### SHALL NOT
- 禁止使用无 ID 的知识页（ID 格式：KP-NNNN-<slug>）
- 禁止知识页缺少 type 或 status 元数据字段
- 禁止 stale 知识页（超过 error_after_days）被加载到上下文

### Enforcement
- KNOW-1: 检查知识页 ID 格式正确
- KNOW-2: 检查 frontmatter 包含必需字段
- KNOW-3: 检查新鲜度不超阈值
