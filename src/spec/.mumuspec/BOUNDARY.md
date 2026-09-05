---
scope: src/spec
layer: 2
---

# Boundary Document: spec

## 对外接口

### Parser（parser.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `parseSpecFile` | `(content: string, path: string) => SpecFile` | 解析 spec.md 文件 |
| `parsePrdFile` | `(content: string, path: string) => PrdFile` | 解析 prd.md 文件 |
| `parseTechFile` | `(content: string, path: string) => TechFile` | 解析 tech.md 文件 |
| `serializeSpecFile` | `(spec: SpecFile) => string` | 序列化 spec.md |
| `createDefaultSpecContent` | `(layer: number, scope: string) => string` | 创建默认 spec |
| `createDefaultPrdContent` | `(scope: string) => string` | 创建默认 prd |
| `createDefaultTechContent` | `(scope: string) => string` | 创建默认 tech |

### Loader（loader.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `loadSpecContext` | `(targetPath, projectRoot, config) => SpecContext` | 加载规范上下文 |
| `loadPrd` | `(targetPath, projectRoot) => PrdFile` | 加载单个 prd |
| `loadTech` | `(targetPath, projectRoot) => TechFile` | 加载单个 tech |
| `searchSpecs` | `(projectRoot, options) => SearchResult[]` | 搜索规范 |
| `getProhibitions` | `(projectRoot, targetPath) => Prohibition[]` | 获取禁止项 |
| `findAllDistributedSpecDirs` | `(root) => SpecDirEntry[]` | 查找所有分布式规范目录 |
| `mergeTechFiles` | `(parent, child) => TechFile` | 合并技术文件 |
| `mergePrdFiles` | `(parent, child) => PrdFile` | 合并产品文件 |

### Validator（validator.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `validateAllSpecs` | `(projectRoot) => ValidationResult` | 验证所有规范 |
| `validateSpecFile` | `(filePath: string) => GuardResult` | 验证单个规范文件 |

### Ponytail（ponytail.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `parsePonytailMarkers` | `(content, path) => PonytailMarker[]` | 解析 ponytail 标记 |
| `injectPonytail` | `(spec: SpecFile) => SpecFile` | 注入 ponytail 约束 |

### Verifier Classifier（verifier-classify.ts）

约束可验证性四分类纯函数（无 I/O）。设计参考：`review/proposal-verifier-semantics-2026-08-29.md` §3.1。

| 函数/类型 | 签名 | 用途 |
|------|------|------|
| `VerifiabilityClass` | `'enforced-strong' \| 'enforced-weak' \| 'manual' \| 'unverifiable'` | 可验证性类别 |
| `classifyConstraint` | `(c: VerifiableConstraint) => VerifiabilityClass` | 单条约束分类（R1→R4 固定顺序） |
| `classifyRequirements` | `(reqs: Requirement[], prohibitions, source) => ClassifiedItem[]` | 逐条分类 Requirement 块内所有 SHALL/SHALL NOT |
| `computeEnforcementCoverage` | `(items: ClassifiedItem[]) => EnforcementCoverage` | 五桶计数 + ratio |
| `isRegexCheckable` | `(text: string) => boolean` | 判断正则兜底通道是否可提取（引号词/eval/jsx） |
| `extractRegexPatterns` | `(text: string) => RegExp[]` | 构建正则兜底模式（checker 共享，避免双份正则漂移） |

### Structure Validator（structure-validator.ts）

| 函数 | 签名 | 用途 |
|------|------|------|
| `validateMumuSpecStructure` | `(projectRoot: string) => GuardResult` | 校验 `.mumuspec/` 目录结构白名单 |

**结构白名单定义**：
- **合法顶级目录**：`changes`, `knowledge`, `contracts`, `feedback`, `roadmap`, `adr`, `designs-archive`, `skills`, `templates`
- **合法顶级文件**：`config.yaml`, `spec.md`, `prd.md`, `tech.md`, `design.md`, `prohibitions.md`, `goal.md`, `env-spec.md`, `glossary.md`, `index.yaml`, `audit.log`, `agents-hash.json`, `constraints.yaml`, `cognitive-map.yaml`, `BOUNDARY.md`
- **合法 knowledge 子目录**：`decisions`, `patterns`, `risks`, `rationales`, `lessons`, `imports`
- **合法 knowledge 文件**：`_index.yaml`, `_reverse-index.yaml`, `_memory.yaml`
- **合法 changes 子目录**：`archive`, `discarded` + 活跃变更目录（须含 `.mumuspec.yaml`）

**错误码**：`E-SPEC-013`（未定义目录）、`E-SPEC-014`（未定义文件）

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统 |
| `node:path` | 路径处理 |
| `yaml` | YAML 解析 |
| `../core/types.js` | 核心类型定义 |
| `../core/utils.js` | 通用工具 |

### 外部依赖

- `yaml`（npm 包）

## 数据契约

### 输入

- 项目根路径
- 目标目录路径
- 配置文件

### 输出

- `SpecContext` — 包含 layers、prohibitions、index、inheritance_conflicts
- `PrdFile` — 产品需求文件
- `TechFile` — 技术设计文件

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-29 | 白名单补 `templates`（cognitive-map 查找路径）与 `discarded`（discard 终态目的地）；`serializeSpecFile` 保真修复（frontmatter 未知字段 round-trip 不再丢失） | 新初始化项目与 discard 流程不再误报 E-SPEC-013；annotate 等 round-trip 命令安全 |
| 2026-08-29 | **Verifier 语义收紧（P0）**：新增 `verifier-classify.ts`（四分类纯函数 + 共享正则提取）；`parser.ts` 解析 `manual(...)` 保留字（`EnforcementRule.kind`）；`validator.ts` 分类驱动发射 E-SPEC-015（SHALL NOT unverifiable，门控 `constraint_strength.enforcement_strict`，默认 false→warning）与 E-SPEC-004（SHALL unverifiable，恒可见）；`GuardResult` 新增 `coverage` 字段；`annotation.ts` 修复「样板/DRY→no-side-effect」错配 | 新对外函数 `classifyConstraint`/`classifyRequirements`/`computeEnforcementCoverage`/`isRegexCheckable`/`extractRegexPatterns`；`validateAllSpecs` 返回体新增 `coverage`；错误码面新增 E-SPEC-015（见 `src/core` 边界变更） |
| 2026-08-22 | 新增 `structure-validator.ts` — `.mumuspec/` 目录结构白名单校验 | 新增 `validateMumuSpecStructure` 导出函数，校验未定义目录/文件 |
| 2026-08-22 | `loader.ts` 新增 `loadKnowledgeMemoryForContext` — 设计时加载 LLM-Wiki 记忆 | `loadSpecContext` 返回新增 `knowledge_memory` 字段 |
| 2026-08-03 | 删除冗余 spec.md 和 design.md | 无功能影响（Loader 已支持新格式） |
