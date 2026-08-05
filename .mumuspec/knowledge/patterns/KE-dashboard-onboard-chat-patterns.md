---
id: KE-dashboard-onboard-chat-patterns
title: Architecture patterns from dashboard-onboard-chat
type: pattern
status: confirmed
scope: dashboard-onboard-chat
created_at: 2026-08-02
tags:
  - auto-extracted
  - pattern
  - architecture
  - dashboard-onboard-chat
graph_bindings: []
---
> Auto-extracted from dashboard-onboard-chat/design.md

# Design — Dashboard + Onboard Chat

> **变更名**: dashboard-onboard-chat
> **工作流**: full / phase: design
> **产出阶段**: Design (Step 3 自顶向下分层设计)
> **参考**: proposal.md, cognitive-map.yaml, Understand-Anything dashboard 结构

---

## 1. 系统定位

在 `mumuspec/dashboard/` 新增一个独立运行的 React 18 + Vite 5 Web 应用，作为 spec / change / knowledge 的**可视化 + 对话入口**。
- **零耦合**: 不调用 mumuspec CLI、不读取 `.mumuspec/` 文件
- **全 mock**: 数据来自 `src/data/mock-*.ts`，形状对标真实 schema
- **纯组件化**: CSS Modules + hand-rolled，无 UI 组件库

---

## 2. 顶层架构 (Layout)

```
+--------------------------------------------------------------+
|  Toolbar (标题 + 视图切换占位 + 搜索)                          |
+------------+-------------------------------------------------+
|  SideNav   |  MainContent                                    |
|  (角色选择 |  +----------------------------+----------------+|
|   + 进度) |  |  StructureGraph            |  DetailPanel   ||
|            |  |  (React Flow canvas)       |  (节点详情 +   ||
|            |  |                            |   change 时间线)||
|            |  +----------------------------+----------------+|
|            +-------------------------------------------------+
|  OnboardChat (浮动对话气泡 / 抽屉 — 可收起)                    |
+--------------------------------------------------------------+
```

**Shell 组件**: `App.tsx` 编排 4 个区域，`zustand store` 共享选中节点 + chat 状态。

---

## 3. 分层设计 (L0 → L3)

### Level 0 — 项目根层 (dashboard/)

| 约束 | 类型 |
|------|------|
| Dashboard 应用 SHALL 作为独立子项目运行（`npm run dev --filter dashboard`） | SHALL |
| Dashboard SHALL 保持与 `mumuspec` CLI 的零依赖（package.json 独立） | SHALL |
| Dashboard 不 SHALL 调用或链接主 CLI 的任何源码 | SHALL NOT |
| Dashboard 不 SHALL 接入真实文件系统 / CLI / LLM | SHALL NOT (MVP) |
|  SHALL 使用 React Flow 进行结构图谱可视化 | SHALL |
|  SHALL 使用 Zustand 管理全局状态（选中节点 + chat 历史 + onboard 进度） | SHALL |
|  SHALL 使用 CSS Modules + CSS Variables（主题切换） | SHALL |
|  SHALL 使用 Vitest + Testing Library 测试 | SHALL |

### Level 1 — 模块层 (src/)

| 模块 | 职责 | 依赖 |
|------|------|------|
| `components/StructureGraph/` |