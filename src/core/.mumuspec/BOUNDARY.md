---
scope: src/core
layer: 2
---

# Boundary Document: core

## 对外接口

### 类型定义（types 系列）

| 文件 | 主要类型 | 用途 |
|------|----------|------|
| `types.ts` | `ChangeInfo`, `ChangeStatus`, `Phase` | 变更相关核心类型 |
| `types-spec.ts` | `SpecFile`, `Requirement`, `Enforcement` | 规范文件类型 |
| `types-constraint.ts` | `ConstraintStrengthField` | 约束强度类型 |
| `types-workflow.ts` | `WorkflowRules` | 工作流规则类型 |
| `types-env.ts` | `DetectedTool`, `DetectionResult` | 环境检测类型 |
| `types-contract.ts` | `Contract`, `ContractRegistry`, `ContractDrift`, `DriftReport`, `BoundaryDocument`, `BoundaryExport`, `ContractImpactAnalysis`, `ImpactEntry` | 契约层核心类型 |
| `types-knowledge.ts` | `KnowledgePage`, `PageIndex` | 知识库类型 |

### 日志系统

| 文件 | 导出 | 用途 |
|------|------|------|
| `logger.ts` | `Logger` 类 | 4 级结构化日志（trace/debug/info/warn/error） |

`Logger` 接口：
- `Logger.trace(module, message, context?)` — 最详细诊断
- `Logger.debug(module, message, context?)` — 开发调试
- `Logger.info(module, message, context?)` — 常规信息
- `Logger.warn(module, message, context?)` — 非致命异常
- `Logger.error(module, message, context?)` — 错误

环境变量：
- `MUMUSPEC_LOG_LEVEL` — 控制输出级别（默认 `info`）
- `MUMUSPEC_LOG_JSON` — `true` 时输出 JSON 到 stderr

注意：面向用户的最终输出保留 `console.log/error`，Logger 仅用于内部诊断。

### 配置管理（config 系列）

| 函数 | 签名 | 用途 |
|------|------|------|
| `loadConfig` | `(root: string) => MumuSpecConfig` | 加载项目配置 |
| `saveConfig` | `(root: string, config: MumuSpecConfig) => void` | 保存项目配置 |
| `getDefaultConfig` | `(name: string) => MumuSpecConfig` | 获取默认配置 |

### Git 操作封装（git.ts，2026-08-08 新增）

统一 git 命令执行封装，供 change 分支生命周期 / merge 命令调用。所有调用走 `spawnSync`（args 数组，**无 shell:true**），返回 `{ status, stdout, stderr }`。

| 函数 | 签名 | 用途 |
|------|------|------|
| `git` | `(cwd, args, opts?) => GitResult` | 底层执行（timeout 默认 10s，可 allowFail） |
| `getCurrentBranch` | `(cwd) => string \| undefined` | `git branch --show-current` |
| `createBranch` | `(cwd, name) => GitResult` | `git checkout -b <name>` |
| `switchBranch` | `(cwd, name) => GitResult` | `git checkout <name>` |
| `isWorkingTreeClean` | `(cwd) => boolean` | `git status --porcelain` 为空 |
| `getMainBranch` | `(cwd) => string` | main 优先，fallback master |
| `mergeNoFF` | `(cwd, branch, msg) => GitResult` | `git merge --no-ff <branch> -m <msg>` |
| `getMergeConflicts` | `(cwd) => string[]` | `git diff --name-only --diff-filter=U` |
| `commitAll` | `(cwd, msg) => GitResult` | `git add -A && git commit -m <msg>` |
| `branchExists` | `(cwd, name) => boolean` | `git rev-parse --verify --quiet` |
| `deleteBranch` | `(cwd, name) => GitResult` | `git branch -d <name>`（仅已合并） |
| `getHeadSha` | `(cwd) => string` | `git rev-parse HEAD` |

### 项目分析

| 函数 | 签名 | 用途 |
|------|------|------|
| `analyzeProject` | `(root: string) => ProjectAnalysis` | 分析项目类型和框架 |

### 初始化生成

| 函数 | 签名 | 用途 |
|------|------|------|
| `generateInitialSpec` | `(analysis: ProjectAnalysis) => string` | 生成初始 spec.md |
| `generateInitialDesign` | `(analysis: ProjectAnalysis) => string` | 生成初始 design.md |
| `scaffoldKnowledgeBase` | `(root, config, analysis) => { created: string[] }` | 搭建知识库 |
| `generateFrontendDesignMd` | `(analysis: ProjectAnalysis) => string` | 生成前端设计指导 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统 |
| `node:path` | 路径处理 |
| `node:child_process` | git 命令执行（git.ts，spawnSync 无 shell） |
| `yaml` | YAML 解析/序列化 |

### 外部依赖

- `yaml`（npm 包）

## 数据契约

### 输入

- 项目根路径
- 项目分析结果

### 输出

- 配置文件（`.mumuspec/config.yaml`）
- 知识库目录结构
- 初始化规范文件

## 变更日志

| 日期 | 变更 | 影响 |
|------|------|------|
| 2026-08-08 | 新增 `git.ts` 统一 git 封装（12 个函数，spawnSync 安全调用） | 新外部接口：git 分支/合并操作；新依赖 node:child_process |
| 2026-08-08 | 新增 `logger.ts`（4 级结构化日志）、`validateChangeName` 函数 | 奠定空捕获替换 + 路径穿越防护基础 |
| 2026-08-04 | Contract Layer 实现（loader/validator/impact-analyzer/manager） | 新增类型、目录边界、漂移检测、影响分析 |
| 2026-08-03 | 删除冗余 spec.md 和 design.md | 无功能影响 |
