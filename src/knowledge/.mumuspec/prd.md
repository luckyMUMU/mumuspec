---
scope: src/knowledge
layer: 2
last_updated: '2026-08-04'
---

# Product Requirements: knowledge

## 模块职责 (What this module does)

知识库管理模块，提供知识页的 CRUD、索引、检索和渐进式加载。

- `createKnowledgePage()` — 创建知识页（支持 frontmatter 元数据）
- `listKnowledgePages()` / `getKnowledgePage()` — 列表和获取知识页
- `searchKnowledge()` / `getKnowledgeContext()` — 搜索和渐进式上下文加载
- `rebuildPageIndex()` — 重建 PageIndex
- `analyzeImpact()` — 变更影响分析
- `answerQuery()` — 基于知识库的问答
- `generateOnboardingPath()` — 生成学习路径
- `analyzeCoverage()` — 知识覆盖度分析
- 支持 5 种知识类型：decision、pattern、risk、rationale、lesson

## 存在理由 (Why it exists)

项目的决策、模式、风险和教训需要持久化记录，避免知识流失。
knowledge 模块将知识以结构化页面形式存储，通过 PageIndex 提供渐进式加载，
让 AI 助手按需获取最相关的知识，而非一次性加载全部内容。

## 用户场景 (User scenarios)

1. **知识检索**：AI 助手根据当前任务上下文，渐进式加载相关知识页
2. **影响分析**：变更前分析影响范围，识别受影响的知识页
3. **覆盖度检查**：识别知识库中的覆盖缺口
4. **自动提取**：变更归档时自动从 cognitive-map/decisions 提取知识页
5. **问答**：基于知识库回答关于项目的问题

## 验收标准 (Acceptance criteria)

- 知识页支持 5 种类型：decision、pattern、risk、rationale、lesson
- PageIndex 在知识页创建/更新时自动重建
- 渐进式加载每层最多加载 max_pages_per_layer（默认 5）条
- 新鲜度校验检查 warn_after_days（90）和 error_after_days（180）
- 知识页 ID 格式：KP-NNNN-<slug>
- stale 知识页（超过 error_after_days）不被加载到上下文
