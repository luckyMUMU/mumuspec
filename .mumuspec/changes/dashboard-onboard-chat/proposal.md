# Proposal: MumuSpec Dashboard (Onboard Chat)

> **变更名**: dashboard-onboard-chat
> **工作流**: full
> **提案日期**: 2026-08-02

---

## 1. 需求背景

mumuspec 作为规范驱动的 AI 编程 CLI，当前所有信息（spec、change 状态、knowledge、contract）只能通过 CLI 文本输出或编辑器直接阅读 .mumuspec/ 目录文件，缺乏**可视化 + 交互式理解**入口。

参考对象 [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything)：把 codebase / knowledge-base 转成可交互知识图谱，并内嵌 Dashboard + Onboard Chat（对话式引导 / 问答）。

本变更目标：在 mumuspec 工作区内新增一个 **React + Vite Web Dashboard**，作为 spec/knowledge/change 的**可视化 + 对话入口**。MVP 阶段数据结构全量 **mock**，不引入 LLM / 后端 API。

---

## 2. 目标用户

| 角色 | 使用场景 |
|------|---------|
| 新加入团队成员 | 通过 Onboard Chat 对话式了解项目规范/目录/约束 |
| Tech Lead | 在 Dashboard 上鸟瞰 spec 结构图、知识条目、change 流水线 |
| 单人开发者 | 快速浏览 spec 拓扑，点选节点查看摘要 |

---

## 3. 范围 (Scope)

### 3.1 MVP 包含

1. **结构图可视化 (Structure Graph)**
   - 节点类型：SpecModule / Constraint / Change / Knowledge
   - 边：GOVERNED_BY / DEPENDS_ON / DERIVED_FROM
   - 布局：力导向 (force-directed)，支持平移/缩放/拖拽
   - 交互：点击节点展开详情面板（mock 摘要 + metadata）

2. **Onboard Chat**
   - 对话式引导：步骤式问卷 → 定位用户角色与兴趣域 → 生成引导路径
   - 消息类型：user / assistant / system-progress
   - 对话状态持久化：localStorage
   - 与结构图联动：对话提及某个节点时高亮/居中

3. **Q&A 视图**
   - 基于知识条目的简单检索式 QA（关键词匹配 + 评分，mock）
   - 命中后展示知识条目 + 图谱节点联动

### 3.2 MVP 不包含（显式排除）

- LLM / 真实后端 API 调用（Phase 2 扩展点）
- 用户认证 / 多用户协作
- 实时 WebSocket / 热更新
- 导出报告（PDF/图片）
- 移动端适配
- CI/CD 集成 / 部署流水线 (skill)

---

## 4. 技术栈决策

| 层次 | 选型 | 依据 |
|------|------|------|
| UI 框架 | React 18 + TypeScript | 用户请求；与 UA 参考实现一致 |
| 构建工具 | Vite 5 | React 生态主流，dev server 快 |
| 状态管理 | Zustand | 轻量，ponytail 阶梯 L6 满足 |
| 图谱渲染 | `@reactflow/react` (React Flow) | MIT、开箱即用，力导向布局社区方案成熟 |
| 样式 | CSS Modules + CSS Variables | 无 UI 库依赖，ponytail L5；主题切换靠 CSS vars |
| 图标 | 内联 SVG | 不引入额外依赖 |
| 路由 | 仅单页（无路由） | Dashboard 单页足够 |
| 测试 | Vitest + Testing Library | 复用工作区已有 vitest |

---

## 5. 目录结构（计划）

```
mumuspec/
├── dashboard/                       # 新增子项目
│   ├── package.json                 # 独立依赖管理（React / Vite / React Flow / Zustand / Vitest）
│   ├── tsconfig.json                # 延伸根 tsconfig
│   ├── vite.config.ts
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx                 # 入口
│   │   ├── App.tsx                  # 布局（Graph + Chat + Detail 三栏）
│   │   ├── App.module.css
│   │   ├── components/
│   │   │   ├── StructureGraph/      # 结构图（React Flow 封装）
│   │   │   ├── OnboardChat/         # 对话式引导
│   │   │   ├── QAView/              # 问答视图
│   │   │   ├── DetailPanel/         # 节点详情面板
│   │   │   └── Toolbar/             # 顶部工具条
│   │   ├── store/                   # Zustand store（mock 数据 + 选中状态 + chat 历史）
│   │   ├── hooks/                   # useOnboardFlow / useGraphLayout / useMockData
│   │   ├── data/
│   │   │   └── mock-graph.ts        # mock 图谱数据（nodes/edges）
│   │   │   └── mock-knowledge.ts    # mock 知识条目
│   │   │   └── mock-onboard-steps.ts # 引导步骤定义
│   │   ├── types/                   # GraphNode / ChatMessage / QARequest 等
│   │   └── utils/                   # 布局计算 / 评分 / id 生成
│   └── __tests__/                   # Vitest + Testing Library
```

