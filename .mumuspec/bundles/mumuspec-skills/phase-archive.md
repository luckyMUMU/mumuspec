---
name: phase-archive
description: "MumuSpec Phase 5: Archive。以 /phase-archive 启动。Git 合并 + 规范归档 + 知识提取 + 清理收尾。"
metadata:
  short-description: "Archive 阶段工作流"
  phase: archive
  workflow: full
---

# Phase: Archive — 归档（Git 合并 + 规范归档 + 知识提取）

## 快速决策（Decision Core）

**前置条件**：验证通过（Phase 4 完成），分支已处理

**阻塞点**：
- BP-17: 归档最终确认

**退出条件**：归档脚本执行成功，变更移动到 archive/，知识提取完成

---

## 前置条件

- 验证通过（`verify_result: pass`）
- 分支已处理（`branch_status: handled`）
- `verify.md` 存在且有报告

---

## 执行步骤

### Step 0: 输出语言约束

归档摘要和生命周期闭环说明必须使用触发本工作流的用户请求的语言。

**幂等性**：所有 archive 阶段操作可安全重执行。若 `archived: true` 且 archive 目录存在，归档已完成 — 不重复运行。

### Step 1: 入口状态验证

```bash
mumuspec state check <name> archive
```

### Step 2: 归档最终确认 — BLOCKING POINT (BP-17)

入口验证通过后，**必须使用平台用户输入/确认机制暂停等待用户确认是否立即归档**。

**展示摘要**：
- 变更名
- 验证报告路径和结果
- 分支处理状态
- 本次归档将执行的不可逆操作：
  - 合并主规范（delta-specs 语义合并到主 spec.md）
  - 更新 prohibitions.md 和 index.yaml
  - 更新代码图谱快照
  - 知识提取（cognitive-map → knowledge pages）
  - 标注 design.md 和 tasks.md 归档状态
  - 移动变更到 archive/ 目录

**选项**：
- "确认归档" — 立即运行归档脚本
- "需要调整或重新验证" — 运行 `mumuspec state transition <name> archive-reopen` 回到 `phase: verify`
- "暂不归档" — 保持当前 `phase: archive` 状态

**只有用户选择"确认归档"后才可继续 Step 3。**

### Step 3: 执行归档

运行归档脚本自动完成所有步骤：

```bash
mumuspec archive <change-name>
```

#### 子流程 A: Git 合并流程

1. 最终提交（worktree 中）
2. 推送到远程
3. 创建合并请求（MR/PR）
4. CI 检查（全量 SHALL/SHALL NOT + 漂移检测 + 图谱完整性）
   - CRITICAL 失败 → 回退到 Build（`archive_ci_fail_rollback`）
   - 非 CRITICAL → 用户决定 accept-deviations
5. 合并 MR（用户确认 — BP-17 已在 Step 2 完成）

#### 子流程 B: 规范归档（原子操作 B0-B5）

- B0: 备份受影响规范文件
- B1: delta-specs 合并到主 spec.md（ADDED/MODIFIED/REMOVED/RENAMED 语义）
- B2: 更新 prohibitions.md 汇总
- B3: 更新 index.yaml
- B4: 更新代码图谱快照
- B5: 提交规范变更到主分支（与 B4 同一 commit）

#### 子流程 C: 清理与收尾

- 移动变更到 `archive/` 目录
- 清理 worktree
- 释放活跃变更槽位
- 追加 decisions.md Archive 章节

#### 子流程 D: 知识提取 — MumuSpec 独有

变更归档时从变更工件中提取持久性设计知识到全局知识库（`.mumuspec/knowledge/`）：

| 步骤 | 提取来源 | 产出 |
|------|---------|------|
| D1 | cognitive-map.yaml Q1 持久性条目 | `type: rationale` 知识页面 |
| D2 | cognitive-map.yaml Q3 confirmed 推理 | `type: rationale` 知识页面 |
| D3 | cognitive-map.yaml Q4 残留风险 | `type: risk` 知识页面 |
| D4 | hyperplan_result 幸存洞察 | `type: decision` / `type: risk` 知识页面 |
| D5 | decisions.md 关键决策 | `type: decision` 知识页面 |
| D6 | 确认 graph_bindings（知识页面 ↔ 代码图谱节点关联） | 绑定关系 |
| D7 | 更新 PageIndex（_index.yaml + _reverse-index.yaml） | 索引更新 |
| D8 | 检查知识冲突（新知识是否 supersede 已有知识） | 冲突处理 |

**知识提取守卫**（`archive_complete`）：
- `knowledge_extraction_completed: true`
- `knowledge_pages_created_count > 0`
- `knowledge_graph_bindings_verified: true`
- `knowledge_conflicts_resolved: true`

### Step 4: 生命周期闭环

规范生命周期在此完成：

```
brainstorming → delta-spec → 认知框架 → 设计 → TDD 实现 → 验证 → 主规范合并 → 知识提取 → 归档
```

**知识回流**：归档提取的知识将在下一个变更的 Open 阶段被加载，形成闭环。

### Step 5: 归档目录瘦身 — 仅保留持久化 prd/tech

