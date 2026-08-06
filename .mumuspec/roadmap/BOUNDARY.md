# BOUNDARY: .mumuspec/roadmap/

> 本目录的边界声明 — 记录对外接口、依赖、数据契约、变更日志。

---

## 对外接口

| 接口 | 类型 | 说明 |
|------|------|------|
| `spec.md` | 规范文档 | Roadmap 规则定义 — 所有模块和工具必须遵守 |
| `template/item.md` | 模板文件 | Roadmap Item 的标准模板 |
| `items/*.md` | 目标条目 | 全局级近期目标条目集合 |

## 对外符号 / 类型

| 符号 | 说明 |
|------|------|
| Roadmap Item ID (`R-NNNN`) | 全局唯一标识符 |
| Roadmap Item Status | `planning` / `planned` / `active` / `blocked` / `completed` / `deprecated` |
| Roadmap Item Priority | `P0` / `P1` / `P2` |
| Roadmap Capacity Cost | 正整数，表示占用的容量预算单位 |

## 导出列表

| 导出 | 路径 | 说明 |
|------|------|------|
| 主规范 | `./spec.md` | Roadmap 规范定义 |
| 模板 | `./template/item.md` | Item 模板 |
| 目标条目 | `./items/*.md` | Global Roadmap Items |

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

### 跨模块引用格式

- `depends_on` / `mutex_with` 引用的 ID 必须是 `R-NNNN` 格式
- `scope` 字段必须是相对路径（如 `src/core`、`.`）

---

## 变更日志

| 日期 | 变更描述 | 影响范围 |
|------|---------|---------|
| 2026-08-06 | 扩展：新增 6 个调研驱动的 Item（R-0006~R-0011）覆盖 Graph/Loop/Guard/Onboarding/Meta-Spec/Contract | 新增文件，不修改已有 Item |
| 2026-08-04 | 初始创建：定义三类冲突预防（优先级 + 依赖 + 互斥），支持模块级注册 | 新目录，不影响现有规范 |
