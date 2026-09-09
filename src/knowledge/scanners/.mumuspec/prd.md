---
scope: src/knowledge/scanners
layer: 3
---

# Product Requirements: knowledge/scanners

## 模块职责 (What this module does)

知识扫描器集合，从不同来源（代码、文档、Git 历史）提取可沉淀为知识页的结构化信息。

- 按来源拆分的扫描器实现（导出面见 BOUNDARY.md 函数表）
- 统一产出 ScanSource / ScanSourceResult 等结构化结果，供 knowledge 域消费

## 存在理由 (Why it exists)

知识提取的多源异构性（代码 AST、文档结构、Git 提交记录）如果散落在 knowledge 主域，
会导致主域膨胀且难以独立测试。扫描器独立成模块后，新增来源只扩展本模块，
knowledge 域仅依赖统一的扫描结果契约。

## 用户场景 (User scenarios)

1. **知识提取**：finalize-archive / knowledge extract 调用扫描器从变更产物提取 lesson/pattern
2. **新增扫描来源**：如新增 issue 追踪器扫描，只在本模块添加扫描器实现
3. **扫描结果测试**：以 ScanSourceResult 契约对每个扫描器独立单测

## 验收标准 (Acceptance criteria)

- 每个扫描器实现统一的结果契约（ScanSource / ScanSourceResult）
- 扫描器无跨模块副作用，可独立 mock 测试
- 导出面与 BOUNDARY.md 函数表一致