---

## 6. 与现有规范的边界影响分析

| 契约 | 影响 | 处置 |
|------|------|------|
| 外部 CLI 接口 | 不影响 | Dashboard 仅消费 mock，不做 CLI 调用 |
| 对外 API | 不新增 | MVP 阶段无 HTTP API |
| .mumuspec/ schema | 不修改 | mock 数据按 schema 形状构造但独立于真实文件 |
| 工作流脚本 | 不修改 | 发布脚本不变，dashboard 通过独立命令启动（`npm run --filter dashboard dev`）|
| 包管理 | 在 pnpm workspace**之外**独立 | 推荐普通 npm（避免把 React 拉入 CLI 依赖） |

> **边界结论**：本变更在契约层 zero-impact，完全新砌子目录。

---

## 7. 工作量与拆分

| 阶段 | 内容 | 工作量估计 |
|------|------|-----------|
| Open (本次) | 需求确认 + 契约边界 | 已完成 |
| Design | 技术设计 + 测试用例 | ~1 天 |
| Build | 结构图 + Onboard Chat + Q&A + 详情面板 | ~3 天 |
| Verify | 测试 + 自审 | ~0.5 天 |
| Archive | 集成到 workspace | ~0.5 天 |

**建议拆分**：本变更作为**单一 full-workflow 变更**足够小。无需子任务拆分。

---

## 8. 验收标准 (DoD)

1. `npm install && npm run dev`（在 `dashboard/` 目录）能启动 Vite dev server
2. Dashboard 加载后渲染结构图，节点数 ≥ 6，边 ≥ 5（来自 mock）
3. 点击任意节点：右侧详情面板显示节点 metadata 与 mock 摘要
4. Onboard Chat 完成一轮引导 ≥ 3 步对话；结果持久化到 localStorage
5. Q&A 文本框输入关键词，命中知识条目后结构图联动高亮对应节点
6. 测试套件覆盖：纯函数（布局、评分）+ 交互 smoke test，≥ 15 个用例，全部 pass
7. `npm run build` 无 error
8. 不影响根项目现有 CLI 行为（`mumuspec --version` 等）

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| React Flow 与 Vite 5 兼容性 | 构建失败 | 锁定 @reactflow/react 最新版，lockfile 记录 |
| Mock 数据与真实 schema 差距 | 后续接入真实数据困难 | mock 类型按 `src/core/types.ts` 形状构造 |
| Dashboard 与 CLI 构建隔离不到位 | CLI bundle 膨胀 | 不把 dashboard 依赖加入 package.json；独立 package.json |
| 测试工具链配置不当 | vitest 跑不动 | 参考 demo/ 子项目 vitest 配置 |

---

## 10. 用户决策点（待确认）

1. ✅ 范围：完整 Dashboard（结构图 + Onboard Chat + Q&A）
2. ✅ 技术栈：React + Vite
3. ✅ 数据：Mock 数据源（无真实 LLM / API）
4. ⏳ 图谱可视化库：React Force Graph vs React Flow？（暂定 React Flow，MIT + 生态更成熟）
5. ⏳ 是否需要引入 UI 组件库（Radix / Antd / Mantine）？（暂定无，CSS Modules + hand-rolled）

---

## 11. 详细设计（在 Design 阶段产出）

- design.md：组件拆分、状态模型、事件流、测试映射
- cognitive-map.yaml：需求理解与已知未知
- test-cases/：测试用例 + suite-map

---

> **Groposal 状态**: 草稿，待用户审查确认 (BP-3)
