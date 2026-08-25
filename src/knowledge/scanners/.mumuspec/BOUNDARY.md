---
scope: src/knowledge/scanners
layer: 3
---

# Boundary Document: knowledge/scanners

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `scanCodeStructure` | `(root: string) => ProposedKnowledgePage[]` | code-scanner.ts | 从目录结构和代码组织推断架构模式知识 |
| `scanDeps` | `(root: string) => ProposedKnowledgePage[]` | dep-scanner.ts | 从 package.json 等依赖清单推断框架选型与工具链知识 |
| `scanGitHistory` | `(root: string) => ProposedKnowledgePage[]` | git-scanner.ts | 从 git 提交历史挖掘教训、风险与决策知识 |
| `scanDocs` | `(root: string) => ProposedKnowledgePage[]` | docs-scanner.ts | 盘点项目文档状态（缺失、过时、结构缺口） |

### 导出类型

| 类型 | 用途 |
|------|------|
| `ProposedKnowledgePage` | 提议的知识页（scanner 产出） |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统读取 |
| `node:path` | 路径处理 |
| `node:child_process` | git 命令执行（git-scanner） |
| `../scan-types.js` | 扫描类型定义（ProposedKnowledgePage、DepKnowledgeRule 等） |

### 外部依赖

无（仅 Node.js 标准库）

## 数据契约

### 输入

- 项目根路径（root: string）

### 输出

- `ProposedKnowledgePage[]` — 提议的知识页数组，由 `runScan` 调用后经用户确认写入 knowledge/

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-08 | 初始创建边界文档 | 新目录边界定义 |
