# Branch-Driven Workflow Contract Change Record

**日期**: 2026-08-08
**变更名称**: branch-driven-workflow
**版本**: 0.18.0 → 0.19.0（建议）

---

## 变更摘要

分支驱动的多人协作模型：创建变更自动建 git 分支、单分支仅单一激活变更、归档后才能合并分支，以设计指导代码完成多分支合并。同步内化 SQLite Code-graph 后端。

---

## 对外契约变更清单

| 变更 | 类型 | 说明 | 影响 |
|------|------|------|------|
| `mumuspec new` 自动建分支 | CLI 行为 | 创建变更时自动 `git checkout -b mumuspec/<name>` | 新增行为，不破坏现有命令 |
| `mumuspec merge <name>` | 新命令 | 归档后合并变更分支回主分支（--no-ff + 冲突暂停） | 新增命令，向后兼容 |
| `ChangeState.branch` | 数据字段 | 新增字段记录变更分支名 | 旧变更无此字段，回退全库唯一 active 检查 |
| `ChangeState.git_merge` | 数据字段 | 已存在（types-workflow.ts L104），语义落地为 merge 命令写入 | 兼容 |
| `ChangeState.branch_status` | 数据字段 | 已存在（L130），写入点补齐（guard --apply 路径） | 兼容，修复 E-VERIFY-002 恒定失败 |
| `changes.default_isolation` | 配置 | 默认值 `worktree` → `branch` | 行为变更，需用户知晓 |
| `changes.branch_prefix` | 配置 | 新增，默认 `mumuspec` | 新增配置，deepMerge 兼容旧配置 |
| `package.json engines` | 环境 | `>=20.0.0` → `>=22.13.0`（node:sqlite 需求） | breaking：Node 20 用户需升级 |
| `knowledge.code_graph` | 配置 | 复用现有 `storage: sqlite` / `db_path` | 纯实现，无契约变更 |
| `mumuspec graph` 子命令 | CLI 行为 | 新增 rebuild/query/search/bindings | 新增行为，向后兼容 |

---

## 上游/下游依赖方

| 依赖方 | 方向 | 兼容性 |
|--------|------|--------|
| src/change/lifecycle.ts | 修改 | createChange 增加分支校验，签名不变 |
| src/guard/phase-guard.ts | 修改 | E-VERIFY-002 语义保持（branch_status==='handled'），补写入点 |
| src/cli/index.ts | 修改 | 注册 merge 命令（静态 import 模式） |
| src/cli/commands/graph.ts | 修改 | 增加子命令，组结构不变 |
| src/knowledge/ | 新增 graph/ 子模块 | 新边界，不影响现有知识层接口 |
| docs/reference/cli-commands.md | 文档 | worktree 假命令声明删除，补 merge/graph |

---

## 风险与缓解

- **per-branch 校验对存量数据**：旧变更无 branch 字段 → `getActiveChangeOnBranch` 回退全库唯一 active
- **E-VERIFY-002 门禁回归**：写入点放 guard --apply 路径（先 commit → 写 handled → 再检查 → 再 transition），手动 `state set branch_status handled` 兜底
- **Node 版本升级**：healthCheck 明确报错信息，文档注明最低版本
- **node:sqlite 实验性**：try/catch import + FTS5 探测降级 LIKE

---

## 用户征询记录

- 2026-08-08 用户拍板：纯 git branch 模型（非 worktree）；node:sqlite 内置引擎；merge 命令本地闭环；Code-graph 全量（结构图+FTS5+知识关联）；engines >=22.13.0；存量 active change 全部收尾清空。
