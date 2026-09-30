---
scope: .mumuspec/roadmap
layer: 1
version: "v2"
---

# BOUNDARY: .mumuspec/roadmap/

> 本目录的边界声明 — 记录对外接口、依赖、数据契约、变更日志。
> 当前版本：v2（基于 v1 归档 R-0001~R-0005 后重编）

---

## 对外接口

| 接口 | 类型 | 说明 |
|------|------|------|
| `spec.md` | 规范文档 | Roadmap 规则定义（当前 v2） |
| `template/item.md` | 模板文件 | Roadmap Item 的标准模板 |
| `items/*.md` | 目标条目 | 当前活跃目标条目集合（R-0001~R-0007 沿革 + R-0008~R-0013 CLI-first/DSL 批次 + R-0014~R-0022 核心收敛批次） |
| `archive/*/` | 归档 | 已完成的旧版本 Item（按批次分组） |

## 对外符号 / 类型

| 符号 | 说明 |
|------|------|
| Roadmap Item ID (`R-NNNN`) | 全局唯一标识符 |
| Roadmap Item Status | `planning` / `planned` / `active` / `blocked` / `completed` / `deprecated` |
| Roadmap Item Priority | `P0` / `P1` / `P2` |
| Roadmap Capacity Cost | 正整数，表示占用的容量预算单位 |
| Model Tier | `S` / `A` / `B` / `C` — 模型能力层级 |

## 导出列表

| 导出 | 路径 | 说明 |
|------|------|------|
| 主规范 | `./spec.md` | Roadmap 规范定义（v2） |
| 模板 | `./template/item.md` | Item 模板 |
| 目标条目 | `./items/R-0001.md` .. `R-0022.md` | 当前活跃 Items |
| v1 归档 | `./archive/2026-Q3/R-0001.md` .. `R-0005.md` | 2026-Q3 完成的 Items |

---

## 依赖声明

| 依赖类型 | 依赖对象 | 说明 |
|---------|---------|------|
| 规范层依赖 | `.mumuspec/spec.md` | 复用全局约束与 Enforcement 机制 |
| 外部系统 | 无 | 本目录不依赖外部服务 |

---

## 数据契约

### Roadmap Item Frontmatter Schema

必填字段定义在 `spec.md`—Requirement: 目标条目定义 中详述。

### 跨版本追溯

- `supersedes` 字段链接新版 Item 与被替代的旧版 Item
- 归档目录中的旧版 Items 不应被直接依赖引用（已 out of scope）

### 跨模块引用格式

- `depends_on` / `mutex_with` 引用的 ID 必须是 `R-NNNN` 格式（当前活跃 items 中的有效 ID）
- `scope` 字段必须是相对路径（如 `src/core`、`.`）

---

## v2 Items 依赖图

```
R-0001 (Graph Orchestrator) ─────┐
                                 │ mutex_with
R-0002 (Loop Auto-Eval)         │
      ↓ depends_on              ↓
R-0003 (AST Guard) ←──── mutex_with ────→ R-0005 (Meta-Spec Evolution)
                                      ↗ depends_on
R-0004 (Onboarding)               R-0002 + R-0003

R-0006 (Contract Standard) — 独立，无依赖
R-0007 (Model-Tier) — 独立，无依赖
```

**DAG 验证**：无环 ✓（R-0002 → R-0003；R-0005 → R-0002 + R-0003）

---

## 变更日志

| 日期 | 变更描述 | 影响范围 |
|------|----------|----------|
| 2026-08-29 | **新增 R-0008~R-0013 批次**（CLI-first 与 DSL 规范路线，来源 review/pipeline-cli-first-analysis-2026-08-29.md §二 D + nl-bytecode-gap-analysis P1/P2）：R-0008 next 编排命令、R-0009 skill↔CLI 一致性校验、R-0010 统一 DSL 语言规范 v1、R-0011 spec↔实现漂移清偿（depends R-0009）、R-0012 工作流薄封装、R-0013 JIT 加载与反向通道 | items/ +6 条目；spec.md 架构图同步 |
|------|---------|---------|
| 2026-08-09 | **v2 重设计**：归档 v1 完成的 R-0001~R-0005 至 archive/2026-Q3/；重编 R-0001~R-0007（原 R-0006~R-0012）；解决 R-0006 scope 被低估、R-0007↔R-0008 隐性耦合、R-0009 与现有 onboarding 重叠、互斥不对称等冲突；新增归档管理机制（ROADMAP-80/81） | 全部 Items 重写 + spec.md 版本升级 + BOUNDARY.md 更新 |
| 2026-08-08 | 新增 R-0012（已归档至 archive/2026-Q3/） | 历史记录 |
| 2026-08-06 | 新增 R-0006~R-0011（已归档至 archive/2026-Q3/） | 历史记录 |
| 2026-08-04 | v1 初始创建：三类冲突预防（已归档至 archive/2026-Q3/） | 历史记录 |
