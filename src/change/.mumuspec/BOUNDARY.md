---
scope: src/change
layer: 2
---

# Boundary Document: change

## 对外接口

### 导出函数

| 函数 | 签名 | 来源文件 | 用途 |
|------|------|----------|------|
| `createChange` | `(root, name, options?) => Promise<void>` | lifecycle.ts | 创建新变更 |
| `discardChange` | `(root, name) => Promise<void>` | lifecycle.ts | 丢弃变更 |
| `archiveChange` | `(root, name) => Promise<void>` | archive.ts | 归档变更 |
| `listActiveChanges` | `(root) => ChangeInfo[]` | listing.ts | 列出活跃变更 |
| `listArchivedChanges` | `(root) => ChangeInfo[]` | listing.ts | 列出已归档变更 |
| `getActiveChange` | `(root, name?) => ChangeInfo \| null` | listing.ts | 获取当前活跃变更 |
| `getChangeStatusSummary` | `(root, name) => ChangeStatusSummary` | decisions.ts | 获取变更状态摘要 |
| `loadChangeState` | `(root, name) => ChangeState` | state.ts | 加载变更状态 |
| `saveChangeState` | `(root, name, state) => void` | state.ts | 保存变更状态 |
| `getPhaseGraph` | `() => PhaseGraph` | phase-graph.ts / state-machine.ts | 获取阶段图 |
| `canTransition` | `(from, to) => boolean` | state-machine.ts | 检查是否可转换 |
| `executeTransition` | `(root, name, target) => Promise<void>` | state-machine.ts | 执行状态转换 |
| `getValidTransitions` | `(from) => ChangePhase[]` | state-machine.ts | 获取有效转换列表 |
| `validateScope` | `(root, scope) => void` | lifecycle.ts | 校验变更作用域 |
| `escalateChange` | `(root, targetScope) => void` | lifecycle.ts | 向上升级变更 |
| `appendDecision` | `(root, change, decision) => void` | decisions.ts | 追加决策记录 |
| `mergeDeltaSpecsToMain` | `(root, name, archivedDir, state) => void` | archive.ts | 合并增量规范到主规范（幂等，Marker 注释防重复） |
| `mergeChangeArtifacts` | `(root, name, changeDir, state) => void` | archive.ts | 归档时归并约束和变更级 spec 到目标作用域（幂等） |
| `extractKnowledgeToGlobal` | `(root, name, archivedDir, state) => void` | archive.ts | 提取知识到全局库 |
| `getChangeDir` | `(root, changeName, scope?) => string` | paths.ts | 获取变更目录（含 validateChangeName 校验） |
| `getDiscardedDir` | `(root, changeName, scope?) => string` | paths.ts | 获取已丢弃目录（含 validateChangeName 校验） |

### 分支生命周期（branch.ts，2026-08-08 新增）

| 函数 | 签名 | 用途 |
|------|------|------|
| `getChangeBranchName` | `(root, changeName, config) => string` | 计算变更分支名（`<prefix>/<name>`，默认 `mumuspec/<name>`） |
| `ensureChangeBranch` | `(root, changeName) => GitResult` | 切换到变更分支（不存在则 checkout -b 创建） |
| `rollbackChangeCreation` | `(root, changeName) => void` | 建分支失败时清理已建 change 目录 |
| `getActiveChangeOnBranch` | `(root, branchName) => string \| undefined` | 查询指定分支上的活跃变更（per-branch single active） |
| `commitChangeBranch` | `(root, changeName, state) => void` | 提交变更分支代码并写入 branch_status='handled' |
| `checkMergeGate` | `(root, changeName) => GuardResult` | merge 前置门禁（10 项校验） |
| `mergeArchivedChange` | `(root, changeName) => void` | 执行 merge --no-ff + 冲突暂停 + 删除分支 + 写 git_merge |

### 导出类型

| 类型 | 用途 |
|------|------|
| `ChangeInfo` | 变更元数据 |
| `ChangeStatus` | 变更状态 |
| `Phase` | 阶段枚举 |
| `PhaseNode` | 阶段图节点 |

## 依赖声明

### 内部依赖

| 模块 | 用途 |
|------|------|
| `node:fs` | 文件系统操作 |
| `node:path` | 路径处理 |
| `../core/config.js` | 配置管理 |
| `../core/types.js` | 类型定义 |
| `../core/spec-scaffolder.js` | 变更时分布式规范生成 |
| `../spec/loader.js` | 规范上下文加载 |
| `../feedback/manager.js` | 反馈目录初始化与变更关联（见 ADR-0001） |
| `../knowledge/manager.js` | 知识页创建与全局索引（见 ADR-0001） |
| `../core/git.js` | 统一 git 操作封装（分支/合并/状态校验） |

### 外部依赖

无（仅限 Node.js 标准库）

## 数据契约

### 输入

- 项目根路径（project root）
- 变更名称（name）
- 变更选项（scope、force 等）

### 输出

- `.mumuspec/changes/<name>/` 目录结构
- 变更文件：`design.md`, `prd.md`, `proposal.md`, `decisions.md`, `tasks.md`, `verify.md`
- 约束文件：`constraints/new-shall.md`, `constraints/new-shall-not.md`
- 归档归并：`mergeChangeArtifacts` 将 `constraints/` 和 `.mumuspec/` 下的 spec 文件幂等归并到目标作用域的 `tech.md`/`prd.md`/`spec.md`
- ChangeState 扩展字段：`branch?: string`（变更分支名）、`git_merge?: { merged, commit_sha?, strategy? }`（合并记录）、`branch_status?: 'pending'\|'handled'`（分支代码提交状态）

## 变更日志

| 日期 | 变更 | 原因/影响 |
|------|------|-----------|
| 2026-08-22 | 新增 `mergeChangeArtifacts` 归档归并函数 — 将 constraints/ 和变更级 .mumuspec/ spec 幂等归并到目标作用域 | 归档时自动归并约束和 spec，通过 Marker 注释确保幂等性 |
| 2026-08-08 | 新增 `branch.ts` 分支生命周期模块（7 个函数）；ChangeState 扩展 branch/git_merge/branch_status 语义 | 分支驱动多人协作：new 自动建分支、归档后合并门禁 |
| 2026-08-08 | `getChangeDir`/`getDiscardedDir` 增加 validateChangeName 校验，拒绝路径穿越 | 安全加固 |
| 2026-08-04 | 依赖项添加 ADR-0001 引用 | 明确 change → feedback/knowledge 单向依赖的决策依据 |
| 2026-08-04 | 新增 barrel index.ts（统一 re-export） | 符合 spec.md 结构规范 |
| 2026-08-04 | 修正接口名：listChanges→listActiveChanges/listArchivedChanges, getChangeStatus→getChangeStatusSummary, transitionState→executeTransition | BOUNDARY.md 与代码对齐 |
| 2026-08-03 | 删除冗余 spec.md 和 design.md | 无功能影响 |
