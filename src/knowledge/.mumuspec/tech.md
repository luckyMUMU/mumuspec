---
scope: src/knowledge
layer: 2
last_updated: '2026-08-22'
---

# Technical Design: knowledge

## SHALL constraints (migrated from spec.md)

- 知识页必须支持 5 种类型：decision, pattern, risk, rationale, lesson
- PageIndex 必须在知识页创建/更新时自动重建
- 渐进式加载每层最多加载 max_pages_per_layer（默认 5）条
- 新鲜度校验必须检查 warn_after_days（90）和 error_after_days（180）
- 记忆索引 `_memory.yaml` 必须在缺失时自动重建
- `getMemoryContext` 必须返回作用域相关的决策、模式和风险摘要

## SHALL NOT constraints (migrated from spec.md)

- 禁止使用无 ID 的知识页（ID 格式：KP-NNNN-<slug>）
- 禁止知识页缺少 type 或 status 元数据字段
- 禁止 stale 知识页（超过 error_after_days）被加载到上下文
- 禁止 `_memory.yaml` 缺失时阻塞 spec 加载（best-effort 加载）

## Enforcement (migrated from spec.md)

- KNOW-1: 检查知识页 ID 格式正确
- KNOW-2: 检查 frontmatter 包含必需字段
- KNOW-3: 检查新鲜度不超阈值

## 架构决策 (Architecture decisions)

- **类型目录分区**：知识页按类型存储在 `decisions/`、`patterns/`、`risks/`、`rationale/`、`lessons/` 子目录
- **Frontmatter 元数据**：每页包含 id、type、status、scope、tags、created_at、updated_at
- **PageIndex 索引**：`_index.yaml` 维护所有知识页的摘要，支持快速检索
- **新鲜度阈值**：warn_after_days=90（WARN）、error_after_days=180（ERROR，阻止加载）
- **反向索引**：readReverseIndex 支持从文件路径查找关联知识页
- **影响分析图**：analyzeImpact 遍历文件依赖图，识别变更影响范围
- **LLM-Wiki 记忆索引**：`memory.ts` 实现 L3（项目级摘要）+ L2（作用域级分组）记忆索引，通过 `_memory.yaml` 提供 AI 外部记忆
- **语义金字塔**：L3 Summary → L2 Scenario → L1 Decision → L0 Evidence，`_memory.yaml` 提供 L3+L2 层摘要

## 接口契约 (Interface contracts)

```typescript
function createKnowledgePage(projectRoot: string, config: MumuSpecConfig, page: {...}): KnowledgePage;
function listKnowledgePages(projectRoot: string, config: MumuSpecConfig, options?: {...}): KnowledgePage[];
function searchKnowledge(projectRoot: string, config: MumuSpecConfig, query: string): KnowledgePage[];
function getKnowledgeContext(projectRoot: string, config: MumuSpecConfig, scope: string, maxPages?: number): KnowledgePage[];
function analyzeImpact(projectRoot: string, config: MumuSpecConfig, changedFiles: string[]): ImpactAnalysis;
function answerQuery(projectRoot: string, config: MumuSpecConfig, query: string): ChatAnswer;

// memory.ts — LLM-Wiki 记忆索引
function buildMemoryIndex(projectRoot: string, config: MumuSpecConfig): MemoryIndex;
function rebuildMemoryIndex(projectRoot: string, config: MumuSpecConfig): MemoryIndex;
function loadMemoryIndex(projectRoot: string, config: MumuSpecConfig): MemoryIndex;
function getMemoryContext(projectRoot: string, config: MumuSpecConfig, targetScope?: string): {
  project_summary: string;
  relevant_decisions: MemoryEntry[];
  relevant_patterns: MemoryEntry[];
  relevant_risks: MemoryEntry[];
  recent_lessons: MemoryEntry[];
};
```

## 依赖关系 (Dependencies)

- **上游**：`src/core/types.js`、`src/core/config.js`、`src/core/utils.js`
- **跨模块**：被 `src/change/manager.ts`（归档时知识提取）、`src/spec/loader.ts`（设计时记忆加载）调用
- **下游**：被 `src/cli/commands/knowledge.ts`、`src/mcp-server.ts`、`src/hooks/guard.ts` 调用