归档完成后，archive/ 目录中的变更文件夹应**最小化**，仅保留持久化的规范文件。其余所有中间产物均应删除（已在 Step 3 子流程 B/D 中合并或提取到主规范 / 知识库）。

#### 保留清单（KEEP）

每个归档变更目录仅保留：

| 文件 | 理由 |
|------|------|
| `.mumuspec.yaml` | 变更状态历史记录（需要时可审计） |
| `prd.md`（如存在） | 持久化产品规范（分布式架构下各 scope 的核心文件） |
| `tech.md`（如存在） | 持久化技术规范（分布式架构下各 scope 的核心文件） |

#### 删除清单（REMOVE）

归档产物已在归档流程中消费完毕，不再需要保留：

| 文件/目录 | 已消费于 |
|-----------|---------|
| `design.md` | delta-specs 合并到主 tech.md |
| `proposal.md` | 需求已在代码中实现 |
| `decisions.md` | 知识页已提取（D2） |
| `tasks.md` | 实现已完成，任务失去时效 |
| `verify.md` | 验证已通过，记录无复用价值 |
| `cognitive-map.yaml` | 知识页已提取（D1-D4） |
| `delta-specs/` | 已合并到主规范（B1） |
| `constraints/` | 已合并到主规范 |
| `code-graph/` | 图谱快照已更新（B4） |
| `snapshots/` | worktree 镜像已清理 |
| `test-cases/` | 测试已在主分支保留 |
| `feedback/` | 已在 Open/Archive 阶段消费 |

#### 执行命令

```bash
# 列出归档目录中应删除的文件（dry-run）
mumuspec archive-cleanup <change-name> --dry-run

# 执行清理
mumuspec archive-cleanup <change-name>
```

**后验证**：清理后归档目录仅含 `.mumuspec.yaml` + (如存在) `prd.md` / `tech.md`。

---

## 退出条件

- 归档脚本执行成功（exit code 0）
- archive 目录 `archive/<change-name>/` 存在
- 归档后 `.mumuspec.yaml` 包含 `archived: true`
- `git_merge.merged: true`
- delta-specs 合并到主 specs
- prohibitions.md 更新
- index.yaml 更新
- 代码图谱快照更新
- 规范变更提交到主分支
- 知识提取完成（D1-D8）
- 变更移动到 archive/
- worktree 清理
- 活跃变更槽位释放
- **归档目录瘦身完成（仅保留 .mumuspec.yaml + prd.md + tech.md）**

> **WARNING**：归档成功后，**不要**对旧的活跃变更名运行 `mumuspec guard <name> archive`；活跃目录已不存在。归档完整性由脚本 exit code 和归档目录状态判断。

---

## Phase Guard 调用

归档由 `mumuspec archive <change-name>` 脚本一次性完成所有步骤，包括 guard 检查。

`archive_complete` 守卫检查项：
- git_merge.merged: true
- git_merge.commit_sha recorded
- delta-specs merged to main specs
- prohibitions.md updated
- index.yaml updated
- code-graph snapshot updated
- spec changes committed to main branch
- knowledge_extraction_completed: true
- knowledge_pages_created_count > 0
- knowledge_graph_bindings_verified: true
- knowledge_conflicts_resolved: true
- change moved to archive/
- worktree cleaned up
- active_change_slot_released: true

---

## CI 失败回退

若 Archive 阶段 CI CRITICAL 失败：

```
Archive 阶段 CI CRITICAL 失败
├── 自动回退到 Build (archive_ci_fail_rollback)
│   ├── rollback_count + 1
│   └── 若 rollback_count 超限 → 进入回退次数超限决策树
└── 用户选择 Discard
    └── 走 discard_change
```

---

## 上下文压缩恢复

```bash
mumuspec state check <change-name> archive --recover
```

脚本输出结构化恢复上下文（归档状态、已完成步骤）。

若 `archived: true` 且 archive 目录存在，归档已完成 — 不重复运行归档操作。

---

## Red Flags 自检表

| Agent 想法 | 实际风险 |
|-----------|---------|
| "验证过了，直接归档" | 必须用户确认 — BP-17 不可跳过 |
| "知识提取可以跳过" | 知识提取是 archive_complete 守卫必检项 |
| "delta-specs 合并可以手动做" | 必须通过脚本自动完成 — 语义合并需保证一致性 |
| "CI 失败了继续归档" | CRITICAL 失败必须回退到 Build |
| "worktree 不用清理" | worktree 清理是守卫必检项 |
| "知识冲突不重要" | knowledge_conflicts_resolved 是守卫必检项 |
| "归档后还能改" | archive-completed 是终态 — 不可回退 |
| "graph_bindings 不用验证" | knowledge_graph_bindings_verified 是守卫必检项 |

---

## 领域 Skill 提示

| 场景 | 推荐 Skill | required |
|------|-----------|----------|
| 分支完成 | `finishing-a-development-branch` | true |
| CI/CD 集成 | `ci-cd-and-automation` | true |
| 文档归档 | `documentation-and-adrs` | true |
| 发布准备 | `shipping-and-launch` | false |
