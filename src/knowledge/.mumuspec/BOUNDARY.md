---
scope: src/knowledge
layer: 2
---

# Boundary Document: knowledge

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `getKnowledgeContext` | `(targetPath, root) => KnowledgeContext` | manager.ts | 获取知识上下文 |
| `searchKnowledge` | `(root, query) => KnowledgePage[]` | manager.ts | 搜索知识页 |
| `getKnowledgePage` | `(root, id) => KnowledgePage \| null` | manager.ts | 按 ID 获取知识页 |
| `createKnowledgePage` | `(root, page) => void` | manager.ts | 创建知识页 |
| `verifyKnowledge` | `(root) => VerificationResult` | manager.ts | 验证知识库 |
| `analyzeImpact` | `(root, scope) => ImpactAnalysis` | analysis.ts | 分析知识影响 |
| `generateOnboardingPath` | `(root, target) => LearningPath` | analysis.ts | 生成入门路径 |
| `analyzeCoverage` | `(root) => CoverageReport` | analysis.ts | 分析知识覆盖 |
| `answerQuery` | `(root, query) => ChatAnswer` | analysis.ts | 问答查询 |
| `getDashboardData` | `(root) => DashboardData` | analysis.ts | 获取仪表盘数据 |
| `runDiagnosis` | `(root, options?) => DiagnosisReport` | doctor.ts | 诊断知识库健康 |
| `runScan` | `(root, options?) => ScanResult` | scan.ts | 自主知识发现扫描 |
| `organizeKnowledge` | `(root) => KnowledgeOrganizeResult` | organize.ts | 整理知识库 |
| `buildMemoryIndex` | `(projectRoot, config) => MemoryIndex` | memory.ts | 构建 LLM-Wiki 记忆索引（L3 项目级 + L2 作用域级） |
| `rebuildMemoryIndex` | `(projectRoot, config) => MemoryIndex` | memory.ts | 重建并写入 `_memory.yaml` |
| `loadMemoryIndex` | `(projectRoot, config) => MemoryIndex` | memory.ts | 加载记忆索引（不存在则自动重建） |
| `getMemoryContext` | `(projectRoot, config, targetScope?) => {...}` | memory.ts | 获取作用域记忆上下文（设计时 AI 外部记忆） |

### 导出类型

| 类型 | 用途 |
|------|------|
| `KnowledgePage` | 知识页实体 |
| `PageIndex` | 页面索引 |
| `DiagnosisReport` | 诊断报告 |
| `ScanResult` | 扫描结果 |
| `ProposedKnowledgePage` | 提议知识页 |
| `MemoryIndex` | LLM-Wiki 记忆索引（L3 项目级 + L2 作用域级） |
| `MemoryEntry` | 记忆条目（紧凑摘要） |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统读写 |
| `node:path` | 路径处理 |
| `yaml` | YAML 解析 |
| `../core/utils.js` | 工具函数（readYaml, writeYaml） |
| `../core/types.js` | 核心类型（KnowledgePage 等） |
| `./pages.js` | 知识页 CRUD（listKnowledgePages, getKnowledgeDir） |

### 跨模块依赖

| 模块 | 方向 | 用途 |
|------|------|------|
| `src/spec/loader.ts` | knowledge → spec（被调用） | `loadKnowledgeMemoryForContext` 在 spec 加载时调用 `getMemoryContext` |

### 外部依赖

- `yaml`（npm 包）

## 数据契约

### 输入

- 项目根路径（projectRoot）
- 目标路径（targetPath）
- 扫描选项（ScanOptions）

### 输出

- 知识页文件：`.mumuspec/knowledge/{decisions,patterns,risks,rationales,lessons,imports}/*.md`
- 索引文件：`_index.yaml`, `_reverse-index.yaml`, `_memory.yaml`
- 记忆索引 `_memory.yaml`：L3 项目级摘要（goals, key_decisions, active_risks, recent_lessons）+ L2 作用域级分组（decisions, patterns, risks）
- 诊断报告（结构化对象）

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-22 | 新增 `memory.ts` — LLM-Wiki 记忆索引模块（4 个函数 + 2 个类型） | 设计时 AI 外部记忆：`_memory.yaml` 提供 L3/L2 级摘要 |
| 2026-08-04 | 初始创建边界文档 | 新目录边界定义 |
